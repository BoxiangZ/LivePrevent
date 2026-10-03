"use client";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { api } from "@/client/api";
import {
  assessmentSchema,
  mediaSchema,
  type Assessment,
} from "@/shared/contracts/assessment";
import { useDemo } from "@/client/provider/DemoProvider";
export default function Result({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { selectedPersonId, refresh } = useDemo();
  const [result, setResult] = useState<Assessment | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [videoAvailable, setVideoAvailable] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let active = true;
    setResult(null);
    const load = async () => {
      try {
        const a = await api(`assessments/${id}`, assessmentSchema);
        if (!active) return;
        if (a.personId !== selectedPersonId) {
          setError("Select the person associated with this assessment.");
          return;
        }
        setResult(a);
        if (!["queued", "analyzing"].includes(a.status)) clearInterval(t);
        setError("");
        if (a.input.videoAssetId)
          api(`media/${a.input.videoAssetId}`, mediaSchema)
            .then((m) => {
              if (active) setVideoAvailable(m.status === "ready");
            })
            .catch(() => {
              if (active) setVideoAvailable(false);
            });
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "Unable to load assessment",
          );
      }
    };
    load();
    const t = setInterval(load, 2500);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [id, selectedPersonId, revision]);
  async function act(action: string) {
    setBusy(true);
    try {
      setResult(
        await api(`assessments/${id}/${action}`, assessmentSchema, {
          method: "POST",
        }),
      );
      setRevision((v) => v + 1);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const f = result?.finding;
  const concern = result?.input.primaryConcern;
  const rankedFindings = [...(f?.findings ?? [])].sort((a, b) => {
    const rank = { critical: 4, important: 3, watch: 2, stable: 1, unknown: 0, paused: 0 };
    if (concern && (a.category === concern) !== (b.category === concern))
      return Number(b.category === concern) - Number(a.category === concern);
    return rank[b.status] - rank[a.status];
  });
  const urgentFinding = concern ? f?.findings?.find((item) =>
    item.category !== concern && ["important", "critical"].includes(item.status)) : undefined;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link className="text-sm text-ink-mute" href="/assessments">
        ← Assessments
      </Link>
      <h1 className="text-2xl font-semibold">Assessment details</h1>
      {error && (
        <p role="alert" className="text-critical">
          {error}
        </p>
      )}
      {result ? (
        <>
          <section className="panel">
            <div className="flex justify-between">
              <h2 role="status" className="text-lg font-semibold">
                {result.stage}
              </h2>
              <span className="text-sm capitalize">{result.status}</span>
            </div>
            <p className="mt-3 text-sm text-ink-mute">
              Observation: {new Date(result.input.observedAt).toLocaleString()}{" "}
              · Updated: {new Date(result.updatedAt).toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-ink-mute">
              Source: sample observations
              {result.input.videoAssetId
                ? result.finding?.video
                  ? result.input.videoObservedAt
                    ? " and analyzed sample video"
                    : " and reviewed sample video (recording time unconfirmed)"
                  : " and attached sample video (not analyzed)"
                : ""}
            </p>
            {(result.error || result.finding?.model.fallbackReason) && (
              <p className="mt-3 text-sm text-important">
                {result.error || result.finding?.model.fallbackReason}
              </p>
            )}
            <div className="mt-4 flex gap-3">
              {result.status === "created" && (
                <button
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => act("analyze")}
                >
                  Analyze information
                </button>
              )}
              {["queued", "analyzing"].includes(result.status) && (
                <>
                  <p className="text-sm">
                    You can leave this page and return to the result.
                  </p>
                  <button
                    className="btn-secondary"
                    disabled={busy}
                    onClick={() => act("cancel")}
                  >
                    Cancel analysis
                  </button>
                </>
              )}
              {result.retryable && (
                <button
                  disabled={busy}
                  className="btn-secondary"
                  onClick={() => act("retry")}
                >
                  Retry analysis
                </button>
              )}
            </div>
          </section>
          {f && (
            <>
              <section className="panel">
                <p className="eyebrow">
                  Current assessment ·{" "}
                  {f.displayStatus === "unknown"
                    ? "Unable to determine"
                    : f.displayStatus}
                </p>
                <h2 className="mt-3 text-2xl font-semibold">{f.headline}</h2>
                <p className="mt-4 text-ink-soft">{f.plainSummary}</p>
                {concern && (
                  <p className="mt-3 text-sm text-ink-mute">
                    Primary concern: {concern.replaceAll("_", " ")}. All supplied evidence was reviewed.
                  </p>
                )}
                {concern && !rankedFindings.some((item) => item.category === concern) && (
                  <p className="mt-2 text-sm text-ink-mute">
                    No relevant evidence was available to assess the primary concern.
                  </p>
                )}
                {urgentFinding && (
                  <div className="mt-4 rounded-xl border border-critical bg-red-50 p-4 text-sm">
                    <strong>Priority finding: {urgentFinding.category.replaceAll("_", " ")}</strong>
                    <p className="mt-1">{urgentFinding.summary}</p>
                    <p className="mt-1">{urgentFinding.recommendedAction}</p>
                  </div>
                )}
                {rankedFindings.length > 0 && (
                  <div className="mt-5 space-y-3">
                    <h3 className="font-semibold">What we found</h3>
                    {rankedFindings.map((item, index) => (
                      <article key={index} className="rounded-xl border border-surface-line p-4">
                        <p className="text-sm font-semibold">
                          {item.category.replaceAll("_", " ")} · {item.status === "unknown" ? "Unable to determine" : item.status}
                          {item.category === concern ? " · Primary concern" : ""}
                        </p>
                        <p className="mt-2 text-sm text-ink-soft">{item.summary}</p>
                        <p className="mt-2 text-sm"><strong>Next step:</strong> {item.recommendedAction}</p>
                        {(item.supportingEvidence.length > 0 || item.conflictingEvidence.length > 0) && (
                          <details className="mt-2 text-sm text-ink-soft">
                            <summary className="cursor-pointer">Evidence and conflicts</summary>
                            {item.supportingEvidence.map((entry, i) => <p className="mt-1" key={`support-${i}`}>Supports: {entry}</p>)}
                            {item.conflictingEvidence.map((entry, i) => <p className="mt-1" key={`conflict-${i}`}>Conflicts: {entry}</p>)}
                          </details>
                        )}
                      </article>
                    ))}
                  </div>
                )}
                <div className="mt-5 rounded-xl bg-brand-50 p-4">
                  <h3 className="font-semibold">Recommended next step</h3>
                  <p className="mt-2 text-sm">{f.recommendedAction}</p>
                  <p className="mt-3 text-sm">
                    {f.alertId
                      ? `Sample alert created: ${f.alertReason ?? "A reviewed risk met the alert criteria."}`
                      : f.level === null
                        ? "No risk alert created: the available evidence is insufficient for a reliable decision."
                        : "No risk alert created: the reviewed findings did not meet the alert criteria."}
                  </p>
                  {f.eventId && (
                    <Link
                      className="mt-3 inline-block text-sm font-semibold text-brand-600"
                      href={`/events/${f.eventId}`}
                    >
                      Open related event →
                    </Link>
                  )}
                </div>
                {f.limitations.length > 0 && (
                  <div className="mt-5">
                    <h3 className="font-semibold">What remains uncertain</h3>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-ink-soft">
                      {f.limitations.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
              <section className="panel">
                <h2 className="font-semibold">Evidence reviewed</h2>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm">
                    {f.observations.length} sensor observations
                  </summary>
                  <ul className="mt-3 space-y-2 text-sm">
                    {f.observations.map((o, i) => (
                      <li key={i}>
                        {o.kind.replaceAll("_", " ")}: {String(o.value)} ·{" "}
                        {new Date(o.at).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </details>
                {result.input.note && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer">Original additional context</summary>
                    <p className="mt-2 whitespace-pre-wrap text-ink-soft">{result.input.note}</p>
                  </details>
                )}
                {result.input.videoObservedAt && (
                  <p className="mt-3 text-sm text-ink-mute">
                    Video recording start: {new Date(result.input.videoObservedAt).toLocaleString()}
                  </p>
                )}
                {f.video && (
                  <div className="mt-5">
                    <h3 className="font-medium">Video observations</h3>
                    <p className="mt-2 text-sm">{f.video.summary}</p>
                    {f.video.evidence.map((e, i) => (
                      <div
                        className="mt-3 rounded-lg bg-surface-soft p-3 text-sm"
                        key={i}
                      >
                        <button
                          className="mr-2 text-brand-600 disabled:text-ink-mute"
                          disabled={!videoAvailable}
                          onClick={() => {
                            if (video.current) {
                              video.current.currentTime = e.atSeconds;
                              video.current.play();
                            }
                          }}
                        >
                          {e.atSeconds.toFixed(1)}s
                        </button>
                        {e.description} · {e.confidence} confidence
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
          {result.input.videoAssetId && (
            <section className="panel">
              <h2 className="font-semibold">Uploaded clip</h2>
              {videoAvailable ? (
                <>
                  <video
                    ref={video}
                    controls
                    className="mt-4 max-h-72 w-full rounded-lg bg-black"
                    src={`/api/v3/media/${result.input.videoAssetId}/content`}
                  />
                  <button
                    className="btn-secondary mt-4"
                    onClick={async () => {
                      if (
                        !confirm(
                          "Delete the uploaded clip? Saved observations remain, but the clip cannot be replayed or reanalyzed.",
                        )
                      )
                        return;
                      try {
                        await api(
                          `media/${result.input.videoAssetId}`,
                          z.object({ deleted: z.boolean() }),
                          { method: "DELETE" },
                        );
                        setVideoAvailable(false);
                      } catch (e) {
                        setError(String(e));
                      }
                    }}
                  >
                    Delete video
                  </button>
                </>
              ) : (
                <p className="mt-3 text-sm text-ink-mute">
                  The clip is unavailable or has expired. Saved findings remain.
                </p>
              )}
            </section>
          )}
          {f && (
            <details className="panel">
              <summary className="cursor-pointer font-semibold">
                How this was assessed
              </summary>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  Model:{" "}
                  {f.model.used
                    ? `${f.model.provider} · ${f.model.modelId}`
                    : "Not used"}
                </div>
                <div>{f.model.fallbackReason}</div>
                <div>
                  Decision: {f.decision.engine} · {f.decision.version} ·{" "}
                  {f.decision.ruleId}
                </div>
                <div>Sources: {f.sourceBreakdown.join(", ")}</div>
                <div>Analysis ID: {result.assessmentId}</div>
              </dl>
            </details>
          )}
        </>
      ) : (
        <p role="status">{error ? "" : "Loading assessment…"}</p>
      )}
    </div>
  );
}
