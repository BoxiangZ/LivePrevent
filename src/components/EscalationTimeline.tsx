"use client";

/**
 * 升级时间线可视化 — PRD §6.3 / §19 步骤 6
 * T+0 → T+5 → T+15 → T+30，显示已触发阶段（含通知对象）与下一阶段倒计时。
 * Demo 时间轴已按倍数加速（18×）。
 */

import type { Alert, Contact } from "@/types/alert";
import { ESCALATION_STAGE_ORDER } from "@/lib/alerts/escalation";
import { Countdown } from "@/components/CriticalBanner";
import type { useDemo } from "@/components/DemoProvider";

const STAGE_SHORT = ["T+0", "T+5", "T+15", "T+30"];
const STAGE_DESC = [
  "通知联系人 #1",
  "通知 #2 + 提醒 #1",
  "通知全部联系人",
  "未确认 · 重复提醒",
];

export function EscalationTimeline({
  alert,
  contacts,
  msUntil,
}: {
  alert: Alert;
  contacts: Contact[];
  msUntil: ReturnType<typeof useDemo>["msUntil"];
}) {
  const firedStages = new Set(alert.escalation.stageLog.map((s) => s.stage));
  const stopped = alert.status !== "open";
  const nextMs = msUntil(alert.escalation.nextStageAt);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">升级时间线（已加速 {18}×）</h3>
        {stopped && <span className="text-xs text-gray-400">已停止（{alert.status === "acknowledged" ? "已确认" : "已处理"}）</span>}
      </div>
      <div className="mt-3 flex items-start">
        {ESCALATION_STAGE_ORDER.map((stage, i) => {
          const fired = firedStages.has(stage);
          const isNext =
            !stopped &&
            alert.escalation.currentStage !== null &&
            ESCALATION_STAGE_ORDER.indexOf(alert.escalation.currentStage) === i - 1 &&
            !alert.escalation.unacknowledged;
          const log = alert.escalation.stageLog.find((s) => s.stage === stage);
          return (
            <div key={stage} className="flex flex-1 items-start">
              <div className="flex flex-col items-center text-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                    fired
                      ? "border-critical bg-critical text-white"
                      : isNext
                        ? "border-important bg-important/10 text-important animate-pulse"
                        : "border-gray-200 bg-gray-50 text-gray-400"
                  }`}
                >
                  {STAGE_SHORT[i]}
                </div>
                <div className="mt-1 text-[10px] leading-tight text-gray-500">{STAGE_DESC[i]}</div>
                {log && (
                  <div className="mt-0.5 text-[10px] leading-tight text-gray-400">
                    {log.notifiedContactIds
                      .map((id) => contacts.find((c) => c.id === id)?.name.split("(")[0].trim() ?? id)
                      .join(", ")}
                  </div>
                )}
                {isNext && nextMs !== null && nextMs > 0 && (
                  <div className="mt-0.5 text-[10px] font-semibold text-important">
                    <Countdown ms={nextMs} />
                  </div>
                )}
              </div>
              {i < ESCALATION_STAGE_ORDER.length - 1 && (
                <div className={`mx-1 mt-4 h-0.5 flex-1 ${fired ? "bg-critical" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
