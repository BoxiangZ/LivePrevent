import { legacyAccess } from "@/server/v3/auth";
import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/server/store";

export async function GET(request: NextRequest) {
  const denied = await legacyAccess(request); if (denied) return denied;
  const personId = request.nextUrl.searchParams.get("personId") ?? "";
  const store = getStore(personId);
  if (!store) return NextResponse.json({ error: "unknown_person" }, { status: 404 });
  return NextResponse.json({ personId, subject: store.subject, contacts: store.contacts,
    devices: store.devices, subscription: store.subscription });
}

/** Settings writes use the versioned v3 contract only. */
export async function PUT(request: NextRequest) {
  const denied = await legacyAccess(request); if (denied) return denied;
  return NextResponse.json({ error: "Use PATCH /api/v3/people/:id/settings", code: "endpoint_retired" }, { status: 410 });
}
