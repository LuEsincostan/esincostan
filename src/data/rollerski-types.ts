export type Surface =
  | "asphalt"
  | "paved"
  | "concrete"
  | "paving_stones"
  | "compacted"
  | "fine_gravel"
  | "gravel"
  | "unpaved"
  | "unknown";

export type HighwayType =
  | "cycleway"
  | "living_street"
  | "residential"
  | "unclassified"
  | "tertiary"
  | "secondary"
  | "primary"
  | "service"
  | "track";

export type CyclewayType =
  | "separate"
  | "track"
  | "lane"
  | "shared_lane"
  | "none"
  | "unknown";

export type RouteType = "loop" | "point-to-point" | "out-and-back";

/** A scored road segment (one OSM way) */
export interface RoadSegment {
  id: string;
  coords: [number, number][]; // [lat, lon]
  elevations: number[];
  lengthM: number;
  surface: Surface;
  highway: HighwayType;
  cycleway: CyclewayType;
  maxspeed: number | null;
  name: string | null;
  scores: {
    surface: number;
    traffic: number;
    cycleway: number;
    gradientForward: number;
    gradientReverse: number;
    overall: number;
  };
  gradient: {
    maxDownhillPct: number;
    netElevationM: number;
    elevationGainM: number;
    elevationLossM: number;
  };
}

/** A curated rollerski route */
export interface RollerskiRoute {
  id: string;
  name: string;
  description: string;
  type: RouteType;
  coords: [number, number][];
  elevations: number[];
  lengthKm: number;
  elevationGainM: number;
  elevationLossM: number;
  maxDownhillPct: number;
  avgScore: number;
  surfaceBreakdown: Partial<Record<Surface, number>>;
  transport?: {
    type: "gondola" | "bus" | "train";
    name: string;
    stopName: string;
    url?: string;
  };
  start: { name: string; lat: number; lon: number };
  end: { name: string; lat: number; lon: number };
}

export interface RollerskiFilters {
  routeType: RouteType | "all";
  minLength: number;
  maxLength: number;
  maxGradient: number;
  minScore: number;
  search: string;
}
