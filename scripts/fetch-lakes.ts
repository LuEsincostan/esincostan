import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { temperatureData } from "./temperature-data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

const SPARQL_QUERY = `
SELECT DISTINCT ?lake ?lakeLabel ?lakeLabelDe ?lat ?lon ?area ?elevation ?image WHERE {
  ?lake wdt:P31/wdt:P279* wd:Q23397.
  ?lake wdt:P17 wd:Q39.
  ?lake wdt:P625 ?coords.
  BIND(geof:latitude(?coords) AS ?lat)
  BIND(geof:longitude(?coords) AS ?lon)
  OPTIONAL { ?lake wdt:P2046 ?area. }
  OPTIONAL { ?lake wdt:P2044 ?elevation. }
  OPTIONAL { ?lake wdt:P18 ?image. }
  OPTIONAL { ?lake rdfs:label ?lakeLabelDe. FILTER(LANG(?lakeLabelDe) = "de") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,de,fr". }
}
ORDER BY DESC(?area)
`;

interface SparqlResult {
  lake: { value: string };
  lakeLabel: { value: string };
  lakeLabelDe?: { value: string };
  lat: { value: string };
  lon: { value: string };
  area?: { value: string };
  elevation?: { value: string };
  image?: { value: string };
}

interface Lake {
  id: string;
  name: string;
  nameDe?: string;
  lat: number;
  lon: number;
  areaKm2: number | null;
  elevationM: number | null;
  avgSummerTempC: number | null;
  imageUrl?: string;
}

async function fetchLakes(): Promise<void> {
  console.log("Fetching Swiss lakes from Wikidata...");

  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(SPARQL_QUERY)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "SwissLakeBucketList/1.0 (https://esincostan.com)",
    },
  });

  if (!response.ok) {
    throw new Error(`Wikidata query failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const results: SparqlResult[] = data.results.bindings;

  console.log(`Got ${results.length} raw results`);

  // Deduplicate by Wikidata ID (some lakes appear multiple times due to OPTIONAL joins)
  const lakeMap = new Map<string, Lake>();

  for (const r of results) {
    const id = r.lake.value.replace("http://www.wikidata.org/entity/", "");

    if (lakeMap.has(id)) continue;

    const lat = parseFloat(r.lat.value);
    const lon = parseFloat(r.lon.value);

    // Filter to Switzerland's approximate bounding box
    if (lat < 45.8 || lat > 47.9 || lon < 5.9 || lon > 10.6) continue;

    const area = r.area?.value ? parseFloat(r.area.value) : null;
    // Convert m² to km² if area seems to be in m²
    // The largest Swiss lake (Geneva) is ~580 km², so raw values > 1000 are likely m²
    const areaKm2 = area !== null ? (area > 1000 ? area / 1e6 : area) : null;

    const lake: Lake = {
      id,
      name: r.lakeLabel.value,
      nameDe: r.lakeLabelDe?.value,
      lat,
      lon,
      areaKm2: areaKm2 !== null ? Math.round(areaKm2 * 100) / 100 : null,
      elevationM: r.elevation?.value ? Math.round(parseFloat(r.elevation.value)) : null,
      avgSummerTempC: temperatureData[id] ?? null,
      imageUrl: r.image?.value,
    };

    lakeMap.set(id, lake);
  }

  const lakes = Array.from(lakeMap.values());
  console.log(`Deduplicated to ${lakes.length} unique lakes`);

  const outPath = join(__dirname, "..", "src", "data", "lakes-wikidata.json");
  writeFileSync(outPath, JSON.stringify(lakes, null, 2));
  console.log(`Wrote ${lakes.length} lakes to ${outPath}`);
}

fetchLakes().catch((err) => {
  console.error("Failed to fetch lakes:", err);
  process.exit(1);
});
