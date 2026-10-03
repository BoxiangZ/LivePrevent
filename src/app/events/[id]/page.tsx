"use client";

/**
 * 事件详情页 — demo 的"故事高潮"。
 * 信号证据、两阶段判定、AI 摘要、升级链、通知记录、审计轨迹、处理操作。
 */

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useDemo } from "@/client/provider/DemoProvider";
import { RiskBadge } from "@/client/components/RiskBadge";
import { EscalationTimeline } from "@/client/components/EscalationTimeline";
import { EmailPreviewModal } from "@/client/components/EmailPreview";
import { Sparkline } from "@/client/components/TrendsGrid";
import { Card, CardHeader, CardBody, Pill, Button, EmptyState } from "@/client/components/ui";
import { cn } from "@/client/cn";
import type { NotificationPreview } from "@/server/snapshot";
import type { TrendMetric } from "@/shared/types/event";

const EVENT_TITLE: Record<string, string> = {
  possible_fall: "Possible fall",
  prolonged_inactivity: "Abnormal inactivity",
  heart_rate_deviation: "Heart rate deviation",
  activity_drop: "Activity below baseline",
  device_data_gap: "Data gap",
};

const RESOLVE_REASONS = [
  { id: "real_event_handled", label: "Handled — it was real" },
  { id: "false_positive", label: "False alarm" },
  { id: "device_issue", label: "Device issue" },
  { id: "other", label: "Other" },
] as const;

const METRIC_LABEL: Record<TrendMetric, string> = {
  activity: "Activity",
  sleep: "Sleep",
  mobility: "Mobility",
  resting_hr: "Heart rate",
};

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { snapshot, msUntil, ackAlert, resolveAlert, requestKimiSummary, busy } = useDemo();
  const [preview, setPreview] = useState<NotificationPreview | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);

  const alert = snapshot?.alerts.find((a) => a.eventId === id) ?? null;
  const event = snapshot?.events.find((e) => e.id === id) ?? null;
  const kimi = snapshot?.kimiSummaries[id] ?? null;

  const hasFacts = Boolean(snapshot && event);
  useEffect(() => {
    if (hasFacts && !kimi && !busy) requestKimiSummary(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFacts, id, kimi === null]);

  if (!snapshot) {
    return <div className="h-64 animate-pulse rounded-2xl bg-surface-line/60" />;
  }
  if (!event || !alert) {
    return (
      <EmptyState
        title="Event not found"
        sub="It may have been cleared by a demo reset."
      />
    );
  }

  const deviations = snapshot.deviations[id] ?? [];
  const occurredLocal = new Date(event.occurredAt).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: snapshot.subject.timeZone,
  });
  const markerDate = event.occurredAt.slice(0, 10);
  const firstName = (cid: string | null) =>
    cid ? (snapshot.contacts.find((c) => c.id === cid)?.name.split(" ")[0] ?? cid) : "—";
  const notifications = snapshot.notifications.filter((n) => n.alertId === alert.id);
  const audit = snapshot.auditLog
    .filter((e) => String(e.detail.alertId ?? "") === alert.id)
    .reverse();
  const isFall = event.type === "possible_fall";
  const unrecovered = isFall && event.fallPhase === "unrecovered";
  const canResolve =
    alert.status === "acknowledged" || (alert.status === "open" && alert.level !== "critical");

  return (
    <div className="space-y-6">
      <Link href="/alerts" className="inline-flex items-center gap-1 text-sm text-ink-mute hover:text-ink">
        ← Back to alerts
      </Link>

      {/* 头部状态条 */}
      <Card tone={alert.level === "critical" && alert.status !== "resolved" ? "critical" : "default"}>
        <CardBody className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <RiskBadge level={alert.level} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              {EVENT_TITLE[event.type] ?? alert.eventLabel}
            </h1>
            <div className="mt-0.5 text-sm text-ink-mute">
              {occurredLocal} · {snapshot.subject.timeZone}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {alert.status === "open" &&
              snapshot.contacts.map((c) => (
                <Button
                  key={c.id}
                  variant={alert.level === "critical" ? "danger" : "primary"}
                  onClick={() => ackAlert(alert.id, c.id)}
                  disabled={busy}
                >
                  Acknowledge as {c.name.split(" ")[0]}
                </Button>
              ))}
            {canResolve && (
              <Button variant="secondary" onClick={() => setResolveOpen(true)} disabled={busy}>
                Resolve…
              </Button>
            )}
            {alert.status === "resolved" && (
              <Pill tone="stable">
                Resolved by {firstName(alert.resolvedBy)}
                {alert.resolveReason
                  ? ` · ${RESOLVE_REASONS.find((r) => r.id === alert.resolveReason)?.label ?? alert.resolveReason}`
                  : ""}
              </Pill>
            )}
            {alert.status === "acknowledged" && (
              <Pill tone="brand">Acknowledged by {firstName(alert.acknowledgedBy)}</Pill>
            )}
          </div>
        </CardBody>
      </Card>

      {/* 两阶段判定轨迹 */}
      {alert.levelHistory.length > 1 && (
        <Card tone="watch" className="border-watch/40">
          <CardBody className="py-3">
            <div className="text-sm">
              <span className="font-semibold text-ink">Two-phase detection: </span>
              {alert.levelHistory.map((h, i) => (
                <span key={i} className="text-ink-soft">
                  {i > 0 && <span className="mx-1.5 text-ink-mute">→</span>}
                  <span className="font-medium capitalize">{h.level}</span>
                  {h.trigger === "recovery_window_no_activity" && (
                    <span className="text-ink-mute"> (no recovery during the window)</span>
                  )}
                  {h.trigger === "initial_detection" && i === 0 && (
                    <span className="text-ink-mute"> (capped while observing)</span>
                  )}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {/* 支持信号 */}
          <Card>
            <CardHeader
              title="Supporting signals"
              sub={`${event.independentChannelCount} independent channels agree`}
            />
            <CardBody>
              <ul className="space-y-2.5">
                {event.signals.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <SignalIcon source={s.source} />
                    <div className="min-w-0 flex-1">
                      <span className="text-ink">{s.description}</span>
                      {s.withinCoverage === false && (
                        <span className="ml-2 text-xs text-ink-mute">(outside camera coverage)</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {unrecovered && (
                <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-critical">
                  No recovery movement detected during the observation window.
                </div>
              )}
            </CardBody>
          </Card>

          {/* AI 摘要 */}
          <Card>
            <CardHeader
              title="AI summary"
              sub="Generated from structured facts only — it never decides the risk level."
              right={
                kimi && (
                  <Pill tone={kimi.source === "llm" ? "brand" : "neutral"}>
                    {kimi.source === "llm" ? "AI-generated" : "Template"}
                  </Pill>
                )
              }
            />
            <CardBody>
              {kimi ? (
                <div className="space-y-4 text-sm leading-relaxed text-ink-soft">
                  <SummaryBlock label="What happened" text={kimi.eventSummary} />
                  <SummaryBlock label="Vs personal baseline" text={kimi.baselineComparison} />
                  <SummaryBlock label="Related changes" text={kimi.relatedChanges} />
                  <div className="rounded-lg bg-brand-50 px-3.5 py-3">
                    <div className="text-xs font-semibold text-brand-700">Suggested next step</div>
                    <p className="mt-1 text-ink">{kimi.suggestedNextStep}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-ink-mute">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-surface-line border-t-brand-600" />
                  Generating summary… (alerts are never delayed by this)
                </div>
              )}
            </CardBody>
          </Card>

          {/* 基线偏离 + 趋势 */}
          <Card>
            <CardHeader title="Personal baseline context" sub="Relative to this person's normal pattern, not population averages." />
            <CardBody className="space-y-5">
              {deviations.length > 0 && (
                <div className="divide-y divide-surface-line rounded-lg border border-surface-line">
                  {deviations.map((d) => (
                    <div key={d.metric} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                      <span className="text-ink-soft">{METRIC_LABEL[d.metric as TrendMetric] ?? d.metric}</span>
                      <span className={cn("font-semibold tabular-nums", d.direction === "down" ? "text-important" : "text-watch")}>
                        {d.direction === "down" ? "↓" : "↑"} {Math.abs(Math.round(d.relativeChange * 100))}% vs baseline
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {snapshot.baselines.map((b) => (
                  <div key={b.metric} className="rounded-lg border border-surface-line p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-medium text-ink-soft">{b.label}</span>
                      <span className="text-[10px] text-ink-mute">last 30 days</span>
                    </div>
                    <div className="mt-1">
                      <Sparkline
                        points={(snapshot.trends[b.metric] ?? []).slice(-30)}
                        baseline={b.median}
                        metric={b.metric}
                        height={56}
                        markerDate={markerDate}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {/* 升级链 */}
          {alert.level === "critical" && (
            <Card>
              <CardBody>
                <EscalationTimeline alert={alert} contacts={snapshot.contacts} msUntil={msUntil} />
              </CardBody>
            </Card>
          )}

          {/* 通知记录 */}
          <Card>
            <CardHeader
              title="Notifications"
              sub={notifications.length > 0 ? `${notifications.length} sent · simulated channels` : "None sent for this alert"}
            />
            <CardBody className="space-y-2">
              {notifications.length === 0 && (
                <p className="text-sm text-ink-mute">
                  {alert.level === "watch"
                    ? "Watch-level notes stay on the dashboard by design — no notification."
                    : "No notifications were sent."}
                </p>
              )}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setPreview(n)}
                  className="flex w-full items-center gap-3 rounded-lg border border-surface-line px-3 py-2.5 text-left transition-colors hover:bg-surface-soft"
                >
                  <ChannelBadge channel={n.channel} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">
                      {n.contactName}
                    </div>
                    <div className="text-xs text-ink-mute">
                      {new Date(n.sentAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: snapshot.subject.timeZone,
                      })}
                      {" · delivered"}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-brand-600">View →</span>
                </button>
              ))}
            </CardBody>
          </Card>

          {/* 审计轨迹 */}
          <Card>
            <CardHeader title="Audit trail" sub="Every action on this alert, in order." />
            <CardBody>
              <ol className="relative space-y-3 border-l border-surface-line pl-4">
                {audit.map((e) => (
                  <li key={e.id} className="relative text-xs">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full border-2 border-white bg-brand-400" />
                    <div className="font-mono text-ink-mute">
                      {new Date(e.at).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        timeZone: snapshot.subject.timeZone,
                      })}
                    </div>
                    <div className="mt-0.5 text-ink">
                      <span className="font-medium">{auditLabel(e.action)}</span>
                      <span className="text-ink-mute">
                        {" · "}
                        {e.actorRole === "system" ? "system" : firstName(e.targetContactId) || e.actorRole}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>

      <EmailPreviewModal notification={preview} onClose={() => setPreview(null)} />

      {/* Resolve 对话框 */}
      {resolveOpen && (
        <ResolveDialog
          busy={busy}
          onCancel={() => setResolveOpen(false)}
          onConfirm={(reason, note) => {
            resolveAlert(alert.id, reason, note);
            setResolveOpen(false);
          }}
        />
      )}
    </div>
  );
}

function SummaryBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-mute">{label}</div>
      <p className="mt-1">{text}</p>
    </div>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const label = channel === "email" ? "Email" : channel === "sms" ? "SMS" : "Push";
  const tone =
    channel === "email" ? "bg-brand-50 text-brand-700" : channel === "sms" ? "bg-violet-50 text-violet-700" : "bg-teal-50 text-teal-700";
  return (
    <span className={cn("w-12 shrink-0 rounded-md px-1.5 py-1 text-center text-[10px] font-bold uppercase tracking-wide", tone)}>
      {label}
    </span>
  );
}

function SignalIcon({ source }: { source: string }) {
  const isCamera = source.startsWith("camera");
  return (
    <span
      className={cn(
        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
        isCamera ? "bg-violet-50 text-violet-600" : "bg-brand-50 text-brand-600"
      )}
    >
      {isCamera ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M3 5a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 1.5v3.75l3.5 2v-7.5l-3.5 1.75z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M7 3h6a1 1 0 011 1v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm2 1v12h2V4H9z" />
        </svg>
      )}
    </span>
  );
}

function auditLabel(action: string): string {
  const map: Record<string, string> = {
    alert_created: "Alert created",
    alert_escalated: "Escalation fired",
    alert_acknowledged: "Acknowledged",
    alert_resolved: "Resolved",
    alert_auto_expired: "Auto-expired",
    notification_sent: "Notification sent",
    notification_delivery_failed: "Delivery failed",
  };
  return map[action] ?? action.replace(/_/g, " ");
}

function ResolveDialog({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, note?: string) => void;
}) {
  const [reason, setReason] = useState<string>(RESOLVE_REASONS[0].id);
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lift" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold tracking-tight text-ink">Resolve this alert</h3>
        <p className="mt-1 text-sm text-ink-mute">A short record is kept in the audit trail.</p>
        <div className="mt-4 space-y-2">
          {RESOLVE_REASONS.map((r) => (
            <label
              key={r.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors",
                reason === r.id ? "border-brand-500 bg-brand-50 text-ink" : "border-surface-line text-ink-soft hover:bg-surface-soft"
              )}
            >
              <input
                type="radio"
                name="resolve-reason"
                value={r.id}
                checked={reason === r.id}
                onChange={() => setReason(r.id)}
                className="accent-brand-600"
              />
              {r.label}
            </label>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note about the follow-up"
          rows={2}
          className="mt-3 w-full rounded-lg border border-surface-line px-3 py-2 text-sm text-ink placeholder:text-ink-mute focus:border-brand-500 focus:outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onConfirm(reason, note || undefined)} disabled={busy}>
            Resolve alert
          </Button>
        </div>
      </div>
    </div>
  );
}
