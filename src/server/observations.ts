import { DEMO_RECOVERY_WINDOW_SEC } from "@/shared/constants";
import { EVENT_TYPES, SIGNAL_SOURCES } from "@/shared/types/event";
import type { ObservationInput, ObservationOutput } from "@/shared/types/demo-api";
import type { JevProbabilities } from "@/shared/types/jev";
import type { Alert } from "@/shared/types/alert";
import type { DemoStore } from "@/server/store";
import { appendAudit, nextId } from "@/server/store";
import { buildStructuredFacts } from "@/server/jev/facts";
import { decideLevel } from "@/server/jev/decide";
import { startEscalation } from "@/server/engine";

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const validProbability = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;

export function parseObservation(raw: unknown): ObservationInput | string {
  if (!isRecord(raw)) return "Expected a JSON object";
  const { personId, idempotencyKey, eventType, occurredAt, signals, probabilities, insufficientData, recoveryObserved, note } = raw;
  if (typeof personId !== "string" || !personId || typeof idempotencyKey !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(idempotencyKey)) return "personId and an 8–100 character idempotencyKey are required";
  if (typeof eventType !== "string" || !EVENT_TYPES.includes(eventType as typeof EVENT_TYPES[number])) return "Unknown eventType";
  if (typeof occurredAt !== "string" || !Number.isFinite(Date.parse(occurredAt))) return "occurredAt must be an ISO date";
  if (!Array.isArray(signals) || signals.length < 1 || signals.length > 8 || !signals.every((s) => isRecord(s) && typeof s.source === "string" && SIGNAL_SOURCES.includes(s.source as typeof SIGNAL_SOURCES[number]) && typeof s.description === "string" && s.description.length > 0 && s.description.length <= 200 && (s.withinCoverage === undefined || typeof s.withinCoverage === "boolean"))) return "Provide 1–8 valid signals";
  if (!isRecord(probabilities) || !["normal", "notice", "important", "critical"].every((k) => validProbability(probabilities[k]))) return "Four probabilities between 0 and 1 are required";
  const p = probabilities as unknown as JevProbabilities;
  if (Math.abs(p.normal + p.notice + p.important + p.critical - 1) > 0.001) return "Probabilities must total 1";
  if (typeof insufficientData !== "boolean" || typeof recoveryObserved !== "boolean") return "insufficientData and recoveryObserved must be booleans";
  if (typeof note !== "string" || note.length > 500) return "note must be at most 500 characters";
  return { personId, idempotencyKey, eventType: eventType as ObservationInput["eventType"], occurredAt, signals: signals as ObservationInput["signals"], probabilities: p, insufficientData, recoveryObserved, note };
}

export function ingestObservation(store: DemoStore, input: ObservationInput): ObservationOutput {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const isFall = input.eventType === "possible_fall";
  const fallPhase = isFall ? input.recoveryObserved ? "recovered" : "candidate" : "not_applicable";
  const recoveryWindowEndsAt = fallPhase === "candidate" ? new Date(nowMs + DEMO_RECOVERY_WINDOW_SEC * 1000).toISOString() : null;
  const sources = new Set(input.signals.filter((s) => s.withinCoverage !== false).map((s) => s.source.startsWith("camera_") ? "camera" : "watch"));
  const eventId = nextId(store, "evt");
  const event = { id: eventId, subjectId: store.subject.id, type: input.eventType, trendMetric: null,
    occurredAt: input.occurredAt, signals: input.signals, fallPhase, recoveryWindowEndsAt,
    independentChannelCount: sources.size, dedupeKey: input.idempotencyKey } as const;
  const facts = buildStructuredFacts({ event, subject: store.subject,
    occurredAtLocal: new Date(input.occurredAt).toLocaleString("en-GB", { timeZone: store.subject.timeZone }),
    deviations: [], relatedChanges: input.note ? [input.note] : [], trendSynthetic: true });
  const out = decideLevel({ eventId, subjectId: store.subject.id, eventType: input.eventType,
    signals: input.signals, fallPhase, independentChannelCount: sources.size,
    insufficientData: input.insufficientData,
    baselineLearned: store.baselines.some((b) => b.learned),
    deviceOfflineSuppressed: input.signals.some((s) => s.source.startsWith("watch_")) && !store.devices.some((d) => d.type === "smartwatch" && d.online),
  }, { probabilities: input.probabilities, structuredFacts: facts,
    monitoringPaused: store.subject.monitoringPaused, watchEmailEnabled: store.subscription.watchEmailEnabled });
  store.events.push(event);
  store.structuredFacts[eventId] = facts;
  store.deviations[eventId] = [];
  store.decisionProbabilities ??= {};
  store.decisionProbabilities[eventId] = input.probabilities;
  store.decisionInsufficientData ??= {};
  store.decisionInsufficientData[eventId] = input.insufficientData;
  let alertId: string | null = null;
  if (out.level !== "stable" && (input.eventType === "general_check" || store.subscription[input.eventType])) {
    alertId = nextId(store, "al");
    const alert: Alert = { id: alertId, subjectId: store.subject.id, eventId, eventType: input.eventType,
      level: out.level, status: "open", createdAt: nowIso,
      levelHistory: [{ level: out.level, at: nowIso, trigger: "observation_submitted" }],
      notifications: [], escalation: { subjectId: store.subject.id, alertId,
        currentStage: null, nextStageAt: null, repeatReminderEveryMin: null, unacknowledged: false, stageLog: [] },
      acknowledgedBy: null, acknowledgedAt: null, resolvedBy: null, resolvedAt: null,
      resolveReason: null, resolveNote: null, autoExpiredAt: null };
    store.alerts.push(alert);
    if (out.level === "critical") startEscalation(store, alert, nowMs);
  }
  appendAudit(store, { at: nowIso, actorUserId: null, actorRole: "system", action: "alert_created",
    detail: { eventId, alertId, level: out.level, rule: out.ruleApplied, synthetic: true } });
  return { runId: nextId(store, "run"), personId: store.subject.id, eventId, alertId,
    level: out.level, probabilities: input.probabilities, ruleApplied: out.ruleApplied,
    cappedReason: out.cappedReason, recoveryWindowEndsAt, synthetic: true };
}
