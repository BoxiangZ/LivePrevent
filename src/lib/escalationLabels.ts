import type { EscalationStage } from "@/types/alert";

export const ESCALATION_STAGE_LABEL_ZH: Record<EscalationStage, string> = {
  t0_notify_primary: "T+0 已通知联系人 #1",
  t5_notify_second: "T+5min 通知联系人 #2 并提醒 #1",
  t15_notify_all: "T+15min 通知全部联系人",
  t30_unacknowledged: "T+30min 标记未确认，每 15 分钟重复提醒",
};
