/**
 * 账户、成员邀请、一次性安全链接、免打扰、警报自动过期 — PRD §6 / §7.1 / §8.3 / §12
 * 与 subject.ts 的角色权限矩阵配合使用。
 */

import type { Role } from "./subject";

/** 登录用户（家属账户）— PRD §2.3 / §8.3 */
export interface User {
  id: string;
  email: string;
  displayName: string;
  /** 每位被监测老人下的角色（一个用户可对多位老人有不同角色） */
  rolesBySubject: Record<string, Role>;
  /** 2FA — PRD §8.5 家属账户支持 2FA */
  totpEnabled: boolean;
  createdAt: string;
}

/** 成员邀请 — PRD §8.3 manage_members */
export const INVITATION_STATUSES = ["pending", "accepted", "revoked"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export interface MemberInvitation {
  id: string;
  subjectId: string;
  inviterUserId: string;
  invitedEmail: string;
  role: Role;
  tokenHash: string;
  expiresAt: string;
  status: InvitationStatus;
  createdAt: string;
}

/**
 * Critical 深度链接的一次性限时 token — PRD §7.1
 * 初始有效期 30 分钟（见 lib/constants CRITICAL_LINK_TTL_MIN），
 * 打开后仍需会话验证（sessionVerified）。
 */
export interface OneTimeToken {
  id: string;
  /** 仅存哈希，不存明文 — PRD §8.5 */
  tokenHash: string;
  alertId: string;
  contactId: string;
  issuedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  /** 打开链接后是否已通过会话验证 */
  sessionVerified: boolean;
}

/**
 * 免打扰时段（仅 Important 遵守；Critical 不受限 — PRD §6.3）
 * Important 在免打扰期内延后，时段结束后合并发送，且必须明确告知用户这一点。
 */
export interface QuietHoursWindow {
  /** null = 每天 */
  dayOfWeek: number | null; // 0-6
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export interface QuietHours {
  windows: QuietHoursWindow[];
  /** 免打扰期 Important 的处理方式：时段结束后合并发送 */
  deferralBehaviour: "merge_at_end";
}

/** 监测暂停记录（隐私模式）— PRD §8.1：暂停/恢复均需可审计，家属侧显示"监测已暂停" */
export interface PauseRecord {
  id: string;
  subjectId: string;
  pausedByUserId: string | null; // null = 老人本人（手表/物理按钮入口）
  pausedAt: string;
  resumedAt: string | null;
}

/** 套餐 — PRD §12。unlimited 用 null 表示（Infinity 不可 JSON 序列化） */
export const PLAN_IDS = ["basic", "premium"] as const;
// PlanId 在 lib/constants.ts 中由 PLANS 导出，此处不重复定义。

/** 订阅：付费账户 → 被监测老人 */
export interface Subscription {
  id: string;
  planId: "basic" | "premium";
  ownerUserId: string;
  subjectIds: string[];
  createdAt: string;
}

/**
 * Watch / Important 自动过期策略 — PRD §6.4
 * "超时后无新信号"的时长为初始值，需试点校准（PRD §17 #7）。
 */
export interface AlertAutoExpirePolicy {
  watchMin: number;
  importantMin: number;
}
