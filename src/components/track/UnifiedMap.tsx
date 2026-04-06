import { useEffect, useRef } from "preact/hooks";
import type { Lake, CompletedSwim } from "../../data/types";

interface Props {
  lakes: Lake[];
  selectedIds: string[];
  completedSwims: CompletedSwim[];
}

const COLORS = {
  available: { fill: "#b0b0b0", border: "#999" },
  selected: { fill: "#2980b9", border: "#fff" },
  completed: { fill: "#27ae60", border: "#fff" },
};

// Switzerland bounds for reset view
const CH_BOUNDS: [[number, number], [number, number]] = [
  [45.82, 5.95],
  [47.81, 10.49],
];

export function UnifiedMap({ lakes, selectedIds, completedSwims }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const completedIds = new Set(completedSwims.map((s) => s.lakeId));
  const selectedSet = new Set(selectedIds);

  const resetView = () => {
    if (mapRef.current) {
      mapRef.current.fitBounds(CH_BOUNDS, { padding: [20, 20] });
    }
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      const map = L.map(containerRef.current!, {
        scrollWheelZoom: true,
      });

      // Fit to Switzerland bounds initially
      map.fitBounds(CH_BOUNDS, { padding: [20, 20] });

      // CartoDB Positron — clean, minimal, low-detail basemap
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 18,
        subdomains: "abcd",
      }).addTo(map);

      mapRef.current = map;
      updateMarkers(L);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => updateMarkers(L));
  }, [selectedIds, completedSwims]);

  function getStatus(id: string): "completed" | "selected" | "available" {
    if (completedIds.has(id)) return "completed";
    if (selectedSet.has(id)) return "selected";
    return "available";
  }

  function updateMarkers(L: any) {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const sortOrder = { available: 0, selected: 1, completed: 2 };
    const sorted = [...lakes].sort(
      (a, b) => sortOrder[getStatus(a.id)] - sortOrder[getStatus(b.id)]
    );

    sorted.forEach((lake) => {
      const status = getStatus(lake.id);
      const color = COLORS[status];
      const name = lake.nameDe || lake.name;
      const size = status === "available" ? 8 : 12;
      const swim = completedSwims.find((s) => s.lakeId === lake.id);

      const showLabel = status !== "available";

      const icon = L.divIcon({
        className: "",
        html: `<div style="display:flex;align-items:center;gap:3px;white-space:nowrap;">
          <div style="
            width:${size}px;height:${size}px;border-radius:50%;flex-shrink:0;
            background:${color.fill};border:2px solid ${color.border};
            box-shadow:0 1px 3px rgba(0,0,0,0.25);
            opacity:${status === "available" ? "0.5" : "1"};
          "></div>
          ${showLabel ? `<span style="
            font-family:Inter,sans-serif;font-size:10px;font-weight:600;
            color:${color.fill};text-shadow:0 0 3px white,0 0 3px white,0 0 3px white;
            pointer-events:none;
          ">${name}</span>` : ""}
        </div>`,
        iconSize: [0, 0],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([lake.lat, lake.lon], {
        icon,
        zIndexOffset: sortOrder[status] * 100,
      }).addTo(map);

      const statusLabel = status === "completed"
        ? `<span style="color:#27ae60">Completed${swim ? ` on ${swim.date}` : ""}</span>`
        : status === "selected"
        ? `<span style="color:#2980b9">Selected</span>`
        : `<span style="color:#999">Not selected</span>`;

      const popupContent = `
        <strong>${name}</strong><br/>
        ${lake.elevationM ? `${lake.elevationM}m` : ""}
        ${lake.areaKm2 ? ` · ${lake.areaKm2} km²` : ""}<br/>
        ${statusLabel}
      `;
      marker.bindPopup(popupContent);
      markersRef.current.push(marker);
    });
  }

  return (
    <div style={{ position: "relative" }}>
      <div ref={containerRef} class="map-container" />
      <button
        class="map-reset-btn"
        onClick={resetView}
        title="Reset to all of Switzerland"
      >
        Switzerland
      </button>
    </div>
  );
}
