"use client";
import { useEffect, useState } from "react";
import { statusLabels, type Monitoring } from "@/shared/contracts/monitoring";
import { cn } from "@/client/cn";

export function MonitoringStatus({
  status,
  monitoring,
  reason,
}: {
  status: keyof typeof statusLabels;
  monitoring: Monitoring;
  reason?: string;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = monitoring.lastDataReceivedAt
    ? Math.max(
        0,
        Math.floor((now - Date.parse(monitoring.lastDataReceivedAt)) / 1000),
      )
    : null;
  // A paused UI, stale snapshot or network failure cannot claim live monitoring.
  const actual =
    status === "critical" || status === "paused"
      ? status
      : elapsed === null || elapsed >= 900
        ? "unknown"
        : status;
  const tone = {
    stable: "bg-stable",
    watch: "bg-watch",
    important: "bg-important",
    critical: "bg-critical",
    unknown: "bg-slate-400",
    paused: "bg-slate-400",
  }[actual];
  return (
    <section
      className={cn(
        "panel border-l-4",
        actual === "critical"
          ? "border-l-critical"
          : actual === "important"
            ? "border-l-important"
            : actual === "watch"
              ? "border-l-watch"
              : actual === "stable"
                ? "border-l-stable"
                : "border-l-slate-400",
      )}
      aria-label="Monitoring status"
    >
      <div className="flex items-center gap-5">
        <span
          className={cn(
            "status-breath block h-8 w-8 shrink-0 rounded-full",
            tone,
          )}
          aria-hidden="true"
        />
        <div>
          <p className="eyebrow">Current status</p>
          <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
            {statusLabels[actual]}
          </h2>
        </div>
      </div>
      {reason && <p className="mt-4 text-ink-soft">{reason}</p>}
      <p className="mt-4 text-sm font-medium">
        {actual === "paused"
          ? "Monitoring paused"
          : actual !== "unknown" && elapsed !== null && elapsed < 900
            ? "Live monitoring"
            : "Monitoring data unavailable"}
        {monitoring.simulatorEnabled && " · Simulated heartbeat"}
      </p>
      <p className="mt-1 text-xs text-ink-mute">
        {elapsed === null
          ? "No monitoring data received"
          : `Last update: ${elapsed < 60 ? `${elapsed} seconds` : `${Math.floor(elapsed / 60)} minutes`} ago`}
        {actual === "unknown" && " · Current condition cannot be verified"}
      </p>
    </section>
  );
}
