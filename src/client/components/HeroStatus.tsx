"use client";

/**
 * Overview 顶部 hero 状态条 — 一眼读懂"现在是否安全"。
 * - stable: clear current status for the selected person.
 * - watch/important: 状态 + 需要 review
 * - critical: 显著红色 + 当前事件摘要 + 倒计时
 */

import Link from "next/link";
import { useDemo } from "@/client/provider/DemoProvider";
import type { RiskLevel } from "@/shared/types/risk";
import { cn } from "@/client/cn";

const LEVEL_BG: Record<RiskLevel, string> = {
  stable: "from-emerald-50 to-teal-50 border-emerald-200",
  watch: "from-amber-50 to-orange-50 border-amber-200",
  important: "from-orange-50 to-red-50 border-orange-200",
  critical: "from-red-600 to-rose-700 border-red-700",
};

const LEVEL_TEXT: Record<RiskLevel, { title: string; sub: string; dark: boolean }> = {
  stable: { title: "is stable", sub: "No urgent intervention required.", dark: false },
  watch: { title: "is being watched", sub: "A small change from the usual pattern — monitoring.", dark: false },
  important: { title: "needs attention", sub: "A meaningful deviation from the personal baseline. Review recommended.", dark: false },
  critical: { title: "may need help now", sub: "Immediate attention recommended.", dark: true },
};

export function HeroStatus() {
  const { snapshot, msUntil } = useDemo();
  if (!snapshot) return <div className="h-32 animate-pulse rounded-2xl bg-surface-soft" />;

  const level = snapshot.overallLevel;
  const meta = LEVEL_TEXT[level];

  const criticalAlert = snapshot.activeCriticalAlertId
    ? snapshot.alerts.find((a) => a.id === snapshot.activeCriticalAlertId)
    : null;
  const criticalEvent = criticalAlert
    ? snapshot.events.find((e) => e.id === criticalAlert.eventId)
    : null;
  const nextMs = criticalAlert ? msUntil(criticalAlert.escalation.nextStageAt) : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br px-6 py-6 shadow-card sm:px-8",
        LEVEL_BG[level],
        meta.dark && "text-white"
      )}
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="min-w-0 flex-1">
          <div className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", meta.dark ? "text-white/70" : "text-ink-mute")}>
            Current status · Simulated data
          </div>
          <h1 className={cn("mt-1.5 text-3xl font-semibold tracking-tight sm:text-4xl", meta.dark ? "text-white" : "text-ink")}>
            {level === "stable" ? "Stable" : level === "watch" ? "Watch" : level === "important" ? "Needs attention" : "May need help now"}
          </h1>
          <p className={cn("mt-1.5 text-sm sm:text-base", meta.dark ? "text-white/85" : "text-ink-soft")}>
            {meta.sub}
          </p>

          {criticalAlert && criticalEvent && (
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="font-medium">
                Possible fall detected
                {criticalAlert.levelHistory.length > 1 && " · unrecovered"}
              </span>
              {nextMs !== null && nextMs > 0 && criticalAlert.status === "open" && (
                <span className="text-white/85">
                  Next escalation in <Countdown ms={nextMs} />
                </span>
              )}
              {criticalAlert.status === "acknowledged" && (
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
                  Acknowledged
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <StatusRing level={level} />
          {criticalAlert && (
            <Link
              href={`/events/${criticalAlert.eventId}`}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-critical shadow-lift hover:bg-white/90"
            >
              Review event →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusRing({ level }: { level: RiskLevel }) {
  const ring: Record<RiskLevel, string> = {
    stable: "border-stable text-stable",
    watch: "border-watch text-watch",
    important: "border-important text-important",
    critical: "border-white/80 text-white",
  };
  const label: Record<RiskLevel, string> = {
    stable: "Stable",
    watch: "Watch",
    important: "Important",
    critical: "Critical",
  };
  return (
    <div className={cn("flex h-24 w-24 flex-col items-center justify-center rounded-full border-[5px] bg-white/60 backdrop-blur-sm", ring[level], level === "critical" && "animate-pulse bg-white/10")}>
      <span className="text-[10px] font-semibold uppercase tracking-widest opacity-70">Risk</span>
      <span className="text-base font-bold leading-tight">{label[level]}</span>
    </div>
  );
}

export function Countdown({ ms }: { ms: number }) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return (
    <span className="font-mono font-semibold tabular-nums">
      {m}:{ss.toString().padStart(2, "0")}
    </span>
  );
}
