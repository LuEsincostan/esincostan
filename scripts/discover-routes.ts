/**
 * Route discovery algorithms: finds loops, climbs, and out-and-back routes
 * from a scored road graph.
 */

import type { GraphEdge, RoadGraph, AStarResult } from "./graph.js";
import { astar, greedyWalk, findClosestNode, edgesToCoords, haversineM } from "./graph.js";
import type { OsmNode } from "./overpass.js";

// --- Types ---

export interface DiscoveredRoute {
  id: string;
  name: string;
  description: string;
  type: "loop" | "point-to-point" | "out-and-back";
  coords: [number, number][];
  elevations: number[];
  lengthKm: number;
  elevationGainM: number;
  elevationLossM: number;
  maxDownhillPct: number;
  avgScore: number;
  surfaceBreakdown: Record<string, number>;
  start: { name: string; lat: number; lon: number };
  end: { name: string; lat: number; lon: number };
  transport?: { type: string; name: string; stopName: string };
  edges: GraphEdge[];
  path: number[];
}

// --- Simplify coordinates for output ---

function simplifyRoute(coords: [number, number][], elevations: number[], maxPoints: number): {
  coords: [number, number][]; elevations: number[];
} {
  if (coords.length <= maxPoints) return { coords, elevations };
  const step = (coords.length - 1) / (maxPoints - 1);
  const nc: [number, number][] = [];
  const ne: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(Math.round(i * step), coords.length - 1);
    nc.push([Math.round(coords[idx][0] * 1e5) / 1e5, Math.round(coords[idx][1] * 1e5) / 1e5]);
    ne.push(Math.round(elevations[idx]));
  }
  return { coords: nc, elevations: ne };
}

// --- Compute route stats from edges ---

function computeRouteStats(edges: GraphEdge[], path: number[]) {
  let totalLength = 0;
  let totalWeightedScore = 0;
  let elevGain = 0, elevLoss = 0;
  let maxDown = 0;
  const surfaceLengths: Record<string, number> = {};

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const isForward = edge.from === path[i];
    const score = isForward ? edge.forwardScore : edge.reverseScore;
    const down = isForward ? edge.forwardMaxDownhillPct : edge.reverseMaxDownhillPct;

    totalLength += edge.lengthM;
    totalWeightedScore += score * edge.lengthM;
    if (down > maxDown) maxDown = down;

    surfaceLengths[edge.surface] = (surfaceLengths[edge.surface] || 0) + edge.lengthM;

    // Elevation from coords
    const elevs = isForward ? edge.elevations : [...edge.elevations].reverse();
    for (let j = 0; j < elevs.length - 1; j++) {
      const d = elevs[j + 1] - elevs[j];
      if (d > 0) elevGain += d;
      else elevLoss += Math.abs(d);
    }
  }

  const surfaceBreakdown: Record<string, number> = {};
  for (const [surf, len] of Object.entries(surfaceLengths)) {
    surfaceBreakdown[surf] = Math.round((len / totalLength) * 100);
  }

  return {
    lengthKm: Math.round((totalLength / 1000) * 10) / 10,
    avgScore: totalLength > 0 ? Math.round((totalWeightedScore / totalLength) * 100) / 100 : 0,
    elevationGainM: Math.round(elevGain),
    elevationLossM: Math.round(elevLoss),
    maxDownhillPct: Math.round(maxDown * 10) / 10,
    surfaceBreakdown,
  };
}

// --- Corridor discovery (bidirectional routes) ---

/**
 * Discover "corridors" -- connected stretches of high-quality road that are
 * rollable in both directions. This is the primary route type for rollerski:
 * you skate out along the corridor and back the same way.
 *
 * Key constraint: every edge must have acceptable gradient in BOTH directions.
 */
export function discoverCorridors(
  graph: RoadGraph,
  seedNodes: number[],
  config = {
    targetLengths: [5000, 8000, 12000, 18000, 25000],
    bearings: [0, 45, 90, 135, 180, 225, 270, 315],
    minScore: 0.45,
    maxDownhillEitherDir: 8, // max downhill % in the steeper direction
    minLengthKm: 3,
  }
): DiscoveredRoute[] {
  console.log(`  Searching for corridors from ${seedNodes.length} seed points...`);
  const candidates: DiscoveredRoute[] = [];
  let attempts = 0;

  for (const seedId of seedNodes) {
    for (const targetLen of config.targetLengths) {
      for (const bearing of config.bearings) {
        attempts++;

        // Walk outward, only using edges safe in BOTH directions
        const corridor = bidirectionalWalk(
          graph, seedId, targetLen, bearing,
          config.minScore, config.maxDownhillEitherDir,
        );
        if (!corridor || corridor.length < config.minLengthKm * 1000) continue;

        const stats = computeRouteStats(corridor.edges, corridor.path);
        if (stats.avgScore < config.minScore) continue;

        const { coords, elevations } = edgesToCoords(corridor.edges, corridor.path);
        const simplified = simplifyRoute(coords, elevations, 300);

        const seedNode = graph.nodes.get(seedId)!;
        const endNode = graph.nodes.get(corridor.path[corridor.path.length - 1])!;

        candidates.push({
          id: `corridor-${candidates.length}`,
          name: "",
          description: "",
          type: "out-and-back",
          ...simplified,
          ...stats,
          // Total distance is 2x (out and back)
          lengthKm: Math.round(stats.lengthKm * 2 * 10) / 10,
          start: { name: "", lat: seedNode.lat, lon: seedNode.lon },
          end: { name: "", lat: endNode.lat, lon: endNode.lon },
          edges: corridor.edges,
          path: corridor.path,
        });
      }
    }
  }

  console.log(`    ${attempts} attempts, ${candidates.length} candidates found`);
  return candidates;
}

/**
 * Walk outward from a node, only following edges where the gradient is
 * acceptable in BOTH forward and reverse directions. This ensures the
 * route can be skated out and back.
 *
 * Prefers: cycleways, long edges (fewer crossings), low traffic.
 */
function bidirectionalWalk(
  graph: RoadGraph,
  startId: number,
  targetLengthM: number,
  bearingDeg: number,
  minEdgeScore: number,
  maxDownhillEitherDir: number,
): { path: number[]; edges: GraphEdge[]; length: number } | null {
  const visited = new Set<number>([startId]);
  const path = [startId];
  const edges: GraphEdge[] = [];
  let totalLength = 0;

  const bearingRad = (bearingDeg * Math.PI) / 180;

  while (totalLength < targetLengthM) {
    const currentId = path[path.length - 1];
    const currentNode = graph.nodes.get(currentId);
    if (!currentNode) break;

    const candidates = graph.adjacency.get(currentId) || [];
    let bestEdge: GraphEdge | null = null;
    let bestScore = -Infinity;

    for (const edge of candidates) {
      const isForward = edge.from === currentId;
      const neighborId = isForward ? edge.to : edge.from;
      if (visited.has(neighborId)) continue;

      // BOTH directions must be safe
      if (edge.forwardMaxDownhillPct > maxDownhillEitherDir) continue;
      if (edge.reverseMaxDownhillPct > maxDownhillEitherDir) continue;

      // Use the WORSE of the two directional scores (conservative)
      const score = Math.min(edge.forwardScore, edge.reverseScore);
      if (score < minEdgeScore) continue;

      const neighborNode = graph.nodes.get(neighborId);
      if (!neighborNode) continue;

      // Bearing alignment
      const edgeBearing = Math.atan2(
        neighborNode.lon - currentNode.lon,
        neighborNode.lat - currentNode.lat
      );
      const bearingDiff = Math.abs(edgeBearing - bearingRad);
      const bearingAlignment = Math.cos(bearingDiff);

      // Bonus for longer edges (fewer crossings per km)
      const lengthBonus = Math.min(edge.lengthM / 500, 0.3);

      // Combined: quality + direction + length bonus
      const combinedScore = score * 0.6 + bearingAlignment * 0.2 + lengthBonus * 0.2;

      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestEdge = edge;
      }
    }

    if (!bestEdge) break;

    const isForward = bestEdge.from === currentId;
    const nextId = isForward ? bestEdge.to : bestEdge.from;
    visited.add(nextId);
    path.push(nextId);
    edges.push(bestEdge);
    totalLength += bestEdge.lengthM;
  }

  if (path.length < 3) return null;
  return { path, edges, length: totalLength };
}

// --- Loop discovery (circular routes, still useful for lake loops) ---

export function discoverLoops(
  graph: RoadGraph,
  seedNodes: number[],
  config = {
    targetLengths: [12000, 18000, 25000, 35000],
    bearings: [0, 60, 120, 180, 240, 300],
    minScore: 0.45,
    maxDownhillPct: 10,
    minLengthKm: 8,
  }
): DiscoveredRoute[] {
  console.log(`  Searching for loops from ${seedNodes.length} seed points...`);
  const candidates: DiscoveredRoute[] = [];
  let attempts = 0;

  for (const seedId of seedNodes) {
    for (const targetLen of config.targetLengths) {
      for (const bearing of config.bearings) {
        attempts++;

        const outward = greedyWalk(
          graph, seedId, targetLen / 2, bearing, config.minScore, config.maxDownhillPct
        );
        if (!outward || outward.length < 3000) continue;

        const endNodeId = outward.path[outward.path.length - 1];
        const returnPath = astar(
          graph, endNodeId, seedId,
          targetLen * 1.5,
          config.maxDownhillPct,
        );
        if (!returnPath) continue;

        const allEdges = [...outward.edges, ...returnPath.edges];
        const allPath = [...outward.path, ...returnPath.path.slice(1)];
        const stats = computeRouteStats(allEdges, allPath);

        if (stats.avgScore < config.minScore) continue;
        if (stats.lengthKm < config.minLengthKm) continue;

        const { coords, elevations } = edgesToCoords(allEdges, allPath);
        const simplified = simplifyRoute(coords, elevations, 300);

        const seedNode = graph.nodes.get(seedId)!;
        candidates.push({
          id: `loop-${candidates.length}`,
          name: "",
          description: "",
          type: "loop",
          ...simplified,
          ...stats,
          start: { name: "", lat: seedNode.lat, lon: seedNode.lon },
          end: { name: "", lat: seedNode.lat, lon: seedNode.lon },
          edges: allEdges,
          path: allPath,
        });
      }
    }
  }

  console.log(`    ${attempts} attempts, ${candidates.length} candidates found`);
  return candidates;
}

// --- Climb discovery ---

export function discoverClimbs(
  graph: RoadGraph,
  gondolaStations: OsmNode[],
  config = {
    minElevGain: 300,
    maxLengthKm: 15,
    minScore: 0.4,
    maxDownhillPct: 8,
  }
): DiscoveredRoute[] {
  console.log(`  Searching for climbs to ${gondolaStations.length} stations...`);
  const candidates: DiscoveredRoute[] = [];

  for (const station of gondolaStations) {
    const stationNodeId = findClosestNode(graph, station.lat, station.lon);
    if (!stationNodeId) continue;
    const stationNode = graph.nodes.get(stationNodeId)!;

    // Find valley nodes that are significantly lower
    for (const [nodeId, node] of graph.nodes) {
      const elevDiff = stationNode.elevation - node.elevation;
      if (elevDiff < config.minElevGain) continue;
      const horizDist = haversineM([node.lat, node.lon], [stationNode.lat, stationNode.lon]);
      if (horizDist < 1500 || horizDist > 12000) continue;

      // A* from valley to station (uphill = good gradient score)
      const result = astar(graph, nodeId, stationNodeId, config.maxLengthKm * 1000, config.maxDownhillPct);
      if (!result) continue;

      const stats = computeRouteStats(result.edges, result.path);
      if (stats.avgScore < config.minScore) continue;
      if (stats.elevationGainM < config.minElevGain) continue;

      const { coords, elevations } = edgesToCoords(result.edges, result.path);
      const simplified = simplifyRoute(coords, elevations, 200);

      candidates.push({
        id: `climb-${candidates.length}`,
        name: "",
        description: "",
        type: "point-to-point",
        ...simplified,
        ...stats,
        start: { name: "", lat: node.lat, lon: node.lon },
        end: { name: "", lat: stationNode.lat, lon: stationNode.lon },
        transport: { type: "gondola", name: "", stopName: "" },
        edges: result.edges,
        path: result.path,
      });
    }
  }

  console.log(`    ${candidates.length} climb candidates found`);
  return candidates;
}

// (Out-and-back discovery is now handled by discoverCorridors above)

// --- Deduplication ---

function edgeSetOverlap(a: GraphEdge[], b: GraphEdge[]): number {
  const setA = new Set(a.map((e) => e.id));
  const setB = new Set(b.map((e) => e.id));
  let intersection = 0;
  for (const id of setA) {
    if (setB.has(id)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function deduplicateRoutes(routes: DiscoveredRoute[], maxOverlap = 0.5): DiscoveredRoute[] {
  // Sort by score descending
  routes.sort((a, b) => b.avgScore - a.avgScore);

  const kept: DiscoveredRoute[] = [];
  for (const route of routes) {
    let isDuplicate = false;
    for (const existing of kept) {
      if (edgeSetOverlap(route.edges, existing.edges) > maxOverlap) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) kept.push(route);
  }

  return kept;
}

// --- Auto-naming ---

export function autoNameRoutes(
  routes: DiscoveredRoute[],
  graph: RoadGraph,
  seeds: { trainStations: OsmNode[]; towns: OsmNode[] }
): void {
  for (const route of routes) {
    // Find nearest town to start
    let nearestTown = "";
    let nearestDist = Infinity;
    for (const town of seeds.towns) {
      const d = haversineM([town.lat, town.lon], [route.start.lat, route.start.lon]);
      if (d < nearestDist) { nearestDist = d; nearestTown = `Town(${town.id})`; }
    }
    // Also check train stations
    for (const stn of seeds.trainStations) {
      const d = haversineM([stn.lat, stn.lon], [route.start.lat, route.start.lon]);
      if (d < nearestDist) { nearestDist = d; nearestTown = `Station(${stn.id})`; }
    }

    // Collect road names along the route
    const roadNames = new Map<string, number>();
    for (const edge of route.edges) {
      if (edge.name) roadNames.set(edge.name, (roadNames.get(edge.name) || 0) + edge.lengthM);
    }
    const mainRoad = [...roadNames.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    // Set start/end names
    route.start.name = nearestTown;

    if (route.type === "loop") {
      route.name = mainRoad
        ? `${mainRoad} Runde (${route.lengthKm}km)`
        : `Route bei ${nearestTown} (${route.lengthKm}km)`;
      route.end.name = route.start.name;
    } else if (route.type === "point-to-point") {
      let endTown = nearestTown;
      let endDist = Infinity;
      for (const town of seeds.towns) {
        const d = haversineM([town.lat, town.lon], [route.end.lat, route.end.lon]);
        if (d < endDist) { endDist = d; endTown = `Town(${town.id})`; }
      }
      route.end.name = endTown;
      route.name = `${nearestTown} - ${endTown} Aufstieg`;
    } else {
      route.end.name = mainRoad || "Endpunkt";
      route.name = mainRoad
        ? `${nearestTown} - ${mainRoad}`
        : `${nearestTown} Strecke (${route.lengthKm}km)`;
    }

    route.description = generateDescription(route);
  }
}

function generateDescription(route: DiscoveredRoute): string {
  const parts: string[] = [];

  if (route.type === "loop") {
    parts.push(`${route.lengthKm}km loop route.`);
  } else if (route.type === "point-to-point") {
    parts.push(`${route.lengthKm}km climb with ${route.elevationGainM}m elevation gain.`);
  } else {
    parts.push(`${route.lengthKm}km out-and-back route (${Math.round(route.lengthKm / 2)}km each way).`);
  }

  const score = Math.round(route.avgScore * 100);
  if (score >= 80) parts.push("Excellent rollerski suitability.");
  else if (score >= 65) parts.push("Good rollerski suitability.");
  else parts.push("Moderate rollerski suitability.");

  if (route.maxDownhillPct > 6) {
    parts.push(`Caution: max ${route.maxDownhillPct}% downhill section.`);
  }

  if (route.transport) {
    parts.push(`Return by ${route.transport.type}.`);
  }

  return parts.join(" ");
}
