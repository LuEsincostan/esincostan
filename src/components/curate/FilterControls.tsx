export type SortOption = "name" | "area" | "altitude" | "temperature";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  minArea: number;
  onMinAreaChange: (v: number) => void;
  maxAltitude: number;
  onMaxAltitudeChange: (v: number) => void;
  minTemp: number;
  onMinTempChange: (v: number) => void;
  sortBy: SortOption;
  onSortChange: (v: SortOption) => void;
}

export function FilterControls({
  search,
  onSearchChange,
  minArea,
  onMinAreaChange,
  maxAltitude,
  onMaxAltitudeChange,
  minTemp,
  onMinTempChange,
  sortBy,
  onSortChange,
}: Props) {
  return (
    <div class="filter-panel">
      <div class="filter-row">
        <div class="filter-group" style={{ minWidth: "200px" }}>
          <label class="filter-label">Search by name</label>
          <input
            class="filter-input"
            type="text"
            placeholder="e.g. Zürichsee..."
            value={search}
            onInput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
          />
        </div>

        <div class="filter-group">
          <label class="filter-label">Sort by</label>
          <select
            class="filter-input"
            value={sortBy}
            onChange={(e) => onSortChange((e.target as HTMLSelectElement).value as SortOption)}
          >
            <option value="name">Name (A-Z)</option>
            <option value="area">Area (largest first)</option>
            <option value="altitude">Altitude (lowest first)</option>
            <option value="temperature">Temperature (warmest first)</option>
          </select>
        </div>
      </div>

      <div class="filter-row" style={{ marginTop: "0.8rem" }}>
        <div class="filter-group">
          <label class="filter-label">
            Min area (km²): <span class="filter-value">{minArea}</span>
          </label>
          <input
            class="filter-slider"
            type="range"
            min="0"
            max="50"
            step="0.5"
            value={minArea}
            onInput={(e) => onMinAreaChange(parseFloat((e.target as HTMLInputElement).value))}
          />
        </div>

        <div class="filter-group">
          <label class="filter-label">
            Max altitude (m): <span class="filter-value">{maxAltitude === 4000 ? "any" : maxAltitude}</span>
          </label>
          <input
            class="filter-slider"
            type="range"
            min="200"
            max="4000"
            step="100"
            value={maxAltitude}
            onInput={(e) => onMaxAltitudeChange(parseInt((e.target as HTMLInputElement).value))}
          />
        </div>

        <div class="filter-group">
          <label class="filter-label">
            Min temperature (°C): <span class="filter-value">{minTemp === 0 ? "any" : minTemp}</span>
          </label>
          <input
            class="filter-slider"
            type="range"
            min="0"
            max="25"
            step="1"
            value={minTemp}
            onInput={(e) => onMinTempChange(parseInt((e.target as HTMLInputElement).value))}
          />
        </div>
      </div>
    </div>
  );
}
