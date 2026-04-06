import type { Lake, CompletedSwim } from "../../data/types";

interface Props {
  lakes: Lake[];
  selectedIds: string[];
  completedSwims: CompletedSwim[];
  onToggleComplete: (lakeId: string, date: string | null) => void;
}

export function TrackList({ lakes, selectedIds, completedSwims, onToggleComplete }: Props) {
  const completedMap = new Map(completedSwims.map((s) => [s.lakeId, s]));
  const selectedLakes = lakes
    .filter((l) => selectedIds.includes(l.id))
    .sort((a, b) => {
      const aCompleted = completedMap.has(a.id);
      const bCompleted = completedMap.has(b.id);
      if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
      return (a.nameDe || a.name).localeCompare(b.nameDe || b.name);
    });

  return (
    <div>
      <ul class="track-list">
        {selectedLakes.map((lake) => {
          const swim = completedMap.get(lake.id);
          const isCompleted = !!swim;

          return (
            <li key={lake.id} class={`track-item ${isCompleted ? "completed" : "pending"}`}>
              <input
                type="checkbox"
                class="track-checkbox"
                checked={isCompleted}
                onChange={() => {
                  if (isCompleted) {
                    onToggleComplete(lake.id, null);
                  } else {
                    onToggleComplete(lake.id, new Date().toISOString().slice(0, 10));
                  }
                }}
              />
              <div class="track-item-info">
                <div class="track-item-name">{lake.nameDe || lake.name}</div>
                <div class="track-item-meta">
                  {lake.elevationM ? `${lake.elevationM}m` : ""}
                  {lake.areaKm2 ? ` · ${lake.areaKm2} km²` : ""}
                </div>
              </div>
              {isCompleted && swim ? (
                <input
                  type="date"
                  class="track-item-date"
                  value={swim.date}
                  onChange={(e) =>
                    onToggleComplete(lake.id, (e.target as HTMLInputElement).value)
                  }
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      {selectedLakes.length === 0 && (
        <p style={{ textAlign: "center", color: "var(--text-dim)", padding: "2rem" }}>
          No lakes selected yet. Go to the Curate tab to pick your lakes.
        </p>
      )}
    </div>
  );
}
