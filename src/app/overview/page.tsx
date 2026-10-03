"use client";

/**
 * Overview — demo 的开场页。
 * 自上而下：hero 状态 → 异常时的"Why this matters" → 四个健康域 →
 * Personal Baseline → 7/30/90 天纵向趋势 → 数据新鲜度。
 */

import Link from "next/link";
import { useDemo } from "@/client/provider/DemoProvider";
import { HeroStatus } from "@/client/components/HeroStatus";
import { WhyThisMatters } from "@/client/components/WhyThisMatters";
import { PersonalBaseline } from "@/client/components/PersonalBaseline";
import { TrendsGrid } from "@/client/components/TrendsGrid";
import { AlertCard } from "@/client/components/AlertCard";
import { Card, SectionTitle } from "@/client/components/ui";
import { cn } from "@/client/cn";
import type { TrendMetric } from "@/shared/types/event";

const METRIC_ORDER: TrendMetric[] = ["activity", "resting_hr", "sleep", "mobility"];

export default function OverviewPage() {
  const { snapshot } = useDemo();

  if (!snapshot) {
    return (
      <div className="space-y-6">
        <div className="h-36 animate-pulse rounded-2xl bg-surface-line/60" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-surface-line/60" />
          ))}
        </div>
      </div>
    );
  }

  const activeAlerts = snapshot.alerts.filter(
    (a) => a.status === "open" || a.status === "acknowledged"
  );
  const pendingFall = snapshot.pendingFallEventId
    ? snapshot.events.find((e) => e.id === snapshot.pendingFallEventId)
    : null;

  return (
    <div className="space-y-8">
      <HeroStatus />
      <FreshnessFooter />
      <section className="rounded-xl border border-surface-line bg-white p-4">
        <h2 className="text-sm font-semibold text-ink">Next action</h2>
        <p className="mt-1 text-sm text-ink-soft">{activeAlerts.length ? "Review the latest alert and confirm the person's status." : "No urgent action. Continue monitoring or submit a synthetic observation."}</p>
        <Link className="mt-2 inline-block text-sm font-semibold text-brand-600" href={activeAlerts.length ? `/events/${activeAlerts[0].eventId}` : "/demo-studio"}>{activeAlerts.length ? "Review alert →" : "Open demo input →"}</Link>
      </section>

      {/* 恢复观察窗提示 — 两阶段判定的第一幕 */}
      {pendingFall?.recoveryWindowEndsAt && (
        <RecoveryWindowBanner endsAt={pendingFall.recoveryWindowEndsAt} />
      )}

      {/* 有活动警报时优先展示 Why this matters */}
      {activeAlerts.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <WhyThisMatters />
          </div>
          <div className="space-y-3 lg:col-span-2">
            {activeAlerts.slice(0, 2).map((a) => (
              <AlertCard key={a.id} alert={a} snapshot={snapshot} />
            ))}
          </div>
        </div>
      )}

      {/* 四个健康域 */}
      <section>
        <SectionTitle
          title="Health areas"
          sub="Today compared with this person's personal baseline."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {METRIC_ORDER.map((m) => {
            const s = snapshot.metricSummaries.find((x) => x.metric === m);
            if (!s) return null;
            return <MetricTile key={m} summary={s} />;
          })}
        </div>
      </section>

      {/* 稳定时把 WhyThisMatters 放到趋势前面（有警报时已在上文展示） */}
      {activeAlerts.length === 0 && <WhyThisMatters />}

      <PersonalBaseline />

      <TrendsGrid />

    </div>
  );
}

function MetricTile({
  summary: s,
}: {
  summary: import("@/server/snapshot").MetricSummary;
}) {
  const delta = s.deltaPct;
  const abs = delta === null ? 0 : Math.abs(delta);
  const tone =
    delta === null
      ? "muted"
      : s.metric === "resting_hr"
        ? abs < 0.08
          ? "good"
          : abs < 0.15
            ? "watch"
            : "bad"
        : abs < 0.1
          ? "good"
          : abs < 0.2
            ? "watch"
            : "bad";

  const toneText: Record<string, string> = {
    good: "text-stable",
    watch: "text-watch",
    bad: "text-critical",
    muted: "text-ink-mute",
  };
  const toneBg: Record<string, string> = {
    good: "bg-stable/10",
    watch: "bg-watch/10",
    bad: "bg-critical/10",
    muted: "bg-surface-soft",
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-mute">{s.label}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
            toneBg[tone],
            toneText[tone]
          )}
        >
          {delta === null ? "—" : `${delta > 0 ? "+" : ""}${Math.round(delta * 100)}%`}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[26px] font-semibold tabular-nums tracking-tight text-ink">
          {s.current !== null ? formatVal(s.current, s.metric) : "—"}
        </span>
        <span className="text-sm text-ink-mute">{s.unit}</span>
      </div>
      <p className="mt-2 text-[13px] leading-snug text-ink-soft">{s.interpretation}</p>
    </Card>
  );
}

function RecoveryWindowBanner({ endsAt }: { endsAt: string }) {
  const { msUntil } = useDemo();
  const ms = msUntil(endsAt);
  const secs = ms !== null ? Math.max(0, Math.ceil(ms / 1000)) : 0;
  return (
    <Card tone="watch" className="border-watch/40">
      <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-watch opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-watch" />
        </span>
        <div className="min-w-0 flex-1 text-sm text-ink">
          <span className="font-semibold">Possible fall detected — observation window open.</span>{" "}
          <span className="text-ink-soft">
            If recovery movement is detected within{" "}
            <span className="font-mono font-semibold tabular-nums text-watch">{secs}s</span>, this
            downgrades to a watch note. Otherwise it escalates to Critical.
          </span>
        </div>
      </div>
    </Card>
  );
}

function FreshnessFooter() {
  const { snapshot } = useDemo();
  if (!snapshot) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-surface-line bg-white px-4 py-3 text-xs text-ink-mute">
      <strong className={snapshot.dataStatus.stale ? "text-critical" : "text-stable"}>
        Data {snapshot.dataStatus.stale ? "stale" : "fresh"}
      </strong>
      <span>Last sync {new Date(snapshot.dataStatus.asOf).toLocaleString("en-GB", { timeZone: snapshot.subject.timeZone })}</span>
      {snapshot.deviceDetails.map((d) => (
        <span key={d.id} className="inline-flex items-center gap-1.5">
          <span
            className={cn("h-1.5 w-1.5 rounded-full", d.online ? "bg-stable" : "bg-critical")}
          />
          {d.label}
          {d.type === "smartwatch" && d.worn !== null && (d.worn ? " · worn" : " · not worn")}
          {d.batteryPct !== null && ` · ${d.batteryPct}%`}
          {d.cameraMode === "edge_only" && " · on-device processing"}
        </span>
      ))}
      <span className="ml-auto">
        <Link href="/settings" className="text-brand-600 hover:underline">
          Privacy &amp; devices →
        </Link>
      </span>
    </div>
  );
}

function formatVal(v: number, metric: TrendMetric): string {
  if (metric === "activity") return Math.round(v).toLocaleString("en-US");
  if (metric === "resting_hr") return String(Math.round(v));
  return v.toFixed(1);
}
