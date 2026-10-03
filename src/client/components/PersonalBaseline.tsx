"use client";

/**
 * Personal Baseline 区 — LivePrevent 的核心差异化：
 * 我们不和"人群平均值"比，只和 Margaret 自己的历史比。
 */

import { useDemo } from "@/client/provider/DemoProvider";
import { Card, CardBody } from "./ui";
import type { TrendMetric } from "@/shared/types/event";

const ORDER: TrendMetric[] = ["activity", "resting_hr", "sleep", "mobility"];

function fmt(v: number | null, metric: TrendMetric): string {
  if (v === null) return "—";
  if (metric === "activity") return Math.round(v).toLocaleString("en-US");
  if (metric === "resting_hr") return String(Math.round(v));
  return v.toFixed(1);
}

export function PersonalBaseline() {
  const { snapshot } = useDemo();
  if (!snapshot) return null;

  return (
    <Card>
      <CardBody>
        <div className="mb-4">
          <h3 className="text-sm font-semibold tracking-tight text-ink">Personal baseline</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-mute">
            LivePrevent learns Margaret's own normal over weeks, then flags deviations from{" "}
            <span className="font-medium text-ink-soft">her</span> baseline — not from generic
            population averages.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {ORDER.map((m) => {
            const b = snapshot.baselines.find((x) => x.metric === m);
            if (!b) return null;
            return (
              <div key={m}>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-mute">
                  {b.label}
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-ink">
                  {fmt(b.median, m)}
                  <span className="ml-1 text-xs font-normal text-ink-mute">{b.unit}</span>
                </dd>
                <dd className="mt-0.5 text-[11px] text-ink-mute">
                  typical {fmt(b.p25, m)}–{fmt(b.p75, m)}
                </dd>
              </div>
            );
          })}
        </dl>
      </CardBody>
    </Card>
  );
}
