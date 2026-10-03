import { advance } from "@/server/engine";
import { aiContext } from "@/server/longitudinal";
import { randomUUID } from "node:crypto";
import {
  type Assessment,
  type AssessmentInput,
  type Finding,
  type Observation,
  assessmentSchema,
} from "@/shared/contracts/assessment";
import { all, get, put } from "./repository";
import { mediaFor } from "./media";
import { analyzeVideo, summarizeReportedContext, visualModel } from "./kimi";
import { ApiError } from "./auth";
import { getStore, saveStore, appendAudit, nextId } from "@/server/store";
import { buildStructuredFacts } from "@/server/jev/facts";
import { callKimi } from "@/server/llm/kimi";
import type { MonitoredEvent, EventType } from "@/shared/types/event";
import type { RiskLevel } from "@/shared/types/risk";
export type StoredAssessment = Assessment & {
  ownerId: string;
  leaseUntil?: number;
};
export function getAssessment(id: string) {
  const a = get<StoredAssessment>("assessment", id);
  if (!a)
    throw new ApiError(404, "assessment_not_found", "Assessment not found.");
  return a;
}
export function publicAssessment(a: StoredAssessment) {
  return assessmentSchema.parse(a);
}
export function listAssessments(personId: string) {
  return all<StoredAssessment>("assessment").filter(
    (a) => a.personId === personId,
  );
}
export function createAssessment(input: AssessmentInput, ownerId: string) {
  const existing = listAssessments(input.personId).find(
    (a) => a.input.idempotencyKey === input.idempotencyKey,
  );
  if (existing) {
    if (JSON.stringify(existing.input) !== JSON.stringify(input))
      throw new ApiError(
        409,
        "idempotency_conflict",
        "This submission key has already been used for different information.",
      );
    return existing;
  }
  for (const id of input.sensorAssetIds) {
    const m = mediaFor(id, input.personId);
    if (m.kind !== "sensor" || m.status !== "ready")
      throw new ApiError(
        422,
        "invalid_sensor_file",
        "Upload and validate the data file first.",
      );
  }
  if (input.videoAssetId) {
    const m = mediaFor(input.videoAssetId, input.personId);
    if (m.kind !== "video" || m.status !== "ready")
      throw new ApiError(
        422,
        "invalid_video",
        "Upload and validate the video first.",
      );
  }
  const now = new Date().toISOString();
  const a: StoredAssessment = {
    assessmentId: randomUUID(),
    personId: input.personId,
    input,
    ownerId,
    status: "created",
    stage: "Ready to analyze",
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    attempt: 0,
    error: null,
    retryable: false,
    finding: null,
  };
  put("assessment", a.assessmentId, a);
  return a;
}
export function queueAssessment(id: string, retry = false) {
  const a = getAssessment(id);
  if (["queued", "analyzing"].includes(a.status)) return a;
  if (
    retry
      ? !["failed", "partial", "cancelled"].includes(a.status)
      : a.status !== "created"
  )
    throw new ApiError(
      409,
      "invalid_state",
      "This assessment cannot be started in its current state.",
    );
  a.status = "queued";
  a.stage = "Waiting for analysis";
  a.error = null;
  a.retryable = false;
  a.attempt++;
  a.updatedAt = new Date().toISOString();
  put("assessment", id, a);
  return a;
}
const controllers = new Map<string, AbortController>();
export function cancelAssessment(id: string) {
  const a = getAssessment(id);
  if (!["created", "queued", "analyzing"].includes(a.status))
    throw new ApiError(
      409,
      "invalid_state",
      "This assessment is already finished.",
    );
  a.status = "cancelled";
  a.stage = "Cancelled";
  a.updatedAt = new Date().toISOString();
  a.retryable = true;
  put("assessment", id, a);
  controllers.get(id)?.abort();
  return a;
}
export function evaluate(
  input: AssessmentInput,
  observations: Observation[],
  video: Finding["video"],
  baseline?: { heartRate: number | null; steps: number | null },
  reportedSummary?: string | null,
): Pick<
  Finding,
  | "level"
  | "displayStatus"
  | "headline"
  | "recommendedAction"
  | "limitations"
  | "findings"
> & { ruleId: string } {
  const limitations: string[] = [];
  const relevant = observations.filter(
    (o) =>
      Math.abs(Date.parse(o.at) - Date.parse(input.observedAt)) <= 5 * 60_000 &&
      o.withinCoverage !== false,
  );
  if (relevant.length !== observations.length)
    limitations.push(
      "Some observations were outside the selected time window or camera coverage and were excluded.",
    );
  const values = (kind: Observation["kind"]) =>
    relevant.filter((o) => o.kind === kind).map((o) => o.value);
  const yes = (kind: Observation["kind"]) => values(kind).includes(true);
  const no = (kind: Observation["kind"]) => values(kind).includes(false);
  const number = (kind: Observation["kind"]) =>
    values(kind).find((v) => typeof v === "number") as number | undefined;
  const evidence = (kind: Observation["kind"]) =>
    relevant
      .filter((o) => o.kind === kind)
      .map(
        (o) =>
          `${o.source === "sample_manual" ? "Reported" : "Sensor"} ${kind.replaceAll("_", " ")}: ${String(o.value)} at ${o.at}`,
      );
  const videoEvidence = (kind: "fall_posture" | "recovery" | "movement") =>
    video?.uncertain || !input.videoObservedAt
      ? []
      : (video?.evidence ?? [])
          .filter(
            (e) =>
              e.kind === kind &&
              e.confidence !== "low" &&
              Math.abs(
                Date.parse(input.videoObservedAt!) +
                  e.atSeconds * 1000 -
                  Date.parse(input.observedAt),
              ) <=
                5 * 60_000,
          )
          .map(
            (e) =>
              `Video at ${e.atSeconds}s: ${e.description} (${e.confidence} confidence)`,
          );
  type Item = NonNullable<Finding["findings"]>[number];
  const findings: Item[] = [];
  const add = (item: Item) => findings.push(item);
  const conflict = (kind: Observation["kind"]) => yes(kind) && no(kind);
  const fallSignals = [
    ...evidence("impact"),
    ...evidence("fall_posture"),
    ...videoEvidence("fall_posture"),
  ];
  if (conflict("impact") || conflict("fall_posture") || conflict("recovery")) {
    add({
      category: "possible_fall",
      status: "unknown",
      summary:
        "Reports about a possible impact, posture, or recovery conflict.",
      supportingEvidence: fallSignals,
      conflictingEvidence: [
        ...evidence("impact"),
        ...evidence("fall_posture"),
        ...evidence("recovery"),
      ],
      limitations: [
        "Confirm which observation is accurate before relying on a fall assessment.",
      ],
      recommendedAction:
        "Contact the person and check the observation times and sources.",
      ruleId: "fall_conflicting_evidence",
      alertRecommended: false,
    });
  } else if (
    yes("impact") ||
    yes("fall_posture") ||
    videoEvidence("fall_posture").some((e) => e.includes("high confidence"))
  ) {
    const recovered = yes("recovery") || videoEvidence("recovery").length > 0;
    add({
      category: "possible_fall",
      status: recovered ? "watch" : "important",
      summary: recovered
        ? "A possible fall signal was followed by reported or visible recovery movement."
        : "A possible impact or fall posture needs a prompt check-in; recovery has not been confirmed.",
      supportingEvidence: [
        ...fallSignals,
        ...(recovered
          ? [...evidence("recovery"), ...videoEvidence("recovery")]
          : []),
      ],
      conflictingEvidence: [],
      limitations: [
        "A historical clip cannot establish the person's condition after recording.",
      ],
      recommendedAction:
        "Contact the person to confirm their current condition.",
      ruleId: recovered ? "observed_recovery" : "possible_fall_needs_check",
      alertRecommended: true,
    });
  }
  const inactive = number("inactivity_minutes");
  if (inactive !== undefined) {
    const moving = videoEvidence("movement");
    const context = yes("worn") && !yes("sleeping") && !no("device_online");
    const conflicted =
      moving.length > 0 || conflict("worn") || conflict("sleeping");
    const status =
      conflicted || !context || inactive < 30
        ? "unknown"
        : inactive >= 120
          ? "important"
          : "watch";
    add({
      category: "prolonged_inactivity",
      status,
      summary: conflicted
        ? "Reported inactivity conflicts with visible movement or device context."
        : !context
          ? "Inactivity was reported, but wearing, sleep, or device context is incomplete."
          : inactive < 30
            ? "A short inactive interval alone does not establish prolonged inactivity."
            : `${inactive} minutes of inactivity warrants review in the supplied context.`,
      supportingEvidence: evidence("inactivity_minutes"),
      conflictingEvidence: moving,
      limitations:
        status === "unknown"
          ? ["The available evidence cannot confirm prolonged inactivity."]
          : [],
      recommendedAction:
        conflicted || !context
          ? "Check the observation time, device status, and the person's current condition."
          : "Contact the person to check their current activity and wellbeing.",
      ruleId: conflicted
        ? "inactivity_video_conflict"
        : status === "unknown"
          ? "inactivity_context_missing"
          : "sample_inactivity_review",
      alertRecommended: status === "important",
    });
  }
  const heartRate = number("heart_rate");
  if (heartRate !== undefined) {
    const valid = yes("worn") && !conflict("worn") && !!baseline?.heartRate;
    const change = valid
      ? Math.abs(heartRate - baseline!.heartRate!) / baseline!.heartRate!
      : null;
    const status =
      change === null
        ? "unknown"
        : change >= 0.25
          ? "important"
          : change >= 0.1
            ? "watch"
            : "stable";
    add({
      category: "heart_rate_deviation",
      status,
      summary:
        change === null
          ? "A heart rate was supplied, but a learned personal baseline or confirmed watch wearing is unavailable."
          : `The supplied heart rate differs from the learned personal baseline by ${Math.round(change * 100)}%.`,
      supportingEvidence: [
        ...evidence("heart_rate"),
        ...evidence("worn"),
        ...(change === null
          ? []
          : [
              `Learned resting heart rate baseline: ${baseline!.heartRate} bpm`,
            ]),
      ],
      conflictingEvidence: [],
      limitations: ["A heart rate difference is not a medical diagnosis."],
      recommendedAction:
        status === "important"
          ? "Contact the person and consider professional advice if they feel unwell."
          : "Review the reading and the person's usual context.",
      ruleId:
        change === null
          ? "heart_rate_baseline_missing"
          : "sample_heart_rate_baseline",
      alertRecommended: status === "important",
    });
  }
  const steps = number("activity_steps");
  if (steps !== undefined) {
    const valid = yes("worn") && !conflict("worn") && !!baseline?.steps;
    const drop = valid ? 1 - steps / baseline!.steps! : null;
    const status =
      drop === null
        ? "unknown"
        : drop >= 0.45
          ? "important"
          : drop >= 0.2
            ? "watch"
            : "stable";
    add({
      category: "activity_drop",
      status,
      summary:
        drop === null
          ? "Daily steps were supplied, but a learned personal baseline or confirmed watch wearing is unavailable."
          : `Daily steps are ${Math.round(Math.max(0, drop) * 100)}% below the learned personal baseline.`,
      supportingEvidence: [
        ...evidence("activity_steps"),
        ...evidence("worn"),
        ...(drop === null
          ? []
          : [`Learned daily steps baseline: ${baseline!.steps}`]),
      ],
      conflictingEvidence: [],
      limitations: [
        "The step total must cover a full day for this comparison.",
      ],
      recommendedAction:
        status === "important"
          ? "Contact the person and review the activity change."
          : "Check the daily total and recent activity.",
      ruleId:
        drop === null
          ? "activity_baseline_missing"
          : "sample_daily_activity_baseline",
      alertRecommended: status === "important",
    });
  }
  if (conflict("device_online")) {
    add({
      category: "device_data_gap",
      status: "unknown",
      summary: "Device status reports conflict.",
      supportingEvidence: evidence("device_online"),
      conflictingEvidence: evidence("device_online"),
      limitations: ["Device availability cannot be confirmed."],
      recommendedAction:
        "Check the device connection and its recent sync time.",
      ruleId: "device_status_conflict",
      alertRecommended: false,
    });
  } else if (no("device_online")) {
    add({
      category: "device_data_gap",
      status: "watch",
      summary:
        "The device was reported offline, so recent observations may be missing.",
      supportingEvidence: evidence("device_online"),
      conflictingEvidence: [],
      limitations: [
        "An offline device cannot establish the person's current condition.",
      ],
      recommendedAction:
        "Check the device battery, connection, and the person's condition.",
      ruleId: "device_gap",
      alertRecommended: true,
    });
  }
  if (input.note.trim() || values("note").length) {
    add({
      category: "general_check",
      status: "unknown",
      summary:
        reportedSummary ??
        "Additional user-reported context was supplied and needs confirmation.",
      supportingEvidence: ["User-provided additional context"],
      conflictingEvidence: [],
      limitations: ["Free-text reports are not verified measurements."],
      recommendedAction:
        "Check the reported concern with the person and add a timed observation if available.",
      ruleId: "reported_context",
      alertRecommended: false,
    });
  }
  if (
    video &&
    (video.uncertain ||
      !input.videoObservedAt ||
      video.evidence.some(
        (e) => e.kind === "fall_posture" && e.confidence === "low",
      ))
  ) {
    add({
      category: "general_check",
      status: "unknown",
      summary:
        "The clip contains uncertain or unaligned visual evidence that cannot confirm the person's current condition.",
      supportingEvidence: [],
      conflictingEvidence: [],
      limitations: [
        "Review the clip and its recording time before relying on it for a risk decision.",
      ],
      recommendedAction:
        "Check in with the person and confirm when the clip was recorded.",
      ruleId: "video_uncertain_or_unaligned",
      alertRecommended: false,
    });
  }
  if (
    !findings.length &&
    yes("device_online") &&
    yes("worn") &&
    !conflict("worn")
  ) {
    add({
      category: "general_check",
      status: "stable",
      summary:
        "The supplied device and wearing observations show no concerning pattern within this limited check.",
      supportingEvidence: [...evidence("device_online"), ...evidence("worn")],
      conflictingEvidence: [],
      limitations: [
        "This does not establish overall health or conditions outside the observation period.",
      ],
      recommendedAction:
        "Continue checking current observations and device status.",
      ruleId: "no_concerning_observation",
      alertRecommended: false,
    });
  }
  if (!findings.length) {
    add({
      category: "general_check",
      status: "unknown",
      summary:
        "The submitted evidence does not support a reliable risk assessment.",
      supportingEvidence: [],
      conflictingEvidence: [],
      limitations: ["Add relevant, timed observations or a data file."],
      recommendedAction:
        "Check in with the person and add observations from the relevant time.",
      ruleId: "insufficient_evidence",
      alertRecommended: false,
    });
  }
  if (video?.uncertain)
    limitations.push("The video is unclear and cannot confirm an event.");
  if (video && !input.videoObservedAt)
    limitations.push(
      "The video recording time was not confirmed, so visual evidence was not used for the risk decision.",
    );
  if (input.videoAssetId && !video)
    limitations.push("Video was not included in the analysis.");
  const rank = {
    critical: 4,
    important: 3,
    watch: 2,
    stable: 1,
    unknown: 0,
    paused: 0,
  };
  const lead = [...findings].sort((a, b) => rank[b.status] - rank[a.status])[0];
  const hasUnknown = findings.some((f) => f.status === "unknown");
  const level: RiskLevel | null =
    lead.status === "unknown" || (lead.status === "stable" && hasUnknown)
      ? null
      : (lead.status as RiskLevel);
  return {
    level,
    displayStatus: level ?? "unknown",
    headline:
      level === "important"
        ? "A check-in is recommended"
        : level === "watch"
          ? "Observations need review"
          : level === "stable"
            ? "No concerning pattern in the supplied observations"
            : "More information is needed",
    recommendedAction: lead.recommendedAction,
    limitations: [
      ...limitations,
      ...findings.flatMap((f) => f.limitations),
      ...(video?.limitations ?? []),
    ],
    ruleId: lead.ruleId,
    findings,
  };
}
export async function runAssessment(id: string) {
  let a = getAssessment(id);
  if (a.status !== "queued") return;
  a.status = "analyzing";
  a.startedAt = new Date().toISOString();
  a.stage = "Reviewing observations";
  a.updatedAt = a.startedAt;
  a.leaseUntil = Date.now() + 180000;
  put("assessment", id, a);
  const attempt = a.attempt;
  const controller = new AbortController();
  controllers.set(id, controller);
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const observations = [
      ...a.input.observations,
      ...a.input.sensorAssetIds.flatMap(
        (asset) => mediaFor(asset, a.personId).observations,
      ),
    ];
    if (observations.length > 1000)
      throw new Error("At most 1000 observations are allowed per assessment.");
    let video: Finding["video"] = null;
    let videoError: string | null = null;
    if (a.input.videoAssetId) {
      a.stage = "Analyzing video";
      put("assessment", id, a);
      try {
        video = await analyzeVideo(
          a.input.videoAssetId,
          controller.signal,
          observations,
          aiContext(getStore(a.personId)!),
        );
      } catch (e) {
        videoError =
          e instanceof Error ? e.message : "Video analysis unavailable";
      }
    }
    if (getAssessment(id).status === "cancelled") return;
    const reportText = [
      a.input.note,
      ...observations
        .filter((o) => o.kind === "note")
        .map((o) => String(o.value)),
    ]
      .filter(Boolean)
      .join("\n");
    const reportedSummary = await summarizeReportedContext(
      reportText,
      controller.signal,
      aiContext(getStore(a.personId)!),
    );
    if (getAssessment(id).status === "cancelled") return;
    const store = getStore(a.personId);
    if (!store) throw new Error("Person is unavailable");
    const decision = evaluate(
      a.input,
      observations,
      video,
      {
        heartRate:
          store.baselines.find((b) => b.metric === "resting_hr" && b.learned)
            ?.median ?? null,
        steps:
          store.baselines.find((b) => b.metric === "activity" && b.learned)
            ?.median ?? null,
      },
      reportedSummary,
    );
    const priority = {
      critical: 4,
      important: 3,
      watch: 2,
      stable: 1,
      unknown: 0,
      paused: 0,
    };
    const alertFinding = decision.findings
      ?.filter((f) => f.alertRecommended)
      .sort((a, b) => priority[b.status] - priority[a.status])[0];
    const type: EventType =
      alertFinding?.category ??
      decision.findings?.find((f) => f.status === decision.displayStatus)
        ?.category ??
      "general_check";
    const alignedVideoEvidence =
      video && !video.uncertain && a.input.videoObservedAt
        ? video.evidence.filter(
            (e) =>
              e.confidence !== "low" &&
              Math.abs(
                Date.parse(a.input.videoObservedAt!) +
                  e.atSeconds * 1000 -
                  Date.parse(a.input.observedAt),
              ) <=
                5 * 60_000,
          )
        : [];
    const event: MonitoredEvent = {
      id: "pending",
      subjectId: a.personId,
      type,
      trendMetric: null,
      occurredAt: a.input.observedAt,
      signals: [
        ...observations.map((o) => ({
          source: (o.kind === "fall_posture"
            ? "camera_posture"
            : o.kind === "heart_rate"
              ? "watch_hr"
              : o.kind === "impact"
                ? "watch_impact"
                : "watch_activity") as MonitoredEvent["signals"][number]["source"],
          description:
            o.kind === "note"
              ? "Additional user-reported context"
              : `${o.kind.replaceAll("_", " ")}: ${o.value}`,
          withinCoverage: o.withinCoverage,
        })),
        ...alignedVideoEvidence.map((e) => ({
          source:
            e.kind === "fall_posture"
              ? ("camera_posture" as const)
              : ("camera_motion" as const),
          description: `Video at ${e.atSeconds}s: ${e.description} (${e.confidence} confidence)`,
          withinCoverage: true,
        })),
      ],
      fallPhase:
        type === "possible_fall"
          ? observations.some(
              (o) => o.kind === "recovery" && o.value === true,
            ) || alignedVideoEvidence.some((e) => e.kind === "recovery")
            ? "recovered"
            : "candidate"
          : "not_applicable",
      recoveryWindowEndsAt: null,
      independentChannelCount: new Set([
        ...observations.map((o) =>
          o.kind === "fall_posture" ? "camera" : "watch",
        ),
        ...(alignedVideoEvidence.length ? ["camera"] : []),
      ]).size,
      dedupeKey: id,
    };
    const facts = buildStructuredFacts({
      event,
      subject: store.subject,
      occurredAtLocal: a.input.observedAt,
      deviations: [],
      relatedChanges: [a.input.note, video?.summary ?? ""].filter(Boolean),
      trendSynthetic: true,
    });
    facts.subjectAlias = "the monitored person";
    facts.healthContext = aiContext(store);
    facts.observations = observations;
    facts.assessmentFindings = decision.findings?.map((f) => ({
      category: f.category,
      status: f.status,
      summary: f.summary,
      supportingEvidence: f.supportingEvidence,
      conflictingEvidence: f.conflictingEvidence,
      limitations: f.limitations,
      recommendedAction: f.recommendedAction,
    }));
    // Risk decisions and notifications are saved before waiting for narrative generation.
    const current = getAssessment(id);
    if (current.status === "cancelled" || current.attempt !== attempt) return;
    // Re-read after asynchronous provider calls to avoid overwriting acknowledgements/settings.
    const latest = getStore(a.personId)!;
    const previous = latest.events.find((e) => e.dedupeKey === id);
    event.id = previous?.id ?? nextId(latest, "evt");
    if (!previous) latest.events.push(event);
    else latest.events[latest.events.indexOf(previous)] = event;
    latest.structuredFacts[event.id] = facts;
    let alert = latest.alerts.find((al) => al.eventId === event.id);
    if (
      !alert &&
      decision.level &&
      decision.level !== "stable" &&
      !!alertFinding
    ) {
      const now = new Date().toISOString();
      alert = {
        id: nextId(latest, "al"),
        subjectId: a.personId,
        eventId: event.id,
        eventType: type,
        level: decision.level,
        status: "open",
        createdAt: now,
        levelHistory: [
          { level: decision.level, at: now, trigger: "uploaded_assessment" },
        ],
        notifications: [],
        escalation: {
          subjectId: a.personId,
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
      latest.alerts.push(alert);
    }
    // A retry refreshes an active alert, but never reopens a human-resolved event.
    if (
      alert &&
      ["open", "acknowledged"].includes(alert.status) &&
      decision.level &&
      decision.level !== "stable" &&
      alert.level !== decision.level
    ) {
      alert.level = decision.level;
      alert.levelHistory.push({
        level: decision.level,
        at: new Date().toISOString(),
        trigger: "assessment_retry",
      });
    }
    if (!previous)
      appendAudit(latest, {
        at: new Date().toISOString(),
        actorUserId: a.ownerId,
        actorRole: "primary_family",
        action: alert ? "alert_created" : "assessment_completed",
        detail: {
          assessmentId: id,
          eventId: event.id,
          alertId: alert?.id ?? null,
          source: "uploaded_sample",
          rule: decision.ruleId,
          alertCategory: alertFinding?.category ?? null,
          supportingEvidenceCount: alertFinding?.supportingEvidence.length ?? 0,
          conflictingEvidenceCount:
            alertFinding?.conflictingEvidence.length ?? 0,
        },
      });
    advance(latest, Date.now());
    saveStore(latest);
    const summary = await callKimi(id, facts);
    const afterSummary = getAssessment(id);
    if (afterSummary.status === "cancelled" || afterSummary.attempt !== attempt)
      return;
    const currentStore = getStore(a.personId);
    if (!currentStore) throw new Error("Person was removed during analysis.");
    currentStore.kimiSummaries[event.id] = { ...summary, eventId: event.id };
    saveStore(currentStore);
    const partial = Boolean(videoError) || summary.source !== "llm";
    a = {
      ...current,
      status: partial ? "partial" : "completed",
      stage: partial ? "Review available results" : "Analysis complete",
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      error: videoError,
      retryable: partial,
      finding: {
        ...decision,
        plainSummary:
          summary.source === "llm"
            ? summary.eventSummary
            : decision.findings!.map((f) => f.summary).join(" ") +
              " " +
              decision.recommendedAction,
        alertReason: alert ? (alertFinding?.summary ?? null) : null,
        observations,
        video,
        sourceBreakdown: [
          "Submitted sample observations",
          ...(video
            ? [
                a.input.videoObservedAt
                  ? "Analyzed sample video with confirmed recording time"
                  : "Reviewed sample video; recording time unconfirmed",
              ]
            : a.input.videoAssetId
              ? ["Attached sample video; analysis unavailable"]
              : []),
        ],
        model: {
          provider: "kimi",
          modelId: video
            ? visualModel()
            : summary.source === "llm" || !!reportedSummary
              ? (process.env.KIMI_MODEL ?? "moonshot-v1-8k")
              : null,
          used: !!video || summary.source === "llm" || !!reportedSummary,
          fallbackReason:
            videoError ??
            (summary.source !== "llm"
              ? "Text summary unavailable; showing a rule-based explanation."
              : null),
        },
        decision: {
          engine: "observation_rules",
          version: "4.0-sample-fusion",
          ruleId: decision.ruleId,
        },
        eventId: event.id,
        alertId: alert?.id ?? null,
      },
    };
    put("assessment", id, a);
  } catch (e) {
    a = getAssessment(id);
    if (a.status !== "cancelled") {
      a.status = "failed";
      a.stage = "Analysis could not finish";
      a.error = e instanceof Error ? e.message : "Analysis failed";
      a.retryable = true;
      a.updatedAt = new Date().toISOString();
      put("assessment", id, a);
    }
  } finally {
    clearTimeout(timeout);
    controllers.delete(id);
  }
}
