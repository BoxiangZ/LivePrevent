"use client";

/**
 * Alerts — PRD §11 #4 / §6.4
 * Open（Critical 优先，含升级倒计时）/ Acknowledged / Resolved；
 * Acknowledge、Resolve（必须选择原因）、误报标记（Resolve 原因之一）。
 */

import { useState } from "react";
import Link from "next/link";
import { useDemo } from "@/components/DemoProvider";
import { RiskBadge } from "@/components/RiskBadge";
import { Countdown } from "@/components/CriticalBanner";
import { EscalationTimeline } from "@/components/EscalationTimeline";
import { NotificationPreviewCard } from "@/components/NotificationPreview";
import { RESOLVE_REASON_LABELS_ZH, ALERT_STATUS_LABELS_ZH } from "@/lib/labels";
import { RESOLVE_REASONS } from "@/types/risk";
import type { SnapshotAlert } from "@/lib/demo/snapshot";

export default function AlertsPage() {
  const { snapshot, msUntil, ackAlert, resolveAlert, busy } = useDemo();
  const [resolving, setResolving] = useState<string | null>(null);
  const [reason, setReason] = useState<string>(RESOLVE_REASONS[0]);
  const [note, setNote] = useState("");

  if (!snapshot) {
    return <div className="mx-auto max-w-5xl p-8 text-sm text-gray-400">Loading…</div>;
  }

  const open = snapshot.alerts.filter((a) => a.status === "open");
  const acked = snapshot.alerts.filter((a) => a.status === "acknowledged");
  const closed = snapshot.alerts.filter((a) => a.status === "resolved" || a.status === "auto_expired");

  const sortBySeverity = (arr: SnapshotAlert[]) =>
    [...arr].sort((x, y) => {
      const rank = { critical: 0, important: 1, watch: 2, stable: 3 } as const;
      return rank[x.level] - rank[y.level];
    });

  const contactName = (id: string | null) =>
    id ? (snapshot.contacts.find((c) => c.id === id)?.name.split("(")[0].trim() ?? id) : "—";

  const doResolve = async (alertId: string) => {
    await resolveAlert(alertId, reason, note || undefined);
    setResolving(null);
    setNote("");
  };

  const AlertRow = ({ a }: { a: SnapshotAlert }) => {
    const nextMs = msUntil(a.escalation.nextStageAt);
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <RiskBadge level={a.level} />
          <span className="font-medium text-gray-900">{a.eventLabel}</span>
          <span className="text-xs text-gray-400">
            {new Date(a.createdAt).toLocaleString("en-GB", { timeZone: snapshot.subject.timeZone })}
          </span>
          {a.levelHistory.length > 1 && (
            <span className="rounded bg-important/10 px-1.5 py-0.5 text-[10px] text-important">
              由 {a.levelHistory[0].level} 升级
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {a.status === "open" && a.level === "critical" && nextMs !== null && nextMs > 0 && (
              <span className="text-xs text-important">
                下一阶段 <Countdown ms={nextMs} />
              </span>
            )}
            {a.status === "open" && (
              <button
                onClick={() => ackAlert(a.id, snapshot.contacts[0]?.id)}
                disabled={busy}
                className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
              >
                Acknowledge
              </button>
            )}
            {(a.status === "open" && a.level !== "critical") || a.status === "acknowledged" ? (
              <button
                onClick={() => setResolving(a.id)}
                disabled={busy}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Resolve…
              </button>
            ) : null}
            <Link href={`/events/${a.eventId}`} className="text-xs text-indigo-600 hover:underline">
              详情 →
            </Link>
          </span>
        </div>

        {a.status !== "open" && (
          <div className="mt-2 text-xs text-gray-500">
            {a.acknowledgedBy && <>确认：{contactName(a.acknowledgedBy)} · </>}
            {a.resolveReason && <>处理：{RESOLVE_REASON_LABELS_ZH[a.resolveReason]}</>}
            {a.status === "auto_expired" && <>自动过期</>}
          </div>
        )}

        {a.level === "critical" && (
          <div className="mt-3">
            <EscalationTimeline alert={a} contacts={snapshot.contacts} msUntil={msUntil} />
          </div>
        )}

        {/* Resolve 弹层（必须选择原因 — PRD §6.4） */}
        {resolving === a.id && (
          <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
            <div className="text-xs font-semibold text-gray-700">处理结果（必选）— 误报反馈将进入阈值校准数据集（PRD §5.7）</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {RESOLVE_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`rounded-md border px-2.5 py-1 text-xs ${
                    reason === r
                      ? "border-indigo-500 bg-indigo-600 text-white"
                      : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {RESOLVE_REASON_LABELS_ZH[r]}
                </button>
              ))}
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="备注（可选）"
              className="mt-2 w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => doResolve(a.id)}
                disabled={busy}
                className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
              >
                确认处理
              </button>
              <button onClick={() => setResolving(null)} className="text-xs text-gray-500 hover:underline">
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-xl font-bold">Alerts</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">待确认（{open.length}）</h2>
        {open.length === 0 && <div className="text-sm text-gray-400">没有待确认警报</div>}
        {sortBySeverity(open).map((a) => (
          <AlertRow key={a.id} a={a} />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">已确认（{acked.length}）</h2>
        {acked.length === 0 && <div className="text-sm text-gray-400">无</div>}
        {sortBySeverity(acked).map((a) => (
          <AlertRow key={a.id} a={a} />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">已处理 / 已关闭（{closed.length}）</h2>
        {closed.map((a) => (
          <AlertRow key={a.id} a={a} />
        ))}
      </section>

      {/* 模拟通知流（Demo 步骤 5/6 可视化） */}
      {snapshot.notifications.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">已发送通知（模拟通道）</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {snapshot.notifications.slice(0, 6).map((n) => (
              <NotificationPreviewCard key={n.id} notification={n} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
