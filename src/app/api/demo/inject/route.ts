import { NextResponse } from "next/server";
import { getStore } from "@/lib/demo/store";
import { advance } from "@/lib/demo/engine";
import { injectFall } from "@/lib/demo/inject";

export const dynamic = "force-dynamic";

/** 注入模拟跌倒事件（摄像头姿态 + 手表冲击 + 心率偏离）— PRD §19 步骤 2 */
export async function POST(req: Request) {
  const store = getStore();
  const nowMs = Date.now();
  advance(store, nowMs);

  const body = await req.json().catch(() => ({}));
  const scenario = (body as { scenario?: string }).scenario ?? "fall";
  if (scenario !== "fall") {
    return NextResponse.json({ ok: false, error: "unknown scenario" }, { status: 400 });
  }

  // 防重复：已有处于观察窗或 open 的跌倒警报时不再注入
  const existing = store.alerts.find(
    (a) => a.eventType === "possible_fall" && (a.status === "open" || a.status === "acknowledged")
  );
  if (existing) {
    return NextResponse.json({
      ok: false,
      error: "fall_alert_already_active",
      alertId: existing.id,
    });
  }

  const result = injectFall(store, nowMs);
  return NextResponse.json({ ok: true, ...result });
}
