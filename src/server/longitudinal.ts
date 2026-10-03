import { calendarDay } from "@/shared/date";
import type { DemoStore } from "./store";
import { appendAudit, nextId } from "./store";
import { createRiskEvent } from "./simulator";
import { buildTrendSeries } from "./data/seed";
import { callKimi } from "./llm/kimi";
import type { StructuredFacts } from "@/shared/types/jev";
import type { Evolution } from "@/shared/contracts/monitoring";
import { monitoringStatus } from "./monitoring";

export const metricDefinitions = [
  { key: "activity", label: "Activity", unit: "steps" },
  { key: "sleep", label: "Sleep", unit: "hours" },
  { key: "resting_hr", label: "Resting heart rate", unit: "bpm" },
  { key: "mobility", label: "Mobility", unit: "m/s" },
  { key: "gait", label: "Gait symmetry", unit: "%" },
  { key: "behaviour", label: "Behavioural changes", unit: "events/day" },
  { key: "weight", label: "Weight", unit: "kg" },
  { key: "bp_systolic", label: "Blood pressure · systolic", unit: "mmHg" },
  { key: "bp_diastolic", label: "Blood pressure · diastolic", unit: "mmHg" },
  { key: "risk_events", label: "Risk event frequency", unit: "events/day" },
];
const baseKeys = ["activity", "sleep", "resting_hr", "mobility"] as const;
const mean = (p: Array<{ value: number }>) =>
  p.length ? p.reduce((n, v) => n + v.value, 0) / p.length : null;
const today = (s: DemoStore, now = Date.now()) =>
  calendarDay(new Date(now), s.subject.timeZone);
export function history(s: DemoStore, key: string) {
  if ((baseKeys as readonly string[]).includes(key))
    return s.trends[key as (typeof baseKeys)[number]] ?? [];
  if (key === "risk_events") {
    const counts = new Map<string, number>();
    for (const event of s.events) {
      const day = calendarDay(new Date(event.occurredAt), s.subject.timeZone);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    const dates = Object.values(s.trends)
      .flat()
      .map((p) => p.date);
    const start = [...dates, ...counts.keys()].sort()[0];
    if (!start) return [];
    const length = Math.min(
      365,
      Math.max(
        1,
        Math.floor((Date.parse(today(s)) - Date.parse(start)) / 86400000) + 1,
      ),
    );
    return Array.from({ length }, (_, i) => {
      const date = new Date(Date.parse(today(s)) - (length - 1 - i) * 86400000)
        .toISOString()
        .slice(0, 10);
      return { date, value: counts.get(date) ?? 0 };
    });
  }
  return s.evolutionSeries[key] ?? [];
}
export function initializeSampleHistory(s: DemoStore) {
  if (s.historyMode !== "sample") return false;
  let changed = false;
  for (const key of baseKeys)
    if (s.trends[key].length < 365) {
      const original = new Map(s.trends[key].map((p) => [p.date, p]));
      s.trends[key] = buildTrendSeries(
        key,
        365,
        new Date(s.user.createdAt),
        s.subject.timeZone,
      ).map((p) => original.get(p.date) ?? p);
      changed = true;
    }
  if (!s.evolutionSeries.gait) {
    s.evolutionSeries.gait = s.trends.mobility.map((p, i) => ({
      date: p.date,
      value: Math.round((97 - (i > 335 ? (i - 335) * 0.1 : 0)) * 10) / 10,
    }));
    s.evolutionSeries.behaviour = s.trends.activity.map((p, i) => ({
      date: p.date,
      value: i > 335 && i % 7 === 0 ? 1 : 0,
    }));
    changed = true;
  }
  return changed;
}
export function evolution(s: DemoStore, windowDays = 30): Evolution {
  const end = Date.parse(today(s));
  const from = new Date(end - (windowDays - 1) * 86400000)
    .toISOString()
    .slice(0, 10);
  const metrics = metricDefinitions.map((m) => {
    const full = history(s, m.key)
      .filter((p) => p.date <= today(s))
      .sort((a, b) => a.date.localeCompare(b.date));
    const points = full.filter((p) => p.date >= from);
    const baseline =
      s.baselines.find((b) => b.metric === m.key && b.learned)?.median ?? null;
    const current = mean(points.slice(-7));
    const prior = points.length >= 14 ? mean(points.slice(0, 7)) : null;
    return {
      ...m,
      points,
      coverageDays: points.length,
      baseline,
      current,
      changePct:
        current !== null && baseline ? (current - baseline) / baseline : null,
      historicalChangePct:
        current !== null && prior ? (current - prior) / prior : null,
    };
  });
  return {
    personId: s.subject.id,
    windowDays,
    source:
      s.historyMode === "sample"
        ? "Synthetic sample history"
        : "User-reported history",
    metrics,
    tasks: s.careTasks,
    summary:
      s.evolutionSummary?.windowDays === windowDays ? s.evolutionSummary : null,
  };
}
export function aiContext(s: DemoStore) {
  const { photo: _photo, shareWithAi: _share, ...profile } = s.profile;
  return {
    ...(s.profile.shareWithAi
      ? { reportedHealthProfile: { age: s.subject.age, ...profile } }
      : { profileWithheld: true }),
    baseline: s.baselines
      .filter((b) => b.learned)
      .map((b) => ({ metric: b.metric, median: b.median })),
    history: [30, 90].map((days) => ({
      days,
      metrics: evolution(s, days).metrics.map(({ points: _points, ...m }) => m),
    })),
    previousOutcomes: s.alerts
      .filter((a) => a.status === "resolved")
      .slice(-10)
      .map((a) => ({ eventType: a.eventType, reason: a.resolveReason })),
    careOutcomes: s.careTasks
      .filter((t) => t.status === "completed")
      .slice(-10)
      .map((t) => ({
        reason: t.reason,
        outcome: s.profile.shareWithAi ? t.outcome : "Recorded locally",
      })),
  };
}
export async function summarizeEvolution(s: DemoStore, days: number) {
  const data = evolution(s, days);
  const facts: StructuredFacts = {
    subjectAlias: "the monitored person",
    eventType: "activity_drop",
    occurredAtLocal: new Date().toISOString(),
    timeZone: s.subject.timeZone,
    signals: [],
    deviations: data.metrics
      .filter((m) => m.changePct !== null)
      .map((m) => ({
        metric: m.label,
        relativeChange: m.changePct!,
        direction: m.changePct! < 0 ? "down" : "up",
      })),
    relatedChanges: data.metrics
      .filter((m) => m.current !== null)
      .map(
        (m) =>
          `${days}-day ${m.label}: recent mean ${m.current?.toFixed(1)} ${m.unit}; ${m.coverageDays} days recorded${m.historicalChangePct === null ? "" : `; change within window ${Math.round(m.historicalChangePct * 100)}%`}`,
      ),
    trendSynthetic: s.historyMode === "sample",
    healthContext: aiContext(s),
  };
  if (!facts.relatedChanges.length)
    return {
      text: "There is not enough history to compare patterns. Add dated observations to build a personal history.",
      source: "rules" as const,
      generatedAt: new Date().toISOString(),
      windowDays: days,
    };
  const result = await callKimi("longitudinal", facts);
  return {
    text:
      result.source === "llm"
        ? [
            result.baselineComparison,
            result.relatedChanges,
            result.suggestedNextStep,
          ].join(" ")
        : `${facts.relatedChanges.join(". ")}. Compare these limited observations with the person's usual routine and check in if changes persist.`,
    source: result.source === "llm" ? ("llm" as const) : ("rules" as const),
    generatedAt: new Date().toISOString(),
    windowDays: days,
  };
}
/** Versioned sample policy: sustained changes in two independent health areas, capped at Moderate. */
export function advanceLongitudinal(s: DemoStore, now = Date.now()) {
  if (s.subject.monitoringPaused || !monitoringStatus(s, now).verifiable)
    return false;
  const day = today(s, now);
  if (s.trendReviewedAt === day) return false;
  s.trendReviewedAt = day;
  const changes = baseKeys.filter((key) => {
    const baseline = s.baselines.find(
      (b) => b.metric === key && b.learned,
    )?.median;
    if (!baseline) return false;
    const cutoff = new Date(Date.parse(day) - 20 * 86400000)
      .toISOString()
      .slice(0, 10);
    const points = history(s, key).filter(
      (p) => p.date >= cutoff && p.date <= day,
    );
    if (new Set(points.map((p) => p.date)).size < 21) return false;
    return [0, 7, 14].every((i) => {
      const average = mean(points.slice(i, i + 7))!;
      return key === "resting_hr"
        ? average >= baseline * 1.1
        : average <= baseline * 0.85;
    });
  });
  if (
    changes.length < 2 ||
    s.careTasks.some(
      (t) =>
        t.ruleId === "sustained_multi_area_v1" &&
        (t.status === "open" || now - Date.parse(t.createdAt) < 30 * 86400000),
    )
  )
    return true;
  const reason = `Persistent changes in ${changes.join(", ")} relative to learned personal baselines across three weeks.`;
  const result = createRiskEvent(s, "important", "longitudinal", reason, now);
  s.careTasks.push({
    id: nextId(s, "care"),
    createdAt: new Date(now).toISOString(),
    reason,
    recommendation:
      "Arrange a family check-in, review the person's routine and discuss persistent changes with a care professional if appropriate.",
    status: "open",
    completedAt: null,
    outcome: "",
    ruleId: "sustained_multi_area_v1",
    eventId: result.eventId,
  });
  appendAudit(s, {
    at: new Date(now).toISOString(),
    actorUserId: null,
    actorRole: "system",
    action: "alert_created",
    detail: {
      source: "longitudinal",
      ruleId: "sustained_multi_area_v1",
      alertId: result.alertId,
    },
  });
  return true;
}

/** Learn from this person's dated reported measurements, excluding known abnormal-event days. */
export function learnReportedBaselines(s: DemoStore) {
  if (s.historyMode !== "user") return;
  const abnormal = new Set(
    s.alerts
      .filter(
        (a) =>
          a.status !== "resolved" ||
          ["real_event_handled", "device_issue"].includes(
            a.resolveReason ?? "",
          ),
      )
      .flatMap((a) => {
        const event = s.events.find((e) => e.id === a.eventId);
        return event
          ? [calendarDay(new Date(event.occurredAt), s.subject.timeZone)]
          : [];
      }),
  );
  for (const b of s.baselines) {
    const series = history(s, b.metric)
      .filter((p) => !abnormal.has(p.date) && p.value > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-90);
    const needed = b.metric === "sleep" ? 28 : 14;
    if (new Set(series.map((p) => p.date)).size < needed) continue;
    const values = series.map((p) => p.value).sort((a, b) => a - b);
    const quantile = (q: number) => {
      const i = (values.length - 1) * q,
        lo = Math.floor(i),
        hi = Math.ceil(i);
      return values[lo] + (values[hi] - values[lo]) * (i - lo);
    };
    b.median = quantile(0.5);
    b.p25 = quantile(0.25);
    b.p75 = quantile(0.75);
    b.learned = true;
    b.lastIncludedSampleAt = new Date(series.at(-1)!.date).toISOString();
  }
}
