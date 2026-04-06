import type { CompletedSwim } from "../../data/types";

// Monthly weights reflecting swimming likelihood (sum ≈ 1.0)
const MONTHLY_WEIGHTS = [
  0.02, // Jan
  0.02, // Feb
  0.05, // Mar
  0.08, // Apr
  0.12, // May
  0.18, // Jun
  0.22, // Jul
  0.20, // Aug
  0.08, // Sep
  0.02, // Oct
  0.005, // Nov
  0.005, // Dec
];

export interface ProjectionPoint {
  date: Date;
  count: number;
  projected: boolean;
}

export function computeProjection(
  completedSwims: CompletedSwim[],
  goalCount: number,
  goalDeadline: string
): ProjectionPoint[] {
  const points: ProjectionPoint[] = [];
  const deadline = new Date(goalDeadline);

  if (completedSwims.length === 0) {
    // No data yet — project from today
    const now = new Date();
    points.push({ date: now, count: 0, projected: false });

    const monthsLeft = monthsBetween(now, deadline);
    if (monthsLeft <= 0) return points;

    const totalWeight = weightedMonthsBetween(now, deadline);
    let cumulative = 0;
    const cursor = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    while (cursor <= deadline && cumulative < goalCount) {
      const w = MONTHLY_WEIGHTS[cursor.getMonth()];
      cumulative += (goalCount / totalWeight) * w;
      points.push({
        date: new Date(cursor),
        count: Math.min(Math.round(cumulative), goalCount),
        projected: true,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return points;
  }

  // Sort completed swims by date
  const sorted = [...completedSwims].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Actual progress points
  const firstDate = new Date(sorted[0].date);
  points.push({ date: firstDate, count: 0, projected: false });

  sorted.forEach((swim, i) => {
    points.push({
      date: new Date(swim.date),
      count: i + 1,
      projected: false,
    });
  });

  const completed = sorted.length;
  if (completed >= goalCount) return points;

  // Compute historical pace (swims per weighted month)
  const now = new Date();
  const elapsedWeight = weightedMonthsBetween(firstDate, now);
  const pacePerWeight = elapsedWeight > 0 ? completed / elapsedWeight : 1;

  // Project forward
  const remaining = goalCount - completed;
  let cumulative = completed;
  const cursor = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  while (cursor <= deadline && cumulative < goalCount) {
    const w = MONTHLY_WEIGHTS[cursor.getMonth()];
    cumulative += pacePerWeight * w;
    points.push({
      date: new Date(cursor),
      count: Math.min(Math.round(cumulative), goalCount),
      projected: true,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // If we haven't reached the goal by deadline, extend projection
  if (cumulative < goalCount) {
    const beyondDeadline = new Date(cursor);
    while (cumulative < goalCount) {
      const w = MONTHLY_WEIGHTS[beyondDeadline.getMonth()];
      cumulative += pacePerWeight * w;
      points.push({
        date: new Date(beyondDeadline),
        count: Math.min(Math.round(cumulative), goalCount),
        projected: true,
      });
      beyondDeadline.setMonth(beyondDeadline.getMonth() + 1);
    }
  }

  return points;
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function weightedMonthsBetween(a: Date, b: Date): number {
  let total = 0;
  const cursor = new Date(a.getFullYear(), a.getMonth(), 1);
  while (cursor < b) {
    total += MONTHLY_WEIGHTS[cursor.getMonth()];
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return total;
}

export function projectedCompletionDate(
  completedSwims: CompletedSwim[],
  goalCount: number,
  goalDeadline: string
): string | null {
  const points = computeProjection(completedSwims, goalCount, goalDeadline);
  const goalPoint = points.find((p) => p.count >= goalCount);
  if (!goalPoint) return null;
  return goalPoint.date.toISOString().slice(0, 10);
}
