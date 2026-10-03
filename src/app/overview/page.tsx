"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { api } from "@/client/api";
import { overviewSchema } from "@/shared/contracts/assessment";
import { useDemo } from "@/client/provider/DemoProvider";
import { TrendsGrid } from "@/client/components/TrendsGrid";
const titles = {
  stable: "Stable",
  watch: "Keep an eye on this",
  important: "A check-in is recommended",
  critical: "May need help now",
  unknown: "Unable to verify current condition",
  paused: "Monitoring is paused",
};
export default function Overview() {
  const { selectedPersonId, snapshot, error: connectionError } = useDemo();
  const [data, setData] = useState<z.infer<typeof overviewSchema> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setData(null);
    const load = () =>
      api(`people/${selectedPersonId}/overview`, overviewSchema)
        .then((v) => {
          if (active) {
            setData(v);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedPersonId]);
  if (!data)
    return (
      <div className="panel" role="status">
        {error || "Loading current status…"}
      </div>
    );
  const unknown = Boolean(error || connectionError);
  const status = unknown ? "unknown" : data.displayStatus;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <Link className="btn-secondary" href="/assessments/new">
          Add information
        </Link>
      </div>
      <section
        className={`panel border-l-4 ${status === "critical" ? "border-l-critical" : status === "stable" ? "border-l-stable" : "border-l-watch"}`}
      >
        <p className="eyebrow">Current status</p>
        <h2 className="mt-3 text-3xl font-semibold">{titles[status]}</h2>
        <p className="mt-3 text-ink-soft">
          {unknown
            ? "Connection interrupted. Refresh to verify the current condition."
            : data.statusReason}
        </p>
        <p className="mt-4 text-xs text-ink-mute">
          {data.sourceLabel} ·{" "}
          {data.evaluatedAt
            ? `Last reliable device information: ${new Date(data.evaluatedAt).toLocaleString()}`
            : "No device information"}
        </p>
      </section>
      <section className="panel">
        <h2 className="font-semibold">Data freshness</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {data.dataFreshness.devices.map((d) => (
            <div key={d.id} className="rounded-xl bg-surface-soft p-4">
              <div className="flex justify-between">
                <strong className="text-sm">{d.label}</strong>
                <span className="text-xs">
                  {d.online ? "Connected" : "Offline"}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-soft">{d.reason}</p>
              <p className="mt-1 text-xs text-ink-mute">
                {d.lastSyncAt
                  ? new Date(d.lastSyncAt).toLocaleString()
                  : "No sync recorded"}
                {d.batteryPct !== null ? ` · ${d.batteryPct}% battery` : ""}
                {d.worn !== null ? (d.worn ? " · Worn" : " · Not worn") : ""}
              </p>
            </div>
          ))}
        </div>
        {!data.dataFreshness.devices.length && <p>No devices configured.</p>}
      </section>
      <section className="panel flex items-center justify-between gap-6">
        <div>
          <h2 className="font-semibold">Next action</h2>
          <p className="mt-2 text-sm text-ink-soft">
            {data.primaryAction.description}
          </p>
        </div>
        <Link className="btn-primary shrink-0" href={data.primaryAction.href}>
          {data.primaryAction.label}
        </Link>
      </section>
      {data.learningProgress && (
        <p className="text-sm text-ink-soft">
          Learning baseline · day {data.learningProgress.currentDay} /{" "}
          {data.learningProgress.totalDays}
        </p>
      )}
      <section className="panel">
        <div className="flex justify-between">
          <h2 className="font-semibold">Recent observations</h2>
          <Link
            href={`/people/${selectedPersonId}`}
            className="text-sm text-brand-600"
          >
            View history →
          </Link>
        </div>
        {snapshot?.events.slice(0, 3).map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className="mt-3 block border-t border-surface-line pt-3 text-sm"
          >
            <span className="capitalize">{e.type.replaceAll("_", " ")}</span>
            <span className="float-right text-ink-mute">
              {new Date(e.occurredAt).toLocaleString()}
            </span>
          </Link>
        ))}
        {!snapshot?.events.length && (
          <p className="mt-3 text-sm text-ink-mute">
            No observations yet. Add information to begin a review.
          </p>
        )}
      </section>
      <details className="panel">
        <summary className="cursor-pointer font-semibold">
          Health trends and personal baseline
        </summary>
        <div className="mt-6">
          <TrendsGrid />
        </div>
      </details>
    </div>
  );
}
