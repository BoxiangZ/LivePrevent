import { randomUUID } from "node:crypto";
import { createPersonSchema } from "@/shared/contracts/monitoring";
import type { z } from "zod";
import { createEmptyStore, saveStore, appendAudit } from "@/server/store";
import { seedDevices } from "@/server/data/seed";

export function createPerson(
  input: z.infer<typeof createPersonSchema>,
  userId: string,
) {
  const s = createEmptyStore(input.name);
  s.subject.alias = input.alias;
  s.subject.age = input.age;
  s.subject.timeZone = input.timeZone;
  s.user.id = userId;
  s.user.rolesBySubject = { [s.subject.id]: "primary_family" };
  s.profile = input.profile;
  s.monitoring.simulatorEnabled = input.simulatorEnabled;
  s.monitoring.emailEnabled = input.emailEnabled;
  const now = new Date().toISOString();
  s.devices = seedDevices(now)
    .filter((d) => input.devices.includes(d.type))
    .map((d) => ({
      ...d,
      id: `dev_${randomUUID()}`,
      subjectId: s.subject.id,
      lastSyncAt: input.simulatorEnabled ? now : null,
    }));
  s.monitoring.lastDataReceivedAt =
    input.simulatorEnabled && s.devices.length ? now : null;
  s.contacts = [
    {
      ...input.primaryContact,
      id: `ct_${randomUUID()}`,
      subjectId: s.subject.id,
      userId,
      escalationOrder: 1,
      timeZone: input.timeZone,
      channels: ["email"],
      phoneVerified: false,
      quietHours: null,
      subscriptions: { ...input.primaryContact.subscriptions, critical: true },
    },
  ];
  appendAudit(s, {
    at: now,
    actorUserId: userId,
    actorRole: "primary_family",
    action: "person_created",
    detail: { source: "local_workspace" },
  });
  saveStore(s);
  return s;
}
