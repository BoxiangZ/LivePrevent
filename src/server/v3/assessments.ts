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
import { analyzeVideo, visualModel } from "./kimi";
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
): Pick<
  Finding,
  "level" | "displayStatus" | "headline" | "recommendedAction" | "limitations"
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
  const values = (kind: string) =>
    relevant.filter((o) => o.kind === kind).map((o) => o.value);
  const yes = (kind: string) => values(kind).includes(true);
  const number = (kind: string) =>
    values(kind).find((v) => typeof v === "number") as number | undefined;
  const conflicting = relevant.some((o) =>
    values(o.kind).some(
      (v) =>
        typeof v === "boolean" && typeof o.value === "boolean" && v !== o.value,
    ),
  );
  const unsupported =
    relevant.length === 0 || relevant.every((o) => o.kind === "note");
  let level: RiskLevel | null = null,
    ruleId = "insufficient_evidence";
  if (conflicting)
    limitations.push(
      "Observations conflict. Confirm the person's condition before relying on this assessment.",
    );
  if (video?.uncertain)
    limitations.push("The video is unclear and cannot confirm an event.");
  if (!unsupported && !conflicting) {
    if (
      input.scenario === "possible_fall" &&
      (yes("impact") ||
        yes("fall_posture") ||
        (!video?.uncertain &&
          video?.evidence.some(
            (e) => e.kind === "fall_posture" && e.confidence === "high",
          )))
    ) {
      level = yes("recovery") ? "watch" : "important";
      ruleId = yes("recovery")
        ? "observed_recovery"
        : "possible_fall_needs_check";
      limitations.push(
        "A historical upload cannot establish whether recovery occurred after recording. No automatic critical escalation is inferred from the end of this clip.",
      );
    } else if (
      input.scenario === "prolonged_inactivity" &&
      number("inactivity_minutes") !== undefined
    ) {
      if (
        yes("worn") &&
        !yes("sleeping") &&
        !values("device_online").includes(false)
      ) {
        level = number("inactivity_minutes")! >= 120 ? "important" : "watch";
        ruleId = "sample_inactivity_review";
      } else
        limitations.push(
          "Inactivity needs wearable, sleep and device context.",
        );
    } else if (
      input.scenario === "heart_rate_deviation" &&
      number("heart_rate") !== undefined &&
      baseline?.heartRate &&
      yes("worn")
    ) {
      const change =
        Math.abs(number("heart_rate")! - baseline.heartRate) /
        baseline.heartRate;
      level = change >= 0.25 ? "important" : change >= 0.1 ? "watch" : "stable";
      ruleId = "sample_heart_rate_baseline";
      limitations.push(
        "Heart rate differences have many causes. This comparison is not a medical interpretation.",
      );
    } else if (
      input.scenario === "activity_drop" &&
      number("activity_steps") !== undefined &&
      baseline?.steps &&
      yes("worn")
    ) {
      const drop = 1 - number("activity_steps")! / baseline.steps;
      level = drop >= 0.45 ? "important" : drop >= 0.2 ? "watch" : "stable";
      ruleId = "sample_daily_activity_baseline";
      limitations.push(
        "The step total must cover a full day for this baseline comparison.",
      );
    } else if (
      input.scenario === "device_data_gap" &&
      values("device_online").includes(false)
    ) {
      level = "watch";
      ruleId = "device_gap";
    } else if (
      input.scenario === "general_check" &&
      yes("device_online") &&
      yes("worn") &&
      !yes("impact") &&
      !yes("fall_posture")
    ) {
      level = "stable";
      ruleId = "no_concerning_observation";
    } else {
      limitations.push(
        "These observations are not sufficient for this assessment type. Review the recorded values with the person's usual context.",
      );
    }
  }
  if (input.videoAssetId && !video)
    limitations.push("Video was not included in the analysis.");
  const action =
    level === "important"
      ? "Contact the selected person to check their condition."
      : ruleId === "device_gap"
        ? "Check the device battery and connection."
        : level === "stable"
          ? "No concerning pattern was identified in these observations. Continue checking current device status."
          : "Review the available information and check in with the selected person.";
  return {
    level,
    displayStatus: level ?? "unknown",
    headline:
      level === "important"
        ? "A check-in is recommended"
        : level === "watch"
          ? "An observation needs review"
          : level === "stable"
            ? "No concerning pattern in these observations"
            : "More information is needed",
    recommendedAction: action,
    limitations: [...limitations, ...(video?.limitations ?? [])],
    ruleId,
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
        );
      } catch (e) {
        videoError =
          e instanceof Error ? e.message : "Video analysis unavailable";
      }
    }
    if (getAssessment(id).status === "cancelled") return;
    const store = getStore(a.personId);
    if (!store) throw new Error("Person is unavailable");
    const decision = evaluate(a.input, observations, video, {
      heartRate:
        store.baselines.find((b) => b.metric === "resting_hr" && b.learned)
          ?.median ?? null,
      steps:
        store.baselines.find((b) => b.metric === "activity" && b.learned)
          ?.median ?? null,
    });
    const type: EventType = a.input.scenario;
    const event: MonitoredEvent = {
      id: "pending",
      subjectId: a.personId,
      type,
      trendMetric: null,
      occurredAt: a.input.observedAt,
      signals: observations.map((o) => ({
        source:
          o.kind === "fall_posture"
            ? "camera_posture"
            : o.kind === "heart_rate"
              ? "watch_hr"
              : o.kind === "impact"
                ? "watch_impact"
                : "watch_activity",
        description: `${o.kind.replaceAll("_", " ")}: ${o.value}`,
        withinCoverage: o.withinCoverage,
      })),
      fallPhase:
        a.input.scenario === "possible_fall"
          ? observations.some((o) => o.kind === "recovery" && o.value === true)
            ? "recovered"
            : "candidate"
          : "not_applicable",
      recoveryWindowEndsAt: null,
      independentChannelCount: new Set(
        observations.map((o) =>
          o.kind === "fall_posture" ? "camera" : "watch",
        ),
      ).size,
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
    facts.observations = observations;
    const summary = await callKimi(id, facts);
    const current = getAssessment(id);
    if (current.status === "cancelled" || current.attempt !== attempt) return;
    // Re-read after asynchronous provider calls to avoid overwriting acknowledgements/settings.
    const latest = getStore(a.personId)!;
    const previous = latest.events.find((e) => e.dedupeKey === id);
    event.id = previous?.id ?? nextId(latest, "evt");
    if (!previous) latest.events.push(event);
    else latest.events[latest.events.indexOf(previous)] = event;
    latest.structuredFacts[event.id] = facts;
    latest.kimiSummaries[event.id] = { ...summary, eventId: event.id };
    let alert = latest.alerts.find((al) => al.eventId === event.id);
    if (
      !alert &&
      decision.level &&
      decision.level !== "stable" &&
      (type === "general_check" || latest.subscription[type])
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
        action: "alert_created",
        detail: {
          assessmentId: id,
          eventId: event.id,
          alertId: alert?.id ?? null,
          source: "uploaded_sample",
          rule: decision.ruleId,
        },
      });
    saveStore(latest);
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
            : decision.headline + ". " + decision.recommendedAction,
        observations,
        video,
        sourceBreakdown: [
          "Uploaded sample observations",
          ...(video ? ["Uploaded sample video"] : []),
        ],
        model: {
          provider: "kimi",
          modelId: video
            ? visualModel()
            : summary.source === "llm"
              ? (process.env.KIMI_MODEL ?? "moonshot-v1-8k")
              : null,
          used: !!video || summary.source === "llm",
          fallbackReason:
            videoError ??
            (summary.source !== "llm"
              ? "Text summary unavailable; showing a rule-based explanation."
              : null),
        },
        decision: {
          engine: "observation_rules",
          version: "3.0-sample",
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
