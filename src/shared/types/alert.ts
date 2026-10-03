/**
 * 联系人链、警报与升级 — PRD §6
 */

import type { AlertStatus, ResolveReason, RiskLevel } from "./risk";
import type { EventType } from "./event";

/** 通知渠道 — PRD §6.1 */
export const NOTIFICATION_CHANNELS = [
  "email",
  "sms",
  "push",
  "voice_call",
] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** 联系人 — PRD §6.2：至少 1 位主联系人，强烈建议 1 位同城/同时区联系人 */
export interface Contact {
  id: string;
  subjectId: string;
  userId: string | null; // 关联家属账户（外部联系人可为 null）
  name: string;
  email?: string;
  phone?: string;
  relationship?: string;
  role?: "family" | "caregiver" | "healthcare_provider";
  subscriptions?: { critical: boolean; moderate: boolean; low: boolean };
  /** 升级顺序，1 = 主联系人，T+0 即通知 */
  escalationOrder: number;
  timeZone: string; // IANA
  channels: NotificationChannel[];
  /** SMS 需验证手机号 — PRD §6.1 */
  phoneVerified: boolean;
  /** 免打扰时段（仅 Important 遵守；Critical 不受限 — PRD §6.3） */
  quietHours: { start: string; end: string } | null; // "HH:mm"
}

/** 警报 — 由 Alert Engine 生成，状态机见 risk.ts — PRD §6.4 */
export interface Alert {
  id: string;
  subjectId: string;
  eventId: string;
  /** 事件类别快照（通知模板与列表展示用 — PRD §7.1） */
  eventType: EventType;
  level: RiskLevel;
  status: AlertStatus;
  /** T+0（ISO 8601）。升级时间线以此为基准 — PRD §6.3 */
  createdAt: string;
  /** 等级变化历史（如跌倒事件由 Important 升 Critical — PRD §5.2） */
  levelHistory: Array<{ level: RiskLevel; at: string; trigger: string }>;
  /** 通知发送记录（模板即时发送，不等 Kimi — PRD §10.3） */
  notifications: NotificationRecord[];
  /** 升级追踪 — PRD §6.3 */
  escalation: EscalationState;
  /** Acknowledge 记录：任一授权联系人点击即停止升级 — PRD §6.4 */
  acknowledgedBy: string | null; // contact id
  acknowledgedAt: string | null;
  /** Resolve 记录（Critical 必须人工处理）— PRD §6.4 */
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolveReason: ResolveReason | null;
  resolveNote: string | null;
  /** Auto-expire 仅限 Watch/Important，超时无新信号 — PRD §6.4 */
  autoExpiredAt: string | null;
}

/** 单次通知发送记录 */
export interface NotificationRecord {
  id: string;
  alertId: string;
  contactId: string;
  channel: NotificationChannel;
  sentAt: string;
  /** 通道送达监控 — PRD §18 风险"Critical 通知未送达" */
  deliveryStatus: "pending" | "sent" | "delivered" | "failed";
  simulated?: boolean;
  providerMessageId?: string;
  error?: string;
  attempts?: number;
  nextAttemptAt?: string;
  retryable?: boolean;
  leaseUntil?: number;
  recipientEmail?: string;
  /** Critical 深度链接的一次性限时 token — PRD §7.1 */
  oneTimeTokenId: string | null;
  oneTimeTokenExpiresAt: string | null;
}

/** 升级阶段 — PRD §6.3 时间线 */
export const ESCALATION_STAGES = [
  "t0_notify_primary", // T+0 联系人 #1（Email + SMS + Push）
  "t5_notify_second", // T+5min 未确认 → #2 + 再提醒 #1
  "t15_notify_all", // T+15min → 全部联系人（含护理团队）
  "t30_unacknowledged", // T+30min → 标记 Unacknowledged，每 15 分钟重复提醒
] as const;
export type EscalationStage = (typeof ESCALATION_STAGES)[number];

export interface EscalationState {
  subjectId: string;
  alertId: string;
  currentStage: EscalationStage | null;
  /** 下一阶段触发时间（ISO 8601）；Acknowledged 后为 null */
  nextStageAt: string | null;
  /** 重复提醒间隔（T+30 后每 15 分钟） */
  repeatReminderEveryMin: number | null;
  /** T+30 后仍未确认的标记 — Dashboard 持续红色 */
  unacknowledged: boolean;
  /** 各阶段通知记录 — 用于渲染升级时间线（PRD §19 步骤 6） */
  stageLog: Array<{
    stage: EscalationStage;
    at: string;
    notifiedContactIds: string[];
    remindedContactIds: string[];
  }>;
}

/** 警报订阅设置 — PRD §11.2 默认值 */
export interface AlertSubscriptionSettings {
  subjectId: string;
  /** 疑似跌倒：主联系人不可关闭 */
  possible_fall: boolean;
  heart_rate_deviation: boolean;
  prolonged_inactivity: boolean;
  activity_drop: boolean;
  device_data_gap: boolean;
  /** 睡眠变化默认关闭（Dashboard 展示但不发通知） */
  sleep_change: boolean;
  /** Watch 级 Email 默认不发，可选开启 — PRD §3.1 */
  watchEmailEnabled: boolean;
  /** Important 可选开启升级流程 — PRD §3.1 */
  importantEscalationEnabled: boolean;
}

/** 警报类别订阅键（与 EventType 对齐 + 趋势类 sleep_change） */
export type AlertSubscriptionKey = EventType | "sleep_change";
