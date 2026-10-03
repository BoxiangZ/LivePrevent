/** Local, synthetic demo repository. Every monitored person has isolated state. */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { Subject } from "@/shared/types/subject";
import type { Device, DataFreshness } from "@/shared/types/device";
import type { Contact, Alert, NotificationRecord, AlertSubscriptionSettings } from "@/shared/types/alert";
import type { MonitoredEvent, TrendMetric } from "@/shared/types/event";
import type { BaselineEntry, TrendPoint, BaselineDeviation } from "@/shared/types/baseline";
import type { AuditLogEntry, AuditAction } from "@/shared/types/audit";
import type { KimiSummary, StructuredFacts } from "@/shared/types/jev";
import type { JevProbabilities } from "@/shared/types/jev";
import type { OneTimeToken, User } from "@/shared/types/account";
import type { Role } from "@/shared/types/subject";
import { TREND_METRICS } from "@/shared/types/event";
import {
  SUBJECT_ID,
  seedUser,
  seedSubject,
  seedDevices,
  seedContacts,
  seedBaselines,
  buildTrendSeries,
  TREND_DAYS,
  seedPastEvents,
  seedSubscriptions,
  seedConsentAudit,
} from "@/server/data/seed";

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
  decisionProbabilities: Record<string, JevProbabilities>;
  decisionInsufficientData: Record<string, boolean>;
  /** 活跃跌倒事件的恢复观察窗是否会"出现恢复活动"（Demo 固定为无恢复） */
  seq: number;
}

export const DEFAULT_PERSON_ID = SUBJECT_ID;
const SECOND_PERSON_ID = "sub_evelyn";
const DB_PATH = join(process.cwd(), "mockdata", "liveprevent.sqlite");

export interface DemoRun {
  id: string;
  personId: string;
  idempotencyKey: string;
  submittedAt: string;
  input: unknown;
  eventId: string | null;
  alertId: string | null;
  level: string;
  probabilities: JevProbabilities | null;
  ruleApplied: string;
}

let database: DatabaseSync | null = null;

function db(): DatabaseSync {
  if (database) return database;
  mkdirSync(join(process.cwd(), "mockdata"), { recursive: true });
  const connection = new DatabaseSync(DB_PATH);
  connection.exec(`
    CREATE TABLE IF NOT EXISTS people (id TEXT PRIMARY KEY, state TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS demo_runs (
      id TEXT PRIMARY KEY, person_id TEXT NOT NULL, idempotency_key TEXT NOT NULL,
      payload TEXT NOT NULL, UNIQUE(person_id, idempotency_key)
    );
  `);
  database = connection;
  if ((connection.prepare("SELECT COUNT(*) AS count FROM people").get() as { count: number }).count === 0) {
    const now = Date.now();
    saveStore(createSeededStore(now), connection);
    saveStore(createSecondStore(now), connection);
  }
  return connection;
}

export function nextId(store: DemoStore, prefix: string): string {
  store.seq += 1;
  return `${prefix}_${store.subject.id}_${store.seq}`;
}

export function createSeededStore(nowMs: number): DemoStore {
  const nowIso = new Date(nowMs).toISOString();
  const history = seedPastEvents(nowMs);
  const trends = Object.fromEntries(
    TREND_METRICS.map((m) => [m, buildTrendSeries(m, TREND_DAYS, new Date(nowMs))])
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
    decisionProbabilities: {},
    decisionInsufficientData: {},
    seq: 100,
  };
}

function createSecondStore(nowMs: number): DemoStore {
  const store = createSeededStore(nowMs);
  store.subject.id = SECOND_PERSON_ID;
  store.subject.alias = "Evelyn";
  store.subject.displayName = "Evelyn Lee";
  store.subject.age = 79;
  store.subject.consent = store.subject.consent
    ? { ...store.subject.consent, id: "consent_evelyn", subjectId: SECOND_PERSON_ID }
    : null;
  store.user.rolesBySubject = { [SECOND_PERSON_ID]: "primary_family" };
  store.devices = store.devices.map((device) => ({
    ...device, id: `${device.id}_evelyn`, subjectId: SECOND_PERSON_ID,
  }));
  store.contacts = store.contacts.map((contact) => ({
    ...contact, id: `${contact.id}_evelyn`, subjectId: SECOND_PERSON_ID,
    name: contact.escalationOrder === 1 ? "Jamie Lee" : "Local neighbour",
  }));
  store.subscription.subjectId = SECOND_PERSON_ID;
  store.events = [];
  store.alerts = [];
  store.auditLog = store.auditLog.map((entry) => ({ ...entry, subjectId: SECOND_PERSON_ID }));
  store.baselines = store.baselines.map((baseline) => ({ ...baseline }));
  return store;
}

export function listPeople(): Array<{ id: string; label: string; alias: string; overallLevel: string; openAlertCount: number }> {
  const rows = db().prepare("SELECT state FROM people ORDER BY id").all() as Array<{ state: string }>;
  return rows.map(({ state }) => {
    const store = JSON.parse(state) as DemoStore;
    const open = store.alerts.filter((a) => a.status === "open" || a.status === "acknowledged");
    const level = open.some((a) => a.level === "critical") ? "critical"
      : open.some((a) => a.level === "important") ? "important"
      : open.some((a) => a.level === "watch") ? "watch" : "stable";
    return { id: store.subject.id, label: store.subject.displayName ?? store.subject.alias,
      alias: store.subject.alias, overallLevel: level, openAlertCount: open.length };
  });
}

export function getStore(personId = DEFAULT_PERSON_ID): DemoStore | null {
  const row = db().prepare("SELECT state FROM people WHERE id = ?").get(personId) as { state: string } | undefined;
  if (!row) return null;
  const store = JSON.parse(row.state) as DemoStore;
  // Earlier synthetic seeds used a fixed name inside historical resolution notes.
  for (const alert of store.alerts) {
    if (alert.resolveNote === "Called Margaret — she was resting after a poor night. Confirmed OK.")
      alert.resolveNote = "Called the selected person — resting after a poor night. Confirmed OK.";
    if (alert.resolveNote === "Margaret had been climbing stairs — heart rate recovered within minutes.")
      alert.resolveNote = "The selected person had been climbing stairs — heart rate recovered within minutes.";
  }
  return store;
}

export function saveStore(store: DemoStore, connection = db()): void {
  connection.prepare("INSERT INTO people (id, state) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET state=excluded.state")
    .run(store.subject.id, JSON.stringify(store));
}

export function resetStore(personId = DEFAULT_PERSON_ID): DemoStore | null {
  if (!getStore(personId)) return null;
  const store = personId === SECOND_PERSON_ID ? createSecondStore(Date.now()) : createSeededStore(Date.now());
  saveStore(store);
  db().prepare("DELETE FROM demo_runs WHERE person_id = ?").run(personId);
  return store;
}

export function findStoreByAlertId(alertId: string): DemoStore | null {
  for (const person of listPeople()) {
    const store = getStore(person.id);
    if (store?.alerts.some((a) => a.id === alertId)) return store;
  }
  return null;
}

export function findStoreByEventId(eventId: string): DemoStore | null {
  for (const person of listPeople()) {
    const store = getStore(person.id);
    if (store?.events.some((e) => e.id === eventId)) return store;
  }
  return null;
}

export function getRun(personId: string, idempotencyKey: string): DemoRun | null {
  const row = db().prepare("SELECT payload FROM demo_runs WHERE person_id = ? AND idempotency_key = ?")
    .get(personId, idempotencyKey) as { payload: string } | undefined;
  return row ? (JSON.parse(row.payload) as DemoRun) : null;
}

export function saveRun(run: DemoRun): void {
  db().prepare("INSERT INTO demo_runs (id, person_id, idempotency_key, payload) VALUES (?, ?, ?, ?)")
    .run(run.id, run.personId, run.idempotencyKey, JSON.stringify(run));
}

export function listRuns(personId: string): DemoRun[] {
  return (db().prepare("SELECT payload FROM demo_runs WHERE person_id = ? ORDER BY rowid DESC LIMIT 30")
    .all(personId) as Array<{ payload: string }>).map((row) => JSON.parse(row.payload) as DemoRun);
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
    subjectId: store.subject.id,
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
