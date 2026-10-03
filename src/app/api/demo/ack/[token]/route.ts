import { NextResponse } from "next/server";
import { hashToken } from "@/server/engine";
import { getStore, listPeople } from "@/server/store";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const hash = hashToken(token);
  for (const person of listPeople()) {
    const store = getStore(person.id);
    const tokenId = store?.tokenIdByHash[hash];
    const record = store?.oneTimeTokens.find((t) => t.id === tokenId);
    if (!store || !record) continue;
    const alert = store.alerts.find((a) => a.id === record.alertId);
    return NextResponse.json({ personId: person.id, alertId: record.alertId,
      eventId: alert?.eventId ?? null,
      contactName: store.contacts.find((c) => c.id === record.contactId)?.name ?? "Contact",
      status: record.consumedAt ? "used" : Date.parse(record.expiresAt) < Date.now() ? "expired" : "valid" });
  }
  return NextResponse.json({ error: "invalid_token" }, { status: 404 });
}
