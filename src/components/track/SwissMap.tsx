import { useEffect, useRef } from "preact/hooks";
import type { Lake, CompletedSwim } from "../../data/types";

interface Props {
  lakes: Lake[];
  selectedIds: string[];
  completedSwims: CompletedSwim[];
}

export function SwissMap({ lakes, selectedIds, completedSwims }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const completedIds = new Set(completedSwims.map((s) => s.lakeId));
  const selectedLakes = lakes.filter((l) => selectedIds.includes(l.id));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      const map = L.map(containerRef.current!, {
        center: [46.8, 8.2],
        zoom: 8,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
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

  function updateMarkers(L: any) {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    selectedLakes.forEach((lake) => {
      const isCompleted = completedIds.has(lake.id);
      const swim = completedSwims.find((s) => s.lakeId === lake.id);
      const color = isCompleted ? "#27ae60" : "#2980b9";
      const name = lake.nameDe || lake.name;

      const icon = L.divIcon({
        className: "",
        html: `<div style="display:flex;align-items:center;gap:4px;white-space:nowrap;">
          <div style="
            width:12px;height:12px;border-radius:50%;flex-shrink:0;
            background:${color};border:2px solid white;
            box-shadow:0 1px 4px rgba(0,0,0,0.3);
          "></div>
          <span style="
            font-family:Inter,sans-serif;font-size:10px;font-weight:600;
            color:${color};text-shadow:0 0 3px white,0 0 3px white,0 0 3px white;
            pointer-events:none;
          ">${name}</span>
        </div>`,
        iconSize: [0, 0],
        iconAnchor: [6, 6],
      });

      const marker = L.marker([lake.lat, lake.lon], { icon }).addTo(map);

      const popupContent = `
        <strong>${name}</strong><br/>
        ${lake.elevationM ? `${lake.elevationM}m` : ""}
        ${lake.areaKm2 ? ` · ${lake.areaKm2} km²` : ""}
        ${isCompleted && swim ? `<br/><span style="color:#27ae60">Swum on ${swim.date}</span>` : ""}
      `;
      marker.bindPopup(popupContent);
      markersRef.current.push(marker);
    });
  }

  return <div ref={containerRef} class="map-container" />;
}
