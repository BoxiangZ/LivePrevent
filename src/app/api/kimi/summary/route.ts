import { legacyAccess, session } from "@/server/v3/auth";
import { NextResponse } from "next/server";
import { findStoreByEventId, getStore, saveStore } from "@/server/store";
import { callKimi } from "@/server/llm/kimi";

export const dynamic = "force-dynamic";

/**
 * Kimi 摘要 — 异步补充到事件详情页，不在警报链路上（PRD §10.3）。
 * 无 API Key / 超时 / 校验失败 → 模板降级，接口始终 200。
 */
export async function POST(req: Request) {
  const denied = await legacyAccess(req); if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { eventId?: string };
  const eventId = body.eventId;
  if (!eventId) {
    return NextResponse.json({ ok: false, error: "eventId required" }, { status: 400 });
  }

  const store = findStoreByEventId(eventId);
  if (!store) return NextResponse.json({ ok: false, error: "event_not_found" }, { status: 404 });

  session(req, store.subject.id);
  const facts = store.structuredFacts[eventId];
  if (!facts) {
    return NextResponse.json({ ok: false, error: "no_structured_facts" }, { status: 404 });
  }

  // 缓存：同一事件只生成一次
  const cached = store.kimiSummaries[eventId];
  if (cached) return NextResponse.json({ ok: true, summary: cached });

  const summary = await callKimi(eventId, facts);
  const latest = getStore(store.subject.id)!;
  latest.kimiSummaries[eventId] = summary;
  saveStore(latest);
  return NextResponse.json({ ok: true, summary });
}
