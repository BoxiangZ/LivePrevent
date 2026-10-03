"use client";
import { useState } from "react";
import { z } from "zod";
import { api } from "@/client/api";
import { useDemo } from "@/client/provider/DemoProvider";
import { MonitoringStatus } from "@/client/components/MonitoringStatus";
import { DemoControls } from "@/client/components/DemoControls";
export default function DemoStudio() {
  const { selectedPersonId, snapshot, refresh } = useDemo();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function simulate(scenario: string) {
    setBusy(true);
    setError("");
    try {
      await api(`people/${selectedPersonId}/simulate`, z.unknown(), {
        method: "POST",
        body: JSON.stringify({ scenario }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Monitoring simulator</h1>
      <p className="text-sm text-ink-soft">
        Synthetic inputs run through the backend risk rules and notification
        queue. If real email is enabled in Settings, these scenarios send email
        to subscribed contacts.
      </p>
      {snapshot && (
        <MonitoringStatus
          status={snapshot.displayStatus}
          monitoring={snapshot.monitoring}
        />
      )}
      <section className="panel">
        <h2 className="font-semibold">Risk & connection scenarios</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            ["low", "Simulate Low risk"],
            ["moderate", "Simulate Moderate risk"],
            ["critical", "Simulate Critical risk"],
            ["data_loss", "Simulate data loss · 17 minutes"],
            ["recover", "Restore heartbeat"],
            ["longitudinal", "Simulate persistent trend"],
            ["reset", "Reset scenario"],
          ].map(([key, label]) => (
            <button
              className={
                key === "critical" ? "btn-primary bg-critical" : "btn-secondary"
              }
              disabled={busy || !selectedPersonId}
              key={key}
              onClick={() => simulate(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-critical">
            {error}
          </p>
        )}
        <p className="mt-4 text-xs text-ink-mute">
          Data-loss simulation changes only monitoring input. Existing Critical
          alerts remain visible. Reset preserves the person's settings, profile
          and uploaded assessments.
        </p>
      </section>
      <section className="panel">
        <h2 className="font-semibold">Two-phase fall scenarios</h2>
        <DemoControls inline />
      </section>
    </div>
  );
}
