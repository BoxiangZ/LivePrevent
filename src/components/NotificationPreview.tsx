"use client";

/**
 * 模拟通知预览卡片 — PRD §7.2 模板的可视化（Demo 步骤 5/6）
 * 明确标注"模拟发送"，不接入真实 Email/SMS 服务商（待决策 — PRD §17 #5）。
 */

import Link from "next/link";
import type { NotificationPreview as NP } from "@/lib/demo/snapshot";

const CHANNEL_ICON: Record<string, string> = {
  email: "✉️",
  sms: "💬",
  push: "🔔",
};

export function NotificationPreviewCard({ notification }: { notification: NP }) {
  const n = notification;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <span className="font-medium">
          {CHANNEL_ICON[n.channel] ?? "📨"} {n.channel.toUpperCase()} → {n.contactName}
        </span>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-400">
          simulated
        </span>
      </div>
      {n.subject && <div className="mt-1.5 text-sm font-semibold text-gray-900">{n.subject}</div>}
      <pre className="mt-1 whitespace-pre-wrap font-sans text-xs leading-relaxed text-gray-600">{n.body}</pre>
      {n.secureLinkToken && (
        <Link
          href={`/ack/${n.secureLinkToken}`}
          className="mt-2 inline-block rounded-md bg-critical px-3 py-1 text-xs font-semibold text-white hover:bg-critical/90"
        >
          Review & Acknowledge（安全链接，限时 30 分钟）
        </Link>
      )}
    </div>
  );
}
