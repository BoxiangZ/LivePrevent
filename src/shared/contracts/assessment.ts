import { z } from "zod";

export const id = z.string().min(1).max(120);
export const iso = z.string().datetime({ offset: true });
export const risk = z.enum(["stable", "watch", "important", "critical"]);
export const displayStatus = z.enum([
  "stable",
  "watch",
  "important",
  "critical",
  "unknown",
  "paused",
]);
export const scenario = z.enum([
  "possible_fall",
  "prolonged_inactivity",
  "heart_rate_deviation",
  "activity_drop",
  "device_data_gap",
  "general_check",
]);
export const observationKinds = [
  "impact",
  "fall_posture",
  "inactivity_minutes",
  "heart_rate",
  "activity_steps",
  "worn",
  "sleeping",
  "recovery",
  "device_online",
  "note",
] as const;
export const observationSchema = z
  .object({
    kind: z.enum(observationKinds),
    value: z.union([
      z.number().finite(),
      z.boolean(),
      z.string().trim().min(1).max(300),
    ]),
    at: iso,
    source: z.enum(["sample_manual", "sample_sensor"]),
    withinCoverage: z.boolean().optional(),
  })
  .strict()
  .superRefine((o, ctx) => {
    const numeric = [
      "inactivity_minutes",
      "heart_rate",
      "activity_steps",
    ].includes(o.kind);
    if (numeric && (typeof o.value !== "number" || o.value < 0))
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Use a non-negative number",
      });
    if (!numeric && o.kind !== "note" && typeof o.value !== "boolean")
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Use true or false",
      });
    if (o.kind === "note" && typeof o.value !== "string")
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Enter an observation",
      });
    if (o.kind === "heart_rate" && typeof o.value === "number" && o.value > 300)
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Heart rate must be at most 300 bpm",
      });
  });
export type Observation = z.infer<typeof observationSchema>;
export const createAssessmentSchema = z
  .object({
    personId: id,
    scenario,
    observedAt: iso,
    timeZone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Invalid time zone"),
    observations: z.array(observationSchema).max(1000),
    sensorAssetIds: z.array(id).max(3),
    videoAssetId: id.optional(),
    note: z.string().max(500).default(""),
    provenance: z.literal("sample_user_uploaded"),
    consent: z.literal(true),
    idempotencyKey: z.string().regex(/^[\w-]{8,100}$/),
  })
  .strict()
  .refine((v) => v.observations.length + v.sensorAssetIds.length > 0, {
    path: ["observations"],
    message: "Add an observation or a data file",
  });
export type AssessmentInput = z.infer<typeof createAssessmentSchema>;
export const mediaSchema = z.object({
  assetId: id,
  personId: id,
  name: z.string(),
  kind: z.enum(["sensor", "video"]),
  mime: z.string(),
  size: z.number(),
  durationSeconds: z.number().nullable(),
  status: z.enum(["awaiting_upload", "ready", "failed", "deleted"]),
  createdAt: iso,
  expiresAt: iso,
  error: z.string().nullable(),
  observations: z.array(observationSchema),
});
export type Media = z.infer<typeof mediaSchema>;
export const visualFindingSchema = z
  .object({
    summary: z.string().max(1600),
    uncertain: z.boolean(),
    limitations: z.array(z.string().max(300)).max(10),
    evidence: z
      .array(
        z
          .object({
            atSeconds: z.number().nonnegative(),
            description: z.string().min(1).max(500),
            kind: z.enum(["fall_posture", "recovery", "movement", "unclear"]),
            confidence: z.enum(["low", "medium", "high"]),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
export const findingSchema = z.object({
  displayStatus,
  level: risk.nullable(),
  headline: z.string(),
  plainSummary: z.string(),
  recommendedAction: z.string(),
  limitations: z.array(z.string()),
  observations: z.array(observationSchema),
  video: visualFindingSchema.nullable(),
  sourceBreakdown: z.array(z.string()),
  model: z.object({
    provider: z.literal("kimi"),
    modelId: z.string().nullable(),
    used: z.boolean(),
    fallbackReason: z.string().nullable(),
  }),
  decision: z.object({
    engine: z.string(),
    version: z.string(),
    ruleId: z.string(),
  }),
  eventId: id.nullable(),
  alertId: id.nullable(),
});
export const assessmentSchema = z.object({
  assessmentId: id,
  personId: id,
  input: createAssessmentSchema,
  status: z.enum([
    "created",
    "queued",
    "analyzing",
    "completed",
    "partial",
    "failed",
    "cancelled",
  ]),
  stage: z.string(),
  createdAt: iso,
  updatedAt: iso,
  startedAt: iso.nullable(),
  completedAt: iso.nullable(),
  attempt: z.number().int(),
  error: z.string().nullable(),
  retryable: z.boolean(),
  finding: findingSchema.nullable(),
});
export type Assessment = z.infer<typeof assessmentSchema>;
export type Finding = z.infer<typeof findingSchema>;
export const envelope = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    schemaVersion: z.literal("3"),
    requestId: z.string(),
    generatedAt: iso,
    data,
  });
export const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  fieldErrors: z.record(z.array(z.string())).optional(),
  requestId: z.string(),
  retryable: z.boolean(),
});
export const peopleSchema = z.array(
  z.object({
    id,
    label: z.string(),
    alias: z.string(),
    overallLevel: z.string(),
    openAlertCount: z.number(),
  }),
);
export const overviewSchema = z.object({
  personId: id,
  displayStatus,
  statusReason: z.string(),
  evaluatedAt: iso.nullable(),
  riskLevel: risk,
  primaryAction: z.object({
    label: z.string(),
    href: z.string(),
    description: z.string(),
  }),
  dataFreshness: z.object({
    verifiable: z.boolean(),
    devices: z.array(
      z.object({
        id,
        label: z.string(),
        online: z.boolean(),
        worn: z.boolean().nullable(),
        batteryPct: z.number().nullable(),
        lastSyncAt: iso.nullable(),
        reason: z.string(),
        coveredRooms: z.array(z.string()),
      }),
    ),
  }),
  sourceLabel: z.string(),
  learningProgress: z
    .object({ currentDay: z.number(), totalDays: z.number() })
    .nullable(),
});
export const uploadInputSchema = z
  .object({
    personId: id,
    name: z.string().min(1).max(150),
    kind: z.enum(["sensor", "video"]),
    size: z.number().int().positive(),
    mime: z.string().max(100),
  })
  .strict();
export const optionSchema = z.object({
  scenarios: z.array(z.object({ value: scenario, label: z.string() })),
  kinds: z.array(
    z.object({
      value: z.enum(observationKinds),
      label: z.string(),
      type: z.enum(["boolean", "number", "text"]),
    }),
  ),
  limits: z.object({
    sensorBytes: z.number(),
    videoBytes: z.number(),
    videoSeconds: z.number(),
    retentionHours: z.number(),
  }),
  videoAvailable: z.boolean(),
  videoMessage: z.string(),
});
