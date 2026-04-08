import { useEffect, useRef } from "preact/hooks";
import type { RollerskiRoute } from "../../data/rollerski-types";
import { scoreToColor } from "./scoring";

interface Props {
  routes: RollerskiRoute[];
  selectedRouteId: string | null;
  onSelectRoute: (id: string | null) => void;
}

export function RouteMap({ routes, selectedRouteId, onSelectRoute }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;

    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView([47.23, 8.67], 10);

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 18,
        }
      ).addTo(map);

      leafletRef.current = { map, L };
      routeLayerRef.current = L.layerGroup().addTo(map);
      renderRoutes(L, routeLayerRef.current, routes, selectedRouteId, onSelectRoute);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Update routes when selection/filter changes
  useEffect(() => {
    if (!leafletRef.current || !routeLayerRef.current) return;
    const { L } = leafletRef.current;
    routeLayerRef.current.clearLayers();
    renderRoutes(L, routeLayerRef.current, routes, selectedRouteId, onSelectRoute);
  }, [routes, selectedRouteId]);

  return (
    <div class="map-container">
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      <div class="rs-map-legend">
        <span class="rs-legend-title">Suitability</span>
        <span class="rs-legend-item">
          <span class="rs-legend-dot" style={{ background: "#27ae60" }} /> Excellent
        </span>
        <span class="rs-legend-item">
          <span class="rs-legend-dot" style={{ background: "#8bc34a" }} /> Good
        </span>
        <span class="rs-legend-item">
          <span class="rs-legend-dot" style={{ background: "#ffc107" }} /> Moderate
        </span>
        <span class="rs-legend-item">
          <span class="rs-legend-dot" style={{ background: "#ff9800" }} /> Poor
        </span>
        <span class="rs-legend-item">
          <span class="rs-legend-dot" style={{ background: "#e74c3c" }} /> Avoid
        </span>
      </div>
    </div>
  );
}

function renderRoutes(
  L: any,
  layer: any,
  routes: RollerskiRoute[],
  selectedId: string | null,
  onSelect: (id: string | null) => void
) {
  for (const route of routes) {
    if (route.coords.length < 2) continue;
    const isSelected = route.id === selectedId;
    const color = scoreToColor(route.avgScore);

    // Route polyline
    const line = L.polyline(route.coords, {
      color: isSelected ? "#1a3a2a" : color,
      weight: isSelected ? 6 : 4,
      opacity: isSelected ? 1 : 0.85,
    }).addTo(layer);

    line.on("click", () => onSelect(isSelected ? null : route.id));

    line.bindPopup(`
      <strong>${route.name}</strong><br/>
      ${route.lengthKm} km &middot; +${route.elevationGainM}m<br/>
      Score: ${(route.avgScore * 100).toFixed(0)}%<br/>
      <em>${route.type}</em>
    `);

    // Start marker
    const startIcon = L.divIcon({
      className: "rs-marker-start",
      html: `<div class="rs-marker" style="background:${color}">S</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    L.marker(route.coords[0], { icon: startIcon }).addTo(layer);

    // End marker for non-loops
    if (route.type !== "loop") {
      const endIcon = L.divIcon({
        className: "rs-marker-end",
        html: `<div class="rs-marker" style="background:#e74c3c">E</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      L.marker(route.coords[route.coords.length - 1], { icon: endIcon }).addTo(layer);
    }
  }
}
