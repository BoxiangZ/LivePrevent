import { NextResponse } from "next/server";
import { getStore, appendAudit, saveStore } from "@/server/store";

export const dynamic = "force-dynamic";

/** 监测暂停 / 恢复（隐私模式）— PRD §8.1：暂停期不产生"无活动"告警，家属侧显示"监测已暂停" */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { paused?: boolean; personId?: string };
  if (!body.personId) return NextResponse.json({ ok: false, error: "personId_required" }, { status: 400 });
  const store = getStore(body.personId);
  if (!store) return NextResponse.json({ ok: false, error: "person_not_bound" }, { status: 404 });
  const paused = Boolean(body.paused);
  const nowIso = new Date().toISOString();

  store.subject.monitoringPaused = paused;
  appendAudit(store, {
    at: nowIso,
    actorUserId: store.user.id,
    actorRole: "primary_family",
    action: paused ? "monitoring_paused" : "monitoring_resumed",
    detail: {},
  });

  saveStore(store);

  return NextResponse.json({ ok: true, monitoringPaused: paused });
}
