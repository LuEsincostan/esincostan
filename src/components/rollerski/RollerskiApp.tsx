import { useState, useMemo } from "preact/hooks";
import type { RollerskiRoute, RollerskiFilters, RouteType } from "../../data/rollerski-types";
import { RouteMap } from "./RouteMap";
import { RouteList } from "./RouteList";
import { RouteFilters } from "./RouteFilters";
import { ElevationProfile } from "./ElevationProfile";

interface Props {
  routes: RollerskiRoute[];
}

const defaultFilters: RollerskiFilters = {
  routeType: "all",
  minLength: 0,
  maxLength: 100,
  maxGradient: 100,
  minScore: 0,
  search: "",
};

export function RollerskiApp({ routes }: Props) {
  const [filters, setFilters] = useState<RollerskiFilters>(defaultFilters);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const filteredRoutes = useMemo(() => {
    return routes.filter((r) => {
      if (filters.routeType !== "all" && r.type !== filters.routeType) return false;
      if (r.lengthKm < filters.minLength) return false;
      if (r.lengthKm > filters.maxLength) return false;
      if (r.maxDownhillPct > filters.maxGradient) return false;
      if (r.avgScore < filters.minScore) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        if (!r.name.toLowerCase().includes(s) && !r.description.toLowerCase().includes(s)) {
          return false;
        }
      }
      return true;
    });
  }, [routes, filters]);

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null;

  return (
    <div class="rs-app">
      <header class="site-header rs-header">
        <div class="header-content">
          <a href="/" class="back-link">&larr; esincostan</a>
          <h1>Rollerski Routes</h1>
          <p class="header-subtitle">
            Best routes for rollerski around Wadenswil &amp; Zurich region
          </p>
        </div>
      </header>

      <div class="rs-stats-bar">
        <div class="stat-card">
          <span class="stat-value">{routes.length}</span>
          <span class="stat-label">Routes</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">
            {Math.round(routes.reduce((s, r) => s + r.lengthKm, 0))}
          </span>
          <span class="stat-label">Total km</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">
            {Math.round(routes.reduce((s, r) => s + r.elevationGainM, 0)).toLocaleString()}
          </span>
          <span class="stat-label">Total m gain</span>
        </div>
      </div>

      <RouteMap
        routes={filteredRoutes}
        selectedRouteId={selectedRouteId}
        onSelectRoute={setSelectedRouteId}
      />

      {selectedRoute && (
        <div class="rs-detail-panel">
          <div class="rs-detail-header">
            <h2>{selectedRoute.name}</h2>
            <button class="rs-close-btn" onClick={() => setSelectedRouteId(null)}>
              &times;
            </button>
          </div>
          <p class="rs-detail-desc">{selectedRoute.description}</p>
          <div class="rs-detail-stats">
            <span>{selectedRoute.lengthKm} km</span>
            <span>+{selectedRoute.elevationGainM}m / -{selectedRoute.elevationLossM}m</span>
            <span>Score: {(selectedRoute.avgScore * 100).toFixed(0)}%</span>
          </div>
          <ElevationProfile
            elevations={selectedRoute.elevations}
            coords={selectedRoute.coords}
          />
        </div>
      )}

      <RouteFilters filters={filters} onChange={setFilters} />

      <RouteList
        routes={filteredRoutes}
        selectedRouteId={selectedRouteId}
        onSelectRoute={setSelectedRouteId}
      />
    </div>
  );
}
