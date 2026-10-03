"use client";

/**
 * Critical 全局红色横幅 — PRD §3.1 / §19 步骤 4
 * 存在未处理 Critical 警报时跨页面常驻，显示升级倒计时与确认操作。
 */

import Link from "next/link";
import { useDemo } from "@/components/DemoProvider";
import { EVENT_TYPE_LABELS_ZH } from "@/lib/labels";
import { ESCALATION_STAGE_LABEL_ZH } from "@/lib/escalationLabels";

export function CriticalBanner() {
  const { snapshot, msUntil, ackAlert, busy } = useDemo();
  if (!snapshot?.activeCriticalAlertId) return null;

  const alert = snapshot.alerts.find((a) => a.id === snapshot.activeCriticalAlertId);
  if (!alert || alert.status === "resolved") return null;

  const nextMs = msUntil(alert.escalation.nextStageAt);
  const stageLabel = alert.escalation.currentStage
    ? ESCALATION_STAGE_LABEL_ZH[alert.escalation.currentStage]
    : null;

  return (
    <div className="w-full bg-critical text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <span className="text-lg" aria-hidden>
          🔴
        </span>
        <div className="min-w-0 flex-1">
          <span className="font-semibold">
            CRITICAL — {EVENT_TYPE_LABELS_ZH[alert.eventType]}（{snapshot.subject.alias}）
          </span>
          <span className="ml-3 text-sm text-white/85">
            {alert.status === "acknowledged" ? (
              "已确认，待处理"
            ) : alert.escalation.unacknowledged ? (
              <span className="font-medium text-white">未确认 — 持续重复提醒全部联系人</span>
            ) : nextMs !== null && nextMs > 0 ? (
              <>
                {stageLabel} · 下一阶段倒计时{" "}
                <Countdown ms={nextMs} />
              </>
            ) : (
              "升级链推进中…"
            )}
          </span>
        </div>
        {alert.status === "open" && (
          <button
            onClick={() => ackAlert(alert.id, snapshot.contacts[0]?.id)}
            disabled={busy}
            className="rounded-md bg-white px-3 py-1 text-sm font-semibold text-critical hover:bg-white/90 disabled:opacity-50"
          >
            Acknowledge（{snapshot.contacts[0]?.name.split("(")[0].trim()}）
          </button>
        )}
        <Link
          href={`/events/${alert.eventId}`}
          className="rounded-md border border-white/60 px-3 py-1 text-sm font-medium hover:bg-white/10"
        >
          Review →
        </Link>
      </div>
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
