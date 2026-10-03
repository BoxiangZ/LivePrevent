import { RISK_LEVEL_META } from "@/types/risk";
import type { RiskLevel } from "@/types/risk";

const COLOR_CLASSES: Record<RiskLevel, string> = {
  stable: "bg-stable/15 text-stable border-stable/40",
  watch: "bg-watch/15 text-watch border-watch/40",
  important: "bg-important/15 text-important border-important/40",
  critical: "bg-critical/15 text-critical border-critical/40",
};

/** 统一四级徽章 — 全产品唯一等级视觉语言（PRD §3） */
export function RiskBadge({ level, large }: { level: RiskLevel; large?: boolean }) {
  const meta = RISK_LEVEL_META[level];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${COLOR_CLASSES[level]} ${
        large ? "px-3 py-1 text-base" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}
