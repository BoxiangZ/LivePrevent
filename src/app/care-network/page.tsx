"use client";

import { useDemo } from "@/client/provider/DemoProvider";
import Link from "next/link";
import type { DemoStateSnapshot } from "@/server/snapshot";
import { Card, CardHeader, CardBody, Pill, Button } from "@/client/components/ui";
import { cn } from "@/client/cn";

type Contact = DemoStateSnapshot["contacts"][number];
type Subscription = DemoStateSnapshot["subscription"];

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  voice_call: "Voice call",
};

function roleLine(order: number): string {
  if (order === 1) return "Primary contact";
  return `Contact ${order}`;
}

function receivesLine(order: number): string {
  if (order === 1) return "Receives: Important and Critical alerts";
  return "Receives: Critical alerts only";
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5 text-stable"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.313a1 1 0 0 1-1.42-.006L3.29 9.2a1 1 0 1 1 1.428-1.4l4.035 4.114 6.537-6.594a1 1 0 0 1 1.414-.03Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3 w-3 text-ink-mute"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ContactCard({ contact }: { contact: Contact }) {
  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
              {contact.name
                .split(" ")
                .map((s) => s[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-ink">
                {contact.name}
              </div>
              <div className="mt-0.5 text-xs text-ink-mute">
                {roleLine(contact.escalationOrder)}
              </div>
            </div>
          </div>
          <Pill tone="brand">Order {contact.escalationOrder}</Pill>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {contact.channels.map((ch) => (
            <Pill key={ch}>{CHANNEL_LABEL[ch] ?? ch}</Pill>
          ))}
        </div>

        <div className="space-y-1.5 border-t border-surface-line pt-3 text-xs text-ink-soft">
          {contact.phoneVerified ? (
            <div className="flex items-center gap-1.5">
              <CheckIcon />
              <span>Phone verified (demo)</span>
            </div>
          ) : null}
          {contact.quietHours ? (
            <div className="text-ink-mute">
              Quiet hours {contact.quietHours.start}&ndash;{contact.quietHours.end}{" "}
              <span className="text-ink-soft">
                (Critical alerts always come through)
              </span>
            </div>
          ) : null}
          <div className="text-ink-soft">{receivesLine(contact.escalationOrder)}</div>
        </div>
      </CardBody>
    </Card>
  );
}

const ESCALATION_STEPS: Array<{ time: string; label: string }> = [
  { time: "T+0", label: "Primary contact notified (email + SMS + push)" },
  { time: "T+5 min", label: "Second contact notified, primary reminded" },
  { time: "T+15 min", label: "All contacts notified" },
  { time: "T+30 min", label: "Marked unacknowledged — reminders every 15 min" },
];

function EscalationPolicyCard() {
  return (
    <Card>
      <CardHeader
        title="Escalation policy"
        sub="What happens when a Critical alert is not acknowledged"
      />
      <CardBody>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-4 sm:gap-4">
          {ESCALATION_STEPS.map((step, idx) => (
            <div key={step.time} className="relative">
              {/* connecting line */}
              {idx < ESCALATION_STEPS.length - 1 ? (
                <div
                  className="absolute left-5 right-[-1rem] top-2 hidden border-t border-surface-line sm:block"
                  aria-hidden="true"
                />
              ) : null}
              <div className="relative flex items-start gap-3 sm:flex-col sm:gap-2">
                <div className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-brand-600 bg-surface sm:mt-0">
                  <div className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                </div>
                <div>
                  <div className="text-xs font-semibold tabular-nums tracking-tight text-ink">
                    {step.time}
                  </div>
                  <div className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                    {step.label}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

interface SubscriptionRow {
  key: keyof Subscription | "possible_fall";
  label: string;
  description: string;
  locked?: boolean;
  offByDefault?: boolean;
}

const SUBSCRIPTION_ROWS: SubscriptionRow[] = [
  {
    key: "possible_fall",
    label: "Possible fall",
    description: "Always on",
    locked: true,
  },
  {
    key: "heart_rate_deviation",
    label: "Heart rate deviation",
    description: "Resting heart rate outside the personal range",
  },
  {
    key: "prolonged_inactivity",
    label: "Abnormal inactivity",
    description: "No movement for longer than the usual pattern",
  },
  {
    key: "activity_drop",
    label: "Activity below baseline",
    description: "Daily activity well below the personal baseline",
  },
  {
    key: "device_data_gap",
    label: "Data gap (device offline)",
    description: "A device has stopped reporting",
  },
  {
    key: "sleep_change",
    label: "Sleep changes",
    description: "Shown on dashboard, no notification",
    offByDefault: true,
  },
];

function SubscriptionToggle({ on }: { on: boolean }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      aria-disabled="true"
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed items-center rounded-full transition-colors",
        on ? "bg-brand-600" : "bg-surface-line"
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
          on ? "translate-x-[18px]" : "translate-x-[3px]"
        )}
      />
    </div>
  );
}

function SubscriptionsCard({ subscription }: { subscription: Subscription }) {
  return (
    <Card>
      <CardHeader
        title="Alert subscriptions"
        sub="Which signals trigger a notification to the care network"
      />
      <CardBody className="space-y-0 p-0">
        <ul className="divide-y divide-surface-line">
          {SUBSCRIPTION_ROWS.map((row) => {
            const enabled = row.locked ? true : Boolean(subscription[row.key as keyof Subscription]);
            return (
              <li
                key={row.key}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    {row.locked ? <LockIcon /> : null}
                    <span>{row.label}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-mute">
                    {row.description}
                  </div>
                </div>
                <SubscriptionToggle on={enabled} />
              </li>
            );
          })}
        </ul>
        <div className="border-t border-surface-line bg-surface-soft px-5 py-3 text-xs text-ink-mute">
          Critical alerts always reach the primary contact, even during quiet hours.
        </div>
      </CardBody>
    </Card>
  );
}

function CareProviderCard() {
  return (
    <Card tone="soft">
      <CardBody className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight text-ink">
            Connect a care provider
          </div>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">
            Share this person's dashboard with a professional care team. They
            see the same baseline and alerts &mdash; nothing more.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Pill>Coming soon</Pill>
          <Button disabled variant="secondary">
            Invite provider
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export default function CareNetworkPage() {
  const { snapshot } = useDemo();

  if (!snapshot) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Care Network
          </h1>
          <p className="mt-0.5 text-sm text-ink-mute">
            Who gets notified, in what order, when something changes for the selected person.
          </p>
        </div>
        <div className="h-32 animate-pulse rounded-xl bg-surface-soft" />
      </div>
    );
  }

  const contacts = [...snapshot.contacts].sort(
    (a, b) => a.escalationOrder - b.escalationOrder
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          Care Network
        </h1>
        <p className="mt-0.5 text-sm text-ink-mute">
          Who gets notified, in what order, when something changes for the selected person.
        </p>
        <Link href="/setup" className="mt-2 inline-block text-sm font-semibold text-brand-600">Edit contacts and subscriptions →</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {contacts.map((c) => (
          <ContactCard key={c.id} contact={c} />
        ))}
      </div>

      <EscalationPolicyCard />

      <SubscriptionsCard subscription={snapshot.subscription} />

      <CareProviderCard />
    </div>
  );
}
