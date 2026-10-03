import { limits } from "./media";
import { createHash } from "node:crypto";
import type { DemoStore } from "@/server/store";
import { buildSnapshot } from "@/server/snapshot";
import { overviewSchema } from "@/shared/contracts/assessment";
import { settingsSchema } from "@/shared/contracts/settings";
import { recommendedAction } from "./actions";
export function overview(s: DemoStore) {
  const snapshot = buildSnapshot(s, Date.now());
  const devices = s.devices.map((d) => ({
    ...d,
    reason: !d.online
      ? "Offline"
      : !d.lastSyncAt
        ? "No sync recorded"
        : Date.now() - Date.parse(d.lastSyncAt) > 900000
          ? "Last update is over 15 minutes old"
          : d.worn === false
            ? "Not worn"
            : "Recently synced",
  }));
  const verifiable =
    devices.length > 0 && devices.every((d) => d.reason === "Recently synced");
  const active = [...snapshot.alerts]
    .filter((a) => ["open", "acknowledged"].includes(a.status))
    .sort(
      (a, b) =>
        ({ critical: 0, important: 1, watch: 2, stable: 3 })[a.level] -
        { critical: 0, important: 1, watch: 2, stable: 3 }[b.level],
    );
  const displayStatus =
    active[0]?.level === "critical"
      ? "critical"
      : s.subject.monitoringPaused
        ? "paused"
        : !verifiable
          ? "unknown"
          : snapshot.overallLevel;
  const statusReason =
    displayStatus === "paused"
      ? "Monitoring is paused. Current condition cannot be verified."
      : displayStatus === "unknown"
        ? "Current condition cannot be verified from the available device data."
        : active[0]
          ? recommendedAction(active[0].eventType)
          : "No active concern is recorded in the available observations.";
  const evaluatedAt =
    devices
      .map((d) => d.lastSyncAt)
      .filter((v): v is string => !!v)
      .sort()[0] ?? null;
  const b = s.baselines.find((b) => !b.learned);
  return overviewSchema.parse({
    personId: s.subject.id,
    displayStatus,
    riskLevel: snapshot.overallLevel,
    statusReason,
    evaluatedAt,
    primaryAction: active[0]
      ? {
          label: "Review alert",
          href: `/events/${active[0].eventId}`,
          description: recommendedAction(active[0].eventType),
        }
      : !verifiable || s.subject.monitoringPaused
        ? {
            label: "Review devices",
            href: "/settings",
            description:
              "Check device coverage and recent sync before relying on the status.",
          }
        : {
            label: "View history",
            href: `/people/${s.subject.id}`,
            description:
              "No urgent action is needed based on the available observations.",
          },
    dataFreshness: { verifiable, devices },
    sourceLabel: "Based on sample information",
    learningProgress: b
      ? {
          currentDay: Math.max(
            0,
            Math.floor((Date.now() - Date.parse(b.learningSince)) / 86400000),
          ),
          totalDays: b.metric === "sleep" ? 28 : 14,
        }
      : null,
  });
}
export function settings(s: DemoStore) {
  const data = {
    personId: s.subject.id,
    subject: {
      alias: s.subject.alias,
      displayName: s.subject.displayName ?? s.subject.alias,
      age: s.subject.age,
      timeZone: s.subject.timeZone,
      monitoringPaused: s.subject.monitoringPaused,
    },
    contacts: s.contacts,
    devices: s.devices.map((d) => ({
      id: d.id,
      type: d.type,
      label: d.label,
      coveredRooms: d.coveredRooms,
    })),
    subscription: s.subscription,
    policy: { retentionHours: limits.retentionHours, workspaceMode: "sample" },
    consent: {
      status: s.subject.consent?.status ?? "missing",
      grantedAt: s.subject.consent?.grantedAt ?? null,
      role: s.subject.consent?.consenterRole ?? null,
    },
  };
  return settingsSchema.parse({
    ...data,
    version: createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex")
      .slice(0, 16),
  });
}
