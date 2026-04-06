import { useState, useMemo } from "preact/hooks";
import type { Lake, CompletedSwim } from "../data/types";
import { MiniMap } from "./curate/MiniMap";
import { FilterControls, type SortOption } from "./curate/FilterControls";

interface Props {
  lakes: Lake[];
  selectedIds: string[];
  completedSwims: CompletedSwim[];
  onToggleLake: (id: string) => void;
  onToggleComplete: (lakeId: string, date: string | null) => void;
}

export function UnifiedList({
  lakes,
  selectedIds,
  completedSwims,
  onToggleLake,
  onToggleComplete,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");
  const [minArea, setMinArea] = useState(0);
  const [maxAltitude, setMaxAltitude] = useState(4000);
  const [minTemp, setMinTemp] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>("name");

  const completedMap = new Map(completedSwims.map((s) => [s.lakeId, s]));
  const selectedSet = new Set(selectedIds);

  const displayLakes = useMemo(() => {
    const base = showAll ? lakes : lakes.filter((l) => selectedSet.has(l.id));

    return base
      .filter((lake) => {
        if (search) {
          const q = search.toLowerCase();
          const nameMatch =
            lake.name.toLowerCase().includes(q) ||
            (lake.nameDe?.toLowerCase().includes(q) ?? false);
          if (!nameMatch) return false;
        }
        if (showAll) {
          if (lake.areaKm2 !== null && lake.areaKm2 < minArea) return false;
          if (maxAltitude < 4000 && lake.elevationM !== null && lake.elevationM > maxAltitude)
            return false;
          if (minTemp > 0 && (lake.avgSummerTempC === null || lake.avgSummerTempC < minTemp))
            return false;
        }
        return true;
      })
      .sort((a, b) => {
        // When showing selected only, put completed at the bottom
        if (!showAll) {
          const aComp = completedMap.has(a.id);
          const bComp = completedMap.has(b.id);
          if (aComp !== bComp) return aComp ? 1 : -1;
        }
        switch (sortBy) {
          case "name":
            return (a.nameDe || a.name).localeCompare(b.nameDe || b.name);
          case "area":
            return (b.areaKm2 ?? 0) - (a.areaKm2 ?? 0);
          case "altitude":
            return (a.elevationM ?? 9999) - (b.elevationM ?? 9999);
          case "temperature":
            return (b.avgSummerTempC ?? -99) - (a.avgSummerTempC ?? -99);
        }
      });
  }, [lakes, selectedIds, completedSwims, showAll, search, minArea, maxAltitude, minTemp, sortBy]);

  return (
    <div>
      <div class="list-header">
        <div class="list-toggle">
          <button
            class={`toggle-btn ${!showAll ? "active" : ""}`}
            onClick={() => setShowAll(false)}
          >
            My Lakes ({selectedIds.length})
          </button>
          <button
            class={`toggle-btn ${showAll ? "active" : ""}`}
            onClick={() => setShowAll(true)}
          >
            All Lakes ({lakes.length})
          </button>
        </div>
      </div>

      {showAll && (
        <FilterControls
          search={search}
          onSearchChange={setSearch}
          minArea={minArea}
          onMinAreaChange={setMinArea}
          maxAltitude={maxAltitude}
          onMaxAltitudeChange={setMaxAltitude}
          minTemp={minTemp}
          onMinTempChange={setMinTemp}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      )}

      {!showAll && (
        <div style={{ padding: "0 0 0.5rem" }}>
          <input
            class="filter-input"
            type="text"
            placeholder="Search selected lakes..."
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            style={{ maxWidth: "300px" }}
          />
        </div>
      )}

      <div class="unified-count">
        {displayLakes.length} {showAll ? "lakes shown" : "selected"}
      </div>

      <div class="lake-grid">
        {displayLakes.map((lake) => {
          const isSelected = selectedSet.has(lake.id);
          const swim = completedMap.get(lake.id);
          const isCompleted = !!swim;
          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lake.lat},${lake.lon}`;

          const statusClass = isCompleted
            ? "lake-status-completed"
            : isSelected
            ? "lake-status-selected"
            : "lake-status-available";

          return (
            <div key={lake.id} class={`card lake-card ${statusClass}`}>
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
                {!isSelected ? (
                  <button class="btn btn-add" onClick={() => onToggleLake(lake.id)}>
                    Add to list
                  </button>
                ) : (
                  <>
                    <button
                      class={`btn ${isCompleted ? "btn-completed" : "btn-mark"}`}
                      onClick={() => {
                        if (isCompleted) {
                          onToggleComplete(lake.id, null);
                        } else {
                          onToggleComplete(lake.id, new Date().toISOString().slice(0, 10));
                        }
                      }}
                    >
                      {isCompleted ? "Swum ✓" : "Mark as swum"}
                    </button>
                    <button class="btn btn-remove" onClick={() => onToggleLake(lake.id)}>
                      Remove
                    </button>
                  </>
                )}
                {isCompleted && swim && (
                  <input
                    type="date"
                    class="track-item-date"
                    value={swim.date}
                    onChange={(e) =>
                      onToggleComplete(lake.id, (e.target as HTMLInputElement).value)
                    }
                  />
                )}
                <a class="btn-maps-link" href={mapsUrl} target="_blank" rel="noreferrer">
                  Maps ↗
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {displayLakes.length === 0 && (
        <p style={{ textAlign: "center", color: "var(--text-dim)", padding: "2rem" }}>
          {showAll
            ? "No lakes match your filters."
            : "No lakes selected yet. Switch to \"All Lakes\" to start picking."}
        </p>
      )}
    </div>
  );
}
