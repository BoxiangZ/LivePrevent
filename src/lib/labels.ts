/**
 * 事件/等级/状态的人类可读标签 — 通知模板（PRD §7.2）与 Dashboard 共用同一来源。
 */

import type { EventType, TrendMetric } from "@/types/event";
import type { RiskLevel, AlertStatus, ResolveReason } from "@/types/risk";
import type { SignalSource } from "@/types/event";

/** 事件类别标签 — 与 PRD §7.2 模板中的 Category 字段一致 */
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  possible_fall: "Possible fall",
  prolonged_inactivity: "Abnormal inactivity",
  heart_rate_deviation: "Heart rate deviation",
  activity_drop: "Activity below baseline",
  device_data_gap: "Data gap",
};

export const EVENT_TYPE_LABELS_ZH: Record<EventType, string> = {
  possible_fall: "疑似跌倒",
  prolonged_inactivity: "长时间无活动",
  heart_rate_deviation: "心率偏离",
  activity_drop: "活动骤降",
  device_data_gap: "设备离线 / 数据缺失",
};

export const TREND_METRIC_LABELS: Record<TrendMetric, string> = {
  activity: "Activity",
  sleep: "Sleep",
  mobility: "Mobility",
  resting_hr: "Heart Rate",
};

export const TREND_METRIC_LABELS_ZH: Record<TrendMetric, string> = {
  activity: "活动",
  sleep: "睡眠",
  mobility: "行动能力",
  resting_hr: "静息心率",
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  stable: "Stable",
  watch: "Watch",
  important: "Important",
  critical: "Critical",
};

export const RISK_LEVEL_LABELS_ZH: Record<RiskLevel, string> = {
  stable: "平稳",
  watch: "留意",
  important: "重要",
  critical: "紧急",
};

export const ALERT_STATUS_LABELS_ZH: Record<AlertStatus, string> = {
  open: "待确认",
  acknowledged: "已确认",
  resolved: "已处理",
  auto_expired: "自动过期",
};

export const RESOLVE_REASON_LABELS_ZH: Record<ResolveReason, string> = {
  real_event_handled: "真实事件已处理",
  false_positive: "误报",
  device_issue: "设备问题",
  other: "其他",
};

export const SIGNAL_SOURCE_LABELS: Record<SignalSource, string> = {
  watch_impact: "Watch (impact)",
  watch_hr: "Watch (heart rate)",
  watch_activity: "Watch (activity)",
  watch_worn: "Watch (worn state)",
  watch_sleep: "Watch (sleep)",
  camera_posture: "Camera (posture)",
  camera_motion: "Camera (motion)",
  device_heartbeat: "Device (heartbeat)",
};
