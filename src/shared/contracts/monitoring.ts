import { z } from "zod";

const text = z.string().trim().max(500);
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .or(z.literal(""));
export const healthProfileSchema = z
  .object({
    sex: z
      .enum(["unspecified", "female", "male", "other"])
      .default("unspecified"),
    heightCm: z.number().finite().min(50).max(250).nullable().default(null),
    weightKg: z.number().finite().min(10).max(400).nullable().default(null),
    photo: z
      .string()
      .max(700000)
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
      .nullable()
      .default(null),
    livingSituation: text.default(""),
    knownConditions: z
      .array(z.string().trim().min(1).max(100))
      .max(20)
      .default([]),
    previousFalls: text.default(""),
    mobilityIssues: text.default(""),
    otherConditions: text.default(""),
    medications: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(100),
            dose: text,
            frequency: text,
            notes: text,
          })
          .strict(),
      )
      .max(20)
      .default([]),
    wakeTime: time.default(""),
    sleepTime: time.default(""),
    activityLevel: z
      .enum(["unspecified", "low", "moderate", "active"])
      .default("unspecified"),
    walkingAid: text.default(""),
    livesAlone: z.boolean().nullable().default(null),
    notes: z.string().trim().max(1000).default(""),
    shareWithAi: z.boolean().default(false),
  })
  .strict();
export type HealthProfile = z.infer<typeof healthProfileSchema>;
export const emptyProfile = (): HealthProfile => healthProfileSchema.parse({});
export const monitoringSchema = z.object({
  lastDataReceivedAt: z.string().datetime({ offset: true }).nullable(),
  simulatorEnabled: z.boolean(),
  dataLoss: z.boolean(),
  emailEnabled: z.boolean(),
});
export type Monitoring = z.infer<typeof monitoringSchema>;
export const contactDetails = {
  email: z.string().trim().email().max(254).or(z.literal("")).default(""),
  phone: z.string().trim().max(40).default(""),
  relationship: z.string().trim().max(80).default(""),
  role: z
    .enum(["family", "caregiver", "healthcare_provider"])
    .default("family"),
  subscriptions: z
    .object({ critical: z.boolean(), moderate: z.boolean(), low: z.boolean() })
    .default({ critical: true, moderate: true, low: false }),
};
export const createPersonSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    alias: z.string().trim().min(1).max(60),
    age: z.number().int().min(50).max(120).nullable(),
    timeZone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Invalid time zone"),
    profile: healthProfileSchema,
    primaryContact: z
      .object({ name: z.string().trim().min(1).max(100), ...contactDetails })
      .strict(),
    simulatorEnabled: z.boolean().default(true),
    emailEnabled: z.boolean().default(false),
    devices: z
      .array(z.enum(["smartwatch", "camera"]))
      .max(2)
      .default(["smartwatch", "camera"]),
  })
  .strict()
  .refine((v) => !v.emailEnabled || !!v.primaryContact.email, {
    path: ["primaryContact", "email"],
    message: "A primary email is required for email alerts",
  });
export const careTaskSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  reason: z.string(),
  recommendation: z.string(),
  status: z.enum(["open", "completed"]),
  completedAt: z.string().nullable(),
  outcome: z.string(),
  ruleId: z.string(),
  eventId: z.string().nullable(),
});
export type CareTask = z.infer<typeof careTaskSchema>;
export const statusLabels = {
  stable: "Stable",
  watch: "Low risk",
  important: "Moderate risk",
  critical: "Critical",
  unknown: "Unable to verify current condition",
  paused: "Monitoring paused",
};
export const evolutionSchema = z.object({
  personId: z.string(),
  windowDays: z.number(),
  source: z.string(),
  metrics: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      unit: z.string(),
      baseline: z.number().nullable(),
      current: z.number().nullable(),
      changePct: z.number().nullable(),
      historicalChangePct: z.number().nullable(),
      coverageDays: z.number(),
      points: z.array(z.object({ date: z.string(), value: z.number() })),
    }),
  ),
  tasks: z.array(careTaskSchema),
  summary: z
    .object({
      text: z.string(),
      source: z.enum(["llm", "rules"]),
      generatedAt: z.string(),
      windowDays: z.number(),
    })
    .nullable(),
});
export type Evolution = z.infer<typeof evolutionSchema>;
