"use client";
import { useEffect, useState } from "react";
import { calendarDay } from "@/shared/date";
import Link from "next/link";
import { z } from "zod";
import { api } from "@/client/api";
import { evolutionSchema, type Evolution } from "@/shared/contracts/monitoring";
import { useDemo } from "@/client/provider/DemoProvider";

function HistoryChart({
  points,
  label,
}: {
  points: Array<{ date: string; value: number }>;
  label: string;
}) {
  if (points.length < 2)
    return (
      <p className="mt-5 text-xs text-ink-mute">
        Add dated measurements to see a trend.
      </p>
    );
  const values = points.map((p) => p.value),
    min = Math.min(...values),
    max = Math.max(...values);
  const start = Date.parse(points[0].date),
    end = Date.parse(points.at(-1)!.date);
  const line = points
    .map(
      (p) =>
        `${4 + ((Date.parse(p.date) - start) / (end - start || 1)) * 292},${66 - ((p.value - min) / (max - min || 1)) * 58}`,
    )
    .join(" ");
  return (
    <div className="mt-4">
      <svg
        role="img"
        aria-label={`${label} history from ${points[0].date} to ${points.at(-1)!.date}, range ${min.toFixed(1)} to ${max.toFixed(1)}`}
        viewBox="0 0 300 74"
        className="h-20 w-full"
      >
        <polyline fill="none" stroke="#347d9c" strokeWidth="2" points={line} />
      </svg>
      <p className="flex justify-between text-[10px] text-ink-mute">
        <span>{points[0].date}</span>
        <span>{points.at(-1)!.date}</span>
      </p>
    </div>
  );
}
export function HealthEvolution({ personId }: { personId: string }) {
  const { refresh, snapshot } = useDemo();
  const zone = snapshot?.subject.timeZone ?? "Asia/Hong_Kong";
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Evolution | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [metric, setMetric] = useState("weight");
  const [date, setDate] = useState(calendarDay(new Date(), zone));
  const [value, setValue] = useState("");
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    const load = () =>
      api(`people/${personId}/evolution?window=${days}`, evolutionSchema)
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
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [personId, days, revision]);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setRevision((n) => n + 1);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Health Evolution</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Patterns over time, compared with the learned personal baseline.
          </p>
        </div>
        <div className="flex rounded-lg bg-surface-soft p-1">
          {[
            [7, "7D"],
            [30, "30D"],
            [90, "90D"],
            [180, "6M"],
            [365, "1Y"],
          ].map(([n, label]) => (
            <button
              type="button"
              key={n}
              aria-pressed={days === n}
              onClick={() => setDays(Number(n))}
              className={`rounded px-3 py-1.5 text-xs font-semibold ${days === n ? "bg-brand-600 text-white" : "text-ink-soft"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}
      {data ? (
        <>
          <p className="text-xs text-ink-mute">
            {data.source} · Measurements are limited to the recorded dates;
            missing values are unavailable.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.metrics.map((m) => (
              <article
                key={m.key}
                className="rounded-xl border border-surface-line p-4"
              >
                <h3 className="text-sm font-medium">{m.label}</h3>
                <p className="mt-2 text-xl font-semibold tabular-nums">
                  {m.current === null
                    ? "Unavailable"
                    : `${m.current.toFixed(m.unit === "steps" ? 0 : 1)} ${m.unit}`}
                </p>
                <p className="mt-1 text-xs text-ink-mute">
                  {m.changePct === null
                    ? "Personal baseline unavailable"
                    : `${m.changePct >= 0 ? "+" : ""}${Math.round(m.changePct * 100)}% vs personal baseline`}
                </p>
                {m.historicalChangePct !== null && (
                  <p className="mt-1 text-xs text-ink-soft">
                    {m.historicalChangePct >= 0 ? "+" : ""}
                    {Math.round(m.historicalChangePct * 100)}% change within{" "}
                    {days} days
                  </p>
                )}
                <HistoryChart points={m.points} label={m.label} />
                <p className="mt-2 text-[10px] text-ink-mute">
                  Recent mean · {m.coverageDays} days recorded in this window
                </p>
              </article>
            ))}
          </div>
          <div className="rounded-xl bg-brand-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Longitudinal explanation</h3>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    setData(
                      await api(
                        `people/${personId}/evolution/summary?window=${days}`,
                        evolutionSchema,
                        { method: "POST" },
                      ),
                    );
                  })
                }
              >
                {busy ? "Working…" : `Generate ${days}-day summary`}
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed">
              {data.summary?.text ??
                "Generate an explanation using the available history, personal baseline and permitted health context."}
            </p>
            {data.summary && (
              <p className="mt-2 text-xs text-ink-mute">
                {data.summary.source === "llm"
                  ? "Kimi explanation"
                  : "Rule-based explanation · Kimi unavailable or insufficient history"}{" "}
                · {new Date(data.summary.generatedAt).toLocaleString()}
              </p>
            )}
          </div>
          <details className="rounded-xl border border-surface-line p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Record a dated measurement
            </summary>
            <form
              className="mt-4 grid items-end gap-3 sm:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!value) return;
                void act(() =>
                  api(
                    `people/${personId}/evolution/observations?window=${days}`,
                    evolutionSchema,
                    {
                      method: "POST",
                      body: JSON.stringify([
                        { key: metric, date, value: Number(value) },
                      ]),
                    },
                  ),
                );
              }}
            >
              <label className="text-sm">
                Metric
                <select
                  className="field"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                >
                  {data.metrics
                    .filter((m) => m.key !== "risk_events")
                    .map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label} ({m.unit})
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm">
                Date
                <input
                  className="field"
                  type="date"
                  required
                  value={date}
                  max={calendarDay(new Date(), zone)}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Value
                <input
                  className="field"
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
              <button disabled={busy} className="btn-primary">
                Save observation
              </button>
            </form>
            <p className="mt-3 text-xs text-ink-mute">
              Recorded as user-reported information. A measurement does not
              update the monitoring heartbeat. A baseline is learned only after
              enough suitable observations have been recorded.
            </p>
          </details>
          <div>
            <h3 className="font-semibold">Care recommendations & outcomes</h3>
            {!data.tasks.length && (
              <p className="mt-2 text-sm text-ink-mute">
                Persistent changes across multiple health areas can create a
                Moderate alert and a family check-in recommendation. There are
                no recommendations yet.
              </p>
            )}
            {data.tasks.map((task) => (
              <article
                className="mt-3 rounded-xl border border-surface-line p-4"
                key={task.id}
              >
                <p className="text-sm font-medium">{task.recommendation}</p>
                <p className="mt-2 text-sm text-ink-soft">{task.reason}</p>
                {task.eventId && (
                  <Link
                    className="mt-2 inline-block text-sm text-brand-600"
                    href={`/events/${task.eventId}`}
                  >
                    Review linked event →
                  </Link>
                )}
                {task.status === "completed" ? (
                  <p className="mt-3 text-sm">
                    Outcome: {task.outcome} ·{" "}
                    {task.completedAt &&
                      new Date(task.completedAt).toLocaleDateString()}
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <input
                      className="field min-w-0 flex-1"
                      aria-label="Care outcome"
                      placeholder="Record the check-in outcome"
                      value={outcomes[task.id] ?? ""}
                      maxLength={1000}
                      onChange={(e) =>
                        setOutcomes({ ...outcomes, [task.id]: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy || !outcomes[task.id]?.trim()}
                      onClick={() =>
                        act(() =>
                          api(
                            `people/${personId}/care-tasks/${task.id}`,
                            z.object({ ok: z.literal(true) }),
                            {
                              method: "POST",
                              body: JSON.stringify({
                                outcome: outcomes[task.id],
                              }),
                            },
                          ),
                        )
                      }
                    >
                      Complete check-in
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      ) : (
        <p role="status" className="text-sm">
          Loading history…
        </p>
      )}
    </section>
  );
}
