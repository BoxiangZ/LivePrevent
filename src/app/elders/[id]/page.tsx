"use client";

/**
 * Elder Detail — PRD §11 #3
 * 状态、30 天趋势（合成数据标注）、事件时间线、设备状态（含摄像头端侧处理与覆盖房间）。
 */

import Link from "next/link";
import { use } from "react";
import { useDemo } from "@/components/DemoProvider";
import { RiskBadge } from "@/components/RiskBadge";
import { TrendChart } from "@/components/TrendChart";
import { FreshnessLine } from "@/components/FreshnessLine";
import { TREND_METRIC_LABELS, RISK_LEVEL_LABELS_ZH } from "@/lib/labels";

const UNITS: Record<string, string> = {
  activity: "步/日",
  sleep: "小时",
  mobility: "米",
  resting_hr: "bpm",
};

export default function ElderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { snapshot } = useDemo();

  if (!snapshot) {
    return <div className="mx-auto max-w-5xl p-8 text-sm text-gray-400">Loading…</div>;
  }
  if (id !== snapshot.subject.id) {
    return <div className="mx-auto max-w-5xl p-8 text-sm text-gray-400">未找到该被监测者</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <section className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <h1 className="text-2xl font-bold">
            {snapshot.subject.alias}
            <span className="ml-2 text-base font-normal text-gray-500">({snapshot.subject.age})</span>
          </h1>
          <div className="mt-1">
            <FreshnessLine freshness={snapshot.devices} nowMs={snapshot.nowMs} />
          </div>
        </div>
        <RiskBadge level={snapshot.overallLevel} large />
      </section>

      {/* 30 天趋势 — PRD §4.2（趋势类提示最高 Watch/Important，不触发 Critical） */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">30 天趋势</h2>
          <span className="text-[10px] uppercase tracking-wide text-gray-400">synthetic data · 合成数据</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {snapshot.baselines.map((b) => {
            const series = snapshot.trends[b.metric] ?? [];
            return (
              <div key={b.metric} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-gray-700">{TREND_METRIC_LABELS[b.metric]}</span>
                  <span className="text-xs text-gray-400">
                    基线 {b.median ?? "—"} {UNITS[b.metric]}
                  </span>
                </div>
                <TrendChart points={series} median={b.median} synthetic />
              </div>
            );
          })}
        </div>
      </section>

      {/* 设备状态 — PRD §8.2 摄像头端侧处理 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700">设备</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {snapshot.deviceDetails.map((d) => (
            <div key={d.id} className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{d.type === "smartwatch" ? "⌚" : "📷"} {d.label}</span>
                <span className={`text-xs font-medium ${d.online ? "text-stable" : "text-watch"}`}>
                  {d.online ? "online" : "offline"}
                </span>
              </div>
              <div className="mt-1.5 space-y-0.5 text-xs text-gray-500">
                {d.type === "smartwatch" && (
                  <>
                    <div>佩戴：{d.worn ? "已佩戴" : "未佩戴"} · 电量 {d.batteryPct ?? "—"}%</div>
                  </>
                )}
                {d.type === "camera" && (
                  <>
                    <div>覆盖房间：{d.coveredRooms.join("、") || "—"}（浴室等盲区依赖手表侧检测 — PRD §5.5）</div>
                    <div className="text-gray-400">端侧处理，不持续上传视频 — PRD §8.2</div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 事件时间线 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700">事件时间线</h2>
        <div className="mt-3 divide-y divide-gray-100">
          {snapshot.alerts.map((a) => (
            <Link key={a.id} href={`/events/${a.eventId}`} className="flex items-center gap-3 py-2.5 hover:bg-gray-50">
              <RiskBadge level={a.level} />
              <span className="flex-1 text-sm text-gray-800">{a.eventLabel}</span>
              <span className="text-xs text-gray-400">
                {a.resolveReason ? RISK_LEVEL_LABELS_ZH[a.level] : ""}{" "}
                {new Date(a.createdAt).toLocaleString("en-GB", { timeZone: snapshot.subject.timeZone })}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
