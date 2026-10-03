/**
 * Dashboard 视图模型 — PRD §11
 * 页面渲染所需的聚合类型（不直接落库）。
 */

import type { RiskLevel } from "./risk";
import type { TrendMetric } from "./event";
import type { DataFreshness } from "./device";
import type { Alert } from "./alert";
import type { TrendDirection } from "./baseline";

/** Overview 核心指标行 — PRD §11.1 示例 */
export interface OverviewMetric {
  metric: TrendMetric;
  /** Normal / ↓ Slightly 等 */
  status: "normal" | "slightly_off" | "deviated" | "insufficient_data";
  direction: TrendDirection | null;
  /** 关联等级（如 Sleep ↓ Slightly → Watch） */
  flagLevel: RiskLevel | null;
}

/** Overview 页视图 — PRD §11.1 */
export interface OverviewViewModel {
  subjectAlias: string;
  subjectAge: number | null;
  overallLevel: RiskLevel;
  /** 学习期进度（仅学习期显示） */
  learningProgress: { currentDay: number; totalDays: number } | null;
  metrics: OverviewMetric[];
  dataFreshness: DataFreshness[];
  latestEvents: Array<{
    timeLocal: string;
    label: string;
    flagLevel: RiskLevel;
  }>;
  /** 监测已暂停（隐私模式）时的横幅 — PRD §8.1 */
  monitoringPaused: boolean;
}

/** Elder Detail 页视图 — PRD §11 #3 */
export interface ElderDetailViewModel {
  subjectId: string;
  alias: string;
  overallLevel: RiskLevel;
  /** 30 / 90 天趋势数据（Demo 中为合成数据，需标注） */
  trends: Array<{
    metric: TrendMetric;
    windowDays: 30 | 90;
    points: Array<{ date: string; value: number; synthetic?: boolean }>;
  }>;
  eventTimeline: Array<{
    id: string;
    occurredAt: string;
    label: string;
    level: RiskLevel;
    resolvedAs: string | null;
  }>;
  devices: DataFreshness[];
}

/** 事件详情页视图 — Kimi 摘要展示页 — PRD §7 / §10 / §19 步骤 7 */
export interface EventDetailViewModel {
  eventId: string;
  subjectAlias: string;
  level: RiskLevel;
  eventTypeLabel: string;
  occurredAtLocal: string;
  signals: Array<{ source: string; description: string }>;
  deviations: Array<{ metric: string; relativeChange: number; direction: string }>;
  trend30d: Array<{ date: string; value: number; synthetic?: boolean }>;
  kimiSummary: {
    eventSummary: string;
    baselineComparison: string;
    relatedChanges: string;
    suggestedNextStep: string;
    source: "llm" | "template_fallback";
    /** "基于结构化事实生成" 标注 — PRD §19 */
    disclaimer: string;
  } | null;
  relatedAlert: Alert | null;
}

/** Patient Risk Board（B2B 预览，Phase 2）— PRD §13.1。MVP 仅静态展示 */
export interface PatientRiskBoardRow {
  patientAlias: string;
  level: RiskLevel;
  reason: string;
}
