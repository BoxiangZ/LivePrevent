/**
 * JEV 决策 — PRD §5.3 / §10.1
 * JEV 是唯一决定风险等级的组件。本模块为纯函数，不依赖 store / 网络。
 * 所有阈值初始值见 lib/constants（标注"初始值"，待试点校准 — PRD §17 #7）。
 */

import {
  JEV_CRITICAL_PROB,
  JEV_CRITICAL_MIN_SIGNALS,
  JEV_IMPORTANT_PROB,
  JEV_WATCH_PROB,
} from "@/shared/constants";
import type {
  JevInput,
  JevOutput,
  JevProbabilities,
  StructuredFacts,
} from "@/shared/types/jev";
import type { RiskLevel } from "@/shared/types/risk";

/** Demo 注入事件的确定性概率分布 — 与 PRD §5.3 示例一致（critical 0.94） */
export function demoFallProbabilities(): JevProbabilities {
  return { normal: 0.01, notice: 0.02, important: 0.03, critical: 0.94 };
}

/** 通用的确定性打分器占位：真实模型接入前，事件自带的概率或 demo 分布 */
export function defaultProbabilities(input: JevInput): JevProbabilities {
  if (input.eventType === "possible_fall") return demoFallProbabilities();
  // 非跌倒类事件的保守默认分布（占位，真实打分器接入后移除）
  return { normal: 0.5, notice: 0.2, important: 0.2, critical: 0.1 };
}

export interface DecideOptions {
  probabilities?: JevProbabilities;
  structuredFacts: StructuredFacts;
  /** 监测暂停（隐私模式）— 暂停期不得产生"无活动"告警 — PRD §8.1 */
  monitoringPaused?: boolean;
  /** Watch 级 Email 可选开启 — PRD §3.1 */
  watchEmailEnabled?: boolean;
}

const NOTIFY_CHANNELS: Record<RiskLevel, Array<"email" | "sms" | "push">> = {
  stable: [],
  watch: [], // 默认不发；watchEmailEnabled 时加 email — PRD §3.1
  important: ["email", "push"], // SMS 可选 — PRD §3.1
  critical: ["email", "sms", "push"], // Critical 不得只依赖 Email — PRD §3.1
};

/**
 * 决策规则表 — PRD §5.3（初始值）：
 * 1. p(critical) ≥ 0.60 且（≥2 个独立信号一致，或恢复观察窗内无活动）→ Critical
 * 2. p(critical) ≥ 0.60 但仅单一信号且未过观察窗 → 封顶 Important，等待佐证或观察窗结束
 * 3. p(important) + p(critical) ≥ 0.50（不满足 Critical 条件）→ Important
 * 4. p(notice) + p(important) + p(critical) ≥ 0.30 → Watch
 * 5. 其他 → Stable
 *
 * 守卫（先于规则表）：
 * - 设备离线抑制：离线期间不产生基于该设备的活动/静止告警 — PRD §5.6
 * - 监测暂停：不产生"无活动"告警 — PRD §8.1
 * - 数据不足：信号冲突或置信度低时宁可降级 — PRD §5.4
 * - 学习期：关闭基于个人基线偏离的 Important 及趋势类提示 — PRD §5.1
 */
export function decideLevel(input: JevInput, opts: DecideOptions): JevOutput {
  const p = opts.probabilities ?? defaultProbabilities(input);
  const watchEmail = opts.watchEmailEnabled ?? false;

  const base: Omit<JevOutput, "level" | "notify" | "channels" | "ruleApplied" | "cappedReason"> = {
    eventId: input.eventId,
    probabilities: p,
    structuredFacts: opts.structuredFacts,
  };

  // ── 守卫：设备离线抑制 — PRD §5.6 ──
  if (
    input.deviceOfflineSuppressed &&
    (input.eventType === "activity_drop" || input.eventType === "prolonged_inactivity")
  ) {
    return {
      ...base,
      level: "stable",
      notify: false,
      channels: [],
      ruleApplied:
        "guard:device_offline_suppressed — activity/inactivity alerts are suppressed while the device is offline",
      cappedReason: null,
    };
  }

  // ── 守卫：监测暂停（隐私模式）— PRD §8.1 ──
  if (opts.monitoringPaused && input.eventType === "prolonged_inactivity") {
    return {
      ...base,
      level: "stable",
      notify: false,
      channels: [],
      ruleApplied:
        "guard:monitoring_paused — inactivity alerts are not generated while monitoring is paused",
      cappedReason: null,
    };
  }

  // ── 守卫：学习期关闭基线偏离类提示 — PRD §5.1 ──
  const baselineDriven =
    input.eventType === "activity_drop" || input.eventType === "heart_rate_deviation";
  if (!input.baselineLearned && baselineDriven) {
    return {
      ...base,
      level: "stable",
      notify: false,
      channels: [],
      ruleApplied:
        "guard:baseline_learning — personal-baseline alerts are disabled during the baseline learning period",
      cappedReason: null,
    };
  }

  if (input.eventType === "possible_fall" && input.fallPhase === "recovered") {
    return { ...base, level: "watch", notify: true,
      channels: watchEmail ? ["email"] : [],
      ruleApplied: "rule:recovered — recovery movement observed after possible fall",
      cappedReason: "Recovery movement observed; review the event as Watch" };
  }

  // ── 规则表 — PRD §5.3 ──
  let level: RiskLevel;
  let ruleApplied: string;
  let cappedReason: string | null = null;

  const isFall = input.eventType === "possible_fall";
  const windowOpen = isFall && input.fallPhase === "candidate";

  if (
    p.critical >= JEV_CRITICAL_PROB &&
    windowOpen
  ) {
    // 观察窗未结束：封顶 Important，等待佐证或观察窗结束 — PRD §5.3 行 2 / §5.2
    // （先判窗内，保证 ≥2 信号的跌倒候选也先封顶，窗内无恢复才升级）
    level = "important";
    cappedReason =
      "Recovery window still open — capped at Important until the window closes or recovery is detected";
    ruleApplied = `rule:capped_important — p(critical)=${p.critical} ≥ ${JEV_CRITICAL_PROB}, but the recovery window is still open`;
  } else if (
    p.critical >= JEV_CRITICAL_PROB &&
    (input.independentChannelCount >= JEV_CRITICAL_MIN_SIGNALS ||
      input.fallPhase === "unrecovered")
  ) {
    level = "critical";
    ruleApplied = `rule:critical — p(critical)=${p.critical} ≥ ${JEV_CRITICAL_PROB}, with ${
      input.fallPhase === "unrecovered"
        ? "no recovery movement during the observation window"
        : `${input.independentChannelCount} ≥ ${JEV_CRITICAL_MIN_SIGNALS} independent signals agreeing`
    }`;
  } else if (p.critical >= JEV_CRITICAL_PROB) {
    // 单信号且非观察窗流程
    level = "important";
    cappedReason = "Only one independent signal — capped at Important pending corroboration";
    ruleApplied = `rule:capped_important — p(critical)=${p.critical} ≥ ${JEV_CRITICAL_PROB}, but only ${input.independentChannelCount} independent signal`;
  } else if (p.important + p.critical >= JEV_IMPORTANT_PROB) {
    level = "important";
    ruleApplied = `rule:important — p(important)+p(critical)=${(p.important + p.critical).toFixed(2)} ≥ ${JEV_IMPORTANT_PROB}`;
  } else if (p.notice + p.important + p.critical >= JEV_WATCH_PROB) {
    level = "watch";
    ruleApplied = `rule:watch — p(notice)+p(important)+p(critical)=${(p.notice + p.important + p.critical).toFixed(2)} ≥ ${JEV_WATCH_PROB}`;
  } else {
    level = "stable";
    ruleApplied = "rule:stable — no notification threshold reached";
  }

  // ── 数据不足降级 — PRD §5.4 ──
  if (input.insufficientData && (level === "critical" || level === "important")) {
    const downgraded: RiskLevel = level === "critical" ? "important" : "watch";
    ruleApplied += `; guard:insufficient_data — conflicting or low-confidence signals, downgraded ${level} → ${downgraded}`;
    level = downgraded;
    if (cappedReason === null) {
      cappedReason = "Insufficient data — downgraded with a data-quality notice";
    }
  }

  const notify = level === "critical" || level === "important" || level === "watch";
  let channels = NOTIFY_CHANNELS[level];
  if (level === "watch" && watchEmail) channels = ["email"];

  return { ...base, level, notify, channels, ruleApplied, cappedReason };
}
