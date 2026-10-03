import { legacyAccess } from "@/server/v3/auth";
import { NextResponse } from "next/server";
import { resetStore } from "@/server/store";

export const dynamic = "force-dynamic";

/** 重置 Demo：重建合成数据集（供评委重复演示） */
export async function POST(req: Request) {
  const denied = await legacyAccess(req); if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const personId = (body as { personId?: string }).personId;
  if (!personId) return NextResponse.json({ ok: false, error: "personId_required" }, { status: 400 });
  if (!resetStore(personId)) return NextResponse.json({ ok: false, error: "person_not_bound" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
