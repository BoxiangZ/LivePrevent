/**
 * PRD v0.2 初始值常量集中地。
 * 所有标注"初始值"的数字都是设计假设，需在试点数据上校准（PRD 卷首声明），
 * 校准数据来源本身是待决策事项（PRD §17 #7）。修改数值请保留 PRD 章节引用注释。
 */

// ─── 冷启动与基线 ─── PRD §5.1 ───────────────────────────────

/** 基础指标基线学习期（天） */
export const BASELINE_LEARNING_DAYS_BASIC = 14;

/** 睡眠与趋势类指标基线学习期（天） */
export const BASELINE_LEARNING_DAYS_SLEEP_TREND = 28;

// ─── 跌倒两阶段判定 ─── PRD §5.2 ─────────────────────────────

/** 恢复观察窗时长（分钟）：有恢复降 Watch，无恢复升 Critical */
export const FALL_RECOVERY_WINDOW_MIN = 3;

// ─── JEV 等级决策阈值 ─── PRD §5.3 ───────────────────────────

/** p(critical) ≥ 此值且满足佐证条件 → Critical */
export const JEV_CRITICAL_PROB = 0.6;

/** Critical 所需独立信号数（≥2 个独立信号一致） */
export const JEV_CRITICAL_MIN_SIGNALS = 2;

/** p(important) + p(critical) ≥ 此值 → Important */
export const JEV_IMPORTANT_PROB = 0.5;

/** p(notice) + p(important) + p(critical) ≥ 此值 → Watch */
export const JEV_WATCH_PROB = 0.3;

// ─── 设备离线与数据缺失 ─── PRD §5.6 ─────────────────────────

/** 单设备离线超过此时长（小时）→ Watch */
export const DEVICE_OFFLINE_WATCH_HOURS = 2;

/** 所有数据源离线超过此时长（小时）→ Important（Data gap） */
export const ALL_DEVICES_OFFLINE_IMPORTANT_HOURS = 4;

// ─── Critical 升级时间线 ─── PRD §6.3 ────────────────────────

/** T+5min：未确认 → 通知联系人 #2，并再次提醒 #1 */
export const ESCALATION_STAGE2_MIN = 5;

/** T+15min：仍未确认 → 通知全部联系人 */
export const ESCALATION_STAGE3_MIN = 15;

/** T+30min：仍未确认 → 标记 Unacknowledged */
export const ESCALATION_STAGE4_MIN = 30;

/** T+30 后重复提醒间隔（分钟） */
export const ESCALATION_REPEAT_REMINDER_MIN = 15;

// ─── 通知最小化 ─── PRD §7.1 ─────────────────────────────────

/** Critical 深度链接一次性 token 有效期（分钟），打开后仍需会话验证 */
export const CRITICAL_LINK_TTL_MIN = 30;

// ─── 数据保留期（待决策，建议初始值）─── PRD §8.4 ────────────

export const RETENTION = {
  /** 原始传感器数据 */
  rawSensorDataDays: 30,
  /** 事件记录与聚合指标 */
  eventRecordsMonths: 12,
  /** 事件快照/片段（如启用），可由用户缩短 */
  snapshotDaysMin: 7,
  snapshotDaysMax: 30,
  /** 审计日志 */
  auditLogMonths: 24,
  /** 撤销同意/注销后删除期限（天） */
  postRevocationDeletionDays: 30,
} as const;

// ─── 警报合并与抑制 ─── PRD §5.7 ─────────────────────────────

/** 同一事件合并窗口（分钟）：窗口内不重复发送 */
export const ALERT_DEDUPE_WINDOW_MIN = 30;

// ─── Demo 时间轴加速 ─── PRD §19 ─────────────────────────────

/** 恢复观察窗：3 分钟 → 10 秒（×18 加速）。升级时间线同理按倍数加速。 */
export const DEMO_RECOVERY_WINDOW_SEC = 10;

/**
 * Demo 加速倍数：从环境变量读取，服务端与客户端共享同一加速倍数。
 * 默认 18（= 真实 3min / Demo 10s）。
 */
export const DEMO_TIME_SCALE = Number(process.env.NEXT_PUBLIC_DEMO_TIME_SCALE ?? 18);

// ─── 套餐限制 ─── PRD §12 ────────────────────────────────────
// null = 不限（Infinity 不可 JSON 序列化）

export const PLANS = {
  basic: {
    subjects: 1 as number | null,
    trendHistoryDays: 30,
    familyAccounts: 2 as number | null,
    aiSummary: "basic_weekly_report" as const,
  },
  premium: {
    subjects: null as number | null,
    trendHistoryDays: 90,
    familyAccounts: null as number | null,
    aiSummary: "full_ai_summary" as const,
  },
} as const;

export type PlanId = keyof typeof PLANS;

/** 套餐配额读取：null 表示不限 */
export function planLimit(planId: PlanId, key: "subjects" | "familyAccounts"): number | null {
  return PLANS[planId][key];
}

// ─── 免打扰时段 ─── PRD §6.3 ─────────────────────────────────
// Important 遵守联系人的免打扰时段，时段结束后合并发送（必须明确告知用户）；
// Critical 不受免打扰限制。

export const QUIET_HOURS_DEFAULT = { start: "22:00", end: "07:00" } as const;

// ─── 警报自动过期（初始值，待校准）─── PRD §6.4 ──────────────
// 仅 Watch / Important：超时后无新信号则 Auto-expired。Critical 不自动过期。

export const AUTO_EXPIRE_WATCH_MIN = 24 * 60;
export const AUTO_EXPIRE_IMPORTANT_MIN = 48 * 60;
