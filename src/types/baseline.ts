/**
 * 个人基线与冷启动 — PRD §5.1 / §5.4 / §5.5
 * 基线是"这位老人自己的正常"，不是人群通用阈值 — PRD §16
 */

import type { TrendMetric } from "./event";

/** 基线指标维度（与 TrendMetric 对齐） */
export type BaselineMetric = TrendMetric;

/** 单指标的滚动基线（分布以中位数与四分位近似，避免异常被"学进"基线 — PRD §5.1） */
export interface BaselineEntry {
  metric: BaselineMetric;
  /** 学习期起点（ISO 8601） */
  learningSince: string;
  /** 是否完成学习期（基础 14 天 / 睡眠与趋势类 28 天 — PRD §5.1，常量见 lib/constants） */
  learned: boolean;
  /** 该指标的中位水平（单位随指标：activity=步数/日、sleep=小时、mobility=米、resting_hr=bpm） */
  median: number | null;
  /** 稳健下分位（如 P25） */
  p25: number | null;
  /** 稳健上分位（如 P75） */
  p75: number | null;
  /** 时段基线：按小时段划分的最长静止时长等作息特征 — PRD §5.4 */
  timeOfDayProfile: Record<string, number> | null;
  /** 最近一次纳入基线计算的样本时间（异常排除规则过滤后） */
  lastIncludedSampleAt: string | null;
}

/** 学习期进度展示（"Learning baseline — day X / 14"）— PRD §5.1 */
export interface BaselineLearningProgress {
  subjectId: string;
  /** 基础指标学习日（0 起算的天数） */
  currentDay: number;
  /** 学习期是否全部完成 */
  complete: boolean;
}

/** 趋势方向，用于 Elder Detail 30/90 天视图 — PRD §4.2 */
export const TREND_DIRECTIONS = ["up", "down", "flat"] as const;
export type TrendDirection = (typeof TREND_DIRECTIONS)[number];

/** 单个趋势点（日粒度聚合） */
export interface TrendPoint {
  date: string; // YYYY-MM-DD
  metric: BaselineMetric;
  value: number;
  /** 合成数据标记 — Demo 必须标注 — PRD §19 */
  synthetic?: boolean;
}

/** 偏离描述：与基线的相对差（用于解释型警报，不含绝对健康数值 — PRD §7） */
export interface BaselineDeviation {
  metric: BaselineMetric;
  direction: TrendDirection;
  /** 相对基线中位数的偏离比例，如 -0.45 表示低于基线 45% */
  relativeChange: number;
}
