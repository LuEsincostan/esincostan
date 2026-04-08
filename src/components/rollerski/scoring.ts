import type { Surface, HighwayType, CyclewayType } from "../../data/rollerski-types";

// --- Surface scoring ---

const SURFACE_SCORES: Record<Surface, number> = {
  asphalt: 1.0,
  paved: 0.8,
  concrete: 0.7,
  paving_stones: 0.5,
  compacted: 0.3,
  fine_gravel: 0.1,
  gravel: 0.1,
  unpaved: 0.0,
  unknown: 0.5,
};

// Roads in Switzerland that are very likely asphalt even without a surface tag
const LIKELY_ASPHALT: Set<HighwayType> = new Set([
  "primary",
  "secondary",
  "tertiary",
  "residential",
]);

export function scoreSurface(surface: Surface, highway: HighwayType): number {
  if (surface === "unknown" && LIKELY_ASPHALT.has(highway)) return 0.7;
  return SURFACE_SCORES[surface];
}

// --- Traffic scoring ---

const HIGHWAY_SCORES: Record<HighwayType, number> = {
  cycleway: 1.0,
  living_street: 0.9,
  residential: 0.7,
  service: 0.6,
  unclassified: 0.6,
  tertiary: 0.5,
  secondary: 0.3,
  primary: 0.1,
  track: 0.4,
};

export function scoreTraffic(highway: HighwayType, maxspeed: number | null): number {
  let score = HIGHWAY_SCORES[highway];
  if (maxspeed !== null) {
    if (maxspeed <= 30) score += 0.1;
    else if (maxspeed >= 80) score -= 0.1;
    else if (maxspeed >= 100) score -= 0.2;
  }
  return Math.max(0, Math.min(1, score));
}

// --- Cycleway scoring ---

const CYCLEWAY_SCORES: Record<CyclewayType, number> = {
  separate: 1.0,
  track: 0.9,
  lane: 0.6,
  shared_lane: 0.3,
  none: 0.0,
  unknown: 0.0,
};

export function scoreCycleway(cycleway: CyclewayType, highway: HighwayType): number {
  if (highway === "cycleway") return 1.0;
  return CYCLEWAY_SCORES[cycleway];
}

// --- Gradient scoring (directional) ---

/** Haversine distance in meters between two [lat, lon] points */
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

function gradientSubScore(gradientPct: number): number {
  if (gradientPct >= -1) return 1.0; // flat or uphill
  if (gradientPct >= -3) return 0.8; // gentle downhill
  if (gradientPct >= -6) return 0.4; // moderate downhill
  if (gradientPct >= -10) return 0.1; // steep downhill
  return 0.0; // very steep
}

export interface GradientResult {
  score: number;
  maxDownhillPct: number;
  elevationGainM: number;
  elevationLossM: number;
}

/**
 * Score gradient for a given direction of travel.
 * coords and elevations must be in the direction of travel.
 */
export function scoreGradient(
  coords: [number, number][],
  elevations: number[]
): GradientResult {
  let totalDist = 0;
  let weightedScore = 0;
  let maxDownhillPct = 0;
  let gain = 0;
  let loss = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const dist = haversineM(coords[i], coords[i + 1]);
    if (dist < 0.5) continue; // skip negligible segments
    const dElev = elevations[i + 1] - elevations[i];
    const gradPct = (dElev / dist) * 100;

    if (dElev > 0) gain += dElev;
    else loss += Math.abs(dElev);

    if (gradPct < maxDownhillPct) maxDownhillPct = gradPct;

    weightedScore += gradientSubScore(gradPct) * dist;
    totalDist += dist;
  }

  return {
    score: totalDist > 0 ? weightedScore / totalDist : 1.0,
    maxDownhillPct: Math.abs(maxDownhillPct),
    elevationGainM: Math.round(gain),
    elevationLossM: Math.round(loss),
  };
}

// --- Composite scoring ---

const WEIGHTS = {
  surface: 0.3,
  gradient: 0.35,
  traffic: 0.2,
  cycleway: 0.15,
};

export function computeOverallScore(
  surfaceScore: number,
  gradientScore: number,
  trafficScore: number,
  cyclewayScore: number
): number {
  return (
    WEIGHTS.surface * surfaceScore +
    WEIGHTS.gradient * gradientScore +
    WEIGHTS.traffic * trafficScore +
    WEIGHTS.cycleway * cyclewayScore
  );
}

/** Map a 0-1 score to a CSS color */
export function scoreToColor(score: number): string {
  if (score >= 0.8) return "#27ae60";
  if (score >= 0.6) return "#8bc34a";
  if (score >= 0.4) return "#ffc107";
  if (score >= 0.3) return "#ff9800";
  return "#e74c3c";
}
