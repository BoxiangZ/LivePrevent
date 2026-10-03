/**
 * Demo 状态快照 — GET /api/demo/state 的返回形状。
 * 所有页面消费同一份快照，客户端 500ms 轮询。
 * 倒计时以快照中的 nowMs 为基准计算，避免客户端/服务端时钟偏差。
 */

import { recommendedAction } from "@/server/v3/actions";
import type { DemoStore } from "@/server/store";
import { freshnessOf } from "@/server/store";
import { seedCarePatients } from "@/server/data/care";
import type { Alert, Contact, NotificationRecord } from "@/shared/types/alert";
import type { AuditLogEntry } from "@/shared/types/audit";
import type { DataFreshness } from "@/shared/types/device";
import type { MonitoredEvent, TrendMetric } from "@/shared/types/event";
import type { RiskLevel } from "@/shared/types/risk";
import type { TrendPoint, BaselineDeviation } from "@/shared/types/baseline";
import type { KimiSummary } from "@/shared/types/jev";
import type { AlertSubscriptionSettings } from "@/shared/types/alert";
import type { CarePatientRow } from "@/shared/types/care";

export interface NotificationPreview {
  id: string;
  alertId: string;
  contactId: string;
  contactName: string;
  channel: string;
  sentAt: string;
  subject: string | null;
  body: string;
  secureLinkAvailable: boolean;
  deliveryStatus: "sent" | "delivered" | "failed";
  simulated: true;
}

export interface SnapshotAlert extends Alert {
  eventLabel: string;
  recommendedAction: string;
}

export interface SnapshotBaseline {
  metric: TrendMetric;
  learned: boolean;
  median: number | null;
  p25: number | null;
  p75: number | null;
  /** 指标单位（"steps" / "hours" / "m/s" / "bpm"） */
  unit: string;
  /** 展示标签（"Activity" / "Sleep" / "Mobility" / "Heart Rate"） */
  label: string;
}

export interface MetricSummary {
  metric: TrendMetric;
  label: string;
  unit: string;
  /** 今日/当前值 */
  current: number | null;
  /** 基线中位数 */
  baseline: number | null;
  /** 基线正常区间 */
  p25: number | null;
  p75: number | null;
  /** 相对基线的偏离（如 -0.37 = 低于基线 37%） */
  deltaPct: number | null;
  /** 30 天均值 vs 前 30 天均值 的变化（长期趋势） */
  delta30dPct: number | null;
  /** 状态归类 */
  status: "normal" | "slightly_off" | "deviated" | "insufficient_data";
  /** 一句话人类可读解读 */
  interpretation: string;
}

export interface DemoStateSnapshot {
  nowMs: number;
  demoTimeScale: number;
  people: Array<{ id: string; label: string; alias: string; overallLevel: string; openAlertCount: number }>;
  dataStatus: { source: "simulated"; synthetic: true; asOf: string; stale: boolean };
  subject: {
    id: string;
    /** Full display name */
    name: string;
    /** Notification alias */
    alias: string;
    age: number | null;
    timeZone: string;
    monitoringPaused: boolean;
  };
  learningProgress: { currentDay: number; totalDays: number } | null;
  overallLevel: RiskLevel;
  devices: DataFreshness[];
  deviceDetails: Array<{
    id: string;
    type: string;
    label: string;
    online: boolean;
    worn: boolean | null;
    batteryPct: number | null;
    coveredRooms: string[];
    cameraMode: string | null;
  }>;
  baselines: SnapshotBaseline[];
  /** 90 天日粒度趋势（7D/30D/90D 由前端切窗） */
  trends: Record<TrendMetric, TrendPoint[]>;
  /** 派生指标摘要（含 30 天趋势变化与解读） */
  metricSummaries: MetricSummary[];
  events: MonitoredEvent[];
  deviations: Record<string, BaselineDeviation[]>;
  alerts: SnapshotAlert[];
  contacts: Contact[];
  notifications: NotificationPreview[];
  auditLog: AuditLogEntry[];
  subscription: AlertSubscriptionSettings;
  kimiSummaries: Record<string, KimiSummary>;
  /** Institutional preview rows; the selected person is live. */
  carePatients: CarePatientRow[];
  /** 活跃（open）的 Critical 警报，驱动全局红色横幅 */
  activeCriticalAlertId: string | null;
  /** 处于恢复观察窗内的事件（Overview 展示观察窗倒计时） */
  pendingFallEventId: string | null;
}

const EVENT_LABEL: Record<string, string> = {
  possible_fall: "Possible fall",
  prolonged_inactivity: "Abnormal inactivity",
  heart_rate_deviation: "Heart rate deviation",
  activity_drop: "Activity below baseline",
  device_data_gap: "Data gap",
};

const METRIC_META: Record<TrendMetric, { label: string; unit: string }> = {
  activity: { label: "Activity", unit: "steps" },
  sleep: { label: "Sleep", unit: "hours" },
  mobility: { label: "Mobility", unit: "m/s" },
  resting_hr: { label: "Heart Rate", unit: "bpm" },
};

function overallLevelOf(alerts: Alert[]): RiskLevel {
  const open = alerts.filter((a) => a.status === "open" || a.status === "acknowledged");
  if (open.some((a) => a.level === "critical")) return "critical";
  if (open.some((a) => a.level === "important")) return "important";
  if (open.some((a) => a.level === "watch")) return "watch";
  return "stable";
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function buildMetricSummaries(store: DemoStore): MetricSummary[] {
  return store.baselines.map((b) => {
    const meta = METRIC_META[b.metric];
    const series = store.trends[b.metric] ?? [];
    const current = series.length > 0 ? series[series.length - 1].value : null;
    const median = b.median;

    const deltaPct =
      current !== null && median ? (current - median) / median : null;

    // 30 天长期趋势：最近 7 天均值 vs 最初 7 天均值
    let delta30dPct: number | null = null;
    if (series.length >= 30) {
      const first7 = mean(series.slice(0, 7).map((p) => p.value));
      const last7 = mean(series.slice(-7).map((p) => p.value));
      if (first7 > 0) delta30dPct = (last7 - first7) / first7;
    }

    let status: MetricSummary["status"] = "insufficient_data";
    if (deltaPct !== null) {
      const a = Math.abs(deltaPct);
      if (a < 0.1) status = "normal";
      else if (a < 0.2) status = "slightly_off";
      else status = "deviated";
    }

    const interpretation = interpretMetric(b.metric, current, median, deltaPct, delta30dPct);

    return {
      metric: b.metric,
      label: meta.label,
      unit: meta.unit,
      current,
      baseline: median,
      p25: b.p25,
      p75: b.p75,
      deltaPct,
      delta30dPct,
      status,
      interpretation,
    };
  });
}

function fmt(v: number, metric: TrendMetric): string {
  if (metric === "activity") return Math.round(v).toLocaleString("en-US");
  if (metric === "resting_hr") return String(Math.round(v));
  return v.toFixed(1);
}

function interpretMetric(
  metric: TrendMetric,
  current: number | null,
  median: number | null,
  deltaPct: number | null,
  delta30dPct: number | null
): string {
  if (current === null || median === null || deltaPct === null) {
    return "Not enough data yet.";
  }
  const pct = Math.round(Math.abs(deltaPct) * 100);
  const dir = deltaPct < 0 ? "below" : "above";
  const longPct = delta30dPct !== null ? Math.round(Math.abs(delta30dPct) * 100) : null;
  const longDir = delta30dPct !== null && delta30dPct < 0 ? "down" : "up";

  switch (metric) {
    case "activity":
      if (Math.abs(deltaPct) < 0.1)
        return `Daily activity is close to the usual ${fmt(median, metric)} steps.`;
      return `Activity is ${pct}% ${dir} the personal baseline today${
        longPct !== null ? `, and trending ${longDir} ${longPct}% over 30 days` : ""
      }.`;
    case "sleep":
      if (Math.abs(deltaPct) < 0.08)
        return `Sleep is near the usual ${fmt(median, metric)} hours.`;
      return `Sleep is ${pct}% ${dir} the personal baseline${
        longPct !== null ? `, with a ${longPct}% ${longDir}ward drift over 30 days` : ""
      }.`;
    case "mobility":
      if (Math.abs(deltaPct) < 0.08)
        return `Walking speed is near the usual ${fmt(median, metric)} m/s.`;
      return `Walking speed is ${pct}% ${dir} the personal baseline${
        longPct !== null ? `, trending ${longDir} ${longPct}% over 30 days` : ""
      }.`;
    case "resting_hr":
      if (Math.abs(deltaPct) < 0.08)
        return `Resting heart rate is near the personal baseline of ${fmt(median, metric)} bpm.`;
      return `Resting heart rate is ${pct}% ${dir} the personal baseline of ${fmt(median, metric)} bpm.`;
  }
}

export function buildSnapshot(store: DemoStore, nowMs: number): DemoStateSnapshot {
  const contactName = (id: string) => store.contacts.find((c) => c.id === id)?.name ?? id;

  const notifications: NotificationPreview[] = store.alerts.flatMap((a) =>
    a.notifications.map((n: NotificationRecord) => {
      const body = store.notificationBodies[n.id];
      return {
        id: n.id,
        alertId: a.id,
        contactId: n.contactId,
        contactName: contactName(n.contactId),
        channel: n.channel,
        sentAt: n.sentAt,
        subject: body?.subject ?? null,
        body: body?.rawToken ? (body.body ?? "").replaceAll(body.rawToken, "[secure link available in preview]") : body?.body ?? "",
        secureLinkAvailable: Boolean(body?.rawToken),
        deliveryStatus: n.deliveryStatus,
        simulated: true,
      };
    })
  );

  const activeCritical = store.alerts.find(
    (a) => a.level === "critical" && (a.status === "open" || a.status === "acknowledged")
  );
  const pendingFall = store.events.find((e) => e.fallPhase === "candidate");

  const nowIso = new Date(nowMs).toISOString();
  const overall = overallLevelOf(store.alerts);

  // The live preview row reflects the selected person's state.
  const carePatients = seedCarePatients(store.user.createdAt).map((p) =>
    p.live
      ? {
          ...p,
          name: store.subject.displayName ?? store.subject.alias,
          age: store.subject.age ?? p.age,
          level: overall,
          reason:
            overall === "stable"
              ? "Activity within normal range"
              : (activeCritical
                  ? "Possible fall — immediate attention needed"
                  : store.alerts.find(
                      (a) =>
                        (a.status === "open" || a.status === "acknowledged") &&
                        (a.level === "important" || a.level === "watch")
                    )?.eventType === "prolonged_inactivity"
                    ? "Abnormal inactivity — 2h 47m (3.1× baseline)"
                    : "Deviation from personal baseline"),
          statusLabel:
            overall === "critical"
              ? "Needs immediate attention"
              : overall === "important"
                ? "Needs review today"
                : overall === "watch"
                  ? "Monitoring"
                  : "Stable",
          lastUpdatedIso: store.devices.map(d => d.lastSyncAt).filter((v): v is string => !!v).sort().at(-1) ?? store.user.createdAt,
        }
      : p
  );
  // 排序：critical > important > watch > stable，同级按名字
  const levelRank: Record<RiskLevel, number> = { critical: 0, important: 1, watch: 2, stable: 3 };
  carePatients.sort((a, b) => levelRank[a.level] - levelRank[b.level] || a.name.localeCompare(b.name));

  return {
    nowMs,
    demoTimeScale: Number(process.env.NEXT_PUBLIC_DEMO_TIME_SCALE ?? 18),
    people: [],
    dataStatus: { source: "simulated", synthetic: true,
      asOf: store.devices.map((d) => d.lastSyncAt).filter((v): v is string => !!v).sort().at(-1) ?? nowIso,
      stale: store.devices.some((d) => !d.online || !d.lastSyncAt || nowMs - Date.parse(d.lastSyncAt) > 15 * 60_000) },
    subject: {
      id: store.subject.id,
      name: store.subject.displayName ?? store.subject.alias,
      alias: store.subject.alias,
      age: store.subject.age,
      timeZone: store.subject.timeZone,
      monitoringPaused: store.subject.monitoringPaused,
    },
    learningProgress: store.baselines.some(b => !b.learned) ? { currentDay: Math.max(0, Math.floor((nowMs - Date.parse(store.baselines.find(b => !b.learned)!.learningSince)) / 86400000)), totalDays: store.baselines.find(b => !b.learned)!.metric === "sleep" ? 28 : 14 } : null,
    overallLevel: overall,
    devices: freshnessOf(store),
    deviceDetails: store.devices.map((d) => ({
      id: d.id,
      type: d.type,
      label: d.label,
      online: d.online,
      worn: d.worn,
      batteryPct: d.batteryPct,
      coveredRooms: d.coveredRooms,
      cameraMode: d.cameraMode,
    })),
    baselines: store.baselines.map((b) => ({
      metric: b.metric,
      learned: b.learned,
      median: b.median,
      p25: b.p25,
      p75: b.p75,
      unit: METRIC_META[b.metric].unit,
      label: METRIC_META[b.metric].label,
    })),
    trends: store.trends,
    metricSummaries: buildMetricSummaries(store),
    events: [...store.events].sort((x, y) => y.occurredAt.localeCompare(x.occurredAt)),
    deviations: store.deviations,
    alerts: [...store.alerts]
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
      .map((a) => ({ ...a, eventLabel: EVENT_LABEL[a.eventType] ?? a.eventType, recommendedAction: recommendedAction(a.eventType) })),
    contacts: [...store.contacts].sort((x, y) => x.escalationOrder - y.escalationOrder),
    notifications: notifications.sort((x, y) => y.sentAt.localeCompare(x.sentAt)),
    auditLog: [...store.auditLog].sort((x, y) => y.at.localeCompare(x.at)),
    subscription: store.subscription,
    kimiSummaries: store.kimiSummaries,
    carePatients,
    activeCriticalAlertId: activeCritical?.id ?? null,
    pendingFallEventId: pendingFall?.id ?? null,
  };
}
