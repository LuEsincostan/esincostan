/**
 * Curated rollerski route definitions.
 *
 * Routes can be defined by:
 * 1. A GPX file (from SchweizMobil etc.) - preferred, accurate geometry + elevation
 * 2. An Overpass query + waypoints - fallback, reconstructed from OSM
 */

export interface CuratedRouteDef {
  id: string;
  name: string;
  description: string;
  type: "loop" | "point-to-point" | "out-and-back";
  /** Path to GPX file relative to project root (preferred source) */
  gpxFile?: string;
  /** Overpass QL body -- fallback if no GPX */
  overpassQuery?: string;
  /** Ordered waypoints for OSM route reconstruction -- fallback if no GPX */
  waypoints?: [number, number][];
  start: { name: string; lat: number; lon: number };
  end: { name: string; lat: number; lon: number };
  transport?: {
    type: "gondola" | "bus" | "train";
    name: string;
    stopName: string;
    url?: string;
  };
}

export const curatedRoutes: CuratedRouteDef[] = [
  {
    id: "greifensee-skate",
    name: "Greifensee Skate",
    description:
      "SchweizMobil Skating Route 72. Flat cycling/skating path loop around Greifensee. Separated paths with beautiful lake views. Very popular.",
    type: "loop",
    gpxFile: "src/data/skatingland-72-0.gpx",
    start: { name: "Uster", lat: 47.365, lon: 8.678 },
    end: { name: "Uster", lat: 47.365, lon: 8.678 },
  },
  {
    id: "sihlsee-loop",
    name: "Sihlsee Rundweg",
    description:
      "Scenic loop around the Sihlsee reservoir on well-paved roads. Mostly flat with gentle rolling terrain. Great views of the Einsiedeln valley.",
    type: "loop",
    overpassQuery: `
      way["highway"~"secondary|tertiary|unclassified|residential|cycleway"]
        (47.09,8.72,47.16,8.85);
    `,
    waypoints: [
      [47.1278, 8.7475],
      [47.1125, 8.7600],
      [47.1100, 8.7900],
      [47.1200, 8.8100],
      [47.1400, 8.8200],
      [47.1450, 8.7800],
      [47.1380, 8.7500],
    ],
    start: { name: "Einsiedeln", lat: 47.1278, lon: 8.7475 },
    end: { name: "Einsiedeln", lat: 47.1278, lon: 8.7475 },
  },
  {
    id: "zurich-airport-loop",
    name: "Flughafen Velorunde",
    description:
      "Flat cycling loop around Zurich Airport area. Wide, well-maintained cycling paths with minimal crossings. Great for speed training on inline skates.",
    type: "loop",
    overpassQuery: `
      way["highway"~"cycleway|tertiary|unclassified|residential|secondary"]
        (47.42,8.51,47.49,8.62);
    `,
    waypoints: [
      [47.4510, 8.5630],
      [47.4420, 8.5500],
      [47.4350, 8.5300],
      [47.4500, 8.5200],
      [47.4700, 8.5400],
      [47.4750, 8.5650],
      [47.4650, 8.5850],
      [47.4550, 8.5700],
    ],
    start: { name: "Kloten", lat: 47.4510, lon: 8.5630 },
    end: { name: "Kloten", lat: 47.4510, lon: 8.5630 },
  },
  {
    id: "flumserberg-climb",
    name: "Flumserberg Aufstieg",
    description:
      "Climb from Flums up to Tannenboden on a well-paved mountain road. About 900m of elevation gain with consistent gradients. Take the gondola back down.",
    type: "point-to-point",
    overpassQuery: `
      way["highway"~"secondary|tertiary|unclassified"]
        (47.05,9.26,47.10,9.35);
    `,
    waypoints: [
      [47.0930, 9.3430],
      [47.0880, 9.3300],
      [47.0800, 9.3100],
      [47.0750, 9.2950],
      [47.0700, 9.2800],
    ],
    start: { name: "Flums", lat: 47.0930, lon: 9.3430 },
    end: { name: "Tannenboden", lat: 47.0700, lon: 9.2800 },
    transport: {
      type: "gondola",
      name: "Flumserberg Bergbahnen",
      stopName: "Tannenboden",
      url: "https://www.flumserberg.ch",
    },
  },
  {
    id: "einsiedeln-brunni",
    name: "Einsiedeln - Brunni",
    description:
      "Road climb from Einsiedeln towards Brunni/Alpthal. Good visibility on descents makes this one of the few routes where the return downhill is also rollable. Great for longer sessions.",
    type: "out-and-back",
    overpassQuery: `
      way["highway"~"secondary|tertiary|unclassified|residential"]
        (47.04,8.72,47.14,8.82);
    `,
    waypoints: [
      [47.1270, 8.7510],
      [47.1200, 8.7520],
      [47.1100, 8.7580],
      [47.1000, 8.7650],
      [47.0900, 8.7700],
      [47.0750, 8.7800],
      [47.0600, 8.7900],
      [47.0500, 8.7950],
    ],
    start: { name: "Einsiedeln", lat: 47.1270, lon: 8.7510 },
    end: { name: "Brunni", lat: 47.0500, lon: 8.7950 },
  },
];
