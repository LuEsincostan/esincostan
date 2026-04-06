import type { Lake } from "../../data/types";
import { MiniMap } from "./MiniMap";

interface Props {
  lake: Lake;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

export function LakeCard({ lake, isSelected, onToggle }: Props) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lake.lat},${lake.lon}`;

  return (
    <div class="card lake-card">
      <div class="lake-card-header">
        <div>
          <span class="lake-card-name">{lake.nameDe || lake.name}</span>
          <div class="lake-card-metrics">
            {lake.avgSummerTempC !== null && (
              <span class="metric">
                <span class="metric-icon">🌡</span> {lake.avgSummerTempC}°C
              </span>
            )}
            {lake.areaKm2 !== null && (
              <span class="metric">
                <span class="metric-icon">📐</span> {lake.areaKm2} km²
              </span>
            )}
            {lake.elevationM !== null && (
              <span class="metric">
                <span class="metric-icon">⛰</span> {lake.elevationM}m
              </span>
            )}
          </div>
        </div>
        <a href={mapsUrl} target="_blank" rel="noreferrer" title="Open in Google Maps">
          <MiniMap lat={lake.lat} lon={lake.lon} />
        </a>
      </div>

      <div class="lake-card-actions">
        <button
          class={`btn ${isSelected ? "btn-remove" : "btn-add"}`}
          onClick={() => onToggle(lake.id)}
        >
          {isSelected ? "Remove" : "Add to list"}
        </button>
        <a class="btn-maps-link" href={mapsUrl} target="_blank" rel="noreferrer">
          Google Maps ↗
        </a>
      </div>
    </div>
  );
}
