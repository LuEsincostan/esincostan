import { useRef, useEffect } from "preact/hooks";

interface Props {
  elevations: number[];
  coords: [number, number][];
}

function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function gradientColor(gradPct: number): string {
  if (gradPct >= -1) return "#27ae60"; // flat/uphill
  if (gradPct >= -3) return "#8bc34a"; // gentle downhill
  if (gradPct >= -6) return "#ffc107"; // moderate
  if (gradPct >= -10) return "#ff9800"; // steep
  return "#e74c3c"; // very steep
}

export function ElevationProfile({ elevations, coords }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || elevations.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    // Compute cumulative distances
    const distances = [0];
    for (let i = 1; i < coords.length; i++) {
      distances.push(distances[i - 1] + haversineM(coords[i - 1], coords[i]));
    }
    const totalDist = distances[distances.length - 1];

    const minElev = Math.min(...elevations) - 20;
    const maxElev = Math.max(...elevations) + 20;
    const elevRange = maxElev - minElev || 1;

    const pad = { top: 10, bottom: 25, left: 45, right: 10 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    const toX = (d: number) => pad.left + (d / totalDist) * plotW;
    const toY = (e: number) => pad.top + plotH - ((e - minElev) / elevRange) * plotH;

    // Background
    ctx.fillStyle = "#fafaf8";
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 0.5;
    const elevStep = elevRange > 500 ? 200 : elevRange > 200 ? 100 : 50;
    for (let e = Math.ceil(minElev / elevStep) * elevStep; e <= maxElev; e += elevStep) {
      const y = toY(e);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = "#888";
      ctx.font = "10px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(e)}m`, pad.left - 5, y + 3);
    }

    // Distance labels
    ctx.fillStyle = "#888";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "center";
    const distStepKm = totalDist > 15000 ? 5 : totalDist > 5000 ? 2 : 1;
    for (let d = 0; d <= totalDist / 1000; d += distStepKm) {
      const x = toX(d * 1000);
      ctx.fillText(`${d}km`, x, H - 5);
    }

    // Fill area under profile with gradient coloring
    for (let i = 0; i < elevations.length - 1; i++) {
      const x1 = toX(distances[i]);
      const x2 = toX(distances[i + 1]);
      const y1 = toY(elevations[i]);
      const y2 = toY(elevations[i + 1]);
      const dist = distances[i + 1] - distances[i];
      const gradPct = dist > 0 ? ((elevations[i + 1] - elevations[i]) / dist) * 100 : 0;
      const color = gradientColor(gradPct);

      ctx.fillStyle = color + "30"; // semi-transparent
      ctx.beginPath();
      ctx.moveTo(x1, toY(minElev));
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2, toY(minElev));
      ctx.closePath();
      ctx.fill();
    }

    // Draw profile line with gradient colors
    ctx.lineWidth = 2;
    for (let i = 0; i < elevations.length - 1; i++) {
      const x1 = toX(distances[i]);
      const x2 = toX(distances[i + 1]);
      const y1 = toY(elevations[i]);
      const y2 = toY(elevations[i + 1]);
      const dist = distances[i + 1] - distances[i];
      const gradPct = dist > 0 ? ((elevations[i + 1] - elevations[i]) / dist) * 100 : 0;

      ctx.strokeStyle = gradientColor(gradPct);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }, [elevations, coords]);

  if (elevations.length < 2) return null;

  return (
    <div class="rs-elevation-chart">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "160px", display: "block" }}
      />
    </div>
  );
}
