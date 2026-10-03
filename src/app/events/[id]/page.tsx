"use client";

/**
 * 事件详情 / 复核页 — PRD §7 / §10 / §19 步骤 7
 * 支持信号、与个人基线对比（相对值）、30 天趋势（含事件标记与合成标注）、
 * Kimi 摘要（固定四段结构 + "基于结构化事实生成"标注 + 来源徽标）、
 * 建议的下一步（仅通用动作）、关联警报状态与操作、审计轨迹。
 */

import { use, useEffect } from "react";
import { useDemo } from "@/components/DemoProvider";
import { RiskBadge } from "@/components/RiskBadge";
import { TrendChart } from "@/components/TrendChart";
import { EscalationTimeline } from "@/components/EscalationTimeline";
import { NotificationPreviewCard } from "@/components/NotificationPreview";
import { SIGNAL_SOURCE_LABELS, TREND_METRIC_LABELS, RESOLVE_REASON_LABELS_ZH } from "@/lib/labels";
import type { TrendMetric } from "@/types/event";

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { snapshot, msUntil, ackAlert, resolveAlert, requestKimiSummary, busy } = useDemo();

  const alert = snapshot?.alerts.find((a) => a.eventId === id) ?? null;
  const event = snapshot?.events.find((e) => e.id === id) ?? null;
  const kimi = snapshot?.kimiSummaries[id] ?? null;

  // Kimi 摘要异步生成：进入详情页后请求（警报链路从不等待它 — PRD §10.3）
  const hasFacts = Boolean(snapshot && event && event.type === "possible_fall");
  useEffect(() => {
    if (hasFacts && !kimi && !busy) {
      requestKimiSummary(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFacts, id, kimi === null]);

  if (!snapshot) {
    return <div className="mx-auto max-w-5xl p-8 text-sm text-gray-400">Loading…</div>;
  }
  if (!event || !alert) {
    return <div className="mx-auto max-w-5xl p-8 text-sm text-gray-400">未找到该事件</div>;
  }

  const deviations = snapshot.deviations[id] ?? [];
  const occurredLocal = new Date(event.occurredAt).toLocaleString("en-GB", {
    timeZone: snapshot.subject.timeZone,
  });
  const markerDate = event.occurredAt.slice(0, 10);
  const contactName = (cid: string | null) =>
    cid ? (snapshot.contacts.find((c) => c.id === cid)?.name.split("(")[0].trim() ?? cid) : "—";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* 头部 */}
      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-5">
        <RiskBadge level={alert.level} large />
        <div className="flex-1">
          <h1 className="text-xl font-bold">{alert.eventLabel}</h1>
          <div className="text-sm text-gray-500">
            {snapshot.subject.alias} · {occurredLocal}（{snapshot.subject.timeZone}）
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {alert.status === "open" && (
            <>
              {snapshot.contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => ackAlert(alert.id, c.id)}
                  disabled={busy}
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                >
                  Acknowledge as {c.name.split("(")[0].trim()}
                </button>
              ))}
            </>
          )}
          {(alert.status === "acknowledged" || (alert.status === "open" && alert.level !== "critical")) && (
            <button
              onClick={() => resolveAlert(alert.id, "real_event_handled")}
              disabled={busy}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Resolve（真实事件已处理）
            </button>
          )}
        </div>
      </section>

      {/* 等级变化（两阶段判定可视化 — PRD §5.2） */}
      {alert.levelHistory.length > 1 && (
        <section className="rounded-xl border border-important/30 bg-important/5 p-4 text-sm">
          <span className="font-semibold text-important">两阶段判定：</span>
          {alert.levelHistory.map((h, i) => (
            <span key={i} className="ml-2 text-gray-600">
              {i > 0 && "→ "}
              {h.level}
              {h.trigger === "recovery_window_no_activity" && "（恢复观察窗内无活动）"}
            </span>
          ))}
        </section>
      )}

      {/* 支持信号 — 可解释性（PRD §5.3 evidence） */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700">支持信号（{event.independentChannelCount} 个独立通道）</h2>
        <ul className="mt-3 space-y-2">
          {event.signals.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                {SIGNAL_SOURCE_LABELS[s.source]}
              </span>
              <span className="text-gray-800">{s.description}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 与基线对比（相对值，不含绝对健康数值 — PRD §7） */}
      {deviations.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700">与个人基线对比</h2>
          <div className="mt-3 divide-y divide-gray-100">
            {deviations.map((d) => (
              <div key={d.metric} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-gray-600">{TREND_METRIC_LABELS[d.metric as TrendMetric] ?? d.metric}</span>
                <span className={d.direction === "down" ? "text-important" : "text-watch"}>
                  {d.direction === "down" ? "↓" : "↑"} {Math.abs(Math.round(d.relativeChange * 100))}% vs baseline
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 30 天趋势（含事件标记，合成数据标注） */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">过去 30 天相关趋势</h2>
          <span className="text-[10px] uppercase tracking-wide text-gray-400">synthetic · 合成数据</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {snapshot.baselines.map((b) => (
            <div key={b.metric} className="rounded-lg border border-gray-100 p-3">
              <div className="text-xs font-medium text-gray-600">{TREND_METRIC_LABELS[b.metric]}</div>
              <TrendChart
                points={snapshot.trends[b.metric] ?? []}
                median={b.median}
                markerDate={markerDate}
                synthetic
              />
            </div>
          ))}
        </div>
      </section>

      {/* Kimi 摘要 — 固定四段结构（PRD §10.2），异步生成，可降级 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">AI 摘要</h2>
          {kimi && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                kimi.source === "llm" ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-500"
              }`}
            >
              {kimi.source === "llm" ? "Kimi 生成" : "模板降级"} · 基于结构化事实生成 · 不参与风险判定
            </span>
          )}
        </div>
        {kimi ? (
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-800">
            <div>
              <div className="text-xs font-semibold text-gray-500">事件</div>
              <p>{kimi.eventSummary}</p>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">与基线对比</div>
              <p>{kimi.baselineComparison}</p>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">相关变化</div>
              <p>{kimi.relatedChanges}</p>
            </div>
            <div className="rounded-lg bg-indigo-50/60 p-3">
              <div className="text-xs font-semibold text-indigo-600">建议的下一步</div>
              <p>{kimi.suggestedNextStep}</p>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-gray-400">
            {hasFacts ? "摘要生成中…（警报链路不等待摘要 — PRD §10.3）" : "该事件无可生成摘要的结构化事实"}
          </div>
        )}
      </section>

      {/* 升级链 + 通知记录 */}
      {alert.level === "critical" && (
        <EscalationTimeline alert={alert} contacts={snapshot.contacts} msUntil={msUntil} />
      )}
      {alert.notifications.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">通知记录（模拟通道 · 最小化内容 — PRD §7）</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {snapshot.notifications
              .filter((n) => n.alertId === alert.id)
              .map((n) => (
                <NotificationPreviewCard key={n.id} notification={n} />
              ))}
          </div>
        </section>
      )}

      {/* 审计轨迹 — PRD §8.5 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700">审计轨迹</h2>
        <div className="mt-3 space-y-1.5 text-xs text-gray-600">
          {snapshot.auditLog
            .filter((e) => String(e.detail.alertId ?? "") === alert.id)
            .reverse()
            .map((e) => (
              <div key={e.id} className="flex gap-3">
                <span className="font-mono text-gray-400">
                  {new Date(e.at).toLocaleTimeString("en-GB", { timeZone: snapshot.subject.timeZone })}
                </span>
                <span className="font-medium">{e.action}</span>
                <span className="text-gray-400">
                  {e.actorRole}
                  {e.targetContactId ? ` → ${contactName(e.targetContactId)}` : ""}
                  {e.detail.reason ? ` · ${RESOLVE_REASON_LABELS_ZH[e.detail.reason as keyof typeof RESOLVE_REASON_LABELS_ZH] ?? e.detail.reason}` : ""}
                </span>
              </div>
            ))}
        </div>
        <div className="mt-3 text-[10px] text-gray-400">
          Demo 中审计日志为内存存储；生产环境保留 24 个月（PRD §8.4）。
        </div>
      </section>

      {/* 状态 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
        状态：{alert.status === "open" ? "待确认" : alert.status === "acknowledged" ? `已确认（${contactName(alert.acknowledgedBy)}）` : alert.status === "resolved" ? `已处理（${contactName(alert.resolvedBy)}${alert.resolveReason ? ` · ${RESOLVE_REASON_LABELS_ZH[alert.resolveReason]}` : ""}）` : "自动过期"}
      </section>
    </div>
  );
}
