/**
 * Demo 事件注入 — PRD §19 步骤 2
 * 注入"摄像头疑似跌倒 + 手表冲击 + 心率偏离"，进入恢复观察窗（3 分钟 → Demo 10 秒）。
 * 观察窗内无恢复 → 升级 Critical（由 engine.advance 完成）。
 * cap-then-upgrade 的两阶段判定正是 Demo 要展示的核心 — PRD §5.2 / §5.3。
 */

import { DEMO_RECOVERY_WINDOW_SEC } from "@/lib/constants";
import { decideLevel, demoFallProbabilities } from "@/lib/jev/decide";
import { buildStructuredFacts } from "@/lib/jev/facts";
import { fallDeviations, SUBJECT_ID } from "@/data/seed";
import type { DemoStore } from "@/lib/demo/store";
import { appendAudit, nextId } from "@/lib/demo/store";
import type { MonitoredEvent } from "@/types/event";
import type { Alert } from "@/types/alert";

export interface InjectResult {
  eventId: string;
  alertId: string;
  /** 初始等级（封顶 Important — 观察窗未结束） */
  level: Alert["level"];
  cappedReason: string | null;
  recoveryWindowEndsAt: string;
}

function formatLocalTime(iso: string, timeZone: string): string {
  try {
    const t = new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    });
    const tzName =
      new Intl.DateTimeFormat("en", { timeZoneName: "short", timeZone })
        .formatToParts(new Date(iso))
        .find((p) => p.type === "timeZoneName")?.value ?? timeZone;
    return `${t} (${tzName})`;
  } catch {
    return iso;
  }
}

export function injectFall(store: DemoStore, nowMs: number): InjectResult {
  const nowIso = new Date(nowMs).toISOString();
  const recoveryEnds = new Date(nowMs + DEMO_RECOVERY_WINDOW_SEC * 1000).toISOString();

  // 支持信号：摄像头姿态 + 手表冲击 + 心率偏离（2 个独立通道）— PRD §5.3 示例
  const event: MonitoredEvent = {
    id: nextId(store, "evt"),
    subjectId: SUBJECT_ID,
    type: "possible_fall",
    trendMetric: null,
    occurredAt: nowIso,
    signals: [
      { source: "camera_posture", description: "fall posture detected", withinCoverage: true },
      { source: "watch_impact", description: "sudden impact detected" },
      { source: "watch_hr", description: "heart rate elevated above personal baseline" },
    ],
    fallPhase: "candidate",
    recoveryWindowEndsAt: recoveryEnds,
    independentChannelCount: 2, // camera + watch
    dedupeKey: null,
  };
  store.events.push(event);

  // 结构化事实（Kimi 的唯一输入，去标识化）— PRD §10.2 / §10.4
  const deviations = fallDeviations();
  const facts = buildStructuredFacts({
    event,
    subject: store.subject,
    occurredAtLocal: formatLocalTime(nowIso, store.subject.timeZone),
    deviations,
    relatedChanges: [
      "Activity today is 45% below personal baseline",
      "Sleep was slightly below baseline for the past 5 days",
    ],
    trendSynthetic: true, // 合成数据标注 — PRD §19
  });
  store.structuredFacts[event.id] = facts;
  store.deviations[event.id] = deviations;

  // JEV 决策：p(critical)=0.94 且 2 独立信号，但观察窗未结束 → 封顶 Important — PRD §5.3 行 2
  const out = decideLevel(
    {
      eventId: event.id,
      subjectId: event.subjectId,
      eventType: event.type,
      signals: event.signals,
      fallPhase: "candidate",
      independentChannelCount: event.independentChannelCount,
      insufficientData: false,
      baselineLearned: true,
      deviceOfflineSuppressed: false,
    },
    {
      probabilities: demoFallProbabilities(),
      structuredFacts: facts,
      monitoringPaused: store.subject.monitoringPaused,
      watchEmailEnabled: store.subscription.watchEmailEnabled,
    }
  );

  const alert: Alert = {
    id: nextId(store, "al"),
    subjectId: SUBJECT_ID,
    eventId: event.id,
    eventType: event.type,
    level: out.level,
    status: "open",
    createdAt: nowIso,
    levelHistory: [{ level: out.level, at: nowIso, trigger: "initial_detection" }],
    notifications: [],
    escalation: {
      subjectId: SUBJECT_ID,
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
  store.alerts.push(alert);

  appendAudit(store, {
    at: nowIso,
    actorUserId: null,
    actorRole: "system",
    action: "alert_created",
    detail: {
      alertId: alert.id,
      eventId: event.id,
      eventType: event.type,
      level: out.level,
      rule: out.ruleApplied,
    },
  });

  return {
    eventId: event.id,
    alertId: alert.id,
    level: out.level,
    cappedReason: out.cappedReason,
    recoveryWindowEndsAt: recoveryEnds,
  };
}
