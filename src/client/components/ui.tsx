/**
 * 通用 UI 原语 — Card / SectionTitle / Stat / EmptyState。
 * 克制、医疗级视觉，避免 CRUD/admin 感。
 */

import type { ReactNode } from "react";
import { cn } from "@/client/cn";

export function Card({
  children,
  className,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "soft" | "critical" | "watch";
}) {
  const tones: Record<string, string> = {
    default: "bg-surface border-surface-line",
    soft: "bg-surface-soft border-surface-line",
    critical: "bg-red-50/60 border-red-200",
    watch: "bg-amber-50/60 border-amber-200",
  };
  return (
    <div className={cn("rounded-xl border shadow-card", tones[tone], className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  sub,
  right,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-surface-line px-5 py-3.5">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
        {sub ? <p className="mt-0.5 text-xs text-ink-mute">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

export function SectionTitle({
  title,
  sub,
  right,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-4", className)}>
      <div>
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {sub ? <p className="mt-0.5 text-sm text-ink-mute">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneColor: Record<string, string> = {
    default: "text-ink",
    good: "text-stable",
    warn: "text-watch",
    bad: "text-critical",
  };
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-mute">{label}</div>
      <div className={cn("mt-1 flex items-baseline gap-1", toneColor[tone])}>
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        {unit ? <span className="text-sm font-normal text-ink-mute">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-ink-mute">{hint}</div> : null}
    </div>
  );
}

export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-surface-line bg-surface-soft px-6 py-10 text-center">
      <div className="text-sm font-medium text-ink-soft">{title}</div>
      {sub ? <div className="mt-1 text-xs text-ink-mute">{sub}</div> : null}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "stable" | "watch" | "important" | "critical" | "brand";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-soft text-ink-soft border-surface-line",
    stable: "bg-green-50 text-green-700 border-green-200",
    watch: "bg-amber-50 text-amber-700 border-amber-200",
    important: "bg-orange-50 text-orange-700 border-orange-200",
    critical: "bg-red-50 text-red-700 border-red-200",
    brand: "bg-brand-50 text-brand-700 border-brand-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "secondary",
  size = "md",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  className?: string;
}) {
  const variants: Record<string, string> = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 border border-transparent",
    secondary: "bg-surface text-ink border border-surface-line hover:bg-surface-soft",
    danger: "bg-critical text-white hover:bg-critical/90 border border-transparent",
    ghost: "text-ink-soft hover:bg-surface-soft border border-transparent",
  };
  const sizes: Record<string, string> = {
    sm: "px-2.5 py-1 text-xs rounded-md",
    md: "px-3.5 py-1.5 text-sm rounded-lg",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
}
