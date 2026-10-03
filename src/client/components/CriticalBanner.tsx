"use client";

/**
 * Critical 全局红色横幅 — 存在未处理 Critical 警报时跨页面常驻。
 */

import Link from "next/link";
import { useDemo } from "@/client/provider/DemoProvider";
import { Countdown } from "./HeroStatus";

const EVENT_LABEL: Record<string, string> = {
  possible_fall: "Possible fall",
  prolonged_inactivity: "Abnormal inactivity",
  heart_rate_deviation: "Heart rate deviation",
  activity_drop: "Activity below baseline",
  device_data_gap: "Data gap",
};

export function CriticalBanner() {
  const { snapshot, msUntil, ackAlert, busy } = useDemo();
  if (!snapshot?.activeCriticalAlertId) return null;

  const alert = snapshot.alerts.find((a) => a.id === snapshot.activeCriticalAlertId);
  if (!alert || alert.status === "resolved") return null;

  const nextMs = msUntil(alert.escalation.nextStageAt);
  const primary = snapshot.contacts[0];

  return (
    <div className="w-full bg-critical text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="font-semibold">
            CRITICAL — {EVENT_LABEL[alert.eventType] ?? alert.eventType}
          </span>
          <span className="ml-3 text-sm text-white/85">
            {alert.status === "acknowledged" ? (
              "Acknowledged — follow-up in progress"
            ) : alert.escalation.unacknowledged ? (
              <span className="font-medium">Unacknowledged — reminding all contacts</span>
            ) : nextMs !== null && nextMs > 0 ? (
              <>
                Next escalation in <Countdown ms={nextMs} />
              </>
            ) : (
              "Escalating…"
            )}
          </span>
        </div>
        {alert.status === "open" && primary && (
          <button
            onClick={() => ackAlert(alert.id, primary.id)}
            disabled={busy}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-critical hover:bg-white/90 disabled:opacity-50"
          >
            Acknowledge as {primary.name.split(" ")[0]}
          </button>
        )}
        <Link
          href={`/events/${alert.eventId}`}
          className="rounded-lg border border-white/60 px-3 py-1.5 text-sm font-medium hover:bg-white/10"
        >
          Review →
        </Link>
      </div>
    </div>
  );
}
