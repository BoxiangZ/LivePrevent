"use client";

/**
 * Demo 控制条 — 常驻底部。
 * 注入跌倒 / 重置 / 加速标识 / 模拟数据声明（PRD §19 开场声明始终可见）。
 */

import { useDemo } from "@/components/DemoProvider";

export function DemoPanel() {
  const { snapshot, injectFall, resetDemo, busy } = useDemo();
  const scale = snapshot?.demoTimeScale ?? 18;
  const fallActive = snapshot?.alerts.some(
    (a) => a.eventType === "possible_fall" && (a.status === "open" || a.status === "acknowledged")
  );

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
        <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600">
          DEMO · {scale}× accelerated（恢复观察窗 3min→10s）
        </span>
        <button
          onClick={injectFall}
          disabled={busy || fallActive}
          className="rounded-md bg-critical px-3 py-1 text-xs font-semibold text-white hover:bg-critical/90 disabled:opacity-40"
        >
          ⚡ Inject fall（摄像头姿态+手表冲击+心率偏离）
        </button>
        <button
          onClick={resetDemo}
          disabled={busy}
          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          ↺ Reset demo
        </button>
        <span className="ml-auto text-[11px] text-gray-400">
          本 Demo 使用模拟输入与合成数据，不代表真实检测精度。
        </span>
      </div>
    </div>
  );
}
