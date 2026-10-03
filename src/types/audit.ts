/**
 * 审计日志 — PRD §8.5 / §6.4
 * 所有查看、导出、授权变更、警报操作写入审计日志。保留期见 lib/constants（PRD §8.4）。
 */

import type { Role } from "./subject";

export const AUDIT_ACTIONS = [
  // 同意与权限 — PRD §8.1 / §8.3
  "consent_granted",
  "consent_revoked",
  "consent_narrowed",
  "monitoring_paused",
  "monitoring_resumed",
  "member_invited",
  "member_removed",
  "permission_changed",
  // 警报链路 — PRD §6.4
  "alert_created",
  "alert_escalated",
  "alert_acknowledged",
  "alert_resolved",
  "alert_auto_expired",
  "notification_sent",
  "notification_delivery_failed",
  // 数据访问 — PRD §8.5
  "data_viewed",
  "data_exported",
  // 基线管理 — PRD §18 风险"基线被污染"
  "baseline_reset",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditLogEntry {
  id: string;
  /** ISO 8601 */
  at: string;
  actorUserId: string | null;
  actorRole: Role | "system";
  subjectId: string;
  action: AuditAction;
  /** member_invited / member_removed / permission_changed 等动作的目标 */
  targetUserId: string | null;
  targetContactId: string | null;
  /** 结构化补充（如 alertId、范围、结果），不含原始健康数据 */
  detail: Record<string, string | number | boolean | null>;
  /** 请求来源 IP（传输与存储加密 — PRD §8.5） */
  ip: string | null;
}
