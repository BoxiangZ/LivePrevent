import { NextResponse } from "next/server";
import { getStore, appendAudit } from "@/lib/demo/store";
import { advance, hashToken } from "@/lib/demo/engine";

export const dynamic = "force-dynamic";

/**
 * Acknowledge — 任一授权联系人点击确认即可，记录确认人与时间，停止升级 — PRD §6.4
 * 支持一次性 token 路径（Critical 安全链接）— PRD §7.1
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const nowMs = Date.now();
  advance(store, nowMs);
  const nowIso = new Date(nowMs).toISOString();

  const alert = store.alerts.find((a) => a.id === id);
  if (!alert) return NextResponse.json({ ok: false, error: "alert_not_found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { contactId?: string; token?: string };

  let contactId = body.contactId ?? null;

  // token 路径：校验一次性、未过期 — PRD §7.1
  if (body.token) {
    const hash = hashToken(body.token);
    const tokenId = store.tokenIdByHash[hash];
    const rec = tokenId ? store.oneTimeTokens.find((t) => t.id === tokenId) : null;
    if (!rec || rec.alertId !== alert.id) {
      return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 403 });
    }
    if (rec.consumedAt) {
      return NextResponse.json({ ok: false, error: "token_already_used" }, { status: 403 });
    }
    if (Date.parse(rec.expiresAt) < nowMs) {
      return NextResponse.json({ ok: false, error: "token_expired" }, { status: 403 });
    }
    rec.consumedAt = nowIso;
    rec.sessionVerified = true; // Demo 简化：会话验证略；真实产品此处要求登录态
    contactId = rec.contactId;
  }

  if (!contactId || !store.contacts.some((c) => c.id === contactId)) {
    return NextResponse.json({ ok: false, error: "contact_required" }, { status: 400 });
  }
  if (alert.status !== "open") {
    return NextResponse.json({ ok: false, error: "alert_not_open", status: alert.status }, { status: 409 });
  }

  alert.status = "acknowledged";
  alert.acknowledgedBy = contactId;
  alert.acknowledgedAt = nowIso;
  alert.escalation.nextStageAt = null; // 停止升级 — PRD §6.4

  appendAudit(store, {
    at: nowIso,
    actorUserId: store.contacts.find((c) => c.id === contactId)?.userId ?? null,
    actorRole: "primary_family",
    action: "alert_acknowledged",
    targetContactId: contactId,
    detail: { alertId: alert.id, viaToken: Boolean(body.token) },
  });

  return NextResponse.json({ ok: true, alertId: alert.id, eventId: alert.eventId });
}
