/**
 * Validate discovered routes against ground truth.
 * Checks geographic proximity and route type matching.
 */

import type { DiscoveredRoute } from "./discover-routes.js";
import type { GroundTruthRoute } from "./ground-truth.js";
import { haversineM } from "./graph.js";

export interface ValidationResult {
  groundTruthId: string;
  groundTruthName: string;
  matched: "MATCHED" | "PARTIAL" | "NOT_FOUND";
  bestMatchId: string | null;
  avgDistanceM: number;
  lengthDiffPct: number;
}

/**
 * For each ground truth route, find the best matching discovered route
 * based on geographic proximity of the reference coordinates.
 */
export function validateRoutes(
  discovered: DiscoveredRoute[],
  groundTruth: GroundTruthRoute[]
): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const gt of groundTruth) {
    let bestMatch: DiscoveredRoute | null = null;
    let bestAvgDist = Infinity;

    for (const route of discovered) {
      if (route.type !== gt.type) continue;

      // Compute average distance from ground truth points to nearest route point
      let totalDist = 0;
      for (const gtCoord of gt.coords) {
        let minDist = Infinity;
        for (const rCoord of route.coords) {
          const d = haversineM(gtCoord, rCoord);
          if (d < minDist) minDist = d;
        }
        totalDist += minDist;
      }
      const avgDist = totalDist / gt.coords.length;

      if (avgDist < bestAvgDist) {
        bestAvgDist = avgDist;
        bestMatch = route;
      }
    }

    const lengthDiff = bestMatch
      ? Math.abs(bestMatch.lengthKm - gt.lengthKm) / gt.lengthKm
      : 1;

    let status: "MATCHED" | "PARTIAL" | "NOT_FOUND";
    if (bestMatch && bestAvgDist < 500 && lengthDiff < 0.4) {
      status = "MATCHED";
    } else if (bestMatch && bestAvgDist < 1500) {
      status = "PARTIAL";
    } else {
      status = "NOT_FOUND";
    }

    results.push({
      groundTruthId: gt.id,
      groundTruthName: gt.name,
      matched: status,
      bestMatchId: bestMatch?.id ?? null,
      avgDistanceM: Math.round(bestAvgDist),
      lengthDiffPct: Math.round(lengthDiff * 100),
    });
  }

  return results;
}

export function printValidationReport(results: ValidationResult[]): void {
  console.log("\n=== Route Discovery Validation ===");
  const pad = (s: string, n: number) => s.padEnd(n);

  for (const r of results) {
    const status = r.matched === "MATCHED" ? "✓ MATCHED"
      : r.matched === "PARTIAL" ? "~ PARTIAL"
      : "✗ NOT FOUND";

    const details = r.bestMatchId
      ? `(${r.bestMatchId}, avg ${r.avgDistanceM}m, len diff ${r.lengthDiffPct}%)`
      : "";

    console.log(`  ${pad(r.groundTruthName, 35)} ${status} ${details}`);
  }

  const matched = results.filter((r) => r.matched === "MATCHED").length;
  const partial = results.filter((r) => r.matched === "PARTIAL").length;
  console.log(`\n  Score: ${matched}/${results.length} matched, ${partial} partial\n`);
}
