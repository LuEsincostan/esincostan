import type { RollerskiRoute } from "../../data/rollerski-types";
import { RouteCard } from "./RouteCard";

interface Props {
  routes: RollerskiRoute[];
  selectedRouteId: string | null;
  onSelectRoute: (id: string | null) => void;
}

export function RouteList({ routes, selectedRouteId, onSelectRoute }: Props) {
  if (routes.length === 0) {
    return (
      <div class="rs-empty">
        No routes match your filters.
      </div>
    );
  }

  return (
    <div class="rs-route-grid">
      {routes.map((route) => (
        <RouteCard
          key={route.id}
          route={route}
          isSelected={route.id === selectedRouteId}
          onSelect={() => onSelectRoute(route.id === selectedRouteId ? null : route.id)}
        />
      ))}
    </div>
  );
}
