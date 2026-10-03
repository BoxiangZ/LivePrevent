/**
 * Care Dashboard 视图模型 — 机构/护理方视角（B2B 预览）。
 * 与家庭端共用底层数据模型，仅做只读投影。
 */

import type { RiskLevel } from "./risk";

export interface CarePatientRow {
  id: string;
  name: string;
  age: number;
  level: RiskLevel;
  /** 触发当前等级的原因（人类可读，基于个人基线） */
  reason: string;
  /** 详情：与基线的相对偏离（如 "Activity 41% below baseline"） */
  detail: string;
  /** 当前状态文案（如 "Needs review today" / "Monitoring"） */
  statusLabel: string;
  lastUpdatedIso: string;
  /** 是否为本 demo 真实数据（Margaret），其余为 mock */
  live: boolean;
}
