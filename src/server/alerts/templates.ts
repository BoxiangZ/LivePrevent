/**
 * 通知模板 — PRD §7.2（最小化原则）
 * 邮件 / 短信只包含：别名、事件类别、优先级、发生时间（含当地时区）、登录链接。
 * 不包含：心率数值、活动百分比、摄像头细节、诊断性描述。
 * 每条 Critical 消息附免责声明 — PRD §6.5。
 *
 * 本 MVP 中通知为模拟发送（渲染为 NotificationRecord + UI 预览卡片），
 * 不接入真实 Email/SMS 服务商（待决策 — PRD §17 #5）。
 */

import { CRITICAL_LINK_TTL_MIN } from "@/shared/constants";
import { EVENT_TYPE_LABELS } from "@/shared/labels";
import { RISK_LEVEL_META } from "@/shared/types/risk";
import type { Alert, Contact } from "@/shared/types/alert";
import type { Subject } from "@/shared/types/subject";

export const EMERGENCY_DISCLAIMER =
  "If you believe this is an emergency, contact local emergency services now. LivePrevent is not an emergency service.";

export interface RenderedMessage {
  channel: "email" | "sms" | "push";
  subject: string | null; // sms/push 无主题
  body: string;
}

export interface TemplateContext {
  alert: Pick<Alert, "level" | "eventType" | "createdAt">;
  subject: Pick<Subject, "alias" | "timeZone">;
  occurredAtLocal: string; // 已格式化的当地时间，如 "14:32 (Hong Kong time)"
  /** Critical 安全链接（一次性限时 token）— PRD §7.1 */
  secureLink: string | null;
}

export function renderEmailTemplate(ctx: TemplateContext): RenderedMessage {
  const levelLabel = RISK_LEVEL_META[ctx.alert.level].label.toUpperCase();
  const category = EVENT_TYPE_LABELS[ctx.alert.eventType];
  const alias = ctx.subject.alias;

  return {
    channel: "email",
    subject: `[${levelLabel}] LivePrevent — ${ctx.alert.level === "critical" ? "Immediate check-in recommended" : "Review recommended"} for ${alias}`,
    body: [
      ctx.alert.level === "critical"
        ? "LivePrevent recorded a high-priority change. Please check in immediately."
        : "LivePrevent recorded a change. Please review and consider checking in.",
      "",
      `Person: ${alias}`,
      `Priority: ${levelLabel}`,
      `Event: ${category}`,
      `Time: ${ctx.occurredAtLocal}`,
      "",
      "This workspace uses simulated monitoring inputs and user-submitted observations.",
      "Full evidence and recommended next steps are available after sign-in.",
      ctx.secureLink
        ? `Review & acknowledge: ${ctx.secureLink}`
        : "View the event in LivePrevent after sign-in.",
      ...(ctx.secureLink
        ? [`One-time link expires in ${CRITICAL_LINK_TTL_MIN} minutes.`]
        : []),
      "",
      ...(ctx.alert.level === "critical" ? [EMERGENCY_DISCLAIMER] : []),
    ].join("\n"),
  };
}

export function renderSmsTemplate(ctx: TemplateContext): RenderedMessage {
  const category = EVENT_TYPE_LABELS[ctx.alert.eventType];
  const levelLabel = RISK_LEVEL_META[ctx.alert.level].label.toUpperCase();
  const lines = [
    `[${levelLabel}] LivePrevent: ${category} — "${ctx.subject.alias}" at ${ctx.occurredAtLocal}.`,
  ];
  if (ctx.alert.level === "critical") {
    lines.push(
      `Review & acknowledge: ${ctx.secureLink ?? "open LivePrevent"} (expires ${CRITICAL_LINK_TTL_MIN} min).`,
    );
    lines.push(EMERGENCY_DISCLAIMER);
  } else {
    lines.push("Details after sign-in.");
  }
  return { channel: "sms", subject: null, body: lines.join(" ") };
}

export function renderPushTemplate(ctx: TemplateContext): RenderedMessage {
  const category = EVENT_TYPE_LABELS[ctx.alert.eventType];
  const levelLabel = RISK_LEVEL_META[ctx.alert.level].label;
  return {
    channel: "push",
    subject: `[${levelLabel}] ${category} — "${ctx.subject.alias}"`,
    body:
      ctx.alert.level === "critical"
        ? `Immediate attention may be needed at ${ctx.occurredAtLocal}. Tap to review & acknowledge.`
        : `Noticed at ${ctx.occurredAtLocal}. Tap to view details.`,
  };
}

/** 按联系人配置的渠道渲染（voice_call 为 Phase 2，不渲染） */
export function renderForContact(
  ctx: TemplateContext,
  contact: Contact,
): RenderedMessage[] {
  return contact.channels
    .filter((c) => c === "email" || c === "sms" || c === "push")
    .map((c) =>
      c === "email"
        ? renderEmailTemplate(ctx)
        : c === "sms"
          ? renderSmsTemplate(ctx)
          : renderPushTemplate(ctx),
    );
}

/**
 * 最小化内容校验（测试用）— PRD §7.1
 * 渲染结果中不得出现健康数值模式（bpm、%、steps、小时数等）。
 */
export function assertMinimalContent(rendered: RenderedMessage): void {
  const text = `${rendered.subject ?? ""}\n${rendered.body}`;
  const forbidden = [
    /\bbpm\b/i,
    /\d+\s*(%|percent)/i,
    /\d[\d,]*\s*steps/i,
    /\d+(\.\d+)?\s*(hours?|hrs?)\s*of\s*sleep/i,
    /heart rate (is|was|of)\s*\d/i,
  ];
  for (const re of forbidden) {
    if (re.test(text)) {
      throw new Error(
        `Notification violates minimal-content rule (PRD §7.1): matched ${re}`,
      );
    }
  }
}
