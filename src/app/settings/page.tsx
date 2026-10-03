"use client";

/**
 * Settings — how LivePrevent watches over Margaret, and what it never does.
 * Sections: Notifications / Care Network / Privacy / Devices / Subscription.
 */

import Link from "next/link";
import { useDemo } from "@/client/provider/DemoProvider";
import {
  Card,
  CardHeader,
  CardBody,
  Pill,
  Button,
} from "@/client/components/ui";
import { cn } from "@/client/cn";

/* ---------- small bits ---------- */

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={cn("h-4 w-4", className)}
    >
      <path
        d="M5 10.5l3 3 7-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Switch({ on, locked }: { on: boolean; locked?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        on ? "bg-brand-600" : "bg-surface-line",
        locked ? "opacity-60" : "opacity-100"
      )}
    >
      <span
        className={cn(
          "absolute h-4 w-4 rounded-full bg-white shadow transition-transform",
          on ? "translate-x-[18px]" : "translate-x-[2px]"
        )}
      />
    </span>
  );
}

function SettingRow({
  title,
  sub,
  on,
  locked,
}: {
  title: string;
  sub: string;
  on: boolean;
  locked?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-xs text-ink-mute">{sub}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        {locked ? (
          <span className="text-[11px] text-ink-mute">Always on</span>
        ) : null}
        <Switch on={on} locked={locked} />
      </div>
    </div>
  );
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        online ? "bg-stable" : "bg-critical"
      )}
      aria-label={online ? "Online" : "Offline"}
    />
  );
}

function ChannelLabel({ channel }: { channel: string }) {
  const label =
    channel === "voice_call"
      ? "Voice call"
      : channel.charAt(0).toUpperCase() + channel.slice(1);
  return <Pill tone="brand">{label}</Pill>;
}

function PlanBullet({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2 text-sm text-ink-soft">
      <CheckIcon className="mt-0.5 shrink-0 text-stable" />
      <span>{children}</span>
    </li>
  );
}

/* ---------- page ---------- */

export default function SettingsPage() {
  const { snapshot, setPaused, busy } = useDemo();

  if (!snapshot) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Settings</h1>
          <p className="mt-0.5 text-sm text-ink-mute">
            How LivePrevent watches over Margaret — and what it never does.
          </p>
        </div>
        <Card>
          <CardBody>
            <div className="py-6 text-center text-sm text-ink-mute">Loading…</div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const sub = snapshot.subscription;
  const contacts = snapshot.contacts;
  const devices = snapshot.deviceDetails;
  const paused = snapshot.subject.monitoringPaused;

  const primaryContact = contacts.find((c) => c.escalationOrder === 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-0.5 text-sm text-ink-mute">
          How LivePrevent watches over Margaret — and what it never does.
        </p>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader
          title="Notifications"
          sub="What reaches you, and on which channels."
        />
        <CardBody>
          <div className="divide-y divide-surface-line">
            <SettingRow
              title="Possible fall"
              sub="Always on — core safety net."
              on={sub.possible_fall}
              locked
            />
            <SettingRow
              title="Heart rate deviation"
              sub="When resting heart rate moves outside her normal range."
              on={sub.heart_rate_deviation}
            />
            <SettingRow
              title="Abnormal inactivity"
              sub="Long stretches without movement during her usual active hours."
              on={sub.prolonged_inactivity}
            />
            <SettingRow
              title="Activity below baseline"
              sub="Daily activity meaningfully lower than her personal baseline."
              on={sub.activity_drop}
            />
            <SettingRow
              title="Data gap"
              sub="When a device stops reporting — so silence is never mistaken for safety."
              on={sub.device_data_gap}
            />
            <SettingRow
              title="Sleep changes"
              sub="Dashboard only — no notifications for gradual sleep drift."
              on={sub.sleep_change}
            />
          </div>

          <div className="mt-5 border-t border-surface-line pt-4">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-mute">
              Channels — {primaryContact?.name ?? "Primary contact"} (primary)
            </div>
            <div className="mt-2 divide-y divide-surface-line">
              <SettingRow
                title="Email"
                sub="Detailed summaries with secure links to the dashboard."
                on
              />
              <SettingRow
                title="SMS"
                sub="Short, time-sensitive alerts."
                on
              />
              <SettingRow
                title="Push"
                sub="Instant alerts in the LivePrevent app."
                on
              />
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-soft px-3 py-2.5">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute"
              >
                <path
                  d="M17 11.5A7 7 0 018.5 3a7 7 0 108.5 8.5z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-xs text-ink-soft">
                <span className="font-medium text-ink">Quiet hours 22:00 – 07:00.</span>{" "}
                Non-urgent updates are held overnight.{" "}
                <span className="font-medium text-ink">
                  Critical alerts always come through.
                </span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Care Network */}
      <Card>
        <CardHeader
          title="Care Network"
          sub="Who is notified, and in what order."
        />
        <CardBody>
          <div className="divide-y divide-surface-line">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink">{c.name}</div>
                  <div className="mt-0.5 text-xs text-ink-mute">
                    {c.escalationOrder === 1
                      ? "Primary — notified first"
                      : `Contact #${c.escalationOrder} — notified if the primary hasn't responded`}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {c.channels.map((ch) => (
                    <ChannelLabel key={ch} channel={ch} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-surface-line pt-3">
            <Link
              href="/care-network"
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Manage care network →
            </Link>
          </div>
        </CardBody>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader
          title="Privacy"
          sub="LivePrevent analyzes behaviour, not video."
        />
        <CardBody>
          <ul className="space-y-2.5">
            {[
              "Camera processing happens on the device — raw video is never uploaded or stored.",
              "Only events and trends leave the home — never images or audio.",
              "Margaret can pause monitoring at any time, from any page.",
              "AI summaries are generated from de-identified structured facts only.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-50 text-stable">
                  <CheckIcon className="h-3 w-3" />
                </span>
                <span className="text-sm text-ink-soft">{line}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-surface-line pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-ink">Monitoring pause</div>
                <div className="mt-0.5 text-xs text-ink-mute">
                  When paused, no new events are generated.
                </div>
              </div>
              <Button
                variant={paused ? "danger" : "primary"}
                onClick={() => setPaused(!paused)}
                disabled={busy}
              >
                {paused ? "Resume monitoring" : "Pause monitoring"}
              </Button>
            </div>
            {paused ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Monitoring is paused — no new events are being generated.
              </div>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {/* Devices */}
      <Card>
        <CardHeader
          title="Devices"
          sub="Sensors watching over Margaret's home."
        />
        <CardBody>
          <div className="divide-y divide-surface-line">
            {devices.map((d) => (
              <div key={d.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusDot online={d.online} />
                    <span className="text-sm font-medium text-ink">{d.label}</span>
                  </div>
                  <div className="mt-1 text-xs text-ink-mute">
                    {d.type === "camera"
                      ? `${d.coveredRooms.join(", ")} · On-device processing`
                      : d.type === "watch"
                        ? d.batteryPct !== null
                          ? `Battery ${d.batteryPct}%${d.worn === false ? " · Not worn" : ""}`
                          : d.worn === false
                            ? "Not worn"
                            : "Worn"
                        : d.coveredRooms.length > 0
                          ? d.coveredRooms.join(", ")
                          : d.type}
                  </div>
                </div>
                <div className="shrink-0 pt-0.5">
                  <Pill tone={d.online ? "stable" : "critical"}>
                    {d.online ? "Online" : "Offline"}
                  </Pill>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Subscription */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-semibold tracking-tight text-ink">Subscription</h2>
          <p className="mt-0.5 text-sm text-ink-mute">
            Plans that scale from one family to a full care team.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Family */}
          <Card>
            <CardBody className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">LivePrevent Family</div>
                  <div className="mt-0.5 text-xs text-ink-mute">
                    For families watching over one person
                  </div>
                </div>
                <Pill tone="brand">Current plan</Pill>
              </div>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold tracking-tight text-ink tabular-nums">
                  US$12
                </span>
                <span className="text-sm text-ink-mute">/ month</span>
              </div>
              <ul className="mt-4 space-y-2">
                <PlanBullet>1 person monitored</PlanBullet>
                <PlanBullet>2 family accounts</PlanBullet>
                <PlanBullet>30-day trend history</PlanBullet>
                <PlanBullet>Weekly AI summary</PlanBullet>
              </ul>
            </CardBody>
          </Card>

          {/* Care */}
          <Card>
            <CardBody className="flex h-full flex-col">
              <div>
                <div className="text-sm font-semibold text-ink">LivePrevent Care</div>
                <div className="mt-0.5 text-xs text-ink-mute">
                  For care teams and providers
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold tracking-tight text-ink tabular-nums">
                  US$49
                </span>
                <span className="text-sm text-ink-mute">/ month</span>
              </div>
              <ul className="mt-4 space-y-2">
                <PlanBullet>Unlimited people</PlanBullet>
                <PlanBullet>Unlimited family accounts</PlanBullet>
                <PlanBullet>90-day trend history</PlanBullet>
                <PlanBullet>Full AI summaries</PlanBullet>
                <PlanBullet>Care Dashboard access</PlanBullet>
              </ul>
              <div className="mt-4 pt-2">
                <Button variant="secondary" disabled>
                  Talk to us
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
