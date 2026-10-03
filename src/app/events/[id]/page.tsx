"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { api } from "@/client/api";
import { assessmentSchema } from "@/shared/contracts/assessment";
import { useDemo } from "@/client/provider/DemoProvider";
import { RiskBadge } from "@/client/components/RiskBadge";
import { EmailPreviewModal } from "@/client/components/EmailPreview";
import type { NotificationPreview } from "@/server/snapshot";
export default function Event({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const {
    snapshot,
    selectedPersonId,
    ackAlert,
    resolveAlert,
    busy,
    requestKimiSummary,
  } = useDemo();
  const [error, setError] = useState("");
  const [reason, setReason] = useState("real_event_handled");
  const [note, setNote] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [preview, setPreview] = useState<NotificationPreview | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const event = snapshot?.events.find((e) => e.id === id);
  const alert = snapshot?.alerts.find((a) => a.eventId === id);
  const summary = snapshot?.kimiSummaries[id];
  useEffect(() => {
    let active = true;
    setAssessmentId(null);
    api(`people/${selectedPersonId}/assessments`, z.array(assessmentSchema))
      .then((items) => {
        if (active)
          setAssessmentId(
            items.find((a) => a.finding?.eventId === id)?.assessmentId ?? null,
          );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [id, selectedPersonId]);
  if (!snapshot) return <div className="panel">Loading event…</div>;
  if (!event)
    return (
      <div className="panel">Event not found for the selected person.</div>
    );
  const notifications = snapshot.notifications.filter(
    (n) => n.alertId === alert?.id,
  );
  const audit = snapshot.auditLog.filter(
    (e) => e.detail.alertId === alert?.id || e.detail.eventId === id,
  );
  async function acknowledge() {
    try {
      await ackAlert(alert!.id);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to acknowledge");
    }
  }
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/alerts" className="text-sm text-ink-mute">
        ← Alerts
      </Link>
      <section className="panel">
        <div className="flex items-center gap-3">
          {alert && <RiskBadge level={alert.level} />}
          <h1 className="text-2xl font-semibold capitalize">
            {event.type.replaceAll("_", " ")}
          </h1>
        </div>
        <p className="mt-3 text-sm text-ink-mute">
          {new Date(event.occurredAt).toLocaleString()} · Sample information
        </p>
        <h2 className="mt-6 font-semibold">Next step</h2>
        <p className="mt-2 text-sm">
          {alert?.recommendedAction ??
            "Review the recorded observations. No alert was generated for this event."}
        </p>
        {alert && (
          <p className="mt-3 text-sm text-ink-soft">
            {alert.status === "acknowledged"
              ? `Being handled by ${snapshot.contacts.find((c) => c.id === alert.acknowledgedBy)?.name ?? "a family contact"}`
              : alert.status === "resolved"
                ? `Resolved · ${alert.resolveReason?.replaceAll("_", " ")}`
                : alert.status === "open"
                  ? "Awaiting a response"
                  : "Closed"}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          {alert?.status === "open" && (
            <button
              className="btn-primary"
              disabled={busy}
              onClick={acknowledge}
            >
              I'm responding
            </button>
          )}
          {alert && ["open", "acknowledged"].includes(alert.status) && (
            <button
              className="btn-secondary"
              disabled={
                busy || (alert.level === "critical" && alert.status === "open")
              }
              onClick={() => setResolveOpen((v) => !v)}
            >
              Mark resolved
            </button>
          )}
        </div>
        {alert?.level === "critical" && alert.status === "open" && (
          <p className="mt-2 text-xs text-ink-mute">
            Confirm that you are responding before marking a critical alert
            resolved.
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-critical" role="alert">
            {error}
          </p>
        )}
        {resolveOpen && (
          <div className="mt-5 space-y-3 border-t border-surface-line pt-4">
            <label className="block text-sm">
              Outcome
              <select
                className="field"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="real_event_handled">Real event handled</option>
                <option value="false_positive">False alarm</option>
                <option value="device_issue">Device issue</option>
                <option value="other">Uncertain / other</option>
              </select>
            </label>
            <label className="block text-sm">
              Note
              <textarea
                className="field"
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={async () => {
                try {
                  await resolveAlert(alert!.id, reason, note);
                  setResolveOpen(false);
                  setError("");
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Unable to resolve",
                  );
                }
              }}
            >
              Save outcome
            </button>
          </div>
        )}
      </section>
      <section className="panel">
        <h2 className="font-semibold">What was observed</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {event.signals.map((s, i) => (
            <li key={i}>
              {s.description}
              {s.withinCoverage === false ? " · outside camera coverage" : ""}
            </li>
          ))}
        </ul>
        {assessmentId && (
          <Link
            className="mt-4 inline-block text-sm font-semibold text-brand-600"
            href={`/assessments/${assessmentId}`}
          >
            View assessment and video evidence →
          </Link>
        )}
      </section>
      <details className="panel" open={!!summary}>
        <summary className="cursor-pointer font-semibold">Explanation</summary>
        {summary ? (
          <>
            <p className="mt-3 text-sm">{summary.eventSummary}</p>
            <p className="mt-2 text-sm text-ink-soft">
              {summary.baselineComparison}
            </p>
            <p className="mt-3 text-xs text-ink-mute">
              {summary.source === "llm"
                ? "AI-generated explanation"
                : "Rule-based explanation · model summary unavailable"}
            </p>
          </>
        ) : (
          <button
            className="btn-secondary mt-4"
            disabled={busy}
            onClick={async () => {
              try {
                await requestKimiSummary(id);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Explanation unavailable",
                );
              }
            }}
          >
            Generate explanation
          </button>
        )}
      </details>
      {!!notifications.length && (
        <details className="panel">
          <summary className="cursor-pointer font-semibold">
            Notifications · {notifications.length}
          </summary>
          {notifications.map((n) => (
            <button
              className="mt-3 flex w-full justify-between rounded-lg bg-surface-soft p-3 text-left text-sm"
              key={n.id}
              onClick={() => setPreview(n)}
            >
              <span>
                {n.contactName} · {n.channel}
              </span>
              <span>
                {n.simulated ? "Simulated notification" : n.deliveryStatus} ·
                View
              </span>
            </button>
          ))}
        </details>
      )}
      <details className="panel">
        <summary className="cursor-pointer font-semibold">
          Activity and decision history
        </summary>
        <ul className="mt-4 space-y-3 text-sm">
          {audit.map((a) => (
            <li key={a.id}>
              {new Date(a.at).toLocaleString()} ·{" "}
              {a.action.replaceAll("_", " ")}
            </li>
          ))}
        </ul>
        {alert?.levelHistory.map((h, i) => (
          <p key={i} className="mt-2 text-xs text-ink-mute">
            {new Date(h.at).toLocaleString()} · {h.level} ·{" "}
            {h.trigger.replaceAll("_", " ")}
          </p>
        ))}
      </details>
      <EmailPreviewModal
        notification={preview}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
