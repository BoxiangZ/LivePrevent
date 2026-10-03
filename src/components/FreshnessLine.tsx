"use client";

/**
 * 数据新鲜度行 — PRD §5.6
 * 示例："Watch worn · synced 2 min ago │ Camera online (Living room)"
 */

import type { DataFreshness } from "@/types/device";

function relTime(iso: string | null, nowMs: number): string {
  if (!iso) return "never";
  const diffMin = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin === 1) return "1 min ago";
  if (diffMin < 60) return `${diffMin} min ago`;
  const h = Math.round(diffMin / 60);
  return `${h} h ago`;
}

export function FreshnessLine({
  freshness,
  nowMs,
}: {
  freshness: DataFreshness[];
  nowMs: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
      {freshness.map((f, i) => (
        <span key={f.deviceId} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-gray-300">│</span>}
          {f.type === "smartwatch" ? (
            <span className={f.online && f.worn ? "" : "text-watch font-medium"}>
              {f.worn === true ? "⌚ Watch worn" : f.worn === false ? "⌚ Watch not worn" : "⌚ Watch"}
              {" · "}
              synced {relTime(f.lastSyncAt, nowMs)}
            </span>
          ) : (
            <span className={f.online ? "" : "text-watch font-medium"}>
              📷 Camera {f.online ? "online" : "offline"} ({f.label.replace(" camera", "")})
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
