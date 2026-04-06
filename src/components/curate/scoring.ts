import type { Lake } from "../../data/types";

export interface ScoreWeights {
  temperature: number;
  size: number;
  altitude: number;
}

export const defaultWeights: ScoreWeights = {
  temperature: 0.4,
  size: 0.3,
  altitude: 0.3,
};

export function computeScore(lake: Lake, weights: ScoreWeights, allLakes: Lake[]): number {
  const temps = allLakes.map((l) => l.avgSummerTempC).filter((t): t is number => t !== null);
  const areas = allLakes.map((l) => l.areaKm2).filter((a): a is number => a !== null && a > 0);
  const elevations = allLakes.map((l) => l.elevationM).filter((e): e is number => e !== null);

  let tempScore = 0.5;
  if (lake.avgSummerTempC !== null && temps.length > 1) {
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    tempScore = max > min ? (lake.avgSummerTempC - min) / (max - min) : 0.5;
  }

  let sizeScore = 0.5;
  if (lake.areaKm2 !== null && lake.areaKm2 > 0 && areas.length > 1) {
    const logAreas = areas.map((a) => Math.log(a));
    const min = Math.min(...logAreas);
    const max = Math.max(...logAreas);
    sizeScore = max > min ? (Math.log(lake.areaKm2) - min) / (max - min) : 0.5;
  }

  // Lower altitude = higher score (warmer, more accessible) by default
  let altScore = 0.5;
  if (lake.elevationM !== null && elevations.length > 1) {
    const min = Math.min(...elevations);
    const max = Math.max(...elevations);
    altScore = max > min ? 1 - (lake.elevationM - min) / (max - min) : 0.5;
  }

  const totalWeight = weights.temperature + weights.size + weights.altitude;
  if (totalWeight === 0) return 0;

  return (
    (weights.temperature * tempScore +
      weights.size * sizeScore +
      weights.altitude * altScore) /
    totalWeight
  );
}
