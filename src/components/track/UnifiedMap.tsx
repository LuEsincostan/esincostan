import { useEffect, useRef } from "preact/hooks";
import type { Lake, CompletedSwim } from "../../data/types";

interface Props {
  lakes: Lake[];
  selectedIds: string[];
  completedSwims: CompletedSwim[];
  onToggleLake: (id: string) => void;
  onToggleComplete: (lakeId: string, date: string | null) => void;
}

const COLORS = {
  available: { fill: "#b0b0b0", border: "#999" },
  selected: { fill: "#ec4899", border: "#fff" },
  completed: { fill: "#27ae60", border: "#fff" },
};

const CH_BOUNDS: [[number, number], [number, number]] = [
  [45.82, 5.95],
  [47.81, 10.49],
];

export function UnifiedMap({ lakes, selectedIds, completedSwims, onToggleLake, onToggleComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const locationMarkerRef = useRef<any>(null);

  const completedIds = new Set(completedSwims.map((s) => s.lakeId));
  const selectedSet = new Set(selectedIds);

  // Store callbacks in refs so popup handlers always have current values
  const onToggleLakeRef = useRef(onToggleLake);
  const onToggleCompleteRef = useRef(onToggleComplete);
  onToggleLakeRef.current = onToggleLake;
  onToggleCompleteRef.current = onToggleComplete;

  // Global handler for popup button clicks
  useEffect(() => {
    (window as any).__lakeAction = (action: string, lakeId: string) => {
      if (action === "add" || action === "remove") {
        onToggleLakeRef.current(lakeId);
      } else if (action === "complete") {
        onToggleCompleteRef.current(lakeId, new Date().toISOString().slice(0, 10));
      } else if (action === "uncomplete") {
        onToggleCompleteRef.current(lakeId, null);
      }
      // Close popup
      if (mapRef.current) mapRef.current.closePopup();
    };
    return () => { delete (window as any).__lakeAction; };
  }, []);

  const resetView = () => {
    if (mapRef.current) {
      mapRef.current.fitBounds(CH_BOUNDS, { padding: [20, 20] });
    }
  };

  const showLocation = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        import("leaflet").then((L) => {
          const map = mapRef.current;
          if (!map) return;

          // Remove old location marker
          if (locationMarkerRef.current) {
            locationMarkerRef.current.remove();
          }

          const { latitude, longitude } = pos.coords;
          const icon = L.divIcon({
            className: "",
            html: `<div style="
              width:16px;height:16px;border-radius:50%;
              background:#4285f4;border:3px solid white;
              box-shadow:0 0 0 2px rgba(66,133,244,0.3),0 2px 6px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });

          locationMarkerRef.current = L.marker([latitude, longitude], {
            icon,
            zIndexOffset: 1000,
          }).addTo(map);
          locationMarkerRef.current.bindPopup("You are here");

          map.setView([latitude, longitude], 11);
        });
      },
      () => {
        // Geolocation denied or unavailable
      }
    );
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      const map = L.map(containerRef.current!, {
        scrollWheelZoom: true,
      });

      map.fitBounds(CH_BOUNDS, { padding: [20, 20] });

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

    const btnStyle = `
      display:inline-block;font-family:IBM Plex Mono,monospace;font-size:11px;
      font-weight:500;padding:4px 10px;border-radius:5px;cursor:pointer;
      border:none;margin-top:6px;margin-right:4px;
    `;

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

      // Build popup with action buttons
      let actions = "";
      if (status === "available") {
        actions = `<button style="${btnStyle}background:#1a3a2a;color:#fff;" onclick="__lakeAction('add','${lake.id}')">Add to list</button>`;
      } else if (status === "selected") {
        actions = `
          <button style="${btnStyle}background:#ec4899;color:#fff;" onclick="__lakeAction('complete','${lake.id}')">Mark as swum</button>
          <button style="${btnStyle}background:transparent;color:#e67e22;border:1px solid #e67e22;" onclick="__lakeAction('remove','${lake.id}')">Remove</button>
        `;
      } else {
        actions = `
          <span style="display:block;color:#27ae60;font-size:12px;margin-top:4px;">Swum${swim ? ` on ${swim.date}` : ""}</span>
          <button style="${btnStyle}background:transparent;color:#999;border:1px solid #ccc;" onclick="__lakeAction('uncomplete','${lake.id}')">Undo</button>
        `;
      }

      const popupContent = `
        <div style="min-width:140px;">
          <strong style="font-size:13px;">${name}</strong><br/>
          <span style="font-size:11px;color:#666;">
            ${lake.elevationM ? `${lake.elevationM}m` : ""}
            ${lake.areaKm2 ? ` · ${lake.areaKm2} km²` : ""}
            ${lake.avgSummerTempC ? ` · ${lake.avgSummerTempC}°C` : ""}
          </span>
          <div>${actions}</div>
        </div>
      `;
      marker.bindPopup(popupContent);
      markersRef.current.push(marker);
    });
  }

  return (
    <div style={{ position: "relative" }}>
      <div ref={containerRef} class="map-container" />
      <div class="map-controls">
        <button class="map-ctrl-btn" onClick={showLocation} title="Show my location">
          My Location
        </button>
        <button class="map-ctrl-btn" onClick={resetView} title="Reset to all of Switzerland">
          Switzerland
        </button>
      </div>
    </div>
  );
}
