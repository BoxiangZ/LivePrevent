/**
 * Demo 合成数据集 — PRD §19
 * "Mum"（76，香港）+ 2 设备 + 2 联系人 + 30 天 × 4 指标合成趋势 + 历史事件。
 * 全部为合成数据，不涉及真实个人数据；趋势点 synthetic: true，UI 必须标注。
 * 使用 mulberry32 固定种子 — reset 后数据可复现，评委看到相同图表。
 */

import { mulberry32 } from "@/lib/prng";
import type { Subject } from "@/types/subject";
import type { Device } from "@/types/device";
import type { Contact } from "@/types/alert";
import type { BaselineEntry, TrendPoint, BaselineDeviation } from "@/types/baseline";
import type { MonitoredEvent } from "@/types/event";
import type { Alert, AlertSubscriptionSettings } from "@/types/alert";
import type { AuditLogEntry } from "@/types/audit";
import type { TrendMetric } from "@/types/event";
import type { User } from "@/types/account";
import { TREND_METRICS } from "@/types/event";

export const SUBJECT_ID = "sub_mum";
export const WATCH_ID = "dev_watch_1";
export const CAMERA_ID = "dev_cam_1";
export const CONTACT_ALEX_ID = "ct_alex";
export const CONTACT_CHAN_ID = "ct_chan";
export const USER_ALEX_ID = "user_alex";

export function seedUser(nowIso: string): User {
  return {
    id: USER_ALEX_ID,
    email: "alex@example.com",
    displayName: "Alex (son)",
    rolesBySubject: { [SUBJECT_ID]: "primary_family" },
    totpEnabled: true,
    createdAt: nowIso,
  };
}

export function seedSubject(nowIso: string): Subject {
  return {
    id: SUBJECT_ID,
    alias: "Mum",
    displayName: null, // 通知最小化：只出现别名 — PRD §7.1
    age: 76,
    timeZone: "Asia/Hong_Kong",
    monitoringPaused: false,
    medicationContext: null,
    consent: {
      id: "consent_1",
      subjectId: SUBJECT_ID,
      consenterRole: "subject",
      guardianBasis: null,
      scope: {
        deviceTypes: ["smartwatch", "camera"],
        dataCategories: ["activity", "heart_rate", "sleep", "event_metadata"],
        visibleToUserIds: [USER_ALEX_ID],
      },
      grantedAt: nowIso,
      status: "active",
      revokedAt: null,
    },
  };
}

export function seedDevices(nowIso: string): Device[] {
  return [
    {
      id: WATCH_ID,
      subjectId: SUBJECT_ID,
      type: "smartwatch",
      label: "Apple Watch (Mum)",
      online: true,
      offlineSince: null,
      worn: true,
      notWornSince: null,
      batteryPct: 82,
      lastSyncAt: nowIso, // 展示时格式化为 "X min ago"
      coveredRooms: [],
      cameraMode: null,
    },
    {
      id: CAMERA_ID,
      subjectId: SUBJECT_ID,
      type: "camera",
      label: "Living room camera",
      online: true,
      offlineSince: null,
      worn: null,
      notWornSince: null,
      batteryPct: null,
      lastSyncAt: nowIso,
      coveredRooms: ["Living room"], // 覆盖地图：浴室/卧室为盲区 — PRD §5.5
      cameraMode: "edge_only", // 端侧处理，不持续上传视频 — PRD §8.2
    },
  ];
}

export function seedContacts(): Contact[] {
  return [
    {
      id: CONTACT_ALEX_ID,
      subjectId: SUBJECT_ID,
      userId: USER_ALEX_ID,
      name: "Alex (son, San Francisco)",
      escalationOrder: 1,
      timeZone: "America/Los_Angeles",
      channels: ["email", "sms", "push"],
      phoneVerified: true,
      quietHours: { start: "22:00", end: "07:00" }, // 仅 Important 遵守 — PRD §6.3
    },
    {
      id: CONTACT_CHAN_ID,
      subjectId: SUBJECT_ID,
      userId: null,
      name: "Mrs. Chan (neighbour, Hong Kong)",
      escalationOrder: 2,
      timeZone: "Asia/Hong_Kong",
      channels: ["sms", "push"],
      phoneVerified: true,
      quietHours: null, // 同城同时区联系人 — PRD §6.2 强烈建议
    },
  ];
}

/** 基线中位数（单位随指标） */
export const BASELINE_MEDIANS: Record<TrendMetric, number> = {
  activity: 4200, // 步/日
  sleep: 7.2, // 小时
  mobility: 850, // 米
  resting_hr: 68, // bpm
};

export function seedBaselines(learningSinceIso: string): BaselineEntry[] {
  return TREND_METRICS.map((metric) => {
    const median = BASELINE_MEDIANS[metric];
    return {
      metric,
      learningSince: learningSinceIso,
      learned: true, // Demo 中基线已学完，不显示学习进度条
      median,
      p25: median * 0.85,
      p75: median * 1.15,
      timeOfDayProfile: null,
      lastIncludedSampleAt: null,
    };
  });
}

/**
 * 30 天合成趋势（确定性）。sleep 在最近 5 天有轻微下凹，
 * 让 Overview 的 "Sleep ↓ Slightly (Watch)" 有真实数据支撑 — PRD §11.1。
 */
export function buildTrendSeries(metric: TrendMetric, days: number, endDate: Date): TrendPoint[] {
  const rng = mulberry32(hashSeed(metric));
  const median = BASELINE_MEDIANS[metric];
  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    const noise = (rng() - 0.5) * 0.16; // ±8% 噪声
    let value = median * (1 + noise);
    if (metric === "sleep" && i < 5) {
      value = median * (1 - 0.12 - (5 - i) * 0.02); // 最近 5 天约 -12%~-20%
    }
    if (metric === "activity" && i === 0) {
      value = median * 0.55; // 今天活动骤降（Demo 事件的基线对比素材）
    }
    points.push({
      date: d.toISOString().slice(0, 10),
      metric,
      value: Math.round(value * 100) / 100,
      synthetic: true,
    });
  }
  return points;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 与跌倒事件配套的基线偏离（相对值，供详情页与 Kimi 摘要使用） */
export function fallDeviations(): BaselineDeviation[] {
  return [
    { metric: "resting_hr", direction: "up", relativeChange: 0.22 },
    { metric: "activity", direction: "down", relativeChange: -0.45 },
  ];
}

export interface SeededHistory {
  events: MonitoredEvent[];
  alerts: Alert[];
  audit: AuditLogEntry[];
}

/** 历史已处理事件 — 让 Alerts 的 Resolved 区与 Elder Detail 时间线有内容 */
export function seedPastEvents(nowMs: number): SeededHistory {
  const dayMs = 24 * 60 * 60 * 1000;
  const mk = (
    n: number,
    daysAgo: number,
    hour: number,
    type: MonitoredEvent["type"],
    label: string,
    level: Alert["level"],
    reason: Alert["resolveReason"],
    signals: MonitoredEvent["signals"]
  ): { event: MonitoredEvent; alert: Alert; entries: AuditLogEntry[] } => {
    const occurred = new Date(nowMs - daysAgo * dayMs);
    occurred.setHours(hour, 42, 0, 0);
    const occurredIso = occurred.toISOString();
    const eventId = `evt_hist_${n}`;
    const alertId = `al_hist_${n}`;
    const resolvedAt = new Date(occurred.getTime() + 45 * 60 * 1000).toISOString();
    const event: MonitoredEvent = {
      id: eventId,
      subjectId: SUBJECT_ID,
      type,
      trendMetric: null,
      occurredAt: occurredIso,
      signals,
      fallPhase: "not_applicable",
      recoveryWindowEndsAt: null,
      independentChannelCount: 1,
      dedupeKey: null,
    };
    const alert: Alert = {
      id: alertId,
      subjectId: SUBJECT_ID,
      eventId,
      eventType: type,
      level,
      status: "resolved",
      createdAt: occurredIso,
      levelHistory: [{ level, at: occurredIso, trigger: "initial" }],
      notifications: [],
      escalation: {
        subjectId: SUBJECT_ID,
        alertId,
        currentStage: null,
        nextStageAt: null,
        repeatReminderEveryMin: null,
        unacknowledged: false,
        stageLog: [],
      },
      acknowledgedBy: CONTACT_ALEX_ID,
      acknowledgedAt: new Date(occurred.getTime() + 8 * 60 * 1000).toISOString(),
      resolvedBy: CONTACT_ALEX_ID,
      resolvedAt,
      resolveReason: reason,
      resolveNote: null,
      autoExpiredAt: null,
    };
    const entries: AuditLogEntry[] = [
      {
        id: `aud_${n}_1`,
        at: occurredIso,
        actorUserId: null,
        actorRole: "system",
        subjectId: SUBJECT_ID,
        action: "alert_created",
        targetUserId: null,
        targetContactId: null,
        detail: { alertId, level, eventType: type, label },
        ip: null,
      },
      {
        id: `aud_${n}_2`,
        at: alert.acknowledgedAt!,
        actorUserId: USER_ALEX_ID,
        actorRole: "primary_family",
        subjectId: SUBJECT_ID,
        action: "alert_acknowledged",
        targetUserId: null,
        targetContactId: CONTACT_ALEX_ID,
        detail: { alertId },
        ip: null,
      },
      {
        id: `aud_${n}_3`,
        at: resolvedAt,
        actorUserId: USER_ALEX_ID,
        actorRole: "primary_family",
        subjectId: SUBJECT_ID,
        action: "alert_resolved",
        targetUserId: null,
        targetContactId: CONTACT_ALEX_ID,
        detail: { alertId, reason: reason ?? "other" },
        ip: null,
      },
    ];
    return { event, alert, entries };
  };

  const a = mk(1, 2, 10, "prolonged_inactivity", "Long sitting period", "watch", "false_positive", [
    { source: "watch_activity", description: "no movement detected for an extended period" },
  ]);
  const b = mk(2, 5, 14, "activity_drop", "Activity below baseline", "watch", "other", [
    { source: "watch_activity", description: "activity below personal baseline for the time of day" },
  ]);
  const c = mk(3, 9, 21, "heart_rate_deviation", "Heart rate deviation", "important", "real_event_handled", [
    { source: "watch_hr", description: "resting heart rate above personal baseline" },
    { source: "watch_worn", description: "watch worn at time of event" },
  ]);

  return {
    events: [a.event, b.event, c.event],
    alerts: [a.alert, b.alert, c.alert],
    audit: [...a.entries, ...b.entries, ...c.entries],
  };
}

/** 警报订阅默认值 — PRD §11.2 */
export function seedSubscriptions(): AlertSubscriptionSettings {
  return {
    subjectId: SUBJECT_ID,
    possible_fall: true, // 主联系人不可关闭
    heart_rate_deviation: true,
    prolonged_inactivity: true,
    activity_drop: true,
    device_data_gap: true,
    sleep_change: false, // Dashboard 展示但不发通知
    watchEmailEnabled: false,
    importantEscalationEnabled: false,
  };
}

/** 同意授予的审计记录（预置） */
export function seedConsentAudit(nowIso: string): AuditLogEntry {
  return {
    id: "aud_consent_1",
    at: nowIso,
    actorUserId: null,
    actorRole: "subject",
    subjectId: SUBJECT_ID,
    action: "consent_granted",
    targetUserId: null,
    targetContactId: null,
    detail: { scope: "smartwatch+camera; activity/heart_rate/sleep/event_metadata" },
    ip: null,
  };
}
