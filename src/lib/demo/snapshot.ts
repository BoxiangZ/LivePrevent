/**
 * Demo 状态快照 — GET /api/demo/state 的返回形状。
 * 所有页面消费同一份快照，客户端 500ms 轮询。
 * 倒计时以快照中的 nowMs 为基准计算，避免客户端/服务端时钟偏差。
 */

import type { DemoStore } from "@/lib/demo/store";
import { freshnessOf } from "@/lib/demo/store";
import type { Alert, Contact, NotificationRecord } from "@/types/alert";
import type { AuditLogEntry } from "@/types/audit";
import type { DataFreshness } from "@/types/device";
import type { MonitoredEvent, TrendMetric } from "@/types/event";
import type { RiskLevel } from "@/types/risk";
import type { TrendPoint, BaselineDeviation } from "@/types/baseline";
import type { KimiSummary } from "@/types/jev";
import type { AlertSubscriptionSettings } from "@/types/alert";

export interface NotificationPreview {
  id: string;
  alertId: string;
  contactId: string;
  contactName: string;
  channel: string;
  sentAt: string;
  subject: string | null;
  body: string;
  secureLinkToken: string | null; // 原始 token（仅 Demo 展示用，真实产品不出现在 API）
}

export interface SnapshotAlert extends Alert {
  eventLabel: string;
}

export interface DemoStateSnapshot {
  nowMs: number;
  demoTimeScale: number;
  subject: {
    id: string;
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
  baselines: Array<{
    metric: TrendMetric;
    learned: boolean;
    median: number | null;
  }>;
  trends: Record<TrendMetric, TrendPoint[]>;
  events: MonitoredEvent[];
  deviations: Record<string, BaselineDeviation[]>;
  alerts: SnapshotAlert[];
  contacts: Contact[];
  notifications: NotificationPreview[];
  auditLog: AuditLogEntry[];
  subscription: AlertSubscriptionSettings;
  kimiSummaries: Record<string, KimiSummary>;
  /** 活跃（open）的 Critical 警报，驱动全局红色横幅 — PRD §3.1 */
  activeCriticalAlertId: string | null;
  /** 处于恢复观察窗内的事件（Overview 展示观察窗倒计时） */
  pendingFallEventId: string | null;
}

const EVENT_LABEL: Record<string, string> = {
  possible_fall: "Possible fall",
  prolonged_inactivity: "Long sitting period",
  heart_rate_deviation: "Heart rate deviation",
  activity_drop: "Activity below baseline",
  device_data_gap: "Data gap",
};

function overallLevelOf(alerts: Alert[]): RiskLevel {
  const open = alerts.filter((a) => a.status === "open" || a.status === "acknowledged");
  if (open.some((a) => a.level === "critical")) return "critical";
  if (open.some((a) => a.level === "important")) return "important";
  if (open.some((a) => a.level === "watch")) return "watch";
  return "stable";
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
        body: body?.body ?? "",
        // 仅 Demo：把一次性 token 暴露给 UI 以渲染可点击安全链接；真实产品 token 只出现在通知正文
        secureLinkToken: body?.rawToken ?? null,
      };
    })
  );

  const activeCritical = store.alerts.find(
    (a) => a.level === "critical" && (a.status === "open" || a.status === "acknowledged")
  );
  const pendingFall = store.events.find((e) => e.fallPhase === "candidate");

  return {
    nowMs,
    demoTimeScale: Number(process.env.NEXT_PUBLIC_DEMO_TIME_SCALE ?? 18),
    subject: {
      id: store.subject.id,
      alias: store.subject.alias,
      age: store.subject.age,
      timeZone: store.subject.timeZone,
      monitoringPaused: store.subject.monitoringPaused,
    },
    learningProgress: null, // Demo 中基线已学完
    overallLevel: overallLevelOf(store.alerts),
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
    })),
    trends: store.trends,
    events: [...store.events].sort((x, y) => y.occurredAt.localeCompare(x.occurredAt)),
    deviations: store.deviations,
    alerts: [...store.alerts]
      .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
      .map((a) => ({ ...a, eventLabel: EVENT_LABEL[a.eventType] ?? a.eventType })),
    contacts: [...store.contacts].sort((x, y) => x.escalationOrder - y.escalationOrder),
    notifications: notifications.sort((x, y) => y.sentAt.localeCompare(x.sentAt)),
    auditLog: [...store.auditLog].sort((x, y) => y.at.localeCompare(x.at)).slice(0, 50),
    subscription: store.subscription,
    kimiSummaries: store.kimiSummaries,
    activeCriticalAlertId: activeCritical?.id ?? null,
    pendingFallEventId: pendingFall?.id ?? null,
  };
}
