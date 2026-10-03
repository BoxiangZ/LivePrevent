"use client";

/**
 * Login — 简化版角色选择（黑客松 demo）。
 */

import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/client/components/ui";

const ROLE_CARDS = [
  {
    role: "primary_family",
    title: "Alex Chan — Primary family (son)",
    desc: "Acknowledge and resolve alerts, manage the care network and subscription.",
  },
  {
    role: "family_member",
    title: "Family member",
    desc: "View status and events, acknowledge and resolve alerts.",
  },
  {
    role: "caregiver",
    title: "Care provider",
    desc: "View the shared care dashboard for assigned patients.",
  },
];

export default function LoginPage() {
  const router = useRouter();

  const enter = (role: string) => {
    document.cookie = `lp_role=${role}; path=/; max-age=86400`;
    router.push("/overview");
  };

  return (
    <div className="mx-auto max-w-xl space-y-8 py-10">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white">
          LP
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">LivePrevent</h1>
        <p className="mt-2 text-sm text-ink-mute">
          Calm home monitoring for aging in place — alerts that explain themselves.
        </p>
      </div>

      <div className="space-y-3">
        <div className="text-center text-xs font-medium uppercase tracking-wide text-ink-mute">
          Choose a role to enter the demo
        </div>
        {ROLE_CARDS.map((c) => (
          <button
            key={c.role}
            onClick={() => enter(c.role)}
            className="w-full rounded-xl border border-surface-line bg-white p-4 text-left shadow-card transition hover:border-brand-400 hover:shadow-lift"
          >
            <div className="font-semibold text-ink">{c.title}</div>
            <div className="mt-0.5 text-sm text-ink-mute">{c.desc}</div>
          </button>
        ))}
      </div>

      <Card tone="soft">
        <CardBody className="text-center text-xs leading-relaxed text-ink-mute">
          LivePrevent is an assistive monitoring tool. It does not provide medical diagnosis, does
          not replace a clinician, and is not an emergency-call service. If you believe someone is
          in immediate danger, contact local emergency services.
        </CardBody>
      </Card>
    </div>
  );
}
