/**
 * Care Dashboard mock 病人数据 — 机构视角演示。
 * Margaret Chan 为真实 demo 数据（live=true），其余为静态 mock。
 * 数字与产品方案一致：David Wong Important / Susan Lee Watch / Peter Lau Stable。
 */

import type { CarePatientRow } from "@/shared/types/care";

export function seedCarePatients(nowIso: string): CarePatientRow[] {
  return [
    {
      id: "pt_margaret",
      name: "Margaret Chan",
      age: 76,
      level: "stable",
      reason: "Activity within normal range",
      detail: "All metrics near personal baseline",
      statusLabel: "Stable",
      lastUpdatedIso: nowIso,
      live: true,
    },
    {
      id: "pt_david",
      name: "David Wong",
      age: 81,
      level: "important",
      reason: "Activity ↓ 41% vs baseline",
      detail: "Daily steps fell from ~5,100 to ~3,000 over the past 10 days",
      statusLabel: "Needs review today",
      lastUpdatedIso: nowIso,
      live: false,
    },
    {
      id: "pt_susan",
      name: "Susan Lee",
      age: 74,
      level: "watch",
      reason: "Sleep deterioration",
      detail: "Sleep below personal baseline 5 of the last 7 nights",
      statusLabel: "Monitoring",
      lastUpdatedIso: nowIso,
      live: false,
    },
    {
      id: "pt_peter",
      name: "Peter Lau",
      age: 79,
      level: "stable",
      reason: "No deviation",
      detail: "Activity, sleep and heart rate within personal baseline",
      statusLabel: "Stable",
      lastUpdatedIso: nowIso,
      live: false,
    },
  ];
}
