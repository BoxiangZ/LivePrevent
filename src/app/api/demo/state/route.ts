import { legacyAccess } from "@/server/v3/auth";
import { NextResponse } from "next/server";
import { getStore, listPeople, saveStore, DEFAULT_PERSON_ID } from "@/server/store";
import { advance } from "@/server/engine";
import { buildSnapshot } from "@/server/snapshot";

export const dynamic = "force-dynamic";

/** 所有页面共享的状态快照。每次调用先 advance 引擎（懒求值时钟）。 */
export async function GET(req: Request) {
  const denied = await legacyAccess(req); if (denied) return denied;
  const personId = new URL(req.url).searchParams.get("personId") ?? DEFAULT_PERSON_ID;
  const store = getStore(personId);
  if (!store) return NextResponse.json({ error: "person_not_bound" }, { status: 404 });
  const nowMs = Date.now();

  return NextResponse.json({
    ...buildSnapshot(store, nowMs),
    people: listPeople(),
  });
}
