"use client";

/**
 * "Why this matters" AI 洞察卡 — 解释"为什么现在需要关注"。
 * 稳定时展示长期趋势解读；有事件时切换为事件上下文 + 建议动作。
 */

import { useDemo } from "@/client/provider/DemoProvider";
import { Card, CardBody } from "./ui";
import { cn } from "@/client/cn";

export function WhyThisMatters() {
  const { snapshot } = useDemo();
  if (!snapshot) return null;

  const criticalAlert = snapshot.activeCriticalAlertId
    ? snapshot.alerts.find((a) => a.id === snapshot.activeCriticalAlertId)
    : null;
  const openImportant = snapshot.alerts.find(
    (a) => a.status === "open" && a.level === "important"
  );

  const active = criticalAlert ?? openImportant ?? null;
  const event = active ? snapshot.events.find((e) => e.id === active.eventId) : null;
  const summary = event ? snapshot.kimiSummaries[event.id] : null;

  const activity = snapshot.metricSummaries.find((m) => m.metric === "activity");
  const sleep = snapshot.metricSummaries.find((m) => m.metric === "sleep");

  const isCritical = !!criticalAlert && criticalAlert.status !== "resolved";

  return (
    <Card tone={isCritical ? "critical" : "default"} className={cn(isCritical && "border-critical/40")}>
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <SparkIcon className={isCritical ? "text-critical" : "text-brand-600"} />
          <h3 className={cn("text-sm font-semibold tracking-tight", isCritical ? "text-critical" : "text-ink")}>
            Why this matters
          </h3>
        </div>

        {active && event ? (
          <div className="space-y-2.5 text-sm leading-relaxed text-ink-soft">
            <p>
              <span className="font-medium text-ink">{eventLabel(active.eventType)}</span>{" "}
              detected {timeAgo(event.occurredAt, snapshot.nowMs)} — this combines{" "}
              {event.independentChannelCount} independent signals:
            </p>
            <ul className="space-y-1 pl-1">
              {event.signals.slice(0, 4).map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className={cn("mt-1.5 h-1 w-1 shrink-0 rounded-full", isCritical ? "bg-critical" : "bg-brand-400")} />
                  <span>{s.description}</span>
                </li>
              ))}
            </ul>
            {summary && (
              <p className="rounded-lg bg-surface-soft px-3 py-2 text-[13px] text-ink-soft">
                {summary.baselineComparison}
              </p>
            )}
            <p className="pt-1 text-[13px] font-medium text-ink">
              Recommended:{" "}
              {isCritical
                ? "call Margaret immediately. If unreachable, check on her or contact local emergency services."
                : "check in with Margaret when convenient."}
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-sm leading-relaxed text-ink-soft">
            <p>
              Margaret's activity and sleep have been{" "}
              <span className="font-medium text-ink">gradually declining over the past 30 days</span>
              {activity?.delta30dPct != null && (
                <>
                  {" "}(activity {Math.round(Math.abs(activity.delta30dPct) * 100)}% down
                  {sleep?.delta30dPct != null && `, sleep ${Math.round(Math.abs(sleep.delta30dPct) * 100)}% down`})
                </>
              )}
              . This is still within a safe range, but the trend is worth watching.
            </p>
            <p className="text-[13px] text-ink-mute">
              LivePrevent compares everything to{" "}
              <span className="font-medium text-ink-soft">Margaret's own baseline</span>, not
              population averages — so small, personal changes surface early.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function eventLabel(t: string): string {
  const map: Record<string, string> = {
    possible_fall: "Possible fall",
    prolonged_inactivity: "Abnormal inactivity",
    heart_rate_deviation: "Heart rate deviation",
    activity_drop: "Activity below baseline",
    device_data_gap: "Data gap",
  };
  return map[t] ?? t;
}

function timeAgo(iso: string, nowMs: number): string {
  const diff = Math.max(0, nowMs - Date.parse(iso));
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={cn("h-4 w-4", className)} aria-hidden>
      <path d="M10 1.5l1.9 5.1 5.1 1.9-5.1 1.9L10 15.5l-1.9-5.1-5.1-1.9 5.1-1.9L10 1.5z" />
      <path d="M15.5 12l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" opacity=".6" />
    </svg>
  );
}
