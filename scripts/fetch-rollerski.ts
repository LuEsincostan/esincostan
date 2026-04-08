/**
 * Rollerski Route Discovery Pipeline
 *
 * 1. Download SRTM elevation tiles
 * 2. Fetch road network from OSM via Overpass
 * 3. Build scored road graph with real elevation data
 * 4. Discover routes algorithmically (loops, climbs, out-and-back)
 * 5. Validate against ground truth
 * 6. Write output JSON
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ensureSrtmTiles } from "./srtm.js";
import { fetchTile, fetchSeedPoints, ALL_TILES, CORE_TILE, FLUMSERBERG_TILE } from "./overpass.js";
import type { OsmNode, OsmWay } from "./overpass.js";
import { buildGraph, findClosestNode } from "./graph.js";
import type { RoadGraph } from "./graph.js";
import { discoverCorridors, discoverLoops, discoverClimbs, deduplicateRoutes, autoNameRoutes } from "./discover-routes.js";
import type { DiscoveredRoute } from "./discover-routes.js";
import { loadGroundTruth } from "./ground-truth.js";
import { validateRoutes, printValidationReport } from "./validate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("=== Rollerski Route Discovery Pipeline ===\n");

  // --- Step 1: Ensure SRTM elevation data ---
  console.log("Step 1: Elevation data");
  await ensureSrtmTiles(["N47E008", "N47E009"]);

  // --- Step 2: Fetch road network ---
  console.log("\nStep 2: Fetch road network");
  const allNodes = new Map<number, OsmNode>();
  const allWays: OsmWay[] = [];

  for (const tile of ALL_TILES) {
    try {
      const { nodes, ways } = await fetchTile(tile);
      for (const [id, node] of nodes) allNodes.set(id, node);
      for (const way of ways) allWays.push(way);
    } catch (err) {
      console.warn(`  Failed to fetch tile "${tile.name}", skipping: ${err}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  console.log(`  Total: ${allWays.length} ways, ${allNodes.size} nodes`);

  // --- Step 3: Build scored graph ---
  console.log("\nStep 3: Build scored road graph");
  const graph = buildGraph(allNodes, allWays);
  console.log(`  Graph: ${graph.nodes.size} nodes, ${graph.edgeCount} edges`);

  // --- Step 4: Fetch seed points ---
  console.log("\nStep 4: Collect seed points");
  let coreSeedData = { trainStations: [] as OsmNode[], towns: [] as OsmNode[], gondolaStations: [] as OsmNode[] };
  try {
    coreSeedData = await fetchSeedPoints(CORE_TILE);
    await new Promise((r) => setTimeout(r, 3000));
  } catch (err) {
    console.warn(`  Failed to fetch seed points, using graph-based seeds: ${err}`);
  }

  // Convert seed points to graph node IDs
  const seedNodeIds: number[] = [];

  if (coreSeedData.trainStations.length + coreSeedData.towns.length > 0) {
    for (const seed of [...coreSeedData.trainStations, ...coreSeedData.towns]) {
      const nodeId = findClosestNode(graph, seed.lat, seed.lon);
      if (nodeId !== null && !seedNodeIds.includes(nodeId)) {
        seedNodeIds.push(nodeId);
      }
    }
  }

  // Fallback: sample graph nodes on a grid as seeds
  if (seedNodeIds.length < 50) {
    console.log("  Adding grid-sampled seed points as fallback...");
    const gridStep = 0.03; // ~3km grid
    for (let lat = CORE_TILE.south; lat <= CORE_TILE.north; lat += gridStep) {
      for (let lon = CORE_TILE.west; lon <= CORE_TILE.east; lon += gridStep) {
        const nodeId = findClosestNode(graph, lat, lon);
        if (nodeId !== null && !seedNodeIds.includes(nodeId)) {
          seedNodeIds.push(nodeId);
        }
      }
    }
  }

  console.log(`  ${seedNodeIds.length} seed points ready`);

  // --- Step 5: Discover routes ---
  console.log("\nStep 5: Discover routes");

  const corridors = discoverCorridors(graph, seedNodeIds);
  const loops = discoverLoops(graph, seedNodeIds);
  const climbs = discoverClimbs(graph, coreSeedData.gondolaStations);

  // Combine and deduplicate
  let allRoutes = [...corridors, ...loops, ...climbs];
  console.log(`  Raw candidates: ${allRoutes.length}`);

  allRoutes = deduplicateRoutes(allRoutes);
  console.log(`  After dedup: ${allRoutes.length}`);

  // Reassign IDs after dedup
  allRoutes.forEach((r, i) => {
    const prefix = r.type === "loop" ? "loop" : r.type === "point-to-point" ? "climb" : "route";
    r.id = `${prefix}-${String(i).padStart(3, "0")}`;
  });

  // Auto-name
  autoNameRoutes(allRoutes, graph, coreSeedData);

  // --- Step 6: Validate ---
  console.log("\nStep 6: Validate against ground truth");
  const groundTruth = loadGroundTruth();
  const validationResults = validateRoutes(allRoutes, groundTruth);
  printValidationReport(validationResults);

  // --- Step 7: Write output ---
  console.log("Step 7: Write output");

  // Strip internal fields before writing
  const outputRoutes = allRoutes.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    type: r.type,
    coords: r.coords,
    elevations: r.elevations,
    lengthKm: r.lengthKm,
    elevationGainM: r.elevationGainM,
    elevationLossM: r.elevationLossM,
    maxDownhillPct: r.maxDownhillPct,
    avgScore: r.avgScore,
    surfaceBreakdown: r.surfaceBreakdown,
    start: r.start,
    end: r.end,
    transport: r.transport,
  }));

  const routesPath = join(__dirname, "..", "src", "data", "rollerski-routes.json");
  writeFileSync(routesPath, JSON.stringify(outputRoutes, null, 2));
  console.log(`  Wrote ${outputRoutes.length} routes to ${routesPath}`);

  // Summary
  console.log("\n=== Pipeline Complete ===");
  console.log(`  Corridors (out-and-back): ${allRoutes.filter((r) => r.type === "out-and-back").length}`);
  console.log(`  Loops: ${allRoutes.filter((r) => r.type === "loop").length}`);
  console.log(`  Climbs: ${allRoutes.filter((r) => r.type === "point-to-point").length}`);
  console.log(`  Total routes: ${allRoutes.length}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
