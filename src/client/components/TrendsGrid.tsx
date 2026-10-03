"use client";

/**
 * 7D / 30D / 90D 纵向趋势图 — 带基线参考线，米级可读。
 * 每个指标一张卡：大数字 + 偏离 + 迷你图 + 窗口切换。
 */

import { useMemo, useState } from "react";
import { useDemo } from "@/client/provider/DemoProvider";
import type { TrendMetric } from "@/shared/types/event";
import type { TrendPoint } from "@/shared/types/baseline";
import { cn } from "@/client/cn";

const WINDOWS = [
  { key: 7, label: "7D" },
  { key: 30, label: "30D" },
  { key: 90, label: "90D" },
] as const;

const METRIC_ORDER: TrendMetric[] = ["activity", "resting_hr", "sleep", "mobility"];

export function TrendsGrid() {
  const { snapshot } = useDemo();
  const [window, setWindow] = useState<7 | 30 | 90>(30);
  if (!snapshot) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-ink">Long-term trends</h2>
          <p className="mt-0.5 text-sm text-ink-mute">
            Compared against Margaret's personal baseline.
          </p>
        </div>
        <div className="flex rounded-lg border border-surface-line bg-surface p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWindow(w.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                window === w.key ? "bg-brand-600 text-white" : "text-ink-soft hover:bg-surface-soft"
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {METRIC_ORDER.map((m) => (
          <TrendCard key={m} metric={m} window={window} />
        ))}
      </div>
    </div>
  );
}

function TrendCard({ metric, window }: { metric: TrendMetric; window: 7 | 30 | 90 }) {
  const { snapshot } = useDemo();
  if (!snapshot) return null;
  const s = snapshot.metricSummaries.find((x) => x.metric === metric);
  const full = snapshot.trends[metric] ?? [];
  const points = useMemo(() => full.slice(-window), [full, window]);
  if (!s) return null;

  const delta = s.deltaPct;
  const deltaColor =
    delta === null
      ? "text-ink-mute"
      : metric === "resting_hr"
        ? Math.abs(delta) < 0.08
          ? "text-stable"
          : "text-watch"
        : delta <= -0.15
          ? "text-watch"
          : Math.abs(delta) < 0.1
            ? "text-stable"
            : "text-ink-soft";

  return (
    <div className="rounded-xl border border-surface-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-ink-mute">{s.label}</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
              {s.current !== null ? formatValue(s.current, metric) : "—"}
            </span>
            <span className="text-sm text-ink-mute">{s.unit}</span>
          </div>
        </div>
        <div className={cn("text-right text-sm font-semibold tabular-nums", deltaColor)}>
          {delta !== null && (
            <>
              {delta > 0 ? "+" : ""}
              {Math.round(delta * 100)}%
              <div className="text-[10px] font-normal text-ink-mute">vs baseline</div>
            </>
          )}
        </div>
      </div>

      <div className="mt-3">
        <Sparkline points={points} baseline={s.baseline} metric={metric} height={64} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-mute">
        <span>
          Baseline {s.baseline !== null ? formatValue(s.baseline, metric) : "—"} {s.unit}
        </span>
        {s.delta30dPct !== null && window >= 30 && (
          <span>
            {s.delta30dPct > 0 ? "+" : ""}
            {Math.round(s.delta30dPct * 100)}% over 30d
          </span>
        )}
      </div>
    </div>
  );
}

export function Sparkline({
  points,
  baseline,
  metric,
  height = 64,
  markerDate,
}: {
  points: TrendPoint[];
  baseline: number | null;
  metric: TrendMetric;
  height?: number;
  markerDate?: string | null;
}) {
  const width = 300;
  const pad = 4;
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values, baseline ?? Infinity);
  const max = Math.max(...values, baseline ?? -Infinity);
  const range = max - min || 1;
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / range) * (height - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const markerIdx = markerDate ? points.findIndex((p) => p.date === markerDate) : -1;

  // 面积填充（ subtle ）
  const areaPath = `${path} L${x(points.length - 1).toFixed(1)},${height - pad} L${x(0).toFixed(1)},${height - pad} Z`;

  const strokeColor = metric === "resting_hr" ? "#dc2626" : "#347d9c";

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block">
      <defs>
        <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.18" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {baseline !== null && (
        <>
          <line
            x1={pad}
            x2={width - pad}
            y1={y(baseline)}
            y2={y(baseline)}
            stroke="#94a3b8"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
        </>
      )}
      <path d={areaPath} fill={`url(#grad-${metric})`} />
      <path d={path} fill="none" stroke={strokeColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {markerIdx >= 0 && (
        <circle cx={x(markerIdx)} cy={y(points[markerIdx].value)} r={4} fill="#dc2626" stroke="#fff" strokeWidth={1.5} />
      )}
    </svg>
  );
}

function formatValue(v: number, metric: TrendMetric): string {
  if (metric === "activity") return Math.round(v).toLocaleString("en-US");
  if (metric === "resting_hr") return String(Math.round(v));
  return v.toFixed(1);
}
