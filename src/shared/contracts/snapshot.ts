import {
  healthProfileSchema,
  monitoringSchema,
  careTaskSchema,
  contactDetails,
} from "./monitoring";
import { z } from "zod";
import { iso, id, risk, peopleSchema } from "./assessment";
import type { DemoStateSnapshot } from "@/server/snapshot";
const nullableNumber = z.number().finite().nullable();
const metric = z.enum(["activity", "sleep", "mobility", "resting_hr"]);
const deviation = z.object({
  metric,
  direction: z.enum(["up", "down", "flat"]),
  relativeChange: z.number(),
});
const notification = z.object({
  id,
  alertId: id,
  contactId: id,
  channel: z.enum(["email", "sms", "push", "voice_call"]),
  sentAt: iso,
  deliveryStatus: z.enum(["pending", "sent", "delivered", "failed"]),
  simulated: z.boolean().optional(),
  error: z.string().optional(),
  providerMessageId: z.string().optional(),
  oneTimeTokenId: id.nullable(),
  oneTimeTokenExpiresAt: iso.nullable(),
});
const stage = z.object({
  stage: z.string(),
  at: iso,
  notifiedContactIds: z.array(id),
  remindedContactIds: z.array(id),
});
const eventType = z.enum([
  "general_check",
  "possible_fall",
  "prolonged_inactivity",
  "heart_rate_deviation",
  "activity_drop",
  "device_data_gap",
]);
const alert = z.object({
  id,
  subjectId: id,
  eventId: id,
  eventType,
  level: risk,
  status: z.enum(["open", "acknowledged", "resolved", "auto_expired"]),
  createdAt: iso,
  levelHistory: z.array(
    z.object({ level: risk, at: iso, trigger: z.string() }),
  ),
  notifications: z.array(notification),
  escalation: z.object({
    subjectId: id,
    alertId: id,
    currentStage: z.string().nullable(),
    nextStageAt: iso.nullable(),
    repeatReminderEveryMin: nullableNumber,
    unacknowledged: z.boolean(),
    stageLog: z.array(stage),
  }),
  acknowledgedBy: id.nullable(),
  acknowledgedAt: iso.nullable(),
  resolvedBy: id.nullable(),
  resolvedAt: iso.nullable(),
  resolveReason: z.string().nullable(),
  resolveNote: z.string().nullable(),
  autoExpiredAt: iso.nullable(),
  eventLabel: z.string(),
  recommendedAction: z.string(),
});
export const snapshotSchema = z
  .object({
    monitoring: monitoringSchema,
    profile: healthProfileSchema,
    careTasks: z.array(careTaskSchema),
    displayStatus: z.enum([
      "stable",
      "watch",
      "important",
      "critical",
      "unknown",
      "paused",
    ]),
    nowMs: z.number(),
    demoTimeScale: z.number(),
    people: peopleSchema,
    dataStatus: z.object({
      source: z.literal("simulated"),
      synthetic: z.literal(true),
      asOf: iso,
      stale: z.boolean(),
    }),
    subject: z.object({
      id,
      name: z.string(),
      alias: z.string(),
      age: nullableNumber,
      timeZone: z.string(),
      monitoringPaused: z.boolean(),
    }),
    learningProgress: z
      .object({ currentDay: z.number(), totalDays: z.number() })
      .nullable(),
    overallLevel: risk,
    devices: z.array(
      z.object({
        deviceId: id,
        type: z.string(),
        label: z.string(),
        online: z.boolean(),
        worn: z.boolean().nullable(),
        lastSyncAt: iso.nullable(),
      }),
    ),
    deviceDetails: z.array(
      z.object({
        id,
        type: z.string(),
        label: z.string(),
        online: z.boolean(),
        worn: z.boolean().nullable(),
        batteryPct: nullableNumber,
        coveredRooms: z.array(z.string()),
        cameraMode: z.string().nullable(),
      }),
    ),
    baselines: z.array(
      z.object({
        metric,
        learned: z.boolean(),
        median: nullableNumber,
        p25: nullableNumber,
        p75: nullableNumber,
        unit: z.string(),
        label: z.string(),
      }),
    ),
    trends: z.object(
      Object.fromEntries(
        ["activity", "sleep", "mobility", "resting_hr"].map((k) => [
          k,
          z.array(
            z.object({
              date: z.string(),
              metric,
              value: z.number(),
              synthetic: z.boolean().optional(),
            }),
          ),
        ]),
      ),
    ),
    metricSummaries: z.array(
      z.object({
        metric,
        label: z.string(),
        unit: z.string(),
        current: nullableNumber,
        baseline: nullableNumber,
        p25: nullableNumber,
        p75: nullableNumber,
        deltaPct: nullableNumber,
        delta30dPct: nullableNumber,
        status: z.enum([
          "normal",
          "slightly_off",
          "deviated",
          "insufficient_data",
        ]),
        interpretation: z.string(),
      }),
    ),
    events: z.array(
      z.object({
        id,
        subjectId: id,
        type: eventType,
        trendMetric: metric.nullable(),
        occurredAt: iso,
        signals: z.array(
          z.object({
            source: z.string(),
            description: z.string(),
            withinCoverage: z.boolean().optional(),
          }),
        ),
        fallPhase: z.enum([
          "candidate",
          "recovered",
          "unrecovered",
          "not_applicable",
        ]),
        recoveryWindowEndsAt: iso.nullable(),
        independentChannelCount: z.number(),
        dedupeKey: z.string().nullable(),
      }),
    ),
    deviations: z.record(z.array(deviation)),
    alerts: z.array(alert),
    contacts: z.array(
      z.object({
        id,
        subjectId: id,
        userId: id.nullable(),
        name: z.string(),
        ...contactDetails,
        escalationOrder: z.number(),
        timeZone: z.string(),
        channels: z.array(z.string()),
        phoneVerified: z.boolean(),
        quietHours: z.object({ start: z.string(), end: z.string() }).nullable(),
      }),
    ),
    notifications: z.array(
      z.object({
        id,
        alertId: id,
        contactId: id,
        contactName: z.string(),
        channel: z.string(),
        sentAt: iso,
        subject: z.string().nullable(),
        body: z.string(),
        error: z.string().nullable(),
        providerMessageId: z.string().nullable(),
        secureLinkAvailable: z.boolean(),
        deliveryStatus: z.enum(["pending", "sent", "delivered", "failed"]),
        simulated: z.boolean(),
      }),
    ),
    auditLog: z.array(
      z.object({
        id,
        at: iso,
        actorUserId: id.nullable(),
        actorRole: z.string(),
        subjectId: id,
        action: z.string(),
        targetUserId: id.nullable(),
        targetContactId: id.nullable(),
        detail: z.record(
          z.union([z.string(), z.number(), z.boolean(), z.null()]),
        ),
        ip: z.string().nullable(),
      }),
    ),
    subscription: z.object({
      subjectId: id,
      possible_fall: z.boolean(),
      heart_rate_deviation: z.boolean(),
      prolonged_inactivity: z.boolean(),
      activity_drop: z.boolean(),
      device_data_gap: z.boolean(),
      sleep_change: z.boolean(),
      watchEmailEnabled: z.boolean(),
      importantEscalationEnabled: z.boolean(),
    }),
    kimiSummaries: z.record(
      z.object({
        eventId: id,
        eventSummary: z.string(),
        baselineComparison: z.string(),
        relatedChanges: z.string(),
        suggestedNextStep: z.string(),
        validationPassed: z.boolean(),
        source: z.enum(["llm", "template_fallback"]),
      }),
    ),
    carePatients: z.array(
      z
        .object({
          id,
          name: z.string(),
          ...contactDetails,
          age: z.number(),
          level: risk,
          reason: z.string(),
          statusLabel: z.string(),
          lastUpdatedIso: iso,
          live: z.boolean(),
        })
        .passthrough(),
    ),
    activeCriticalAlertId: id.nullable(),
    pendingFallEventId: id.nullable(),
  })
  .transform((v) => v as unknown as DemoStateSnapshot);

// Reuse the exact same fields for the smaller person-scoped read endpoints.
export const snapshotFields = snapshotSchema.innerType().shape;
