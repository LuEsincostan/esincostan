import { useState, useMemo } from "preact/hooks";
import type { Lake } from "../../data/types";
import { FilterControls, type SortOption } from "./FilterControls";
import { LakeCard } from "./LakeCard";

interface Props {
  lakes: Lake[];
  selectedIds: string[];
  onToggleLake: (id: string) => void;
}

export function CurateTab({ lakes, selectedIds, onToggleLake }: Props) {
  const [search, setSearch] = useState("");
  const [minArea, setMinArea] = useState(0);
  const [maxAltitude, setMaxAltitude] = useState(4000);
  const [minTemp, setMinTemp] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>("name");

  const filteredLakes = useMemo(() => {
    return lakes
      .filter((lake) => {
        if (search) {
          const q = search.toLowerCase();
          const nameMatch =
            lake.name.toLowerCase().includes(q) ||
            (lake.nameDe?.toLowerCase().includes(q) ?? false);
          if (!nameMatch) return false;
        }
        if (lake.areaKm2 !== null && lake.areaKm2 < minArea) return false;
        if (maxAltitude < 4000 && lake.elevationM !== null && lake.elevationM > maxAltitude)
          return false;
        if (minTemp > 0 && (lake.avgSummerTempC === null || lake.avgSummerTempC < minTemp))
          return false;
        return true;
      })
      .sort((a, b) => {
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
  }, [lakes, search, minArea, maxAltitude, minTemp, sortBy]);

  return (
    <div class="tab-content">
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

      <div class="selection-counter">
        {selectedIds.length} / 40 selected &middot; {filteredLakes.length} lakes shown
      </div>

      <div class="lake-grid">
        {filteredLakes.map((lake) => (
          <LakeCard
            key={lake.id}
            lake={lake}
            isSelected={selectedIds.includes(lake.id)}
            onToggle={onToggleLake}
          />
        ))}
      </div>

      {filteredLakes.length === 0 && (
        <p style={{ textAlign: "center", color: "var(--text-dim)", padding: "2rem" }}>
          No lakes match your filters.
        </p>
      )}
    </div>
  );
}
