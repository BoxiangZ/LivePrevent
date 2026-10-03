/**
 * Patient Risk Board — Phase 2 B2B 预览（PRD §13.1）
 * MVP 仅静态展示，不承诺交付。核心问题：Who needs attention today?
 */

import { RiskBadge } from "@/components/RiskBadge";
import type { PatientRiskBoardRow } from "@/types/dashboard";

const ROWS: PatientRiskBoardRow[] = [
  { patientAlias: "Margaret", level: "critical", reason: "Possible fall" },
  { patientAlias: "David", level: "important", reason: "Activity ↓ 41%" },
  { patientAlias: "Susan", level: "watch", reason: "Sleep deterioration" },
  { patientAlias: "Peter", level: "stable", reason: "Normal" },
];

export default function BoardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-4 py-2 text-sm text-indigo-700">
        Phase 2 预览 · 静态模拟数据 — 医院 / 诊所 / 养老机构版本不在 MVP 范围（PRD §13）
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h1 className="text-xl font-bold">Patient Risk Board</h1>
        <p className="mt-1 text-sm text-gray-500">Who needs attention today? — 把有限的护理资源优先分配给最需要关注的人。</p>
        <div className="mt-4 divide-y divide-gray-100">
          {ROWS.map((r) => (
            <div key={r.patientAlias} className="flex items-center gap-4 py-3">
              <span className="w-28 text-sm font-medium text-gray-900">{r.patientAlias}</span>
              <RiskBadge level={r.level} />
              <span className="text-sm text-gray-600">{r.reason}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-gray-400">
          等级体系与家属版统一：Critical / Important / Watch / Stable（PRD §3）。
          正式 B2B 需多租户、RBAC、审计导出、机构级升级链、EHR 对接评估 — Phase 2。
        </div>
      </section>
    </div>
  );
}
