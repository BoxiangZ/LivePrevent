/**
 * 结构化事实构建 — 发送给 Kimi 的唯一内容（PRD §10.2 / §10.4）
 * 去标识化在这里"按构造"保证：StructuredFacts 类型没有任何字段可以装
 * 姓名、地址、联系方式或图像，只有别名、事件类型、相对数值。
 */

import type { MonitoredEvent } from "@/types/event";
import type { Subject } from "@/types/subject";
import type { BaselineDeviation } from "@/types/baseline";
import type { StructuredFacts } from "@/types/jev";
import { SIGNAL_SOURCE_LABELS } from "@/lib/labels";

export function buildStructuredFacts(input: {
  event: MonitoredEvent;
  subject: Pick<Subject, "alias" | "timeZone">;
  occurredAtLocal: string;
  deviations: BaselineDeviation[];
  relatedChanges: string[];
  trendSynthetic: boolean;
}): StructuredFacts {
  const { event, subject, occurredAtLocal, deviations, relatedChanges, trendSynthetic } =
    input;
  return {
    subjectAlias: subject.alias, // 别名，不含姓名 — PRD §7.1
    eventType: event.type,
    occurredAtLocal,
    timeZone: subject.timeZone,
    signals: event.signals.map((s) => ({
      source: SIGNAL_SOURCE_LABELS[s.source] ?? s.source,
      description: s.description,
    })),
    // 仅相对偏离（如 -0.45 = 低于基线 45%），不含绝对健康数值 — PRD §7
    deviations: deviations.map((d) => ({
      metric: d.metric,
      relativeChange: d.relativeChange,
      direction: d.direction,
    })),
    relatedChanges,
    trendSynthetic, // 合成数据必须标注 — PRD §19
  };
}
