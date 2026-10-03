/**
 * 被监测老人（Subject）、同意与权限 — PRD §2.3 / §8
 */

/** 关系角色 — PRD §2.3（医护为 Phase 2） */
export const ROLES = [
  "subject", // 老人（被监测者，同意主体）
  "primary_family", // 主家属（付费账户持有人）
  "family_member", // 其他家属（被邀请成员）
  "caregiver", // 护理员（Phase 2 完整支持）
  "clinician", // 医护（Phase 2）
  "legal_guardian", // 合法监护人 / 授权代表（代为同意时）
] as const;
export type Role = (typeof ROLES)[number];

/** 同意范围 — PRD §8.1 */
export interface ConsentScope {
  deviceTypes: Array<"smartwatch" | "camera">;
  /** 数据类别：activity / hr / sleep / event_snapshot 等 */
  dataCategories: string[];
  /** 可见人员（用户/联系人 ID 列表） */
  visibleToUserIds: string[];
}

/** 同意记录 — onboarding 必须记录，全量进审计日志 — PRD §8.1 */
export interface ConsentRecord {
  id: string;
  subjectId: string;
  /** 同意主体：本人或法定监护人/授权代表 */
  consenterRole: "subject" | "legal_guardian";
  /** 代为同意时记录其身份与授权依据 — PRD §8.1 / §17#8 */
  guardianBasis: string | null;
  scope: ConsentScope;
  grantedAt: string;
  /** 撤销或缩小范围后的处理状态 */
  status: "active" | "revoked" | "narrowed";
  revokedAt: string | null;
}

/** 老人本人 — 别名用于通知最小化（如 "Mum"），避免全名入主题行 — PRD §7.1 */
export interface Subject {
  id: string;
  /** 展示用别名（通知中只出现别名） */
  alias: string;
  displayName: string | null;
  age: number | null;
  timeZone: string; // IANA，如 Asia/Hong_Kong
  /** 监测暂停（隐私模式）：暂停期不得产生"无活动"告警，家属侧显示"监测已暂停" — PRD §8.1 */
  monitoringPaused: boolean;
  /** 家属可选填写的用药上下文（仅作展示，不做医学判断 — PRD §5.5） */
  medicationContext: string | null;
  consent: ConsentRecord | null;
}

/** 权限矩阵的动作项 — PRD §8.3 */
export const PERMISSION_ACTIONS = [
  "view_status", // 查看当前状态
  "view_events", // 查看事件列表
  "view_trends", // 查看趋势与健康指标
  "view_snapshots", // 查看事件快照/片段
  "ack_resolve_alerts", // 确认/处理警报
  "manage_contacts_subscription", // 修改联系人与订阅
  "manage_members", // 邀请/移除成员
  "revoke_consent_pause", // 撤销同意/暂停监测
  "export_data", // 导出数据
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/**
 * 角色权限矩阵 — PRD §8.3 表格的代码化。
 * "按授权" 表示取决于 ConsentScope.visibleToUserIds 与显式授权，运行时判断。
 */
export const ROLE_PERMISSIONS: Record<
  Role,
  Record<PermissionAction, "allow" | "deny" | "by_grant">
> = {
  subject: {
    view_status: "allow",
    view_events: "allow",
    view_trends: "allow",
    view_snapshots: "allow",
    ack_resolve_alerts: "deny",
    manage_contacts_subscription: "deny",
    manage_members: "deny",
    revoke_consent_pause: "allow",
    export_data: "allow",
  },
  primary_family: {
    view_status: "allow",
    view_events: "allow",
    view_trends: "allow",
    view_snapshots: "by_grant",
    ack_resolve_alerts: "allow",
    manage_contacts_subscription: "allow",
    manage_members: "allow",
    revoke_consent_pause: "deny", // 仅监护人可代理
    export_data: "by_grant",
  },
  family_member: {
    view_status: "allow",
    view_events: "allow",
    view_trends: "by_grant",
    view_snapshots: "deny",
    ack_resolve_alerts: "allow",
    manage_contacts_subscription: "deny",
    manage_members: "deny",
    revoke_consent_pause: "deny",
    export_data: "deny",
  },
  caregiver: {
    view_status: "allow",
    view_events: "by_grant",
    view_trends: "by_grant",
    view_snapshots: "deny",
    ack_resolve_alerts: "allow",
    manage_contacts_subscription: "deny",
    manage_members: "deny",
    revoke_consent_pause: "deny",
    export_data: "deny",
  },
  clinician: {
    view_status: "allow",
    view_events: "by_grant",
    view_trends: "by_grant",
    view_snapshots: "by_grant",
    ack_resolve_alerts: "allow",
    manage_contacts_subscription: "deny",
    manage_members: "deny",
    revoke_consent_pause: "deny",
    export_data: "by_grant",
  },
  legal_guardian: {
    view_status: "allow",
    view_events: "allow",
    view_trends: "allow",
    view_snapshots: "deny",
    ack_resolve_alerts: "deny",
    manage_contacts_subscription: "deny",
    manage_members: "deny",
    revoke_consent_pause: "allow", // 代理行使 — PRD §8.3
    export_data: "deny",
  },
};
