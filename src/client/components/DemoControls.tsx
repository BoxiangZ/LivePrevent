"use client";

/**
 * Demo 控制面板 — 默认收起，只在演示时打开。
 * 关闭时产品看起来就是生产就绪状态。
 */

import { useState } from "react";
import { useDemo } from "@/client/provider/DemoProvider";
import { cn } from "@/client/cn";

export function DemoControls() {
  const [open, setOpen] = useState(false);
  const { snapshot, injectFall, injectInactivity, resetDemo, busy } = useDemo();

  const fallActive = snapshot?.alerts.some(
    (a) => a.eventType === "possible_fall" && (a.status === "open" || a.status === "acknowledged")
  );
  const inactivityActive = snapshot?.alerts.some(
    (a) =>
      a.eventType === "prolonged_inactivity" && (a.status === "open" || a.status === "acknowledged")
  );

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="w-64 overflow-hidden rounded-xl border border-surface-line bg-white shadow-lift">
          <div className="border-b border-surface-line bg-surface-soft px-4 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-mute">
              Demo controls
            </span>
          </div>
          <div className="space-y-2 px-4 py-3">
            <DemoButton
              onClick={injectFall}
              disabled={busy || fallActive}
              tone="critical"
              label="Simulate fall"
              hint="Camera posture + watch impact + HR"
              active={!!fallActive}
            />
            <DemoButton
              onClick={injectInactivity}
              disabled={busy || inactivityActive}
              tone="important"
              label="Simulate inactivity"
              hint="2h 47m still · 3.1× baseline"
              active={!!inactivityActive}
            />
            <DemoButton
              onClick={() => { if (confirm("Reset sample events for this person? Contacts and settings are kept.")) void resetDemo().catch(() => undefined); }}
              disabled={busy}
              tone="neutral"
              label="Reset scenario"
              hint="Reset events; keep contacts and settings"
            />
          </div>
          <div className="border-t border-surface-line bg-surface-soft px-4 py-2 text-[10px] text-ink-mute">
            For demonstration only · simulated data
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 items-center gap-2 rounded-full border px-3.5 text-xs font-semibold shadow-lift transition-colors",
          open
            ? "border-ink bg-ink text-white"
            : "border-surface-line bg-white text-ink-soft hover:border-ink-mute"
        )}
        aria-label={open ? "Close demo controls" : "Open demo controls"}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M11.98 2.5a1.5 1.5 0 00-3 0l-.2 1.6c-.5.16-.97.4-1.4.7l-1.5-.7a1.5 1.5 0 00-2 1.1l-.1.4a1.5 1.5 0 00.9 1.8l1.3 1a5 5 0 000 1.6l-1.3 1a1.5 1.5 0 00-.9 1.8l.1.4a1.5 1.5 0 002 1.1l1.5-.7c.43.3.9.54 1.4.7l.2 1.6a1.5 1.5 0 003 0l.2-1.6c.5-.16.97-.4 1.4-.7l1.5.7a1.5 1.5 0 002-1.1l.1-.4a1.5 1.5 0 00-.9-1.8l-1.3-1a5 5 0 000-1.6l1.3-1a1.5 1.5 0 00.9-1.8l-.1-.4a1.5 1.5 0 00-2-1.1l-1.5.7a5.1 5.1 0 00-1.4-.7l-.2-1.6zM10 12.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
        </svg>
        {open ? "Close" : "Demo"}
      </button>
    </div>
  );
}

function DemoButton({
  onClick,
  disabled,
  tone,
  label,
  hint,
  active,
}: {
  onClick: () => void;
  disabled?: boolean;
  tone: "critical" | "important" | "neutral";
  label: string;
  hint: string;
  active?: boolean;
}) {
  const tones: Record<string, string> = {
    critical: "border-critical/40 bg-red-50 text-critical hover:bg-red-100",
    important: "border-important/40 bg-orange-50 text-important hover:bg-orange-100",
    neutral: "border-surface-line bg-white text-ink-soft hover:bg-surface-soft",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        tones[tone]
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        {active && <span className="text-[10px] font-bold uppercase tracking-wide">active</span>}
      </div>
      <div className="mt-0.5 text-[11px] opacity-75">{hint}</div>
    </button>
  );
}
