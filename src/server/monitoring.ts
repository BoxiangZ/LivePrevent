import type { DemoStore } from "./store";

export const DATA_TIMEOUT_MS = 15 * 60_000;
export const HEARTBEAT_MS = 45_000;
export function monitoringStatus(s: DemoStore, now = Date.now()) {
  const levels = { stable: 0, watch: 1, important: 2, critical: 3 };
  const alert = s.alerts
    .filter((a) => ["open", "acknowledged"].includes(a.status))
    .sort((a, b) => levels[b.level] - levels[a.level])[0];
  const last = s.monitoring?.lastDataReceivedAt ?? null;
  const age = last ? now - Date.parse(last) : Infinity;
  const fresh = Number.isFinite(age) && age >= 0 && age < DATA_TIMEOUT_MS;
  const verifiable =
    fresh && s.devices.some((d) => d.online && d.worn !== false);
  const status:
    "stable" | "watch" | "important" | "critical" | "unknown" | "paused" =
    alert?.level === "critical"
      ? "critical"
      : s.subject.monitoringPaused
        ? "paused"
        : !verifiable
          ? "unknown"
          : (alert?.level ?? "stable");
  return {
    status,
    verifiable,
    lastDataReceivedAt: last,
    minutesWithoutData: Number.isFinite(age)
      ? Math.max(0, Math.floor(age / 60000))
      : null,
  };
}
/** Simulator is the input adapter; risk/notification code is shared with future device inputs. */
export function heartbeat(s: DemoStore, now = Date.now()): boolean {
  if (
    s.archived ||
    s.subject.monitoringPaused ||
    !s.monitoring.simulatorEnabled ||
    s.monitoring.dataLoss
  )
    return false;
  const devices = s.devices.filter((d) => d.online);
  if (!devices.length) return false;
  if (
    s.monitoring.lastDataReceivedAt &&
    now - Date.parse(s.monitoring.lastDataReceivedAt) < HEARTBEAT_MS
  )
    return false;
  const iso = new Date(now).toISOString();
  s.monitoring.lastDataReceivedAt = iso;
  for (const d of devices) d.lastSyncAt = iso;
  return true;
}
