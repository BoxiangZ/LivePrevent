/**
 * Demo dataset — deterministic synthetic data (seeded PRNG, identical after every reset).
 * Persona: Margaret Chan, 76, living independently in Hong Kong.
 * All health data is simulated for the hackathon demo.
 */

import { mulberry32 } from "@/shared/prng";
import type { Subject } from "@/shared/types/subject";
import type { Device } from "@/shared/types/device";
import type { Contact } from "@/shared/types/alert";
import type { BaselineEntry, TrendPoint, BaselineDeviation } from "@/shared/types/baseline";
import type { MonitoredEvent } from "@/shared/types/event";
import type { Alert, AlertSubscriptionSettings } from "@/shared/types/alert";
import type { AuditLogEntry } from "@/shared/types/audit";
import type { TrendMetric } from "@/shared/types/event";
import type { User } from "@/shared/types/account";
import { TREND_METRICS } from "@/shared/types/event";

export const SUBJECT_ID = "sub_margaret";
export const WATCH_ID = "dev_watch_1";
export const CAMERA_ID = "dev_cam_1";
export const CONTACT_ALEX_ID = "ct_alex";
export const CONTACT_NEIGHBOUR_ID = "ct_neighbour";
export const USER_ALEX_ID = "user_alex";

export function seedUser(nowIso: string): User {
  return {
    id: USER_ALEX_ID,
    email: "alex.chan@example.com",
    displayName: "Alex Chan",
    rolesBySubject: { [SUBJECT_ID]: "primary_family" },
    totpEnabled: true,
    createdAt: nowIso,
  };
}

export function seedSubject(nowIso: string): Subject {
  return {
    id: SUBJECT_ID,
    alias: "Margaret",
    displayName: "Margaret Chan",
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
      label: "Apple Watch",
      online: true,
      offlineSince: null,
      worn: true,
      notWornSince: null,
      batteryPct: 82,
      lastSyncAt: nowIso,
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
      coveredRooms: ["Living room"],
      cameraMode: "edge_only",
    },
  ];
}

export function seedContacts(): Contact[] {
  return [
    {
      id: CONTACT_ALEX_ID,
      subjectId: SUBJECT_ID,
      userId: USER_ALEX_ID,
      name: "Alex Chan",
      escalationOrder: 1,
      timeZone: "America/Los_Angeles",
      channels: ["email", "sms", "push"],
      phoneVerified: true,
      quietHours: { start: "22:00", end: "07:00" },
    },
    {
      id: CONTACT_NEIGHBOUR_ID,
      subjectId: SUBJECT_ID,
      userId: null,
      name: "Mrs. Chan",
      escalationOrder: 2,
      timeZone: "Asia/Hong_Kong",
      channels: ["email", "sms"],
      phoneVerified: true,
      quietHours: null,
    },
  ];
}

/** Personal baseline medians — the product differentiator. */
export const BASELINE_MEDIANS: Record<TrendMetric, number> = {
  activity: 4200, // steps/day
  sleep: 7.2, // hours
  mobility: 0.9, // walking speed m/s
  resting_hr: 68, // bpm (typical range 64–73)
};

export function seedBaselines(learningSinceIso: string): BaselineEntry[] {
  const spread: Record<TrendMetric, [number, number]> = {
    activity: [3600, 4800],
    sleep: [6.6, 7.8],
    mobility: [0.82, 0.98],
    resting_hr: [64, 73],
  };
  return TREND_METRICS.map((metric) => ({
    metric,
    learningSince: learningSinceIso,
    learned: true,
    median: BASELINE_MEDIANS[metric],
    p25: spread[metric][0],
    p75: spread[metric][1],
    timeOfDayProfile: null,
    lastIncludedSampleAt: null,
  }));
}

export const TREND_DAYS = 90;

/**
 * 90-day deterministic trends.
 * Decline factors D applied linearly over the last 30 days, tuned so the
 * computed 30-day summary (mean of last 7d vs first 7d) lands at:
 *   activity ≈ -18% (today overridden to 2,640 steps ≈ -37% vs baseline)
 *   mobility ≈ -9%
 *   sleep    ≈ -6% with rising variance (less consistent)
 *   resting_hr ≈ stable
 */
const DECLINE: Record<TrendMetric, number> = {
  activity: 0.18,
  mobility: 0.11,
  sleep: 0.08,
  resting_hr: 0,
};

export function buildTrendSeries(metric: TrendMetric, days: number, endDate: Date): TrendPoint[] {
  const rng = mulberry32(hashSeed(metric));
  const median = BASELINE_MEDIANS[metric];
  const D = DECLINE[metric];
  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    let factor = 1;
    if (i < 30) factor = 1 - (D * (30 - i)) / 30;
    let noiseAmp = 0.05;
    if (metric === "sleep" && i < 14) noiseAmp = 0.13; // less consistent recently
    const noise = (rng() - 0.5) * 2 * noiseAmp;
    let value = median * factor * (1 + noise);
    if (metric === "activity" && i === 0) value = 2640; // today: -37% vs baseline
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

/** Deviations attached to the injected fall event (relative to personal baseline). */
export function fallDeviations(): BaselineDeviation[] {
  return [
    { metric: "resting_hr", direction: "up", relativeChange: 0.38 }, // 68 → ~94 bpm
    { metric: "activity", direction: "down", relativeChange: -0.37 },
  ];
}

export interface SeededHistory {
  events: MonitoredEvent[];
  alerts: Alert[];
  audit: AuditLogEntry[];
  deviations: Record<string, BaselineDeviation[]>;
}

/** Past alerts so Active/Resolved tabs and timelines feel lived-in. */
export function seedPastEvents(nowMs: number): SeededHistory {
  const dayMs = 24 * 60 * 60 * 1000;
  const deviations: Record<string, BaselineDeviation[]> = {};

  const mk = (
    n: number,
    daysAgo: number,
    hour: number,
    minute: number,
    type: MonitoredEvent["type"],
    level: Alert["level"],
    reason: Alert["resolveReason"],
    note: string | null,
    signals: MonitoredEvent["signals"],
    devs: BaselineDeviation[]
  ): { event: MonitoredEvent; alert: Alert; entries: AuditLogEntry[] } => {
    const occurred = new Date(nowMs - daysAgo * dayMs);
    occurred.setHours(hour, minute, 0, 0);
    const occurredIso = occurred.toISOString();
    const eventId = `evt_hist_${n}`;
    const alertId = `al_hist_${n}`;
    const ackAt = new Date(occurred.getTime() + 12 * 60 * 1000).toISOString();
    const resolvedAt = new Date(occurred.getTime() + 40 * 60 * 1000).toISOString();
    deviations[eventId] = devs;

    const event: MonitoredEvent = {
      id: eventId,
      subjectId: SUBJECT_ID,
      type,
      trendMetric: null,
      occurredAt: occurredIso,
      signals,
      fallPhase: "not_applicable",
      recoveryWindowEndsAt: null,
      independentChannelCount: 2,
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
      levelHistory: [{ level, at: occurredIso, trigger: "initial_detection" }],
      notifications: [
        {
          id: `ntf_hist_${n}`,
          alertId,
          contactId: CONTACT_ALEX_ID,
          channel: "email",
          sentAt: occurredIso,
          deliveryStatus: "delivered",
          oneTimeTokenId: null,
          oneTimeTokenExpiresAt: null,
        },
      ],
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
      acknowledgedAt: ackAt,
      resolvedBy: CONTACT_ALEX_ID,
      resolvedAt,
      resolveReason: reason,
      resolveNote: note,
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
        detail: { alertId, level, eventType: type },
        ip: null,
      },
      {
        id: `aud_${n}_2`,
        at: ackAt,
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

  const inactivity = mk(
    1,
    2,
    11,
    5,
    "prolonged_inactivity",
    "important",
    "false_positive",
    "Called the selected person — resting after a poor night. Confirmed OK.",
    [
      { source: "watch_activity", description: "No meaningful movement for 2h 47m" },
      { source: "watch_hr", description: "Heart rate within baseline" },
      { source: "camera_motion", description: "Camera movement very low", withinCoverage: true },
    ],
    [{ metric: "activity", direction: "down", relativeChange: -0.46 }]
  );
  const sleep = mk(
    2,
    6,
    7,
    30,
    "activity_drop",
    "watch",
    "other",
    "Sleep below baseline for several nights — monitoring.",
    [{ source: "watch_sleep", description: "Sleep below personal baseline for 3 consecutive nights" }],
    [{ metric: "sleep", direction: "down", relativeChange: -0.12 }]
  );
  const hr = mk(
    3,
    9,
    21,
    15,
    "heart_rate_deviation",
    "important",
    "real_event_handled",
    "The selected person had been climbing stairs — heart rate recovered within minutes.",
    [
      { source: "watch_hr", description: "Resting heart rate above personal baseline (64–73 bpm)" },
      { source: "watch_worn", description: "Watch worn at time of event" },
    ],
    [{ metric: "resting_hr", direction: "up", relativeChange: 0.19 }]
  );

  return {
    events: [inactivity.event, sleep.event, hr.event],
    alerts: [inactivity.alert, sleep.alert, hr.alert],
    audit: [...inactivity.entries, ...sleep.entries, ...hr.entries],
    deviations,
  };
}

/** Alert subscription defaults. */
export function seedSubscriptions(): AlertSubscriptionSettings {
  return {
    subjectId: SUBJECT_ID,
    possible_fall: true,
    heart_rate_deviation: true,
    prolonged_inactivity: true,
    activity_drop: true,
    device_data_gap: true,
    sleep_change: false,
    watchEmailEnabled: false,
    importantEscalationEnabled: false,
  };
}

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
