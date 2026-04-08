import type { RollerskiRoute } from "../../data/rollerski-types";
import { scoreToColor } from "./scoring";

interface Props {
  route: RollerskiRoute;
  isSelected: boolean;
  onSelect: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  loop: "Loop",
  "point-to-point": "Point-to-Point",
  "out-and-back": "Out & Back",
};

const TRANSPORT_ICONS: Record<string, string> = {
  gondola: "🚡",
  bus: "🚌",
  train: "🚆",
};

export function RouteCard({ route, isSelected, onSelect }: Props) {
  const scorePct = Math.round(route.avgScore * 100);
  const scoreColor = scoreToColor(route.avgScore);

  // Dominant surface
  const dominantSurface = Object.entries(route.surfaceBreakdown)
    .sort((a, b) => b[1] - a[1])[0];

  return (
    <div
      class={`rs-card ${isSelected ? "rs-card-selected" : ""}`}
      onClick={onSelect}
    >
      <div class="rs-card-header">
        <h3 class="rs-card-name">{route.name}</h3>
        <span class="rs-type-badge">{TYPE_LABELS[route.type] ?? route.type}</span>
      </div>

      <p class="rs-card-desc">{route.description}</p>

      <div class="rs-card-metrics">
        <span class="rs-metric">
          <span class="rs-metric-value">{route.lengthKm}</span>
          <span class="rs-metric-label">km</span>
        </span>
        <span class="rs-metric">
          <span class="rs-metric-value">+{route.elevationGainM}</span>
          <span class="rs-metric-label">m gain</span>
        </span>
        <span class="rs-metric">
          <span class="rs-metric-value">-{route.elevationLossM}</span>
          <span class="rs-metric-label">m loss</span>
        </span>
        <span class="rs-metric">
          <span class="rs-metric-value" style={{ color: scoreColor }}>
            {scorePct}%
          </span>
          <span class="rs-metric-label">score</span>
        </span>
      </div>

      <div class="rs-card-footer">
        {dominantSurface && (
          <span class="rs-surface-tag">
            {dominantSurface[0]} ({dominantSurface[1]}%)
          </span>
        )}
        {route.transport && (
          <span class="rs-transport-tag">
            {TRANSPORT_ICONS[route.transport.type] ?? ""}{" "}
            {route.transport.name}
          </span>
        )}
        {route.maxDownhillPct > 3 && (
          <span class="rs-warning-tag">
            {route.maxDownhillPct.toFixed(1)}% max downhill
          </span>
        )}
      </div>

      <div class="rs-card-endpoints">
        <span>{route.start.name}</span>
        {route.type !== "loop" && (
          <>
            <span class="rs-arrow">&rarr;</span>
            <span>{route.end.name}</span>
          </>
        )}
      </div>
    </div>
  );
}
