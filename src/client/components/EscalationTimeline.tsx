"use client";

/**
 * 升级时间线 — T+0 → T+5 → T+15 → T+30。
 * 显示已触发阶段（含通知对象）与下一阶段倒计时。
 */

import type { Alert, Contact } from "@/shared/types/alert";
import { ESCALATION_STAGE_ORDER } from "@/server/alerts/escalation";
import { Countdown } from "@/client/components/HeroStatus";
import type { useDemo } from "@/client/provider/DemoProvider";
import { cn } from "@/client/cn";

const STAGE_SHORT = ["T+0", "T+5", "T+15", "T+30"];
const STAGE_DESC = [
  "Primary notified",
  "Second + remind primary",
  "All contacts",
  "Unacknowledged · repeat",
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
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-ink">Escalation timeline</h3>
        {stopped && (
          <span className="text-xs text-ink-mute">
            Stopped — {alert.status === "acknowledged" ? "acknowledged" : "resolved"}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-start">
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
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                    fired
                      ? "border-critical bg-critical text-white"
                      : isNext
                        ? "animate-pulse border-important bg-important/10 text-important"
                        : "border-surface-line bg-surface-soft text-ink-mute"
                  )}
                >
                  {STAGE_SHORT[i]}
                </div>
                <div className="mt-1.5 max-w-[76px] text-[10px] leading-tight text-ink-mute">
                  {STAGE_DESC[i]}
                </div>
                {log && (
                  <div className="mt-1 max-w-[76px] text-[10px] leading-tight text-ink-soft">
                    {log.notifiedContactIds
                      .map((id) => contacts.find((c) => c.id === id)?.name.split(" ")[0] ?? id)
                      .join(", ")}
                  </div>
                )}
                {isNext && nextMs !== null && nextMs > 0 && (
                  <div className="mt-0.5 text-[11px] font-semibold text-important">
                    <Countdown ms={nextMs} />
                  </div>
                )}
              </div>
              {i < ESCALATION_STAGE_ORDER.length - 1 && (
                <div className={cn("mx-1 mt-4 h-0.5 flex-1 rounded", fired ? "bg-critical" : "bg-surface-line")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
