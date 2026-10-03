"use client";

/**
 * 真实感邮件预览 — 模拟家属收件箱里收到的邮件。
 * 用于事件详情页 / Alerts 页"View notification"，以及 demo 讲解步骤 7。
 */

import { useEffect, useState } from "react";
import type { NotificationPreview } from "@/server/snapshot";
import { cn } from "@/client/cn";
import { useDemo } from "@/client/provider/DemoProvider";

export function EmailPreviewModal({
  notification,
  onClose,
}: {
  notification: NotificationPreview | null;
  onClose: () => void;
}) {
  const { selectedPersonId } = useDemo();
  const [actionUrl, setActionUrl] = useState<string | null>(null);
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  useEffect(() => {
    if (!notification?.secureLinkAvailable) {
      setActionUrl(null);
      setPreviewBody(null);
      return;
    }
    fetch(
      `/api/demo/notifications/${encodeURIComponent(notification.id)}?personId=${encodeURIComponent(selectedPersonId)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        setActionUrl(body?.actionUrl ?? null);
        setPreviewBody(body?.body ?? null);
      })
      .catch(() => {
        setActionUrl(null);
        setPreviewBody(null);
      });
  }, [notification?.id, notification?.secureLinkAvailable, selectedPersonId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!notification) return null;
  const isCritical = notification.subject?.includes("[CRITICAL]") ?? false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 邮件客户端头部 */}
        <div className="border-b border-surface-line bg-surface-soft px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                LP
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">
                  LivePrevent Alerts
                </div>
                <div className="text-[11px] text-ink-mute">
                  alerts@liveprevent.demo
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-ink-mute hover:bg-surface-line"
              aria-label="Close"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10 8.6L5.7 4.3 4.3 5.7 8.6 10l-4.3 4.3 1.4 1.4L10 11.4l4.3 4.3 1.4-1.4L11.4 10l4.3-4.3-1.4-1.4L10 8.6z" />
              </svg>
            </button>
          </div>
          <div className="mt-2.5 text-[13px]">
            <span className="text-ink-mute">To:</span>{" "}
            <span className="text-ink">{notification.contactName}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            {isCritical ? (
              <span className="rounded bg-critical px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Critical
              </span>
            ) : (
              <span className="rounded bg-important px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Moderate
              </span>
            )}
            <h3 className="text-sm font-semibold text-ink">
              {notification.subject}
            </h3>
          </div>
        </div>

        {/* 邮件正文 */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-soft">
            {previewBody ?? notification.body}
          </pre>

          {actionUrl && (
            <div className="mt-4">
              <a
                href={actionUrl}
                className={cn(
                  "inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white",
                  isCritical
                    ? "bg-critical hover:bg-critical/90"
                    : "bg-brand-600 hover:bg-brand-700",
                )}
              >
                Review &amp; acknowledge
              </a>
              <p className="mt-1.5 text-[11px] text-ink-mute">
                One-time secure link · expires 30 minutes after sending
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-surface-line bg-surface-soft px-5 py-2.5 text-[11px] text-ink-mute">
          {new Date(notification.sentAt).toLocaleString("en-GB")} ·{" "}
          {notification.simulated
            ? "Simulated preview · no external delivery"
            : `${notification.deliveryStatus === "sent" ? "Sent · accepted by provider" : notification.deliveryStatus} · real email`}
          {notification.error && ` · ${notification.error}`}
        </div>
      </div>
    </div>
  );
}
