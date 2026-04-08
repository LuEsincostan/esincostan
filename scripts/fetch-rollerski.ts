/**
 * Rollerski Route Discovery Pipeline
 *
 * Primary approach: use SchweizMobil route infrastructure (skating + cycling paths)
 * from OSM as the backbone, score them for rollerski suitability.
 *
 * 1. Download SRTM elevation tiles
 * 2. Fetch SchweizMobil route relations from OSM (skating + cycling)
 * 3. Parse and assemble route geometries with elevation
 * 4. Score each route for rollerski suitability
 * 5. Validate against ground truth
 * 6. Write output
 */

import { writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ensureSrtmTiles } from "./srtm.js";
import { fetchRouteRelations, parseRouteRelations, scoreRoute, splitAtSteepSections } from "./route-relations.js";
import type { ScoredRoute } from "./route-relations.js";
import { loadGroundTruth } from "./ground-truth.js";
import { validateRoutes, printValidationReport } from "./validate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dirname, "..", "data", "osm-routes-raw.json");

async function main() {
  console.log("=== Rollerski Route Discovery Pipeline ===\n");

  // --- Step 1: Ensure SRTM elevation data ---
  console.log("Step 1: Elevation data");
  await ensureSrtmTiles(["N46E008", "N47E008", "N47E009"]);

  // --- Step 2: Fetch SchweizMobil route relations ---
  console.log("\nStep 2: Fetch SchweizMobil routes from OSM");
  if (!existsSync(CACHE_PATH)) {
    try {
      await fetchRouteRelations(46.8, 8.0, 47.6, 9.5);
    } catch (err) {
      console.error(`  Failed to fetch routes: ${err}`);
      console.log("  Use cached data if available, or retry later.");
      if (!existsSync(CACHE_PATH)) process.exit(1);
    }
  } else {
    console.log("  Using cached route relations data");
  }

  // --- Step 3: Parse route relations ---
  console.log("\nStep 3: Parse and assemble routes");
  const parsedRoutes = parseRouteRelations();
  console.log(`  Parsed ${parsedRoutes.length} routes`);

  for (const r of parsedRoutes) {
    const typeIcon = r.routeType === "inline_skates" ? "⛸ " : "🚲";
    console.log(`    ${typeIcon} #${r.ref.padEnd(4)} ${r.name.slice(0, 55).padEnd(55)} ${(r.lengthM / 1000).toFixed(1)}km  ${r.coords.length} pts`);
  }

  // --- Step 4: Split at steep sections and score ---
  console.log("\nStep 4: Split steep sections and score for rollerski");

  // First, split routes at sections too steep for rollerski
  const safeSegments = [];
  for (const route of parsedRoutes) {
    const segments = splitAtSteepSections(route, 8, 2000);
    safeSegments.push(...segments);
  }
  console.log(`  Split ${parsedRoutes.length} routes into ${safeSegments.length} safe segments`);

  const scoredRoutes: ScoredRoute[] = [];
  for (const route of safeSegments) {
    const scored = scoreRoute(route);

    // Filter: skip very short routes and those with terrible scores
    if (scored.lengthKm < 2) continue;
    if (scored.avgScore < 0.3) continue;

    scoredRoutes.push(scored);
  }

  // Sort by score descending
  scoredRoutes.sort((a, b) => b.avgScore - a.avgScore);

  console.log(`  ${scoredRoutes.length} routes scored and filtered`);
  console.log();
  for (const r of scoredRoutes) {
    const bidir = r.bidirectional ? "↔" : "→";
    console.log(`    ${r.avgScore.toFixed(2)} ${bidir} ${r.type.padEnd(14)} ${r.lengthKm.toString().padStart(5)}km  +${String(r.elevationGainM).padStart(4)}m  ${r.name.slice(0, 50)}`);
  }

  // --- Step 5: Validate ---
  console.log("\nStep 5: Validate against ground truth");
  const groundTruth = loadGroundTruth();
  // Adapt scored routes for validation (match the DiscoveredRoute interface)
  const forValidation = scoredRoutes.map((r) => ({
    ...r,
    edges: [] as any[],
    path: [] as number[],
  }));
  const validationResults = validateRoutes(forValidation, groundTruth);
  printValidationReport(validationResults);

  // --- Step 6: Write output ---
  console.log("Step 6: Write output");
  const outputRoutes = scoredRoutes.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    type: r.type,
    source: r.source,
    coords: r.coords,
    elevations: r.elevations,
    lengthKm: r.lengthKm,
    elevationGainM: r.elevationGainM,
    elevationLossM: r.elevationLossM,
    maxDownhillPct: r.maxDownhillPct,
    avgScore: r.avgScore,
    bidirectional: r.bidirectional,
    surfaceBreakdown: r.surfaceBreakdown,
    start: r.start,
    end: r.end,
  }));

  const routesPath = join(__dirname, "..", "src", "data", "rollerski-routes.json");
  writeFileSync(routesPath, JSON.stringify(outputRoutes, null, 2));
  console.log(`  Wrote ${outputRoutes.length} routes to rollerski-routes.json`);

  const skateCount = scoredRoutes.filter((r) => r.source === "Skatingland Schweiz").length;
  const veloCount = scoredRoutes.filter((r) => r.source === "Veloland Schweiz").length;
  console.log(`\n=== Pipeline Complete ===`);
  console.log(`  Skating routes: ${skateCount}`);
  console.log(`  Cycling routes: ${veloCount}`);
  console.log(`  Total: ${scoredRoutes.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
