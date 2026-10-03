/**
 * 事件类别与信号来源的人类可读标签 — 通知模板与 Kimi facts 共用同一来源。
 */

import type { EventType, SignalSource } from "@/shared/types/event";

/** 事件类别标签 — 通知模板 Category 字段 */
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  possible_fall: "Possible fall",
  prolonged_inactivity: "Abnormal inactivity",
  heart_rate_deviation: "Heart rate deviation",
  activity_drop: "Activity below baseline",
  device_data_gap: "Data gap",
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
