import { NextResponse } from "next/server";
import { getStore, saveStore } from "@/server/store";
import { advance } from "@/server/engine";
import { injectFall, injectInactivity } from "@/server/inject";

export const dynamic = "force-dynamic";

/** 注入模拟事件（scenario: "fall" | "inactivity"）— PRD §19 步骤 2 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const personId = (body as { personId?: string }).personId;
  if (!personId) return NextResponse.json({ ok: false, error: "personId_required" }, { status: 400 });
  const store = getStore(personId);
  if (!store) return NextResponse.json({ ok: false, error: "person_not_bound" }, { status: 404 });
  const nowMs = Date.now();
  advance(store, nowMs);

  const scenario = (body as { scenario?: string }).scenario ?? "fall";
  if (scenario !== "fall" && scenario !== "inactivity") {
    return NextResponse.json({ ok: false, error: "unknown scenario" }, { status: 400 });
  }

  const eventType = scenario === "fall" ? "possible_fall" : "prolonged_inactivity";

  // 防重复：已有同类 open/acknowledged 警报时不再注入
  const existing = store.alerts.find(
    (a) => a.eventType === eventType && (a.status === "open" || a.status === "acknowledged")
  );
  if (existing) {
    return NextResponse.json({
      ok: false,
      error: `${scenario}_alert_already_active`,
      alertId: existing.id,
    });
  }

  const result =
    scenario === "fall" ? injectFall(store, nowMs) : injectInactivity(store, nowMs);
  saveStore(store);
  return NextResponse.json({ ok: true, ...result });
}
