/**
 * Overpass API fetching and OSM data parsing.
 * Fetches road network data for the Zurich region in tiles.
 */

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

// --- Tile definitions ---

export interface TileDef {
  name: string;
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Core region covers Greifensee, Airport, Wädenswil, Sihlsee, Einsiedeln */
export const CORE_TILE: TileDef = {
  name: "zurich-core",
  south: 47.04,
  west: 8.50,
  north: 47.50,
  east: 8.86,
};

/** Satellite tile for Flumserberg climb */
export const FLUMSERBERG_TILE: TileDef = {
  name: "flumserberg",
  south: 47.04,
  west: 9.24,
  north: 47.12,
  east: 9.36,
};

export const ALL_TILES = [CORE_TILE, FLUMSERBERG_TILE];

// --- OSM types ---

export interface OsmNode {
  id: number;
  lat: number;
  lon: number;
}

export interface OsmWay {
  id: number;
  nodes: number[];
  tags: Record<string, string>;
}

interface OverpassResponse {
  elements: (
    | { type: "node"; id: number; lat: number; lon: number }
    | { type: "way"; id: number; nodes: number[]; tags?: Record<string, string> }
  )[];
}

// --- Overpass query with retry ---

async function overpassQuery(query: string, retries = 3): Promise<OverpassResponse> {
  const fullQuery = `[out:json][timeout:180];${query}out body;>;out skel qt;`;
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      const delay = 15000 * attempt;
      console.log(`    Retrying in ${delay / 1000}s (attempt ${attempt + 1}/${retries})...`);
      await new Promise((r) => setTimeout(r, delay));
    }
    const resp = await fetch(OVERPASS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(fullQuery)}`,
    });
    if ((resp.status === 429 || resp.status === 504) && attempt < retries - 1) {
      console.log(`    Got ${resp.status}, will retry...`);
      continue;
    }
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Overpass failed (${resp.status}): ${text.slice(0, 200)}`);
    }
    return resp.json();
  }
  throw new Error("Overpass query failed after retries");
}

function parseOverpass(data: OverpassResponse): { nodes: Map<number, OsmNode>; ways: OsmWay[] } {
  const nodes = new Map<number, OsmNode>();
  const ways: OsmWay[] = [];
  for (const el of data.elements) {
    if (el.type === "node") {
      nodes.set(el.id, { id: el.id, lat: el.lat, lon: el.lon });
    } else if (el.type === "way" && el.tags) {
      ways.push({ id: el.id, nodes: el.nodes, tags: el.tags });
    }
  }
  return { nodes, ways };
}

// --- Fetch road network for a tile ---

export async function fetchTile(tile: TileDef): Promise<{ nodes: Map<number, OsmNode>; ways: OsmWay[] }> {
  console.log(`  Fetching tile "${tile.name}" (${tile.south},${tile.west} to ${tile.north},${tile.east})...`);

  // Fetch paved roads suitable for rollerski
  const query = `
    (
      way["highway"~"cycleway|living_street|residential|unclassified|tertiary|secondary|primary|service"]
        ["surface"~"asphalt|paved|concrete"]
        (${tile.south},${tile.west},${tile.north},${tile.east});
      way["highway"="cycleway"]
        (${tile.south},${tile.west},${tile.north},${tile.east});
      way["highway"~"cycleway|living_street|residential|unclassified|tertiary|secondary"]
        (${tile.south},${tile.west},${tile.north},${tile.east});
    );
  `;

  const data = await overpassQuery(query);
  const { nodes, ways } = parseOverpass(data);
  console.log(`    Got ${ways.length} ways, ${nodes.size} nodes`);
  return { nodes, ways };
}

// --- Fetch seed points (train stations, towns, gondola stations) ---

export async function fetchSeedPoints(tile: TileDef): Promise<{
  trainStations: OsmNode[];
  towns: OsmNode[];
  gondolaStations: OsmNode[];
}> {
  console.log(`  Fetching seed points for "${tile.name}"...`);

  const query = `
    (
      node["railway"~"station|halt"](${tile.south},${tile.west},${tile.north},${tile.east});
      node["place"~"town|village"](${tile.south},${tile.west},${tile.north},${tile.east});
      node["aerialway"~"station"](${tile.south},${tile.west},${tile.north},${tile.east});
    );
  `;

  const data = await overpassQuery(query);

  const trainStations: OsmNode[] = [];
  const towns: OsmNode[] = [];
  const gondolaStations: OsmNode[] = [];

  for (const el of data.elements) {
    if (el.type !== "node") continue;
    const node = { id: el.id, lat: el.lat, lon: el.lon };
    // Re-fetch doesn't include tags on skeleton nodes, so check the original elements
    const orig = data.elements.find(
      (e) => e.type === "node" && e.id === el.id
    ) as any;
    const tags = orig?.tags || {};
    if (tags.railway) trainStations.push(node);
    else if (tags.place) towns.push(node);
    else if (tags.aerialway) gondolaStations.push(node);
  }

  console.log(`    Seeds: ${trainStations.length} stations, ${towns.length} towns, ${gondolaStations.length} gondolas`);
  return { trainStations, towns, gondolaStations };
}
