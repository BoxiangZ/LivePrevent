"use client";
import Link from "next/link";
import type { SnapshotAlert, DemoStateSnapshot } from "@/server/snapshot";
import { RiskBadge } from "./RiskBadge";
export function AlertCard({
  alert,
  snapshot,
}: {
  alert: SnapshotAlert;
  snapshot: DemoStateSnapshot;
}) {
  return (
    <Link
      href={`/events/${alert.eventId}`}
      className="panel flex items-center justify-between gap-5"
    >
      <div>
        <div className="flex items-center gap-3">
          <RiskBadge level={alert.level} size="sm" />
          <h3 className="font-semibold">{alert.eventLabel}</h3>
          <span className="text-xs capitalize text-ink-mute">
            {alert.status === "acknowledged"
              ? "Being handled"
              : alert.status.replaceAll("_", " ")}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-soft">{alert.recommendedAction}</p>
        <p className="mt-2 text-xs text-ink-mute">
          {new Date(alert.createdAt).toLocaleString("en-GB", {
            timeZone: snapshot.subject.timeZone,
          })}{" "}
          · Sample information
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-brand-600">
        Review →
      </span>
    </Link>
  );
}
