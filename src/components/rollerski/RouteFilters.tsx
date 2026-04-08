import type { RollerskiFilters, RouteType } from "../../data/rollerski-types";

interface Props {
  filters: RollerskiFilters;
  onChange: (filters: RollerskiFilters) => void;
}

export function RouteFilters({ filters, onChange }: Props) {
  const update = (partial: Partial<RollerskiFilters>) => {
    onChange({ ...filters, ...partial });
  };

  return (
    <div class="rs-filter-panel">
      <div class="rs-filter-row">
        <label class="rs-filter-label">
          Search
          <input
            type="text"
            class="rs-filter-input"
            placeholder="Route name..."
            value={filters.search}
            onInput={(e) => update({ search: (e.target as HTMLInputElement).value })}
          />
        </label>

        <label class="rs-filter-label">
          Type
          <select
            class="rs-filter-select"
            value={filters.routeType}
            onChange={(e) =>
              update({ routeType: (e.target as HTMLSelectElement).value as RouteType | "all" })
            }
          >
            <option value="all">All</option>
            <option value="loop">Loop</option>
            <option value="point-to-point">Point-to-Point</option>
            <option value="out-and-back">Out &amp; Back</option>
          </select>
        </label>
      </div>

      <div class="rs-filter-row">
        <label class="rs-filter-label">
          Min length: {filters.minLength} km
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={filters.minLength}
            onInput={(e) =>
              update({ minLength: Number((e.target as HTMLInputElement).value) })
            }
          />
        </label>

        <label class="rs-filter-label">
          Min score: {Math.round(filters.minScore * 100)}%
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={filters.minScore}
            onInput={(e) =>
              update({ minScore: Number((e.target as HTMLInputElement).value) })
            }
          />
        </label>
      </div>
    </div>
  );
}
