"use client";

/**
 * Settings — PRD §11 #5
 * 警报订阅（§11.2 默认值，疑似跌倒主联系人不可关闭）、联系人与升级顺序、
 * 渠道与时区、隐私与数据（监测暂停）、套餐。
 */

import { useDemo } from "@/components/DemoProvider";
import { PLANS } from "@/lib/constants";

const SUBSCRIPTION_ROWS = [
  { key: "possible_fall", label: "疑似跌倒（Critical）", locked: true },
  { key: "heart_rate_deviation", label: "心率偏离", locked: false },
  { key: "prolonged_inactivity", label: "长时间无活动", locked: false },
  { key: "activity_drop", label: "活动骤降", locked: false },
  { key: "device_data_gap", label: "设备离线 / 数据缺失", locked: false },
  { key: "sleep_change", label: "睡眠变化（仅 Dashboard 展示）", locked: false },
] as const;

export default function SettingsPage() {
  const { snapshot, setPaused, busy } = useDemo();

  if (!snapshot) {
    return <div className="mx-auto max-w-5xl p-8 text-sm text-gray-400">Loading…</div>;
  }

  const sub = snapshot.subscription;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* 警报订阅 — PRD §11.2 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700">警报订阅（默认值 — PRD §11.2）</h2>
        <div className="mt-3 divide-y divide-gray-100">
          {SUBSCRIPTION_ROWS.map((row) => {
            const on = sub[row.key as keyof typeof sub] === true;
            return (
              <div key={row.key} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-700">{row.label}</span>
                <span className="flex items-center gap-2">
                  {row.locked && (
                    <span className="text-[10px] text-gray-400" title="安全关键功能不按套餐锁定 — PRD §12">
                      主联系人不可关闭
                    </span>
                  )}
                  <span
                    className={`inline-flex h-5 w-9 items-center rounded-full px-0.5 ${
                      on ? "bg-indigo-600 justify-end" : "bg-gray-200 justify-start"
                    } ${row.locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                    aria-disabled={row.locked}
                  >
                    <span className="h-4 w-4 rounded-full bg-white shadow" />
                  </span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-xs text-gray-400">
          Watch 级 Email 默认不发（{sub.watchEmailEnabled ? "已开启" : "关闭"}）· Critical 走 Email+SMS+Push 多通道，绝不只依赖 Email（PRD §3.1）。
        </div>
      </section>

      {/* 联系人与升级顺序 — PRD §6.2 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700">联系人链（升级顺序）</h2>
        <div className="mt-3 space-y-3">
          {snapshot.contacts.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 p-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                #{c.escalationOrder}
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{c.name}</div>
                <div className="text-xs text-gray-500">
                  {c.timeZone} · 渠道：{c.channels.join(" + ")}
                  {c.quietHours ? ` · 免打扰 ${c.quietHours.start}–${c.quietHours.end}（仅 Important 遵守；Critical 不受限）` : " · 无免打扰"}
                </div>
              </div>
              {c.phoneVerified && <span className="text-[10px] text-stable">✓ 手机已验证</span>}
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-gray-400">
          强烈建议至少 1 位同城 / 同时区联系人，应对家属在海外且夜间的情况（PRD §6.2）。
        </div>
      </section>

      {/* 隐私与数据 — PRD §8 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700">隐私与数据</h2>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-100 p-3">
          <div>
            <div className="text-sm font-medium text-gray-900">监测暂停（隐私模式）</div>
            <div className="text-xs text-gray-500">暂停期间不产生“无活动”告警，家属侧显示“监测已暂停”（PRD §8.1）</div>
          </div>
          <button
            onClick={() => setPaused(!snapshot.subject.monitoringPaused)}
            disabled={busy}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              snapshot.subject.monitoringPaused
                ? "bg-watch text-white"
                : "border border-gray-300 text-gray-600 hover:bg-gray-50"
            } disabled:opacity-40`}
          >
            {snapshot.subject.monitoringPaused ? "已暂停 · 点击恢复" : "暂停监测"}
          </button>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-gray-500">
          <li>· 摄像头默认端侧处理，不持续上传视频（PRD §8.2）</li>
          <li>· 数据保留：原始传感器 30 天 / 事件记录 12 个月 / 审计日志 24 个月（建议初始值 — PRD §8.4）</li>
          <li>· 通知最小化：邮件 / 短信不含健康数值（PRD §7）</li>
        </ul>
      </section>

      {/* 套餐 — PRD §12 */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700">套餐</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border-2 border-indigo-500 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Basic（当前）</span>
              <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">CURRENT</span>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-gray-600">
              <li>· 被监测老人 {PLANS.basic.subjects} 位</li>
              <li>· 趋势历史 {PLANS.basic.trendHistoryDays} 天</li>
              <li>· 家庭成员账户 {PLANS.basic.familyAccounts} 个</li>
              <li>· Critical 多通道 + 升级 ✓（安全关键功能不按套餐锁定）</li>
            </ul>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <span className="font-semibold text-gray-700">Premium</span>
            <ul className="mt-2 space-y-1 text-xs text-gray-500">
              <li>· 多位被监测老人</li>
              <li>· 趋势历史 {PLANS.premium.trendHistoryDays} 天</li>
              <li>· 家庭成员不限 · 完整 AI 摘要</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
