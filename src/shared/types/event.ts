/**
 * 监测事件 — PRD §4.1（实时事件）/ §4.2（长期趋势）
 */

/** 实时事件类别 — PRD §4.1 */
export const EVENT_TYPES = [
  "general_check", // 用户主动提交的一次观察
  "possible_fall", // 疑似跌倒
  "prolonged_inactivity", // 长时间无活动
  "heart_rate_deviation", // 心率偏离
  "activity_drop", // 活动骤降
  "device_data_gap", // 设备离线 / 数据缺失（v0.2 新增）
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** 长期趋势维度 — PRD §4.2。趋势类提示最高 Watch/Important，不触发 Critical */
export const TREND_METRICS = [
  "activity", // 30/90 天活动趋势
  "sleep", // 睡眠趋势
  "mobility", // 步行 / 移动能力趋势
  "resting_hr", // 静息心率趋势
] as const;
export type TrendMetric = (typeof TREND_METRICS)[number];

/** 支持信号的来源通道 — PRD §5.3 evidence / §5.4 */
export const SIGNAL_SOURCES = [
  "watch_impact", // 手表加速度/冲击
  "watch_hr", // 手表心率
  "watch_activity", // 手表活动
  "watch_worn", // 佩戴状态
  "watch_sleep", // 睡眠状态
  "camera_posture", // 摄像头姿态
  "camera_motion", // 摄像头运动
  "device_heartbeat", // 电量/网络心跳
] as const;
export type SignalSource = (typeof SIGNAL_SOURCES)[number];

/** 单条支持信号（可解释性的最小单元）— PRD §5.3 / §16 */
export interface EventSignal {
  source: SignalSource;
  /** 人类可读描述，如 "impact + HR deviation"。不得含医疗判断 — PRD §10.2 */
  description: string;
  /** 发生于覆盖房间之外时摄像头信号不具意义 — PRD §5.4 */
  withinCoverage?: boolean;
}

/** 跌倒两阶段判定状态 — PRD §5.2 */
export const FALL_PHASES = [
  "candidate", // Possible Fall 候选，进入恢复观察窗
  "recovered", // 有恢复 → 降级 Watch
  "unrecovered", // 无恢复 → 升级 Critical
  "not_applicable", // 非跌倒类事件
] as const;
export type FallPhase = (typeof FALL_PHASES)[number];

/** 被监测事件（含趋势类提示） */
export interface MonitoredEvent {
  id: string;
  subjectId: string;
  type: EventType;
  /** 趋势类事件关联的维度（实时事件为 null） */
  trendMetric: TrendMetric | null;
  /** ISO 8601 */
  occurredAt: string;
  /** 支持信号列表 — JEV 输出，供详情页解释使用 */
  signals: EventSignal[];
  /** 跌倒恢复观察窗状态与截止时间 — PRD §5.2 */
  fallPhase: FallPhase;
  recoveryWindowEndsAt: string | null;
  /** 独立信号通道数（如 watch + camera），用于 ≥2 佐证规则 — PRD §5.3 */
  independentChannelCount: number;
  /** 事件合并窗口内的去重键 — PRD §5.7 抑制重复 */
  dedupeKey: string | null;
}
