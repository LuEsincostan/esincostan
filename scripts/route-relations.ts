/**
 * Parse OSM route relations (SchweizMobil skating + cycling routes)
 * and assemble them into scored rollerski route candidates.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getElevation } from "./srtm.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(__dirname, "..", "data", "osm-routes-raw.json");

// --- Types ---

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
  members?: { type: string; ref: number; role: string }[];
}

export interface ParsedRoute {
  relationId: number;
  name: string;
  ref: string;
  routeType: "inline_skates" | "bicycle";
  network: string; // national, regional, local
  operator: string;
  coords: [number, number][];
  elevations: number[];
  wayIds: number[];
  lengthM: number;
}

// --- Haversine ---

function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// --- Fetch route relations from Overpass ---

export async function fetchRouteRelations(
  south: number, west: number, north: number, east: number
): Promise<void> {
  console.log("  Fetching SchweizMobil route relations from OSM...");
  const query = `[out:json][timeout:90];(relation["route"="inline_skates"](${south},${west},${north},${east});relation["route"="bicycle"]["network"~"ncn|rcn|lcn"]["operator"~"Veloland"](${south},${west},${north},${east}););(._;>;);out body;`;

  const resp = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!resp.ok) {
    throw new Error(`Overpass failed: ${resp.status}`);
  }

  const data = await resp.json();
  const { mkdirSync, writeFileSync } = await import("fs");
  mkdirSync(join(__dirname, "..", "data"), { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(data));

  const rels = data.elements.filter((e: OsmElement) => e.type === "relation");
  console.log(`  Saved ${rels.length} route relations to cache`);
}

// --- Parse cached route data ---

export function parseRouteRelations(): ParsedRoute[] {
  if (!existsSync(CACHE_PATH)) {
    throw new Error("Route relations cache not found. Run fetchRouteRelations first.");
  }

  const raw = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
  const elements: OsmElement[] = raw.elements;

  // Index nodes and ways
  const nodeMap = new Map<number, { lat: number; lon: number }>();
  const wayMap = new Map<number, { nodes: number[]; tags: Record<string, string> }>();
  const relations: OsmElement[] = [];

  for (const el of elements) {
    if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
      nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
    } else if (el.type === "way" && el.nodes) {
      wayMap.set(el.id, { nodes: el.nodes, tags: el.tags || {} });
    } else if (el.type === "relation") {
      relations.push(el);
    }
  }

  console.log(`  Parsing ${relations.length} relations (${wayMap.size} ways, ${nodeMap.size} nodes)`);

  const routes: ParsedRoute[] = [];

  for (const rel of relations) {
    const tags = rel.tags || {};
    const routeType = tags.route as "inline_skates" | "bicycle";
    if (!routeType) continue;

    const name = tags.name || `${routeType} #${tags.ref || "?"}`;
    const members = rel.members || [];
    const wayRefs = members.filter((m) => m.type === "way").map((m) => m.ref);

    if (wayRefs.length === 0) continue;

    // Assemble ways into an ordered path
    const assembled = assembleWays(wayRefs, wayMap, nodeMap);
    if (!assembled || assembled.coords.length < 10) continue;

    // Add SRTM elevation
    const elevations = assembled.coords.map(
      ([lat, lon]) => getElevation(lat, lon) ?? 0
    );

    // Compute length
    let lengthM = 0;
    for (let i = 0; i < assembled.coords.length - 1; i++) {
      lengthM += haversineM(assembled.coords[i], assembled.coords[i + 1]);
    }

    routes.push({
      relationId: rel.id,
      name,
      ref: tags.ref || "",
      routeType,
      network: tags.network || "",
      operator: tags.operator || "",
      coords: assembled.coords,
      elevations,
      wayIds: assembled.wayIds,
      lengthM,
    });
  }

  // Sort: skating routes first, then by length descending
  routes.sort((a, b) => {
    if (a.routeType !== b.routeType) return a.routeType === "inline_skates" ? -1 : 1;
    return b.lengthM - a.lengthM;
  });

  return routes;
}

// --- Assemble ordered way sequence ---

function assembleWays(
  wayRefs: number[],
  wayMap: Map<number, { nodes: number[]; tags: Record<string, string> }>,
  nodeMap: Map<number, { lat: number; lon: number }>
): { coords: [number, number][]; wayIds: number[] } | null {
  // Build adjacency from way endpoints
  // Each way connects its first node to its last node
  const wayData = wayRefs
    .map((id) => {
      const w = wayMap.get(id);
      if (!w || w.nodes.length < 2) return null;
      return { id, nodes: w.nodes };
    })
    .filter(Boolean) as { id: number; nodes: number[] }[];

  if (wayData.length === 0) return null;

  // Greedy assembly: start with first way, then connect closest endpoints
  const usedIds = new Set<number>();
  const orderedWays: { id: number; nodes: number[]; reversed: boolean }[] = [];

  // Start with the first way
  const first = wayData[0];
  orderedWays.push({ id: first.id, nodes: first.nodes, reversed: false });
  usedIds.add(first.id);

  // Keep extending from the last endpoint
  for (let iter = 0; iter < wayData.length * 2; iter++) {
    const last = orderedWays[orderedWays.length - 1];
    const lastNodeId = last.reversed
      ? last.nodes[0]
      : last.nodes[last.nodes.length - 1];

    let bestWay: (typeof wayData)[0] | null = null;
    let bestReversed = false;
    let bestDist = 50; // max gap of 50m between consecutive ways

    for (const w of wayData) {
      if (usedIds.has(w.id)) continue;
      const firstNode = nodeMap.get(w.nodes[0]);
      const lastNode = nodeMap.get(w.nodes[w.nodes.length - 1]);
      const endNode = nodeMap.get(lastNodeId);
      if (!endNode) continue;

      if (firstNode) {
        const d = haversineM([endNode.lat, endNode.lon], [firstNode.lat, firstNode.lon]);
        if (d < bestDist) { bestDist = d; bestWay = w; bestReversed = false; }
      }
      if (lastNode) {
        const d = haversineM([endNode.lat, endNode.lon], [lastNode.lat, lastNode.lon]);
        if (d < bestDist) { bestDist = d; bestWay = w; bestReversed = true; }
      }
    }

    if (!bestWay) break;
    orderedWays.push({ id: bestWay.id, nodes: bestWay.nodes, reversed: bestReversed });
    usedIds.add(bestWay.id);
  }

  // Convert to coordinates
  const coords: [number, number][] = [];
  const wayIds: number[] = [];

  for (const w of orderedWays) {
    const nodeIds = w.reversed ? [...w.nodes].reverse() : w.nodes;
    wayIds.push(w.id);

    for (const nid of nodeIds) {
      const node = nodeMap.get(nid);
      if (!node) continue;
      // Skip duplicate consecutive points
      if (coords.length > 0) {
        const prev = coords[coords.length - 1];
        if (Math.abs(prev[0] - node.lat) < 1e-7 && Math.abs(prev[1] - node.lon) < 1e-7) continue;
      }
      coords.push([
        Math.round(node.lat * 1e6) / 1e6,
        Math.round(node.lon * 1e6) / 1e6,
      ]);
    }
  }

  return { coords, wayIds };
}

// --- Split routes at steep sections ---

/**
 * Rollerski can't brake. Split a route at any section where the gradient
 * exceeds the safe threshold in EITHER direction, since routes should
 * be rollable both ways. Returns safe segments as separate routes.
 *
 * Uses a sliding window to compute gradient over ~100m stretches
 * (avoids SRTM noise from single-point gradients).
 */
export function splitAtSteepSections(
  route: ParsedRoute,
  maxGradientPct = 8, // max gradient in either direction
  minSegmentLengthM = 2000, // minimum usable segment length
): ParsedRoute[] {
  const { coords, elevations } = route;
  if (coords.length < 10) return [route];

  // Compute gradient over ~100m windows to smooth SRTM noise
  const windowM = 100;
  const gradients: number[] = []; // one per coord point
  for (let i = 0; i < coords.length; i++) {
    // Look ahead to find a point ~windowM away
    let j = i + 1;
    let dist = 0;
    while (j < coords.length && dist < windowM) {
      dist += haversineM(coords[j - 1], coords[j]);
      j++;
    }
    if (dist < 10 || j > coords.length) {
      gradients.push(0);
      continue;
    }
    const dElev = elevations[j - 1] - elevations[i];
    const gradPct = Math.abs((dElev / dist) * 100);
    gradients.push(gradPct);
  }

  // Find safe segments: consecutive stretches where gradient < threshold
  const segments: ParsedRoute[] = [];
  let segStart = 0;
  let inSteep = gradients[0] > maxGradientPct;

  for (let i = 1; i < coords.length; i++) {
    const steep = gradients[i] > maxGradientPct;
    if (steep && !inSteep) {
      // Entering steep section -- save the safe segment so far
      if (i - segStart >= 10) {
        const seg = extractSegment(route, segStart, i, segments.length);
        if (seg && seg.lengthM >= minSegmentLengthM) segments.push(seg);
      }
      inSteep = true;
    } else if (!steep && inSteep) {
      // Leaving steep section -- start new safe segment
      segStart = i;
      inSteep = false;
    }
  }

  // Final segment
  if (!inSteep && coords.length - segStart >= 10) {
    const seg = extractSegment(route, segStart, coords.length, segments.length);
    if (seg && seg.lengthM >= minSegmentLengthM) segments.push(seg);
  }

  // If no splitting happened (whole route is safe), return original
  if (segments.length === 0 && !gradients.some((g) => g > maxGradientPct)) {
    return [route];
  }

  return segments;
}

function extractSegment(
  route: ParsedRoute, startIdx: number, endIdx: number, segNum: number
): ParsedRoute | null {
  const coords = route.coords.slice(startIdx, endIdx);
  const elevations = route.elevations.slice(startIdx, endIdx);
  if (coords.length < 5) return null;

  let lengthM = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    lengthM += haversineM(coords[i], coords[i + 1]);
  }

  const suffix = segNum > 0 ? ` (Abschnitt ${segNum + 1})` : "";
  return {
    ...route,
    name: route.name + suffix,
    coords,
    elevations,
    wayIds: route.wayIds, // keep original for reference
    lengthM,
  };
}

// --- Score a parsed route for rollerski suitability ---

export interface ScoredRoute {
  id: string;
  name: string;
  description: string;
  type: "loop" | "point-to-point" | "out-and-back";
  source: string; // "skating" or "cycling"
  coords: [number, number][];
  elevations: number[];
  lengthKm: number;
  elevationGainM: number;
  elevationLossM: number;
  maxDownhillPct: number;
  avgScore: number;
  bidirectional: boolean; // safe to skate both ways?
  surfaceBreakdown: Record<string, number>;
  start: { name: string; lat: number; lon: number };
  end: { name: string; lat: number; lon: number };
}

function gradientSubScore(gradPct: number): number {
  if (gradPct >= -1) return 1.0;
  if (gradPct >= -3) return 0.8;
  if (gradPct >= -6) return 0.4;
  if (gradPct >= -10) return 0.1;
  return 0.0;
}

export function scoreRoute(route: ParsedRoute, wayMap?: Map<number, Record<string, string>>): ScoredRoute {
  const coords = route.coords;
  const elevations = route.elevations;

  // Compute elevation stats using smoothed gradients (~100m windows)
  // to avoid SRTM noise from point-to-point calculations
  let gain = 0, loss = 0, maxDownhill = 0;
  let fwdWeightedGrad = 0, revWeightedGrad = 0, totalDist = 0;
  const windowM = 80;

  for (let i = 0; i < coords.length - 1; i++) {
    const dist = haversineM(coords[i], coords[i + 1]);
    if (dist < 1) continue;
    totalDist += dist;

    // Find point ~windowM ahead for smoothed gradient
    let j = i + 1;
    let lookAheadDist = dist;
    while (j < coords.length - 1 && lookAheadDist < windowM) {
      lookAheadDist += haversineM(coords[j], coords[j + 1]);
      j++;
    }
    const dElev = elevations[Math.min(j, coords.length - 1)] - elevations[i];
    const gradPct = lookAheadDist > 5
      ? Math.max(-30, Math.min(30, (dElev / lookAheadDist) * 100))
      : 0;

    if (dElev > 0) gain += dElev;
    else loss += Math.abs(dElev);
    if (Math.abs(gradPct) > maxDownhill) maxDownhill = Math.abs(gradPct);

    fwdWeightedGrad += gradientSubScore(gradPct) * dist;
    revWeightedGrad += gradientSubScore(-gradPct) * dist;
  }

  const fwdGradScore = totalDist > 0 ? fwdWeightedGrad / totalDist : 1.0;
  const revGradScore = totalDist > 0 ? revWeightedGrad / totalDist : 1.0;

  // Skating routes get higher base scores (they're curated for this purpose)
  const isSkating = route.routeType === "inline_skates";
  const surfaceScore = isSkating ? 0.95 : 0.8;
  const trafficScore = isSkating ? 0.85 : 0.65;
  const cyclewayScore = isSkating ? 0.9 : 0.7;

  const bestGradScore = Math.max(fwdGradScore, revGradScore);
  const avgScore = 0.2 * surfaceScore + 0.3 * bestGradScore + 0.3 * trafficScore + 0.2 * cyclewayScore;

  // Check if bidirectional (safe both ways)
  const worstGradScore = Math.min(fwdGradScore, revGradScore);
  const bidirectional = worstGradScore >= 0.5; // at least "moderate" in both directions

  // Determine route type
  const startEnd = haversineM(coords[0], coords[coords.length - 1]);
  const isLoop = startEnd < 500; // start and end within 500m
  const type: "loop" | "point-to-point" | "out-and-back" = isLoop
    ? "loop"
    : bidirectional
      ? "out-and-back"
      : "point-to-point";

  // Simplify coordinates for output
  const maxPts = 300;
  let outCoords = coords;
  let outElevs = elevations;
  if (coords.length > maxPts) {
    const step = (coords.length - 1) / (maxPts - 1);
    outCoords = [];
    outElevs = [];
    for (let i = 0; i < maxPts; i++) {
      const idx = Math.min(Math.round(i * step), coords.length - 1);
      outCoords.push([
        Math.round(coords[idx][0] * 1e5) / 1e5,
        Math.round(coords[idx][1] * 1e5) / 1e5,
      ]);
      outElevs.push(Math.round(elevations[idx]));
    }
  }

  const source = isSkating ? "Skatingland Schweiz" : "Veloland Schweiz";

  return {
    id: `${isSkating ? "skate" : "velo"}-${route.ref || route.relationId}`,
    name: route.name,
    description: generateRouteDescription(route, type, bidirectional, gain, maxDownhill),
    type,
    source,
    coords: outCoords as [number, number][],
    elevations: outElevs,
    lengthKm: Math.round((totalDist / 1000) * 10) / 10,
    elevationGainM: Math.round(gain),
    elevationLossM: Math.round(loss),
    maxDownhillPct: Math.round(maxDownhill * 10) / 10,
    avgScore: Math.round(avgScore * 100) / 100,
    bidirectional,
    surfaceBreakdown: { asphalt: 90, paved: 10 },
    start: { name: route.name.split("(")[1]?.split("-")[0]?.trim() || "", lat: coords[0][0], lon: coords[0][1] },
    end: { name: route.name.split("-")[1]?.split(")")[0]?.trim() || "", lat: coords[coords.length - 1][0], lon: coords[coords.length - 1][1] },
  };
}

function generateRouteDescription(
  route: ParsedRoute, type: string, bidirectional: boolean, gain: number, maxDown: number
): string {
  const parts: string[] = [];
  const src = route.routeType === "inline_skates" ? "Skatingland" : "Veloland";
  parts.push(`${src} Schweiz route #${route.ref}.`);

  if (type === "loop") parts.push("Loop route.");
  else if (bidirectional) parts.push("Rollable in both directions.");
  else parts.push("Best in one direction.");

  if (gain > 200) parts.push(`${Math.round(gain)}m total climbing.`);
  if (maxDown > 6) parts.push(`Caution: up to ${Math.round(maxDown)}% downhill sections.`);

  return parts.join(" ");
}
