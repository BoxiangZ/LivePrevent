/**
 * 演示引擎 — 纯函数 advance(store, nowMs)，在每个 API 路由入口调用（懒求值，无需 setInterval）。
 * 顺序：
 *  1. 跌倒恢复观察窗到期且无恢复 → 重跑 JEV（fallPhase=unrecovered）→ 升级 Critical → 启动升级链 T+0
 *     （若观察窗内出现恢复活动 → 降级 Watch — PRD §5.2；Demo 固定无恢复）
 *  2. 升级链下一阶段到期且未确认 → 发送该阶段通知（T+5 / T+15 / T+30，已按 DEMO_TIME_SCALE 加速）
 *  3. T+30 后 → 标记 Unacknowledged，每 15 分钟（加速后）重复提醒
 *  4. Watch / Important 超时无新信号 → Auto-expired（PRD §6.4；Critical 不自动过期）
 *
 * 本模块只依赖纯函数与 store 结构，可用假时钟做单元测试。
 */

import { createHash, randomBytes } from "crypto";
import {
  DEMO_RECOVERY_WINDOW_SEC,
  DEMO_TIME_SCALE,
  CRITICAL_LINK_TTL_MIN,
  AUTO_EXPIRE_WATCH_MIN,
  AUTO_EXPIRE_IMPORTANT_MIN,
} from "@/shared/constants";
import { decideLevel, demoFallProbabilities } from "@/server/jev/decide";
import {
  computeEscalationSchedule,
  contactsForStage,
  nextEscalationStage,
  repeatReminderMs,
  stageAtMs,
} from "@/server/alerts/escalation";
import { renderEmailTemplate, renderSmsTemplate, renderPushTemplate } from "@/server/alerts/templates";
import type { DemoStore } from "@/server/store";
import { appendAudit, nextId } from "@/server/store";
import type { Alert, Contact, EscalationStage } from "@/shared/types/alert";
import type { NotificationChannel } from "@/shared/types/alert";

/** token 哈希（Demo 用 Node crypto；等价于生产侧的哈希存储） */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function makeToken(store: DemoStore): { token: string; hash: string } {
  const token = `tok_${nextId(store, "raw")}_${randomBytes(12).toString("hex")}`;
  return { token, hash: hashToken(token) };
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

/** 发送一条（模拟）通知并记录 — 模板即时发送，不等待 Kimi（PRD §10.3） */
export function sendNotification(
  store: DemoStore,
  alert: Alert,
  contact: Contact,
  channel: NotificationChannel,
  nowIso: string,
  kind: "initial" | "escalation" | "reminder"
): void {
  if (channel === "voice_call") return; // Phase 2 — PRD §6.1

  let secureLink: string | null = null;
  let rawToken: string | null = null;
  let tokenId: string | null = null;
  let tokenExpiresAt: string | null = null;

  if (alert.level === "critical") {
    // Critical 深度链接：一次性、限时 token — PRD §7.1
    const { token, hash } = makeToken(store);
    rawToken = token;
    tokenId = nextId(store, "ott");
    tokenExpiresAt = new Date(Date.parse(nowIso) + CRITICAL_LINK_TTL_MIN * 60 * 1000).toISOString();
    store.oneTimeTokens.push({
      id: tokenId,
      tokenHash: hash,
      alertId: alert.id,
      contactId: contact.id,
      issuedAt: nowIso,
      expiresAt: tokenExpiresAt,
      consumedAt: null,
      sessionVerified: false,
    });
    store.tokenIdByHash[hash] = tokenId;
    secureLink = `/ack/${token}`;
  }

  const ctx = {
    alert,
    subject: store.subject,
    occurredAtLocal: formatLocalTime(alert.createdAt, store.subject.timeZone),
    secureLink,
  };
  const rendered =
    channel === "email"
      ? renderEmailTemplate(ctx)
      : channel === "sms"
        ? renderSmsTemplate(ctx)
        : renderPushTemplate(ctx);

  const notifId = nextId(store, "ntf");
  alert.notifications.push({
    id: notifId,
    alertId: alert.id,
    contactId: contact.id,
    channel,
    sentAt: nowIso,
    deliveryStatus: "delivered", // 模拟发送：直接标记送达；真实环境需通道送达监控 — PRD §18
    oneTimeTokenId: tokenId,
    oneTimeTokenExpiresAt: tokenExpiresAt,
  });
  store.notificationBodies[notifId] = {
    channel,
    subject: rendered.subject,
    body: rendered.body,
    rawToken,
  };
  appendAudit(store, {
    at: nowIso,
    actorUserId: null,
    actorRole: "system",
    action: "notification_sent",
    targetContactId: contact.id,
    detail: { alertId: alert.id, channel, kind },
  });
}

function notifyContactAllChannels(
  store: DemoStore,
  alert: Alert,
  contact: Contact,
  nowIso: string,
  kind: "initial" | "escalation" | "reminder"
): void {
  for (const ch of contact.channels) {
    sendNotification(store, alert, contact, ch, nowIso, kind);
  }
}

/** 启动 Critical 升级链（T+0） */
export function startEscalation(store: DemoStore, alert: Alert, nowMs: number): void {
  const nowIso = new Date(nowMs).toISOString();
  alert.escalation = computeEscalationSchedule(alert.id, alert.subjectId, nowMs, DEMO_TIME_SCALE);
  const sorted = [...store.contacts].sort((a, b) => a.escalationOrder - b.escalationOrder);
  const { notify } = contactsForStage("t0_notify_primary", sorted);
  for (const c of notify) notifyContactAllChannels(store, alert, c, nowIso, "initial");
  alert.escalation.stageLog.push({
    stage: "t0_notify_primary",
    at: nowIso,
    notifiedContactIds: notify.map((c) => c.id),
    remindedContactIds: [],
  });
  appendAudit(store, {
    at: nowIso,
    actorUserId: null,
    actorRole: "system",
    action: "alert_escalated",
    detail: { alertId: alert.id, stage: "t0_notify_primary" },
  });
}

/** Important 级警报创建时即时通知（Email + Push，无 SMS、无升级链）— PRD §3.1 */
function sendImportantInitialNotifications(store: DemoStore, alert: Alert, nowIso: string): void {
  if (alert.level !== "important" || alert.status !== "open") return;
  if (alert.notifications.length > 0) return; // 只发一次
  // 跌倒候选（恢复观察窗内）暂不发 — 升级 Critical 后由升级链统一通知，避免重复
  if (alert.eventType === "possible_fall") return;
  const sorted = [...store.contacts].sort((a, b) => a.escalationOrder - b.escalationOrder);
  const primary = sorted[0];
  if (!primary) return;
  for (const ch of primary.channels) {
    if (ch === "sms") continue; // Important 默认不发短信
    sendNotification(store, alert, primary, ch, nowIso, "initial");
  }
}

/** 每 tick 调用。返回本 tick 发生的迁移描述（调试/测试用）。 */
export function advance(store: DemoStore, nowMs: number): string[] {
  const transitions: string[] = [];
  const nowIso = new Date(nowMs).toISOString();

  // ── 0. Important 即时通知（无升级链）──
  for (const alert of store.alerts) {
    if (alert.level === "important" && alert.status === "open" && alert.notifications.length === 0) {
      sendImportantInitialNotifications(store, alert, nowIso);
      transitions.push(`alert ${alert.id}: important initial notifications sent`);
    }
  }

  // ── 1. 跌倒恢复观察窗到期 — PRD §5.2 ──
  for (const event of store.events) {
    if (event.fallPhase !== "candidate" || !event.recoveryWindowEndsAt) continue;
    if (Date.parse(event.recoveryWindowEndsAt) > nowMs) continue;

    // Demo 固定"无恢复活动"（真实实现会检查窗内是否出现站起/走动信号）
    event.fallPhase = "unrecovered";
    transitions.push(`event ${event.id}: recovery window ended, no recovery → unrecovered`);

    const alert = store.alerts.find((a) => a.eventId === event.id && a.status === "open");
    if (!alert) continue;

    const out = decideLevel(
      {
        eventId: event.id,
        subjectId: event.subjectId,
        eventType: event.type,
        signals: event.signals,
        fallPhase: "unrecovered",
        independentChannelCount: event.independentChannelCount,
        insufficientData: false,
        baselineLearned: true,
        deviceOfflineSuppressed: false,
      },
      {
        probabilities: demoFallProbabilities(),
        structuredFacts: store.structuredFacts[event.id],
        monitoringPaused: store.subject.monitoringPaused,
        watchEmailEnabled: store.subscription.watchEmailEnabled,
      }
    );

    if (out.level === "critical" && alert.level !== "critical") {
      alert.level = "critical";
      alert.levelHistory.push({ level: "critical", at: nowIso, trigger: "recovery_window_no_activity" });
      transitions.push(`alert ${alert.id}: upgraded to Critical, escalation started`);
      startEscalation(store, alert, nowMs);
    }
  }

  // ── 2./3. 升级链推进 — PRD §6.3 ──
  for (const alert of store.alerts) {
    if (alert.status !== "open" || alert.level !== "critical") continue;
    const esc = alert.escalation;
    if (!esc.nextStageAt || !esc.currentStage) continue;
    if (Date.parse(esc.nextStageAt) > nowMs) continue;

    const sorted = [...store.contacts].sort((a, b) => a.escalationOrder - b.escalationOrder);

    if (esc.unacknowledged) {
      // T+30 后重复提醒全员 — PRD §6.3
      for (const c of sorted) notifyContactAllChannels(store, alert, c, nowIso, "reminder");
      esc.nextStageAt = new Date(nowMs + repeatReminderMs(DEMO_TIME_SCALE)).toISOString();
      esc.stageLog.push({
        stage: "t30_unacknowledged",
        at: nowIso,
        notifiedContactIds: sorted.map((c) => c.id),
        remindedContactIds: [],
      });
      transitions.push(`alert ${alert.id}: repeat reminder to all contacts`);
      continue;
    }

    const next = nextEscalationStage(esc.currentStage);
    if (!next) continue;

    const { notify, remind } = contactsForStage(next, sorted);
    for (const c of notify) notifyContactAllChannels(store, alert, c, nowIso, "escalation");
    for (const c of remind) notifyContactAllChannels(store, alert, c, nowIso, "reminder");

    esc.currentStage = next;
    esc.stageLog.push({
      stage: next,
      at: nowIso,
      notifiedContactIds: notify.map((c) => c.id),
      remindedContactIds: remind.map((c) => c.id),
    });
    appendAudit(store, {
      at: nowIso,
      actorUserId: null,
      actorRole: "system",
      action: "alert_escalated",
      detail: { alertId: alert.id, stage: next },
    });
    transitions.push(`alert ${alert.id}: escalation stage ${next} fired`);

    if (next === "t30_unacknowledged") {
      esc.unacknowledged = true;
      esc.repeatReminderEveryMin = 15;
      esc.nextStageAt = new Date(nowMs + repeatReminderMs(DEMO_TIME_SCALE)).toISOString();
    } else {
      const after = nextEscalationStage(next);
      esc.nextStageAt = after
        ? new Date(stageAtMs(Date.parse(alert.createdAt), after, DEMO_TIME_SCALE)).toISOString()
        : null;
    }
  }

  // ── 4. Watch / Important 自动过期 — PRD §6.4 ──
  for (const alert of store.alerts) {
    if (alert.status !== "open") continue;
    if (alert.level !== "watch" && alert.level !== "important") continue; // Critical 不自动过期
    // 处于升级链中的（如跌倒 capped Important）不过期
    if (alert.eventType === "possible_fall") continue;
    const expireMin = alert.level === "watch" ? AUTO_EXPIRE_WATCH_MIN : AUTO_EXPIRE_IMPORTANT_MIN;
    if (Date.parse(alert.createdAt) + expireMin * 60 * 1000 <= nowMs) {
      alert.status = "auto_expired";
      alert.autoExpiredAt = nowIso;
      appendAudit(store, {
        at: nowIso,
        actorUserId: null,
        actorRole: "system",
        action: "alert_auto_expired",
        detail: { alertId: alert.id, level: alert.level },
      });
      transitions.push(`alert ${alert.id}: auto-expired`);
    }
  }

  return transitions;
}

export { DEMO_RECOVERY_WINDOW_SEC };
