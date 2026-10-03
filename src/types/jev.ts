/**
 * JEV（风险决策组件）输入输出 — PRD §5.3 / §10.1
 * JEV 是唯一决定风险等级的组件。Kimi 不参与判定 — PRD §10.2。
 */

import type { RiskLevel } from "./risk";
import type { EventSignal, EventType, FallPhase } from "./event";

/** JEV 输出的各等级概率（alert_priority — PRD §5.3） */
export interface JevProbabilities {
  normal: number;
  notice: number; // 对应 Watch
  important: number;
  critical: number;
}

/** JEV 决策输入：事件 + 上下文（设备/佩戴/睡眠/时段等歧义消解要素 — PRD §5.4） */
export interface JevInput {
  eventId: string;
  subjectId: string;
  eventType: EventType;
  signals: EventSignal[];
  fallPhase: FallPhase;
  /** 独立信号通道数（≥2 佐证规则） */
  independentChannelCount: number;
  /** 数据不足降级：信号冲突或置信度低时宁可降级 — PRD §5.4 */
  insufficientData: boolean;
  /** 学习期上下文：期内关闭个人基线偏离类提示 — PRD §5.1 */
  baselineLearned: boolean;
  /** 设备离线抑制：离线设备不产生基于该设备的活动/静止告警 — PRD §5.6 */
  deviceOfflineSuppressed: boolean;
}

/** JEV 输出 */
export interface JevOutput {
  eventId: string;
  probabilities: JevProbabilities;
  /** 命中的决策规则（人类可读，供详情页解释） */
  ruleApplied: string;
  /** 最终等级：规则 + 概率共同决定 — PRD §5.3 表 */
  level: RiskLevel;
  /** 是否通知、走哪个通道 */
  notify: boolean;
  channels: Array<"email" | "sms" | "push">;
  /** 封顶原因（如"单信号未过观察窗，封顶 Important"） */
  cappedReason: string | null;
  /** 传给 Kimi 的结构化事实（去标识化：别名 + 相对数值 — PRD §10.4） */
  structuredFacts: StructuredFacts;
}

/** 结构化事实 — Kimi 摘要的唯一输入。数值必须可追溯 — PRD §10.2 */
export interface StructuredFacts {
  subjectAlias: string; // 别名，不含姓名
  eventType: EventType;
  occurredAtLocal: string; // 当地时区时间
  timeZone: string;
  signals: Array<{ source: string; description: string }>;
  /** 与基线对比（相对值，不含绝对健康数值） */
  deviations: Array<{ metric: string; relativeChange: number; direction: string }>;
  /** 相关历史变化（过去 30 天相关趋势摘要） */
  relatedChanges: string[];
  trendSynthetic: boolean; // 合成数据标记 — Demo 必须标注
}

/** Kimi 摘要输出（固定结构 — PRD §10.2） */
export interface KimiSummary {
  eventId: string;
  /** 事件 / 与基线对比 / 相关变化 / 建议的下一步 */
  eventSummary: string;
  baselineComparison: string;
  relatedChanges: string;
  /** 建议仅限通用性动作（联系确认/查看设备状态），禁止医疗建议 */
  suggestedNextStep: string;
  /** 后处理校验结果：数值与输入不一致 → 丢弃整个摘要，降级模板 — PRD §10.2 */
  validationPassed: boolean;
  /** 生成来源：llm | template_fallback — PRD §10.3 */
  source: "llm" | "template_fallback";
}
