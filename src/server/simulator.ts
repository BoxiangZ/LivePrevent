import type { DemoStore } from "./store";
import { nextId, appendAudit } from "./store";
import { decideLevel } from "./jev/decide";
import { buildStructuredFacts } from "./jev/facts";
import { templateFallback } from "./llm/kimi";
import { startEscalation } from "./engine";
import type { Alert } from "@/shared/types/alert";
import type { MonitoredEvent } from "@/shared/types/event";
import type { RiskLevel } from "@/shared/types/risk";

export function createRiskEvent(
  s: DemoStore,
  requested: Exclude<RiskLevel, "stable">,
  source: "simulator" | "longitudinal",
  reason?: string,
  now = Date.now(),
) {
  if (s.subject.monitoringPaused || s.archived)
    throw new Error("Resume monitoring before generating events.");
  const event: MonitoredEvent = {
    id: nextId(s, "evt"),
    subjectId: s.subject.id,
    type: source === "longitudinal" ? "activity_drop" : "general_check",
    trendMetric: source === "longitudinal" ? "activity" : null,
    occurredAt: new Date(now).toISOString(),
    signals: [
      {
        source: "watch_activity",
        description:
          reason ??
          (requested === "critical"
            ? "Simulated persistent movement change requiring immediate review"
            : requested === "important"
              ? "Simulated sustained activity change"
              : "Simulated minor activity change"),
      },
      ...(requested === "critical"
        ? [
            {
              source: "camera_motion" as const,
              description:
                "Independent simulated visual signal corroborates the change",
            },
          ]
        : []),
    ],
    fallPhase: "not_applicable",
    recoveryWindowEndsAt: null,
    independentChannelCount: requested === "critical" ? 2 : 1,
    dedupeKey: nextId(s, source),
  };
  const facts = buildStructuredFacts({
    event,
    subject: s.subject,
    occurredAtLocal: event.occurredAt,
    deviations: [],
    relatedChanges: [],
    trendSynthetic: true,
  });
  const p =
    requested === "critical"
      ? { normal: 0.02, notice: 0.03, important: 0.04, critical: 0.91 }
      : requested === "important"
        ? { normal: 0.1, notice: 0.2, important: 0.6, critical: 0.1 }
        : { normal: 0.65, notice: 0.3, important: 0.04, critical: 0.01 };
  const out = decideLevel(
    {
      eventId: event.id,
      subjectId: s.subject.id,
      eventType: event.type,
      signals: event.signals,
      fallPhase: event.fallPhase,
      independentChannelCount: event.independentChannelCount,
      insufficientData: false,
      baselineLearned:
        source === "simulator" || s.baselines.some((b) => b.learned),
      deviceOfflineSuppressed: false,
    },
    {
      probabilities: p,
      structuredFacts: facts,
      monitoringPaused: s.subject.monitoringPaused,
    },
  );
  const alert: Alert = {
    id: nextId(s, "al"),
    subjectId: s.subject.id,
    eventId: event.id,
    eventType: event.type,
    level: out.level,
    status: "open",
    createdAt: event.occurredAt,
    levelHistory: [
      {
        level: out.level,
        at: event.occurredAt,
        trigger: `${source}:${out.ruleApplied}`,
      },
    ],
    notifications: [],
    escalation: {
      subjectId: s.subject.id,
      alertId: "",
      currentStage: null,
      nextStageAt: null,
      repeatReminderEveryMin: null,
      unacknowledged: false,
      stageLog: [],
    },
    acknowledgedBy: null,
    acknowledgedAt: null,
    resolvedBy: null,
    resolvedAt: null,
    resolveReason: null,
    resolveNote: null,
    autoExpiredAt: null,
  };
  alert.escalation.alertId = alert.id;
  s.events.push(event);
  s.alerts.push(alert);
  s.structuredFacts[event.id] = facts;
  s.decisionProbabilities[event.id] = p;
  s.kimiSummaries[event.id] = { ...templateFallback(facts), eventId: event.id };
  if (out.level === "critical") startEscalation(s, alert, now);
  appendAudit(s, {
    at: event.occurredAt,
    actorUserId: s.user.id,
    actorRole: "primary_family",
    action: "alert_created",
    detail: {
      eventId: event.id,
      alertId: alert.id,
      source,
      rule: out.ruleApplied,
    },
  });
  return {
    eventId: event.id,
    alertId: alert.id,
    level: out.level,
    source,
    probabilities: p,
    rule: out.ruleApplied,
  };
}
