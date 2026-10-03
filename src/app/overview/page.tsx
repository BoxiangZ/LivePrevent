"use client";

/**
 * Overview — PRD §11 #2 / §11.1
 * 整体状态（四级）、核心指标、数据新鲜度、基线学习进度（已学完则不显示）、最新事件。
 */

import Link from "next/link";
import { useDemo } from "@/components/DemoProvider";
import { RiskBadge } from "@/components/RiskBadge";
import { FreshnessLine } from "@/components/FreshnessLine";
import { Countdown } from "@/components/CriticalBanner";
import { RISK_LEVEL_LABELS_ZH } from "@/lib/labels";
import { TREND_METRIC_LABELS } from "@/lib/labels";
import type { TrendMetric } from "@/types/event";

/** 核心指标状态推导（简化：与基线中位数对比当日值） */
function metricStatus(metric: TrendMetric, today: number | null, median: number | null) {
  if (today === null || median === null) return { text: "—", flag: null as null | "watch" };
  const rel = (today - median) / median;
  if (metric === "sleep" && rel < -0.1) return { text: "↓ Slightly", flag: "watch" as const };
  if (metric === "activity" && rel < -0.3) return { text: "↓ Below baseline", flag: "watch" as const };
  if (Math.abs(rel) > 0.15) return { text: rel < 0 ? "↓ Slightly" : "↑ Slightly", flag: "watch" as const };
  return { text: "Normal", flag: null };
}

export default function OverviewPage() {
  const { snapshot, msUntil } = useDemo();

  if (!snapshot) {
    return <div className="mx-auto max-w-5xl p-8 text-sm text-gray-400">Loading…</div>;
  }

  const { subject } = snapshot;
  const metrics = snapshot.baselines.map((b) => {
    const series = snapshot.trends[b.metric];
    const today = series && series.length > 0 ? series[series.length - 1].value : null;
    return { metric: b.metric, ...metricStatus(b.metric, today, b.median) };
  });

  const pendingFall = snapshot.pendingFallEventId
    ? snapshot.events.find((e) => e.id === snapshot.pendingFallEventId)
    : null;
  const recoveryMs = pendingFall ? msUntil(pendingFall.recoveryWindowEndsAt) : null;

  const latest = snapshot.alerts.slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* 监测暂停横幅 — PRD §8.1 */}
      {subject.monitoringPaused && (
        <div className="rounded-lg border border-watch/40 bg-watch/10 px-4 py-2 text-sm text-watch">
          ⏸ 监测已暂停（隐私模式）— 暂停期间不产生“无活动”告警。
        </div>
      )}

      {/* 恢复观察窗提示 — PRD §5.2：两阶段判定的第一阶段 */}
      {pendingFall && recoveryMs !== null && recoveryMs > 0 && (
        <div className="rounded-lg border border-important/40 bg-important/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl" aria-hidden>🟠</span>
            <div>
              <div className="font-semibold text-important">
                疑似跌倒 — 恢复观察窗进行中（<Countdown ms={recoveryMs} />）
              </div>
              <div className="text-xs text-gray-600">
                已封顶 Important，等待佐证或观察窗结束；窗内无恢复活动将升级为 Critical — PRD §5.2 / §5.3
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 头部：被监测者 + 整体等级 */}
      <section className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <h1 className="text-2xl font-bold">
            {subject.alias}
            {subject.age !== null && <span className="ml-2 text-base font-normal text-gray-500">({subject.age})</span>}
          </h1>
          {snapshot.learningProgress && (
            <div className="mt-1 text-xs text-gray-500">
              Learning baseline · day {snapshot.learningProgress.currentDay} / {snapshot.learningProgress.totalDays}
            </div>
          )}
        </div>
        <RiskBadge level={snapshot.overallLevel} large />
      </section>

      {/* 核心指标 — PRD §11.1 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700">核心指标</h2>
        <div className="mt-3 divide-y divide-gray-100">
          {metrics.map((m) => (
            <div key={m.metric} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-gray-600">{TREND_METRIC_LABELS[m.metric]}</span>
              <span className="flex items-center gap-2 text-sm">
                <span className={m.flag === "watch" ? "text-watch" : "text-gray-900"}>{m.text}</span>
                {m.flag === "watch" && <RiskBadge level="watch" />}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-gray-100 pt-3">
          <FreshnessLine freshness={snapshot.devices} nowMs={snapshot.nowMs} />
        </div>
      </section>

      {/* 最新事件 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">最新事件</h2>
          <Link href="/alerts" className="text-xs text-indigo-600 hover:underline">
            全部警报 →
          </Link>
        </div>
        <div className="mt-3 divide-y divide-gray-100">
          {latest.length === 0 && <div className="py-3 text-sm text-gray-400">暂无事件</div>}
          {latest.map((a) => (
            <Link
              key={a.id}
              href={`/events/${a.eventId}`}
              className="flex items-center justify-between py-2.5 hover:bg-gray-50"
            >
              <span className="text-sm text-gray-500">
                {new Date(a.createdAt).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: subject.timeZone,
                })}
              </span>
              <span className="flex-1 px-3 text-sm text-gray-800">{a.eventLabel}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{RISK_LEVEL_LABELS_ZH[a.level]}</span>
                <RiskBadge level={a.level} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
