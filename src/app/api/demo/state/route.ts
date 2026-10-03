import { NextResponse } from "next/server";
import { getStore } from "@/server/store";
import { advance } from "@/server/engine";
import { buildSnapshot } from "@/server/snapshot";

export const dynamic = "force-dynamic";

/** 所有页面共享的状态快照。每次调用先 advance 引擎（懒求值时钟）。 */
export async function GET() {
  const store = getStore();
  const nowMs = Date.now();
  advance(store, nowMs);
  return NextResponse.json(buildSnapshot(store, nowMs));
}
