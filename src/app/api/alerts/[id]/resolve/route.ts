import { NextResponse } from "next/server";
import { getStore, appendAudit } from "@/server/store";
import { advance } from "@/server/engine";
import { RESOLVE_REASONS } from "@/shared/types/risk";
import type { ResolveReason } from "@/shared/types/risk";

export const dynamic = "force-dynamic";

/**
 * Resolve — 由授权联系人手动处理并选择原因；Critical 必须人工处理，永不自动 Resolved — PRD §6.4
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const nowMs = Date.now();
  advance(store, nowMs);
  const nowIso = new Date(nowMs).toISOString();

  const alert = store.alerts.find((a) => a.id === id);
  if (!alert) return NextResponse.json({ ok: false, error: "alert_not_found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    contactId?: string;
    reason?: string;
    note?: string;
  };

  const reason = body.reason as ResolveReason | undefined;
  if (!reason || !RESOLVE_REASONS.includes(reason)) {
    return NextResponse.json(
      { ok: false, error: "resolve_reason_required", allowed: RESOLVE_REASONS },
      { status: 400 }
    );
  }

  // Critical 必须先经人工确认再处理 — PRD §6.4
  if (alert.level === "critical" && alert.status === "open") {
    return NextResponse.json(
      { ok: false, error: "critical_requires_acknowledge_first" },
      { status: 409 }
    );
  }
  if (alert.status === "resolved" || alert.status === "auto_expired") {
    return NextResponse.json({ ok: false, error: "alert_already_closed" }, { status: 409 });
  }

  const contactId = body.contactId ?? store.contacts[0]?.id ?? null;

  alert.status = "resolved";
  alert.resolvedBy = contactId;
  alert.resolvedAt = nowIso;
  alert.resolveReason = reason;
  alert.resolveNote = body.note ?? null;
  alert.escalation.nextStageAt = null;

  // 误报反馈进入阈值/基线排除规则的输入（离线评估 — PRD §5.7）
  appendAudit(store, {
    at: nowIso,
    actorUserId: store.contacts.find((c) => c.id === contactId)?.userId ?? null,
    actorRole: "primary_family",
    action: "alert_resolved",
    targetContactId: contactId,
    detail: { alertId: alert.id, reason, note: body.note ?? null },
  });

  return NextResponse.json({ ok: true, alertId: alert.id });
}
