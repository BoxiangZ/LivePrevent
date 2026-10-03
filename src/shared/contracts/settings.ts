import { z } from "zod";
import { id, iso } from "./assessment";
export const zone = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "Choose a valid time zone");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const settingsSchema = z
  .object({
    personId: id,
    subject: z.object({
      alias: z.string().trim().min(1).max(60),
      displayName: z.string().trim().min(1).max(100),
      age: z.number().int().min(50).max(120).nullable(),
      timeZone: zone,
      monitoringPaused: z.boolean(),
    }),
    contacts: z
      .array(
        z.object({
          id,
          subjectId: id,
          userId: id.nullable(),
          name: z.string().trim().min(1).max(100),
          escalationOrder: z.number().int().positive(),
          timeZone: zone,
          channels: z
            .array(z.enum(["email", "sms", "push", "voice_call"]))
            .min(1),
          phoneVerified: z.boolean(),
          quietHours: z.object({ start: time, end: time }).nullable(),
        }),
      )
      .min(1)
      .max(8),
    devices: z.array(
      z.object({
        id,
        type: z.string(),
        label: z.string(),
        coveredRooms: z.array(z.string().trim().min(1).max(50)).max(10),
      }),
    ),
    subscription: z.object({
      subjectId: id,
      possible_fall: z.literal(true),
      heart_rate_deviation: z.boolean(),
      prolonged_inactivity: z.boolean(),
      activity_drop: z.boolean(),
      device_data_gap: z.boolean(),
      sleep_change: z.boolean(),
      watchEmailEnabled: z.boolean(),
      importantEscalationEnabled: z.boolean(),
    }),
    consent: z.object({
      status: z.enum(["active", "revoked", "narrowed", "missing"]),
      grantedAt: iso.nullable(),
      role: z.enum(["subject", "legal_guardian"]).nullable(),
    }),
    policy: z.object({
      retentionHours: z.number().positive(),
      workspaceMode: z.literal("sample"),
    }),
    version: z.string(),
  })
  .strict()
  .refine(
    (v) => new Set(v.contacts.map((c) => c.id)).size === v.contacts.length,
    { path: ["contacts"], message: "Contacts must have unique IDs" },
  );
export type Settings = z.infer<typeof settingsSchema>;
