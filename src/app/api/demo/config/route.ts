import { NextRequest, NextResponse } from "next/server";
import { appendAudit, getStore, saveStore } from "@/server/store";
import type { AlertSubscriptionSettings, Contact } from "@/shared/types/alert";

export async function GET(request: NextRequest) {
  const personId = request.nextUrl.searchParams.get("personId") ?? "";
  const store = getStore(personId);
  if (!store) return NextResponse.json({ error: "unknown_person" }, { status: 404 });
  return NextResponse.json({ personId, subject: store.subject, contacts: store.contacts,
    devices: store.devices, subscription: store.subscription });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const store = body && typeof body.personId === "string" ? getStore(body.personId) : null;
  if (!store) return NextResponse.json({ error: "unknown_person" }, { status: 404 });
  const subject = body.subject;
  const contacts = body.contacts as Contact[];
  const subscription = body.subscription as AlertSubscriptionSettings;
  if (!subject || typeof subject.alias !== "string" || !subject.alias.trim() || subject.alias.length > 60 ||
      typeof subject.displayName !== "string" || !subject.displayName.trim() || subject.displayName.length > 100 ||
      (subject.age !== null && (!Number.isInteger(subject.age) || subject.age < 50 || subject.age > 120)) ||
      typeof subject.timeZone !== "string" || !Intl.supportedValuesOf("timeZone").includes(subject.timeZone))
    return NextResponse.json({ error: "Invalid person details" }, { status: 400 });
  if (!Array.isArray(contacts) || contacts.length < 1 || contacts.length > 8 ||
      contacts.some((c) => !c || typeof c.name !== "string" || !c.name.trim() || c.name.length > 100 ||
        !Array.isArray(c.channels) || c.channels.length < 1 ||
        c.channels.some((ch) => !["email", "sms", "push"].includes(ch))) ||
      new Set(contacts.map((c) => c.id)).size !== contacts.length)
    return NextResponse.json({ error: "Provide 1–8 contacts with names and channels" }, { status: 400 });
  if (!subscription || typeof subscription !== "object" ||
      ["heart_rate_deviation", "prolonged_inactivity", "activity_drop", "device_data_gap", "sleep_change", "watchEmailEnabled", "importantEscalationEnabled"].some((key) => typeof subscription[key as keyof AlertSubscriptionSettings] !== "boolean"))
    return NextResponse.json({ error: "Invalid notification settings" }, { status: 400 });
  store.subject.alias = subject.alias.trim();
  store.subject.displayName = subject.displayName.trim();
  store.subject.age = subject.age;
  store.subject.timeZone = subject.timeZone;
  store.contacts = contacts.map((c, index) => ({ ...c, subjectId: store.subject.id,
    escalationOrder: index + 1, name: c.name.trim(),
    phoneVerified: c.channels.includes("sms") ? Boolean(c.phoneVerified) : false }));
  store.subscription = { ...subscription, subjectId: store.subject.id, possible_fall: true };
  if (Array.isArray(body.devices)) {
    for (const update of body.devices) {
      const device = store.devices.find((d) => d.id === update.id);
      if (device && device.type === "camera" && Array.isArray(update.coveredRooms) &&
          update.coveredRooms.length <= 10 && update.coveredRooms.every((r: unknown) => typeof r === "string" && r.length <= 50))
        device.coveredRooms = update.coveredRooms;
    }
  }
  appendAudit(store, { at: new Date().toISOString(), actorUserId: store.user.id,
    actorRole: "primary_family", action: "permission_changed", detail: { target: "demo_config" } });
  saveStore(store);
  return NextResponse.json({ ok: true });
}
