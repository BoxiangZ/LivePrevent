/**
 * 零依赖内联 SVG 迷你趋势线 — 30/90 天趋势（PRD §4.2 / §11）
 * 合成数据带 watermark 标注（PRD §19）。
 */

import type { TrendPoint } from "@/types/baseline";

export function TrendChart({
  points,
  median,
  height = 56,
  markerDate,
  synthetic = true,
}: {
  points: TrendPoint[];
  median: number | null;
  height?: number;
  /** 事件标记日期（YYYY-MM-DD） */
  markerDate?: string | null;
  synthetic?: boolean;
}) {
  const width = 280;
  const pad = 4;
  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values, median ?? Infinity);
  const max = Math.max(...values, median ?? -Infinity);
  const range = max - min || 1;

  const x = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / range) * (height - pad * 2);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const markerIdx = markerDate ? points.findIndex((p) => p.date === markerDate) : -1;

  return (
    <div className="relative inline-block">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block">
        {median !== null && (
          <line
            x1={pad}
            x2={width - pad}
            y1={y(median)}
            y2={y(median)}
            stroke="#9ca3af"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
        )}
        <path d={path} fill="none" stroke="#6366f1" strokeWidth={1.8} strokeLinejoin="round" />
        {markerIdx >= 0 && (
          <circle cx={x(markerIdx)} cy={y(points[markerIdx].value)} r={3.5} fill="#ef4444" stroke="#fff" strokeWidth={1.2} />
        )}
      </svg>
      {synthetic && (
        <span className="pointer-events-none absolute right-1 top-0 text-[9px] uppercase tracking-wide text-gray-300">
          synthetic
        </span>
      )}
    </div>
  );
}
