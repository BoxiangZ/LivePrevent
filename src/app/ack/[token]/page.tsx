"use client";

/**
 * Critical 安全链接落地页 — PRD §7.1 / §19 步骤 7
 * 联系人 #2 从短信/邮件打开一次性限时链接 → 确认 → 进入事件详情复核。
 * Demo 简化：token 校验在服务端完成；真实产品打开后仍需会话验证。
 */

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useDemo } from "@/components/DemoProvider";

export default function AckPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { snapshot } = useDemo();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 找到该 token 对应的联系人（仅用于展示按钮文案；校验在服务端）
  const notif = snapshot?.notifications.find((n) => n.secureLinkToken === token) ?? null;

  const ack = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/alerts/${notif?.alertId ?? "unknown"}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "token_expired"
            ? "链接已过期（限时 30 分钟 — PRD §7.1）"
            : data.error === "token_already_used"
              ? "该一次性链接已被使用"
              : data.error === "invalid_token"
                ? "无效链接"
                : `确认失败：${data.error ?? res.status}`
        );
        return;
      }
      router.push(`/events/${data.eventId}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 p-8">
      <div className="rounded-xl border border-critical/30 bg-white p-6 text-center shadow-sm">
        <div className="text-3xl" aria-hidden>🔴</div>
        <h1 className="mt-2 text-lg font-bold">LivePrevent — Critical 警报确认</h1>
        <p className="mt-1 text-sm text-gray-500">
          {notif
            ? `您正以 ${notif.contactName} 的身份通过一次性安全链接确认（限时 30 分钟）`
            : "正在校验一次性安全链接…"}
        </p>
        {error ? (
          <div className="mt-4 rounded-md bg-critical/10 px-3 py-2 text-sm text-critical">{error}</div>
        ) : (
          <button
            onClick={ack}
            disabled={submitting || !notif}
            className="mt-4 w-full rounded-md bg-critical px-4 py-2 text-sm font-semibold text-white hover:bg-critical/90 disabled:opacity-40"
          >
            {submitting ? "确认中…" : `Acknowledge${notif ? `（${notif.contactName.split("(")[0].trim()}）` : ""}`}
          </button>
        )}
        <p className="mt-4 text-left text-[11px] leading-relaxed text-gray-400">
          如您认为这是紧急情况，请立即联系当地紧急服务。LivePrevent 不是紧急呼叫服务。
        </p>
      </div>
    </div>
  );
}
