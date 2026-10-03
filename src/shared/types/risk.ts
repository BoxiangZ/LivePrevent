/**
 * 统一风险等级体系 — PRD §3
 * Dashboard 与通知全产品通用四级，不做第二套口径。
 */

export const RISK_LEVELS = [
  "stable",
  "watch",
  "important",
  "critical",
] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** 等级元数据：颜色、语义、通知策略速查（完整策略见 PRD §3.1） */
export const RISK_LEVEL_META: Record<
  RiskLevel,
  {
    label: string;
    color: "stable" | "watch" | "important" | "critical";
    emoji: string;
    /** 与 JEV alert_priority 的对应 — PRD §5.3 */
    jevPriority: "normal" | "notice" | "important" | "critical";
    /** 是否参与通知升级流程 — PRD §6 */
    escalates: boolean;
  }
> = {
  stable: {
    label: "Stable",
    color: "stable",
    emoji: "🟢",
    jevPriority: "normal",
    escalates: false,
  },
  watch: {
    label: "Low risk",
    color: "watch",
    emoji: "🟡",
    jevPriority: "notice",
    escalates: false,
  },
  important: {
    label: "Moderate risk",
    color: "important",
    emoji: "🟠",
    jevPriority: "important",
    escalates: false, // 可选开启 — PRD §3.1
  },
  critical: {
    label: "Critical",
    color: "critical",
    emoji: "🔴",
    jevPriority: "critical",
    escalates: true,
  },
};

/** 警报状态机 — PRD §6.4
 * Open → Acknowledged → Resolved
 *   └── Auto-expired（仅 Watch / Important，超时无新信号）
 * Critical 不会自动 Resolved，必须人工确认处理结果。
 */
export const ALERT_STATUSES = [
  "open",
  "acknowledged",
  "resolved",
  "auto_expired",
] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

/** Resolve 时必须选择的原因 — PRD §6.4 / §5.7 */
export const RESOLVE_REASONS = [
  "real_event_handled", // 真实事件已处理
  "false_positive", // 误报
  "device_issue", // 设备问题
  "other", // 其他
] as const;
export type ResolveReason = (typeof RESOLVE_REASONS)[number];
