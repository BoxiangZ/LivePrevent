/**
 * Demo 内存 Store — 服务端模块级单例（globalThis 固定，抗 Next.js dev HMR）。
 * 黑客松演示用，无持久化；进程重启后由 reset() 重建。
 * 真实部署需替换为数据库 + 持久化审计日志（PRD §8.4 保留 24 个月）。
 */

import type { Subject } from "@/types/subject";
import type { Device, DataFreshness } from "@/types/device";
import type { Contact, Alert, NotificationRecord, AlertSubscriptionSettings } from "@/types/alert";
import type { MonitoredEvent, TrendMetric } from "@/types/event";
import type { BaselineEntry, TrendPoint, BaselineDeviation } from "@/types/baseline";
import type { AuditLogEntry, AuditAction } from "@/types/audit";
import type { KimiSummary, StructuredFacts } from "@/types/jev";
import type { OneTimeToken, User } from "@/types/account";
import type { Role } from "@/types/subject";
import { TREND_METRICS } from "@/types/event";
import {
  SUBJECT_ID,
  seedUser,
  seedSubject,
  seedDevices,
  seedContacts,
  seedBaselines,
  buildTrendSeries,
  seedPastEvents,
  seedSubscriptions,
  seedConsentAudit,
} from "@/data/seed";

export interface DemoStore {
  user: User;
  subject: Subject;
  devices: Device[];
  contacts: Contact[];
  baselines: BaselineEntry[];
  /** metric → 30 天日粒度趋势（合成） */
  trends: Record<TrendMetric, TrendPoint[]>;
  events: MonitoredEvent[];
  alerts: Alert[];
  notifications: NotificationRecord[];
  /** 渲染后的通知内容预览（模拟发送，UI 展示用；rawToken 仅 Demo 用于渲染可点击安全链接） */
  notificationBodies: Record<
    string,
    { channel: string; subject: string | null; body: string; rawToken: string | null }
  >;
  oneTimeTokens: OneTimeToken[];
  /** tokenHash → tokenId */
  tokenIdByHash: Record<string, string>;
  auditLog: AuditLogEntry[];
  subscription: AlertSubscriptionSettings;
  /** eventId → StructuredFacts（Kimi 输入快照） */
  structuredFacts: Record<string, StructuredFacts>;
  /** eventId → 基线偏离（详情页展示用） */
  deviations: Record<string, BaselineDeviation[]>;
  kimiSummaries: Record<string, KimiSummary>;
  /** 活跃跌倒事件的恢复观察窗是否会"出现恢复活动"（Demo 固定为无恢复） */
  seq: number;
}

export function nextId(store: DemoStore, prefix: string): string {
  store.seq += 1;
  return `${prefix}_${store.seq}`;
}

export function createSeededStore(nowMs: number): DemoStore {
  const nowIso = new Date(nowMs).toISOString();
  const history = seedPastEvents(nowMs);
  const trends = Object.fromEntries(
    TREND_METRICS.map((m) => [m, buildTrendSeries(m, 30, new Date(nowMs))])
  ) as Record<TrendMetric, TrendPoint[]>;

  const learningSince = new Date(nowMs - 40 * 24 * 60 * 60 * 1000).toISOString();

  return {
    user: seedUser(nowIso),
    subject: seedSubject(nowIso),
    devices: seedDevices(nowIso),
    contacts: seedContacts(),
    baselines: seedBaselines(learningSince),
    trends,
    events: [...history.events],
    alerts: [...history.alerts],
    notifications: [],
    notificationBodies: {},
    oneTimeTokens: [],
    tokenIdByHash: {},
    auditLog: [seedConsentAudit(nowIso), ...history.audit],
    subscription: seedSubscriptions(),
    structuredFacts: {},
    deviations: {},
    kimiSummaries: {},
    seq: 100,
  };
}

const GLOBAL_KEY = "__LIVEPREVENT_DEMO_STORE__";

export function getStore(): DemoStore {
  const g = globalThis as unknown as Record<string, DemoStore | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = createSeededStore(Date.now());
  }
  return g[GLOBAL_KEY];
}

export function resetStore(): DemoStore {
  const g = globalThis as unknown as Record<string, DemoStore | undefined>;
  g[GLOBAL_KEY] = createSeededStore(Date.now());
  return g[GLOBAL_KEY];
}

/** 追加审计日志 — 所有警报操作、授权变更、数据访问均写入（PRD §8.5 / §6.4） */
export function appendAudit(
  store: DemoStore,
  entry: {
    at: string;
    actorUserId: string | null;
    actorRole: Role | "system";
    action: AuditAction;
    targetUserId?: string | null;
    targetContactId?: string | null;
    detail?: Record<string, string | number | boolean | null>;
    ip?: string | null;
  }
): AuditLogEntry {
  const full: AuditLogEntry = {
    id: nextId(store, "aud"),
    at: entry.at,
    actorUserId: entry.actorUserId,
    actorRole: entry.actorRole,
    subjectId: SUBJECT_ID,
    action: entry.action,
    targetUserId: entry.targetUserId ?? null,
    targetContactId: entry.targetContactId ?? null,
    detail: entry.detail ?? {},
    ip: entry.ip ?? null,
  };
  store.auditLog.push(full);
  return full;
}

/** 数据新鲜度行 — PRD §5.6："Watch worn · synced 2 min ago │ Camera online (Living room)" */
export function freshnessOf(store: DemoStore): DataFreshness[] {
  return store.devices.map((d) => ({
    deviceId: d.id,
    type: d.type,
    label: d.label,
    online: d.online,
    worn: d.worn,
    lastSyncAt: d.lastSyncAt,
  }));
}
