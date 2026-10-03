"use client";

/**
 * Care Dashboard — 机构/护理方视角。
 * 与家庭端共用同一份 demo snapshot，但只做只读投影，不暴露监控细节。
 * 路由不在主导航中（直接 URL 访问）。
 */

import Link from "next/link";
import { useDemo } from "@/client/provider/DemoProvider";
import type { CarePatientRow } from "@/shared/types/care";
import {
  Card,
  CardBody,
  SectionTitle,
  EmptyState,
  Pill,
} from "@/client/components/ui";
import { RiskBadge } from "@/client/components/RiskBadge";
import { cn } from "@/client/cn";

function updatedLabel(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "just now";
  const diffMs = Math.max(0, nowMs - then);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

function statusTone(level: CarePatientRow["level"]): "critical" | "important" | "watch" | "stable" {
  if (level === "critical") return "critical";
  if (level === "important") return "important";
  if (level === "watch") return "watch";
  return "stable";
}

function AttentionCard({
  patient,
  eventId,
}: {
  patient: CarePatientRow;
  eventId: string | null;
}) {
  const isCritical = patient.level === "critical";
  return (
    <Card tone={isCritical ? "critical" : "default"}>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold tracking-tight text-ink">
              {patient.name}
              <span className="ml-2 text-sm font-normal text-ink-mute">
                {patient.age}
              </span>
            </div>
            <div className="mt-1">
              <RiskBadge level={patient.level} size="sm" />
            </div>
          </div>
          <Pill tone={statusTone(patient.level)}>{patient.statusLabel}</Pill>
        </div>
        <div>
          <div className="text-sm font-medium text-ink">{patient.reason}</div>
          <div className="mt-1 text-sm text-ink-soft">{patient.detail}</div>
        </div>
        {patient.live && isCritical && eventId ? (
          <div>
            <Link
              href={`/events/${eventId}`}
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Open event →
            </Link>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function PatientRow({
  patient,
  nowMs,
  isLast,
}: {
  patient: CarePatientRow;
  nowMs: number;
  isLast: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-5 py-4",
        !isLast && "border-b border-surface-line"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <div className="truncate text-sm font-semibold tracking-tight text-ink">
            {patient.name}
          </div>
          <div className="text-xs text-ink-mute tabular-nums">{patient.age}</div>
        </div>
        <div className="mt-0.5 truncate text-sm text-ink-soft">{patient.reason}</div>
        <div className="mt-1 text-xs text-ink-mute">
          Updated {updatedLabel(patient.lastUpdatedIso, nowMs)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <RiskBadge level={patient.level} size="sm" />
        <Pill tone={statusTone(patient.level)} className="min-w-[110px] justify-center">
          {patient.statusLabel}
        </Pill>
      </div>
    </div>
  );
}

export default function CareDashboardPage() {
  const { snapshot } = useDemo();

  if (!snapshot) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Care Dashboard</h1>
          <p className="mt-0.5 text-sm text-ink-mute">Who needs attention today?</p>
        </div>
        <Card>
          <CardBody>
            <div className="text-sm text-ink-mute">Loading…</div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const needsAttention = snapshot.carePatients.filter(
    (p) => p.level === "critical" || p.level === "important"
  );

  const activeCriticalAlert = snapshot.activeCriticalAlertId
    ? snapshot.alerts.find((a) => a.id === snapshot.activeCriticalAlertId) ?? null
    : null;
  const activeCriticalEventId = activeCriticalAlert?.eventId ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Care Dashboard</h1>
          <p className="mt-0.5 text-sm text-ink-mute">Who needs attention today?</p>
        </div>
        <Pill tone="brand">Care provider view</Pill>
      </div>

      <section>
        <SectionTitle
          title="Patients requiring attention"
          sub={needsAttention.length === 0 ? "No one needs attention right now." : undefined}
        />
        {needsAttention.length === 0 ? (
          <EmptyState
            title="Everyone is within their personal baseline."
            sub="We'll surface patients here the moment something needs review."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {needsAttention.map((p) => (
              <AttentionCard
                key={p.id}
                patient={p}
                eventId={p.live ? activeCriticalEventId : null}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle title="All patients" sub={`${snapshot.carePatients.length} people under care`} />
        <Card>
          <div className="divide-y-0">
            {snapshot.carePatients.map((p, i) => (
              <PatientRow
                key={p.id}
                patient={p}
                nowMs={snapshot.nowMs}
                isLast={i === snapshot.carePatients.length - 1}
              />
            ))}
          </div>
        </Card>
      </section>

      <Card tone="soft">
        <CardBody>
          <p className="text-sm text-ink-soft">
            Care providers see the same personal-baseline data families do — deviations,
            trends and alerts. No raw video, no continuous location, no medical records.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
