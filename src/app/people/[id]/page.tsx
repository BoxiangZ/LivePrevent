"use client";

/**
 * Selected person's detail page.
 * Health areas, personal baseline, devices, recent events.
 */

import Link from "next/link";
import { use, useEffect } from "react";
import { MonitoringStatus } from "@/client/components/MonitoringStatus";
import { HealthEvolution } from "@/client/components/HealthEvolution";
import { useDemo } from "@/client/provider/DemoProvider";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  SectionTitle,
} from "@/client/components/ui";
import { RiskBadge } from "@/client/components/RiskBadge";
import { PersonalBaseline } from "@/client/components/PersonalBaseline";
import { Sparkline } from "@/client/components/TrendsGrid";
import { cn } from "@/client/cn";
import type { MetricSummary } from "@/server/snapshot";
import type { TrendMetric } from "@/shared/types/event";

const METRIC_ORDER: TrendMetric[] = [
  "activity",
  "resting_hr",
  "sleep",
  "mobility",
];

const EVENT_TITLES: Record<string, string> = {
  possible_fall: "Possible fall",
  prolonged_inactivity: "Abnormal inactivity",
  heart_rate_deviation: "Heart rate deviation",
  activity_drop: "Activity below baseline",
  device_data_gap: "Data gap",
};

function formatValue(v: number | null, metric: TrendMetric): string {
  if (v === null) return "—";
  if (metric === "activity") return Math.round(v).toLocaleString("en-US");
  if (metric === "resting_hr") return String(Math.round(v));
  return v.toFixed(1);
}

function deltaTone(metric: TrendMetric, deltaPct: number | null): string {
  if (deltaPct === null) return "text-ink-mute";
  const a = Math.abs(deltaPct);
  if (metric === "resting_hr") {
    if (a < 0.08) return "text-stable";
    if (a < 0.2) return "text-watch";
    return "text-critical";
  }
  if (a < 0.1) return "text-stable";
  if (a < 0.2) return "text-watch";
  return "text-critical";
}

function formatWhen(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { snapshot, selectedPersonId, selectPerson } = useDemo();
  useEffect(() => {
    if (id !== selectedPersonId) selectPerson(id);
  }, [id, selectedPersonId, selectPerson]);

  if (!snapshot) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-surface-line" />
        <div className="h-40 animate-pulse rounded-xl bg-surface-line" />
      </div>
    );
  }

  if (id !== snapshot.subject.id) {
    return (
      <EmptyState
        title="Unknown person"
        sub="The person you are looking for is not monitored by this account."
      />
    );
  }

  const tz = snapshot.subject.timeZone;
  const summaries = new Map(snapshot.metricSummaries.map((s) => [s.metric, s]));
  const recentEvents = snapshot.events.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Person details
          </h1>
          <p className="mt-0.5 text-sm text-ink-mute">
            {snapshot.subject.age !== null
              ? `Age ${snapshot.subject.age} · `
              : ""}
            Time zone: {snapshot.subject.timeZone}
          </p>
        </div>
        <Link className="btn-secondary" href="/settings">
          Edit health profile
        </Link>
      </div>

      <MonitoringStatus
        status={snapshot.displayStatus}
        monitoring={snapshot.monitoring}
      />
      <section className="panel">
        <h2 className="font-semibold">
          {snapshot.subject.name} · Health context
        </h2>
        {snapshot.profile.photo && (
          <img
            src={snapshot.profile.photo}
            alt="Person profile"
            className="mt-3 h-20 w-20 rounded-xl object-cover"
          />
        )}
        <p className="mt-3 text-sm text-ink-soft">
          {snapshot.profile.knownConditions.join(", ") ||
            "No conditions recorded"}
          {snapshot.profile.mobilityIssues &&
            ` · ${snapshot.profile.mobilityIssues}`}
          {snapshot.profile.walkingAid &&
            ` · Walking aid: ${snapshot.profile.walkingAid}`}
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          {snapshot.profile.livingSituation || "Living situation not recorded"}
        </p>
        <p className="mt-2 text-xs text-ink-mute">
          {snapshot.profile.medications.length} medications recorded · Health
          background{" "}
          {snapshot.profile.shareWithAi
            ? "available to Kimi for explanations"
            : "kept local"}
        </p>
      </section>
      <HealthEvolution key={id} personId={id} />
      {/* Health areas */}
      <section>
        <SectionTitle
          title="Health areas"
          sub="Today compared with this person's personal baseline."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {METRIC_ORDER.map((metric) => {
            const s = summaries.get(metric);
            if (!s) return null;
            return (
              <MetricCard
                key={metric}
                summary={s}
                points={(snapshot.trends[metric] ?? []).slice(-30)}
              />
            );
          })}
        </div>
      </section>

      {/* Personal baseline */}
      <section>
        <PersonalBaseline />
      </section>

      {/* Devices */}
      <section>
        <Card>
          <CardHeader
            title="Devices"
            sub="Live status of this person's devices."
          />
          <CardBody>
            <ul className="divide-y divide-surface-line">
              {snapshot.deviceDetails.map((d) => (
                <li
                  key={d.id}
                  className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          d.online ? "bg-stable" : "bg-critical",
                        )}
                        aria-label={d.online ? "Online" : "Offline"}
                      />
                      <span className="text-sm font-medium text-ink">
                        {d.label}
                      </span>
                      <span className="text-xs text-ink-mute">{d.type}</span>
                    </div>
                    <div className="mt-1 text-xs text-ink-mute">
                      {d.type === "smartwatch" && (
                        <>
                          {d.worn === null
                            ? "Worn state unknown"
                            : d.worn
                              ? "Currently worn"
                              : "Not worn"}
                          {d.batteryPct !== null && (
                            <span className="ml-2 tabular-nums">
                              Battery {Math.round(d.batteryPct)}%
                            </span>
                          )}
                        </>
                      )}
                      {d.type === "camera" && (
                        <>
                          {d.coveredRooms.length > 0 && (
                            <span>Covers {d.coveredRooms.join(", ")}</span>
                          )}
                          {d.cameraMode === "edge_only" && (
                            <span className="ml-2">
                              Device observations · optional assessment clips
                              managed separately
                            </span>
                          )}
                        </>
                      )}
                      {d.type !== "smartwatch" && d.type !== "camera" && (
                        <>{d.online ? "Working normally" : "Offline"}</>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      d.online ? "text-stable" : "text-critical",
                    )}
                  >
                    {d.online ? "Online" : "Offline"}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </section>

      {/* Recent events */}
      <section>
        <Card>
          <CardHeader
            title="Recent events"
            sub="Moments when LivePrevent noticed something worth a closer look."
          />
          <CardBody>
            {recentEvents.length === 0 ? (
              <EmptyState
                title="No events yet"
                sub="When something deviates from this person's baseline, it will appear here."
              />
            ) : (
              <ul className="divide-y divide-surface-line">
                {recentEvents.map((ev) => {
                  const alert = snapshot.alerts.find(
                    (a) => a.eventId === ev.id,
                  );
                  return (
                    <li key={ev.id} className="py-3 first:pt-0 last:pb-0">
                      <Link
                        href={`/events/${ev.id}`}
                        className="group flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-ink group-hover:text-brand-700">
                            {EVENT_TITLES[ev.type] ?? ev.type}
                          </div>
                          <div className="mt-0.5 text-xs text-ink-mute">
                            {formatWhen(ev.occurredAt, tz)}
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {alert ? (
                            <>
                              <RiskBadge level={alert.level} size="sm" />
                              <span className="text-xs text-ink-mute">
                                {alert.status === "open"
                                  ? "Open"
                                  : alert.status === "acknowledged"
                                    ? "Acknowledged"
                                    : alert.status === "resolved"
                                      ? "Resolved"
                                      : "Auto-expired"}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-ink-mute">
                              No alert
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  summary,
  points,
}: {
  summary: MetricSummary;
  points: Array<{
    date: string;
    metric: TrendMetric;
    value: number;
    synthetic?: boolean;
  }>;
}) {
  const metric = summary.metric;
  const delta = summary.deltaPct;
  const toneClass = deltaTone(metric, delta);

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-mute">
              {summary.label}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tabular-nums tracking-tight text-ink">
                {formatValue(summary.current, metric)}
              </span>
              <span className="text-sm text-ink-mute">{summary.unit}</span>
            </div>
          </div>
          <div
            className={cn(
              "text-right text-sm font-semibold tabular-nums",
              toneClass,
            )}
          >
            {delta !== null ? (
              <>
                {delta > 0 ? "+" : ""}
                {Math.round(delta * 100)}%
                <div className="text-[10px] font-normal text-ink-mute">
                  vs baseline
                </div>
              </>
            ) : (
              <span className="text-xs font-normal text-ink-mute">
                Not enough data
              </span>
            )}
          </div>
        </div>

        <div className="mt-3">
          <Sparkline
            points={points}
            baseline={summary.baseline}
            metric={metric}
            height={56}
          />
        </div>

        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          {summary.interpretation}
        </p>
      </CardBody>
    </Card>
  );
}
