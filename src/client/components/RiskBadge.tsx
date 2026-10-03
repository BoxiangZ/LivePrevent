/**
 * 风险等级徽章 — 四级（Stable / Watch / Important / Critical）。
 */

import type { RiskLevel } from "@/shared/types/risk";
import { Pill } from "./ui";
import { cn } from "@/client/cn";

const META: Record<
  RiskLevel,
  {
    label: string;
    tone: "stable" | "watch" | "important" | "critical";
    dot: string;
  }
> = {
  stable: { label: "Stable", tone: "stable", dot: "bg-stable" },
  watch: { label: "Low risk", tone: "watch", dot: "bg-watch" },
  important: { label: "Moderate risk", tone: "important", dot: "bg-important" },
  critical: { label: "Critical", tone: "critical", dot: "bg-critical" },
};

export function RiskBadge({
  level,
  size = "md",
  withDot = true,
  className,
}: {
  level: RiskLevel;
  size?: "sm" | "md";
  withDot?: boolean;
  className?: string;
}) {
  const m = META[level];
  return (
    <Pill
      tone={m.tone}
      className={cn(size === "md" && "px-2.5 py-0.5 text-xs", className)}
    >
      {withDot && (
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            m.dot,
            level === "critical" && "animate-pulse",
          )}
        />
      )}
      {m.label}
    </Pill>
  );
}

export function riskMeta(level: RiskLevel) {
  return META[level];
}
