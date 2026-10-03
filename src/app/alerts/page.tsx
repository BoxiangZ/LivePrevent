"use client";

import { useMemo, useState } from "react";
import { useDemo } from "@/client/provider/DemoProvider";
import { AlertCard } from "@/client/components/AlertCard";
import { EmailPreviewModal } from "@/client/components/EmailPreview";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
} from "@/client/components/ui";
import { cn } from "@/client/cn";
import type { NotificationPreview } from "@/server/snapshot";

type TabKey = "active" | "resolved" | "all";

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  voice_call: "Call",
};

function ChannelMark({ channel }: { channel: string }) {
  const label = CHANNEL_LABEL[channel] ?? channel.toUpperCase();
  return (
    <span className="inline-flex min-w-[3.25rem] items-center justify-center rounded-md border border-surface-line bg-surface-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
      {label}
    </span>
  );
}

export default function AlertsPage() {
  const { snapshot } = useDemo();
  const [tab, setTab] = useState<TabKey>("active");
  const [selected, setSelected] = useState<NotificationPreview | null>(null);

  const counts = useMemo(() => {
    if (!snapshot) return { active: 0, resolved: 0, all: 0 };
    const active = snapshot.alerts.filter(
      (a) => a.status === "open" || a.status === "acknowledged"
    ).length;
    const resolved = snapshot.alerts.filter(
      (a) => a.status === "resolved" || a.status === "auto_expired"
    ).length;
    return { active, resolved, all: snapshot.alerts.length };
  }, [snapshot]);

  if (!snapshot) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Alerts</h1>
          <p className="mt-0.5 text-sm text-ink-mute">
            Every deviation from Margaret&apos;s personal baseline, explained.
          </p>
        </div>
        <Card>
          <CardBody>
            <div className="h-24 animate-pulse rounded-lg bg-surface-soft" />
          </CardBody>
        </Card>
      </div>
    );
  }

  const activeAlerts = snapshot.alerts.filter(
    (a) => a.status === "open" || a.status === "acknowledged"
  );
  const resolvedAlerts = snapshot.alerts.filter(
    (a) => a.status === "resolved" || a.status === "auto_expired"
  );

  const visible =
    tab === "active" ? activeAlerts : tab === "resolved" ? resolvedAlerts : snapshot.alerts;

  const recentNotifications = snapshot.notifications
    .filter((n) => n.body.length > 0)
    .slice(0, 5);
  const showNotificationLog =
    (tab === "active" || tab === "all") && recentNotifications.length > 0;

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: "active", label: "Active", count: counts.active },
    { key: "resolved", label: "Resolved", count: counts.resolved },
    { key: "all", label: "All", count: counts.all },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Alerts</h1>
        <p className="mt-0.5 text-sm text-ink-mute">
          Every deviation from Margaret&apos;s personal baseline, explained.
        </p>
      </div>

      <div className="flex items-center gap-1 border-b border-surface-line">
        {tabs.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-brand-600 text-ink"
                  : "border-transparent text-ink-mute hover:text-ink-soft"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "bg-surface-soft text-ink-mute"
                )}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        tab === "active" ? (
          <EmptyState
            title="Nothing needs attention right now"
            sub="New deviations from Margaret's baseline will appear here."
          />
        ) : tab === "resolved" ? (
          <EmptyState title="No resolved alerts yet." />
        ) : (
          <EmptyState title="No alerts yet." />
        )
      ) : (
        <div className="space-y-3">
          {visible.map((a) => (
            <AlertCard key={a.id} alert={a} snapshot={snapshot} />
          ))}
        </div>
      )}

      {showNotificationLog && (
        <Card>
          <CardHeader
            title="Notification log"
            sub="Most recent messages sent to Margaret's care network."
          />
          <CardBody className="px-0 py-0">
            <ul className="divide-y divide-surface-line">
              {recentNotifications.map((n) => {
                const sentAt = new Date(n.sentAt).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: snapshot.subject.timeZone,
                });
                return (
                  <li
                    key={n.id}
                    className="flex items-center gap-3 px-5 py-3 text-sm"
                  >
                    <ChannelMark channel={n.channel} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">
                        {n.contactName}
                      </div>
                      <div className="text-xs text-ink-mute tabular-nums">
                        {sentAt}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => setSelected(n)}>
                      View
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      <EmailPreviewModal
        notification={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
