/**
 * Ground truth routes for validating the discovery algorithm.
 * These are known good rollerski routes -- the algorithm should find them.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface GroundTruthRoute {
  id: string;
  name: string;
  type: "loop" | "point-to-point" | "out-and-back";
  /** Reference coordinates for matching (either from GPX or manual waypoints) */
  coords: [number, number][];
  lengthKm: number;
}

function parseGpxCoords(filePath: string): [number, number][] {
  const xml = readFileSync(filePath, "utf-8");
  const coords: [number, number][] = [];
  const regex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    coords.push([parseFloat(match[1]), parseFloat(match[2])]);
  }
  return coords;
}

export function loadGroundTruth(): GroundTruthRoute[] {
  const gpxPath = join(__dirname, "..", "src", "data", "skatingland-72-0.gpx");
  const greifenseeCoords = parseGpxCoords(gpxPath);
  // Sample every 10th point
  const greifenseeSampled = greifenseeCoords.filter((_, i) => i % 10 === 0);

  return [
    {
      id: "greifensee",
      name: "Greifensee Skate (SchweizMobil #72)",
      type: "loop",
      coords: greifenseeSampled,
      lengthKm: 19.2,
    },
    {
      id: "sihlsee",
      name: "Sihlsee Rundweg",
      type: "loop",
      coords: [
        [47.1278, 8.7475], [47.1125, 8.7600], [47.1100, 8.7900],
        [47.1200, 8.8100], [47.1400, 8.8200], [47.1450, 8.7800],
        [47.1380, 8.7500],
      ],
      lengthKm: 20,
    },
    {
      id: "airport",
      name: "Zurich Airport Loop",
      type: "loop",
      coords: [
        [47.4510, 8.5630], [47.4420, 8.5500], [47.4350, 8.5300],
        [47.4500, 8.5200], [47.4700, 8.5400], [47.4750, 8.5650],
        [47.4650, 8.5850], [47.4550, 8.5700],
      ],
      lengthKm: 25,
    },
    {
      id: "flumserberg",
      name: "Flumserberg Aufstieg",
      type: "point-to-point",
      coords: [
        [47.0930, 9.3430], [47.0880, 9.3300], [47.0800, 9.3100],
        [47.0750, 9.2950], [47.0700, 9.2800],
      ],
      lengthKm: 5.7,
    },
    {
      id: "einsiedeln-brunni",
      name: "Einsiedeln - Brunni",
      type: "out-and-back",
      coords: [
        [47.1270, 8.7510], [47.1200, 8.7520], [47.1100, 8.7580],
        [47.1000, 8.7650], [47.0900, 8.7700], [47.0750, 8.7800],
        [47.0600, 8.7900], [47.0500, 8.7950],
      ],
      lengthKm: 19,
    },
  ];
}
