import { NextResponse } from "next/server";
import { getStore, appendAudit } from "@/server/store";

export const dynamic = "force-dynamic";

/** 监测暂停 / 恢复（隐私模式）— PRD §8.1：暂停期不产生"无活动"告警，家属侧显示"监测已暂停" */
export async function POST(req: Request) {
  const store = getStore();
  const body = (await req.json().catch(() => ({}))) as { paused?: boolean };
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

  return NextResponse.json({ ok: true, monitoringPaused: paused });
}
