import { useEffect, useRef } from "preact/hooks";
import { computeProjection } from "./projection";
import type { CompletedSwim } from "../../data/types";

interface Props {
  completedSwims: CompletedSwim[];
  goalCount: number;
  goalDeadline: string;
}

export function ProjectionChart({ completedSwims, goalCount, goalDeadline }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 20, right: 20, bottom: 30, left: 40 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    const points = computeProjection(completedSwims, goalCount, goalDeadline);
    const deadline = new Date(goalDeadline);

    if (points.length === 0) {
      ctx.fillStyle = "#8B7355";
      ctx.font = "14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No data yet", w / 2, h / 2);
      return;
    }

    // Time range
    const allDates = points.map((p) => p.date.getTime());
    allDates.push(deadline.getTime());
    const minTime = Math.min(...allDates);
    const maxTime = Math.max(...allDates);
    const timeRange = maxTime - minTime || 1;

    const toX = (d: Date) => pad.left + ((d.getTime() - minTime) / timeRange) * plotW;
    const toY = (count: number) => pad.top + plotH - (count / goalCount) * plotH;

    // Background
    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "#e8e0d0";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= goalCount; i += 10) {
      const y = toY(i);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    // Goal line
    ctx.strokeStyle = "#27ae60";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, toY(goalCount));
    ctx.lineTo(w - pad.right, toY(goalCount));
    ctx.stroke();
    ctx.setLineDash([]);

    // Deadline line
    const deadlineX = toX(deadline);
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(deadlineX, pad.top);
    ctx.lineTo(deadlineX, h - pad.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Actual progress
    const actualPoints = points.filter((p) => !p.projected);
    const projectedPoints = points.filter((p) => p.projected);

    if (actualPoints.length > 0) {
      ctx.strokeStyle = "#1a3a2a";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      actualPoints.forEach((p, i) => {
        const x = toX(p.date);
        const y = toY(p.count);
        if (i === 0) ctx.moveTo(x, y);
        else {
          // Step function
          ctx.lineTo(x, toY(actualPoints[i - 1].count));
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }

    // Projected line
    if (projectedPoints.length > 0) {
      const startPoint = actualPoints.length > 0 ? actualPoints[actualPoints.length - 1] : projectedPoints[0];
      ctx.strokeStyle = "#2980b9";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(toX(startPoint.date), toY(startPoint.count));
      projectedPoints.forEach((p) => {
        ctx.lineTo(toX(p.date), toY(p.count));
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Y-axis labels
    ctx.fillStyle = "#8B7355";
    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.textAlign = "right";
    for (let i = 0; i <= goalCount; i += 10) {
      ctx.fillText(String(i), pad.left - 6, toY(i) + 3);
    }

    // X-axis labels (years)
    ctx.textAlign = "center";
    const startYear = new Date(minTime).getFullYear();
    const endYear = new Date(maxTime).getFullYear();
    for (let y = startYear; y <= endYear; y++) {
      const x = toX(new Date(y, 0, 1));
      if (x >= pad.left && x <= w - pad.right) {
        ctx.fillText(String(y), x, h - pad.bottom + 16);
      }
    }

    // Deadline label
    ctx.fillStyle = "#e74c3c";
    ctx.font = "9px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText("deadline", deadlineX, pad.top - 6);
  }, [completedSwims, goalCount, goalDeadline]);

  return (
    <div class="chart-container">
      <canvas ref={canvasRef} style={{ width: "100%", height: "200px" }} />
      <div class="chart-legend">
        <span class="legend-item">
          <span class="legend-dot" style={{ background: "#1a3a2a" }} /> Actual
        </span>
        <span class="legend-item">
          <span class="legend-dot" style={{ background: "#2980b9" }} /> Projected
        </span>
        <span class="legend-item">
          <span class="legend-dot" style={{ background: "#27ae60" }} /> Goal (40)
        </span>
        <span class="legend-item">
          <span class="legend-dot" style={{ background: "#e74c3c" }} /> Deadline
        </span>
      </div>
    </div>
  );
}
