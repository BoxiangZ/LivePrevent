import { NextResponse } from "next/server";
import { resetStore } from "@/lib/demo/store";

export const dynamic = "force-dynamic";

/** 重置 Demo：重建合成数据集（供评委重复演示） */
export async function POST() {
  resetStore();
  return NextResponse.json({ ok: true });
}
