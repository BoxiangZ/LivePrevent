/**
 * 升级链纯函数 — PRD §6.3
 * 时间线（初始值，按 DEMO_TIME_SCALE 加速）：
 *   T+0     通知联系人 #1（Email + SMS + Push）
 *   T+5min  未确认 → 通知联系人 #2，同时再次提醒 #1
 *   T+15min 仍未确认 → 通知全部联系人
 *   T+30min 仍未确认 → 标记 Unacknowledged，每 15 分钟重复提醒
 * Critical 不受免打扰限制；Important 可遵守（本模块只算 Critical 时间线）。
 */

import {
  ESCALATION_STAGE2_MIN,
  ESCALATION_STAGE3_MIN,
  ESCALATION_STAGE4_MIN,
  ESCALATION_REPEAT_REMINDER_MIN,
  DEMO_TIME_SCALE,
} from "@/lib/constants";
import type { Contact, EscalationStage, EscalationState } from "@/types/alert";

const MIN_MS = 60_000;

/** 各阶段的实际偏移（分钟，真实时间） */
export const STAGE_OFFSET_MIN: Record<EscalationStage, number> = {
  t0_notify_primary: 0,
  t5_notify_second: ESCALATION_STAGE2_MIN,
  t15_notify_all: ESCALATION_STAGE3_MIN,
  t30_unacknowledged: ESCALATION_STAGE4_MIN,
};

/** 阶段顺序 */
export const ESCALATION_STAGE_ORDER: EscalationStage[] = [
  "t0_notify_primary",
  "t5_notify_second",
  "t15_notify_all",
  "t30_unacknowledged",
];

/** 某阶段相对 T+0 的触发时刻（毫秒，已按 timeScale 加速） */
export function stageAtMs(createdMs: number, stage: EscalationStage, timeScale = DEMO_TIME_SCALE): number {
  return createdMs + (STAGE_OFFSET_MIN[stage] * MIN_MS) / timeScale;
}

/** 初始升级状态（T+0 已发出，下一节点 T+5） */
export function computeEscalationSchedule(
  alertId: string,
  subjectId: string,
  createdMs: number,
  timeScale = DEMO_TIME_SCALE
): EscalationState {
  return {
    subjectId,
    alertId,
    currentStage: "t0_notify_primary",
    nextStageAt: new Date(stageAtMs(createdMs, "t5_notify_second", timeScale)).toISOString(),
    repeatReminderEveryMin: null,
    unacknowledged: false,
    stageLog: [],
  };
}

export function nextEscalationStage(stage: EscalationStage): EscalationStage | null {
  const i = ESCALATION_STAGE_ORDER.indexOf(stage);
  return i >= 0 && i < ESCALATION_STAGE_ORDER.length - 1
    ? ESCALATION_STAGE_ORDER[i + 1]
    : null;
}

/**
 * 各阶段应通知 / 提醒的联系人 — PRD §6.3
 * contacts 需已按 escalationOrder 升序。
 */
export function contactsForStage(
  stage: EscalationStage,
  contacts: Contact[]
): { notify: Contact[]; remind: Contact[] } {
  const sorted = [...contacts].sort((a, b) => a.escalationOrder - b.escalationOrder);
  switch (stage) {
    case "t0_notify_primary":
      return { notify: sorted.slice(0, 1), remind: [] };
    case "t5_notify_second":
      return { notify: sorted.slice(1, 2), remind: sorted.slice(0, 1) };
    case "t15_notify_all":
      return { notify: sorted, remind: [] };
    case "t30_unacknowledged":
      return { notify: sorted, remind: [] }; // 重复提醒全员
  }
}

/** T+30 后的重复提醒间隔（毫秒，已加速） */
export function repeatReminderMs(timeScale = DEMO_TIME_SCALE): number {
  return (ESCALATION_REPEAT_REMINDER_MIN * MIN_MS) / timeScale;
}
