/**
 * Road graph construction, scoring, and A* pathfinding for rollerski route discovery.
 */

import type { OsmNode, OsmWay } from "./overpass.js";
import { getElevation } from "./srtm.js";

// --- Types ---

export interface GraphNode {
  id: number;
  lat: number;
  lon: number;
  elevation: number;
}

export interface GraphEdge {
  id: string; // "wayId-fromNode-toNode"
  wayId: number;
  from: number;
  to: number;
  lengthM: number;
  coords: [number, number][]; // full coordinate path [lat, lon]
  elevations: number[];
  // Scores
  surfaceScore: number;
  trafficScore: number;
  cyclewayScore: number;
  forwardGradientScore: number;
  reverseGradientScore: number;
  forwardMaxDownhillPct: number;
  reverseMaxDownhillPct: number;
  forwardScore: number;
  reverseScore: number;
  // Metadata
  surface: string;
  highway: string;
  name: string | null;
}

export interface RoadGraph {
  nodes: Map<number, GraphNode>;
  adjacency: Map<number, GraphEdge[]>; // nodeId -> edges leaving this node
  edgeCount: number;
}

// --- Haversine ---

export function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// --- Scoring (mirrors client-side scoring.ts) ---

const SURFACE_SCORES: Record<string, number> = {
  asphalt: 1.0, paved: 0.8, concrete: 0.7, paving_stones: 0.5,
  compacted: 0.3, fine_gravel: 0.1, gravel: 0.1, unpaved: 0.0,
};

const LIKELY_ASPHALT = new Set(["primary", "secondary", "tertiary", "residential"]);

const HIGHWAY_SCORES: Record<string, number> = {
  cycleway: 1.0, living_street: 0.9, residential: 0.7,
  unclassified: 0.6, tertiary: 0.4, secondary: 0.15, primary: 0.05, track: 0.4,
  service: 0.3, // parking lots, driveways -- mostly useless
};

const CYCLEWAY_SCORES: Record<string, number> = {
  separate: 1.0, track: 0.9, lane: 0.6, shared_lane: 0.3, none: 0.0,
};

function scoreSurface(tags: Record<string, string>): number {
  const surface = tags.surface;
  if (!surface && LIKELY_ASPHALT.has(tags.highway)) return 0.7;
  return SURFACE_SCORES[surface] ?? 0.5;
}

function scoreTraffic(tags: Record<string, string>): number {
  let score = HIGHWAY_SCORES[tags.highway] ?? 0.5;
  const maxspeed = tags.maxspeed ? parseInt(tags.maxspeed, 10) : null;
  if (maxspeed !== null && !isNaN(maxspeed)) {
    if (maxspeed <= 30) score += 0.1;
    else if (maxspeed >= 100) score -= 0.2;
    else if (maxspeed >= 80) score -= 0.1;
  }
  return Math.max(0, Math.min(1, score));
}

function scoreCycleway(tags: Record<string, string>): number {
  if (tags.highway === "cycleway") return 1.0;
  const cw = tags.cycleway || tags["cycleway:right"] || tags["cycleway:left"] || tags["cycleway:both"];
  return CYCLEWAY_SCORES[cw] ?? 0.0;
}

function gradientSubScore(gradPct: number): number {
  if (gradPct >= -1) return 1.0;
  if (gradPct >= -3) return 0.8;
  if (gradPct >= -6) return 0.4;
  if (gradPct >= -10) return 0.1;
  return 0.0;
}

function scoreGradientDir(
  coords: [number, number][],
  elevations: number[]
): { score: number; maxDownhillPct: number } {
  let totalDist = 0, weightedScore = 0, maxDownhill = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const dist = haversineM(coords[i], coords[i + 1]);
    if (dist < 1) continue;
    const dElev = elevations[i + 1] - elevations[i];
    const gradPct = Math.max(-30, Math.min(30, (dElev / dist) * 100));
    if (-gradPct > maxDownhill) maxDownhill = -gradPct;
    weightedScore += gradientSubScore(gradPct) * dist;
    totalDist += dist;
  }
  return {
    score: totalDist > 0 ? weightedScore / totalDist : 1.0,
    maxDownhillPct: Math.round(maxDownhill * 10) / 10,
  };
}

function computeOverallScore(surface: number, gradient: number, traffic: number, cycleway: number): number {
  // Traffic and cycleway weighted higher to strongly prefer quiet roads and bike paths
  return 0.2 * surface + 0.3 * gradient + 0.3 * traffic + 0.2 * cycleway;
}

// --- Graph construction ---

/**
 * Build a road graph from OSM ways and nodes.
 * Splits ways at intersections for correct graph topology.
 */
export function buildGraph(
  osmNodes: Map<number, OsmNode>,
  osmWays: OsmWay[]
): RoadGraph {
  // Exclude primary roads (too much traffic) and service roads (driveways/parking)
  const VALID_HIGHWAYS = new Set([
    "cycleway", "living_street", "residential", "unclassified",
    "tertiary", "secondary",
  ]);

  // Filter to valid highway types
  const ways = osmWays.filter((w) => VALID_HIGHWAYS.has(w.tags.highway));

  // Step 1: Find junction nodes (referenced by 2+ ways, or way endpoints)
  const nodeRefCount = new Map<number, number>();
  for (const way of ways) {
    for (const nid of way.nodes) {
      nodeRefCount.set(nid, (nodeRefCount.get(nid) || 0) + 1);
    }
    // Way endpoints are always junctions
    if (way.nodes.length >= 2) {
      nodeRefCount.set(way.nodes[0], (nodeRefCount.get(way.nodes[0]) || 0) + 10);
      nodeRefCount.set(way.nodes[way.nodes.length - 1],
        (nodeRefCount.get(way.nodes[way.nodes.length - 1]) || 0) + 10);
    }
  }

  const junctions = new Set<number>();
  for (const [nid, count] of nodeRefCount) {
    if (count >= 2) junctions.add(nid);
  }

  // Step 2: Build graph nodes with elevation
  const graphNodes = new Map<number, GraphNode>();
  for (const nid of junctions) {
    const osm = osmNodes.get(nid);
    if (!osm) continue;
    const elev = getElevation(osm.lat, osm.lon) ?? 0;
    graphNodes.set(nid, { id: nid, lat: osm.lat, lon: osm.lon, elevation: elev });
  }

  // Step 3: Split ways at junctions into edges
  const adjacency = new Map<number, GraphEdge[]>();
  let edgeCount = 0;

  for (const way of ways) {
    // Walk through way nodes, split at each junction
    let segStart = 0;
    for (let i = 1; i < way.nodes.length; i++) {
      const nid = way.nodes[i];
      if (!junctions.has(nid) && i < way.nodes.length - 1) continue;

      // Create edge from way.nodes[segStart] to way.nodes[i]
      const fromId = way.nodes[segStart];
      const toId = nid;
      if (fromId === toId) { segStart = i; continue; }
      if (!graphNodes.has(fromId) || !graphNodes.has(toId)) { segStart = i; continue; }

      // Build coordinate path and compute length
      const coords: [number, number][] = [];
      const elevations: number[] = [];
      let lengthM = 0;

      for (let j = segStart; j <= i; j++) {
        const n = osmNodes.get(way.nodes[j]);
        if (!n) continue;
        const coord: [number, number] = [n.lat, n.lon];
        const elev = getElevation(n.lat, n.lon) ?? 0;
        if (coords.length > 0) {
          lengthM += haversineM(coords[coords.length - 1], coord);
        }
        coords.push(coord);
        elevations.push(elev);
      }

      if (coords.length < 2 || lengthM < 1) { segStart = i; continue; }

      // Score the edge
      const surfScore = scoreSurface(way.tags);
      const traffScore = scoreTraffic(way.tags);
      const cycScore = scoreCycleway(way.tags);
      const fwd = scoreGradientDir(coords, elevations);
      const rev = scoreGradientDir([...coords].reverse(), [...elevations].reverse());

      const edge: GraphEdge = {
        id: `${way.id}-${fromId}-${toId}`,
        wayId: way.id,
        from: fromId,
        to: toId,
        lengthM,
        coords,
        elevations,
        surfaceScore: surfScore,
        trafficScore: traffScore,
        cyclewayScore: cycScore,
        forwardGradientScore: fwd.score,
        reverseGradientScore: rev.score,
        forwardMaxDownhillPct: fwd.maxDownhillPct,
        reverseMaxDownhillPct: rev.maxDownhillPct,
        forwardScore: computeOverallScore(surfScore, fwd.score, traffScore, cycScore),
        reverseScore: computeOverallScore(surfScore, rev.score, traffScore, cycScore),
        surface: way.tags.surface || "unknown",
        highway: way.tags.highway,
        name: way.tags.name || null,
      };

      // Add edge in both directions (roads are bidirectional)
      if (!adjacency.has(fromId)) adjacency.set(fromId, []);
      if (!adjacency.has(toId)) adjacency.set(toId, []);
      adjacency.get(fromId)!.push(edge);
      adjacency.get(toId)!.push(edge);
      edgeCount++;

      segStart = i;
    }
  }

  // Post-processing: apply crossing/urbanization penalty
  // Nodes with many edges = busy intersections = bad for rollerski
  for (const [nodeId, edges] of adjacency) {
    const degree = edges.length;
    // Penalty for traversing busy intersections (4+ roads meeting)
    // Also penalize very short edges (urban grid pattern)
    for (const edge of edges) {
      const isFrom = edge.from === nodeId;
      // Apply penalty to edges arriving at high-degree intersections
      const otherNodeId = isFrom ? edge.to : edge.from;
      const otherDegree = (adjacency.get(otherNodeId) || []).length;

      // Crossing penalty: degree 2 = no penalty, 3 = small, 4+ = significant
      const crossingPenalty = Math.max(0, (otherDegree - 2) * 0.06);

      // Short edge penalty: edges < 50m indicate dense urban grid
      const shortPenalty = edge.lengthM < 50 ? 0.15 : edge.lengthM < 100 ? 0.05 : 0;

      const totalPenalty = Math.min(crossingPenalty + shortPenalty, 0.4);
      edge.forwardScore = Math.max(0.05, edge.forwardScore - totalPenalty);
      edge.reverseScore = Math.max(0.05, edge.reverseScore - totalPenalty);
    }
  }

  return { nodes: graphNodes, adjacency, edgeCount };
}

// --- A* pathfinding ---

interface AStarResult {
  path: number[]; // node IDs
  edges: GraphEdge[];
  totalLength: number;
  avgScore: number;
}

/**
 * A* pathfinding from start to goal, weighted by rollerski suitability.
 * Returns null if no path found within maxLength.
 */
export function astar(
  graph: RoadGraph,
  startId: number,
  goalId: number,
  maxLengthM: number,
  maxDownhillPct = 12,
): AStarResult | null {
  const goalNode = graph.nodes.get(goalId);
  if (!goalNode) return null;

  // Priority queue (simple sorted array -- adequate for our graph sizes)
  interface QueueItem {
    nodeId: number;
    gCost: number; // actual cost so far
    fCost: number; // gCost + heuristic
    length: number; // actual distance in meters
  }

  const open: QueueItem[] = [{ nodeId: startId, gCost: 0, fCost: 0, length: 0 }];
  const cameFrom = new Map<number, { nodeId: number; edge: GraphEdge }>();
  const gCosts = new Map<number, number>();
  const lengths = new Map<number, number>();
  gCosts.set(startId, 0);
  lengths.set(startId, 0);

  while (open.length > 0) {
    // Pop lowest fCost
    open.sort((a, b) => a.fCost - b.fCost);
    const current = open.shift()!;

    if (current.nodeId === goalId) {
      // Reconstruct path
      return reconstructPath(graph, startId, goalId, cameFrom);
    }

    const edges = graph.adjacency.get(current.nodeId) || [];
    for (const edge of edges) {
      // Determine direction: are we going from->to or to->from?
      const isForward = edge.from === current.nodeId;
      const neighborId = isForward ? edge.to : edge.from;
      const score = isForward ? edge.forwardScore : edge.reverseScore;
      const maxDown = isForward ? edge.forwardMaxDownhillPct : edge.reverseMaxDownhillPct;

      // Hard reject dangerous downhills
      if (maxDown > maxDownhillPct) continue;

      const newLength = current.length + edge.lengthM;
      if (newLength > maxLengthM) continue;

      // Cost: non-linear penalty for bad roads (score^2 makes bad roads exponentially worse)
      // A score=0.8 edge costs 1.56x per meter; score=0.4 costs 6.25x; score=0.2 costs 25x
      const edgeCost = edge.lengthM / Math.max(score * score, 0.01);
      const newGCost = current.gCost + edgeCost;

      if (newGCost < (gCosts.get(neighborId) ?? Infinity)) {
        gCosts.set(neighborId, newGCost);
        lengths.set(neighborId, newLength);
        cameFrom.set(neighborId, { nodeId: current.nodeId, edge });

        const neighborNode = graph.nodes.get(neighborId);
        const heuristic = neighborNode
          ? haversineM([neighborNode.lat, neighborNode.lon], [goalNode.lat, goalNode.lon]) * 0.8
          : 0;

        open.push({
          nodeId: neighborId,
          gCost: newGCost,
          fCost: newGCost + heuristic,
          length: newLength,
        });
      }
    }
  }

  return null; // no path found
}

function reconstructPath(
  graph: RoadGraph,
  startId: number,
  goalId: number,
  cameFrom: Map<number, { nodeId: number; edge: GraphEdge }>
): AStarResult {
  const path: number[] = [goalId];
  const edges: GraphEdge[] = [];
  let current = goalId;
  let totalLength = 0;
  let totalScore = 0;

  while (current !== startId && cameFrom.has(current)) {
    const { nodeId, edge } = cameFrom.get(current)!;
    path.push(nodeId);
    edges.push(edge);
    const isForward = edge.from === nodeId;
    totalLength += edge.lengthM;
    totalScore += (isForward ? edge.forwardScore : edge.reverseScore) * edge.lengthM;
    current = nodeId;
  }

  path.reverse();
  edges.reverse();

  return {
    path,
    edges,
    totalLength,
    avgScore: totalLength > 0 ? totalScore / totalLength : 0,
  };
}

// --- Greedy directional walk ---

/**
 * Walk outward from a start node in approximately the given bearing,
 * choosing high-score edges. Used as the outward phase of loop discovery.
 */
export function greedyWalk(
  graph: RoadGraph,
  startId: number,
  targetLengthM: number,
  bearingDeg: number,
  minEdgeScore = 0.4,
  maxDownhillPct = 10,
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

      const score = isForward ? edge.forwardScore : edge.reverseScore;
      const maxDown = isForward ? edge.forwardMaxDownhillPct : edge.reverseMaxDownhillPct;
      if (score < minEdgeScore || maxDown > maxDownhillPct) continue;

      const neighborNode = graph.nodes.get(neighborId);
      if (!neighborNode) continue;

      // Prefer edges that go in the target bearing direction
      const edgeBearing = Math.atan2(
        neighborNode.lon - currentNode.lon,
        neighborNode.lat - currentNode.lat
      );
      const bearingDiff = Math.abs(edgeBearing - bearingRad);
      const bearingAlignment = Math.cos(bearingDiff); // 1 = perfect, -1 = opposite

      // Combined score: route quality + direction alignment
      const combinedScore = score * 0.7 + bearingAlignment * 0.3;

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

// --- Utility: find closest graph node to a lat/lon ---

export function findClosestNode(
  graph: RoadGraph,
  lat: number,
  lon: number,
): number | null {
  let bestId: number | null = null;
  let bestDist = Infinity;
  for (const [nid, node] of graph.nodes) {
    const d = haversineM([node.lat, node.lon], [lat, lon]);
    if (d < bestDist) { bestDist = d; bestId = nid; }
  }
  return bestDist < 2000 ? bestId : null; // max 2km snap distance
}

// --- Utility: extract route coordinates from edges ---

export function edgesToCoords(
  edges: GraphEdge[],
  path: number[]
): { coords: [number, number][]; elevations: number[] } {
  const coords: [number, number][] = [];
  const elevations: number[] = [];

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const isForward = edge.from === path[i];
    const ec = isForward ? edge.coords : [...edge.coords].reverse();
    const ee = isForward ? edge.elevations : [...edge.elevations].reverse();

    // Skip first point if it duplicates the last added point
    const start = coords.length > 0 ? 1 : 0;
    for (let j = start; j < ec.length; j++) {
      coords.push(ec[j]);
      elevations.push(ee[j]);
    }
  }

  return { coords, elevations };
}
