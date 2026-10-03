import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/server/store";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const personId = request.nextUrl.searchParams.get("personId") ?? "";
  const store = getStore(personId);
  if (!store) return NextResponse.json({ error: "unknown_person" }, { status: 404 });
  const record = store.notificationBodies[id];
  const notification = store.alerts.flatMap((a) => a.notifications).find((n) => n.id === id);
  if (!record || !notification) return NextResponse.json({ error: "unknown_notification" }, { status: 404 });
  return NextResponse.json({ id, subject: record.subject, body: record.body,
    actionUrl: record.rawToken ? `/ack/${record.rawToken}` : null });
}
