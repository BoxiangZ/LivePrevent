"use client";

/**
 * 富文本警报卡 — Alerts 页的核心元素。
 * 展示：severity、事件、时间、为何触发（含基线倍数）、支持信号、
 * 建议动作、通知了谁、当前状态。
 */

import Link from "next/link";
import type { SnapshotAlert } from "@/server/snapshot";
import type { DemoStateSnapshot } from "@/server/snapshot";
import { RiskBadge } from "./RiskBadge";
import { cn } from "@/client/cn";

const ACTION: Record<string, string> = {
  possible_fall: "Contact the selected person now. If there may be an emergency, contact local emergency services.",
  prolonged_inactivity: "Check in with the selected person.",
  heart_rate_deviation: "Review the event and consider a check-in.",
  activity_drop: "Review the recent activity trend and consider a check-in.",
  device_data_gap: "Check the device battery and network connection.",
};

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  open: { text: "Open", className: "text-important" },
  acknowledged: { text: "Acknowledged", className: "text-brand-600" },
  resolved: { text: "Resolved", className: "text-stable" },
  auto_expired: { text: "Auto-expired", className: "text-ink-mute" },
};

export function AlertCard({
  alert,
  snapshot,
}: {
  alert: SnapshotAlert;
  snapshot: DemoStateSnapshot;
}) {
  const event = snapshot.events.find((e) => e.id === alert.eventId);
  const why = event?.signals.map((signal) => signal.description).slice(0, 2).join("; ") || "Review the available signals and baseline context.";
  const action = ACTION[alert.eventType] ?? "Review the details.";
  const notified = [...new Set(alert.notifications.map((n) => n.contactId))]
    .map((id) => snapshot.contacts.find((c) => c.id === id)?.name ?? "—")
    .filter(Boolean);
  const status = STATUS_LABEL[alert.status] ?? STATUS_LABEL.open;

  const when = new Date(alert.createdAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: snapshot.subject.timeZone,
  });

  return (
    <Link
      href={`/events/${alert.eventId}`}
      className={cn(
        "block rounded-xl border bg-surface p-4 shadow-card transition-shadow hover:shadow-lift",
        alert.level === "critical" && alert.status !== "resolved"
          ? "border-critical/40 ring-1 ring-critical/20"
          : "border-surface-line"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge level={alert.level} size="sm" />
            <h3 className="text-sm font-semibold tracking-tight text-ink">{alert.eventLabel}</h3>
            <span className={cn("text-xs font-medium", status.className)}>· {status.text}</span>
          </div>
          <div className="mt-0.5 text-xs text-ink-mute">{when} · {snapshot.subject.timeZone}</div>
        </div>
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{why}</p>

      {event && event.signals.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {event.signals.slice(0, 3).map((s, i) => (
            <span
              key={i}
              className="rounded-md bg-surface-soft px-2 py-0.5 text-[11px] text-ink-soft"
            >
              {s.description}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-surface-line pt-2.5 text-xs">
        <span className="text-ink-soft">
          <span className="font-medium text-ink">Next step:</span> {action}
        </span>
        {notified.length > 0 && (
          <span className="text-ink-mute">
            Notified: {notified.join(", ")}
          </span>
        )}
      </div>
    </Link>
  );
}
