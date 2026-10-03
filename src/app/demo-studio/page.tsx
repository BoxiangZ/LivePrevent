"use client";

import { DemoControls } from "@/client/components/DemoControls";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useDemo } from "@/client/provider/DemoProvider";
import type { ObservationInput, ObservationOutput } from "@/shared/types/demo-api";
import type { EventType, SignalSource } from "@/shared/types/event";

const presets: Record<string, Pick<ObservationInput, "eventType" | "signals" | "probabilities">> = {
  fall: { eventType: "possible_fall", signals: [
    { source: "camera_posture", description: "Possible fall posture detected", withinCoverage: true },
    { source: "watch_impact", description: "Sudden impact from watch" },
  ], probabilities: { normal: 0.01, notice: 0.02, important: 0.03, critical: 0.94 } },
  inactivity: { eventType: "prolonged_inactivity", signals: [
    { source: "watch_activity", description: "No meaningful movement for 2 hours" },
    { source: "camera_motion", description: "Low motion in covered room", withinCoverage: true },
  ], probabilities: { normal: 0.05, notice: 0.1, important: 0.72, critical: 0.13 } },
};

const field = "w-full rounded-lg border border-surface-line bg-white px-3 py-2 text-sm text-ink";

export default function DemoStudioPage() {
  const { selectedPersonId, snapshot, refresh } = useDemo();
  const [input, setInput] = useState<ObservationInput>({ personId: selectedPersonId,
    idempotencyKey: "", occurredAt: new Date().toISOString(), insufficientData: false,
    recoveryObserved: false, note: "", ...presets.fall });
  const [result, setResult] = useState<ObservationOutput | null>(null);
  const [runs, setRuns] = useState<ObservationOutput[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setInput((old) => ({ ...old, personId: selectedPersonId })); setResult(null);
    fetch(`/api/demo/observations?personId=${encodeURIComponent(selectedPersonId)}`)
      .then((r) => r.ok ? r.json() : { runs: [] }).then((data) => setRuns(data.runs ?? [])).catch(() => setRuns([]));
  }, [selectedPersonId]);
  const set = <K extends keyof ObservationInput>(key: K, value: ObservationInput[K]) => setInput((old) => ({ ...old, [key]: value }));
  const submit = async () => {
    setBusy(true); setError("");
    try {
      const payload = { ...input, personId: selectedPersonId, idempotencyKey: crypto.randomUUID(), occurredAt: new Date().toISOString() };
      const response = await fetch("/api/demo/observations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Submission failed");
      setResult(body); setRuns((old) => [body, ...old]); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Submission failed"); }
    finally { setBusy(false); }
  };
  return <div className="mx-auto max-w-5xl space-y-6 pb-10">
    <div><DemoControls /><h1 className="text-2xl font-semibold text-ink">Developer tools · scenario simulator</h1>
      <p className="mt-1 text-sm text-ink-mute">Technical testing only. Probabilities here are manually supplied, not model predictions. Use Assessments to upload information or an optional video.</p></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-surface-line bg-white p-5">
        <h2 className="font-semibold">Input · {snapshot?.subject.name ?? "selected person"}</h2>
        <label className="block text-sm">Preset
          <select className={field} onChange={(e) => setInput((old) => ({ ...old, ...presets[e.target.value] }))}><option value="fall">Possible fall</option><option value="inactivity">Inactivity</option></select></label>
        <label className="block text-sm">Event type
          <select className={field} value={input.eventType} onChange={(e) => set("eventType", e.target.value as EventType)}>
            {["possible_fall", "prolonged_inactivity", "heart_rate_deviation", "activity_drop", "device_data_gap"].map((v) => <option key={v}>{v}</option>)}
          </select></label>
        <div className="space-y-2"><div className="text-sm font-medium">Signals</div>{input.signals.map((signal, index) => <div key={index} className="grid grid-cols-[9rem_1fr] gap-2">
          <select className={field} value={signal.source} onChange={(e) => set("signals", input.signals.map((s, i) => i === index ? { ...s, source: e.target.value as SignalSource } : s))}>
            {["camera_posture", "camera_motion", "watch_impact", "watch_hr", "watch_activity", "watch_worn", "watch_sleep", "device_heartbeat"].map((v) => <option key={v}>{v}</option>)}
          </select><input className={field} aria-label={`Signal ${index + 1} description`} value={signal.description} onChange={(e) => set("signals", input.signals.map((s, i) => i === index ? { ...s, description: e.target.value } : s))} /></div>)}
          <button className="text-sm font-medium text-brand-600" onClick={() => set("signals", [...input.signals, { source: "watch_activity", description: "New observation" }])}>+ Add signal</button>
        </div>
        <div><div className="mb-1 text-sm font-medium">Priority probabilities · total must equal 1</div><div className="grid grid-cols-4 gap-2">{(["normal", "notice", "important", "critical"] as const).map((key) => <label key={key} className="text-xs capitalize">{key}<input type="number" min="0" max="1" step="0.01" className={field} value={input.probabilities[key]} onChange={(e) => set("probabilities", { ...input.probabilities, [key]: Number(e.target.value) })} /></label>)}</div></div>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={input.insufficientData} onChange={(e) => set("insufficientData", e.target.checked)} />Signals conflict or data are insufficient</label>
        {input.eventType === "possible_fall" && <label className="flex gap-2 text-sm"><input type="checkbox" checked={input.recoveryObserved} onChange={(e) => set("recoveryObserved", e.target.checked)} />Recovery movement observed</label>}
        <label className="block text-sm">Related change or operator note<textarea className={field} maxLength={500} value={input.note} onChange={(e) => set("note", e.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-critical">{error}</p>}
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={submit}>{busy ? "Evaluating…" : "Submit observation"}</button>
      </section>
      <section className="space-y-4 rounded-2xl border border-surface-line bg-white p-5"><h2 className="font-semibold">Output</h2>
        {result ? <div className="space-y-3 text-sm"><p><strong>Decision:</strong> <span className="capitalize">{result.level}</span></p><p><strong>Rule:</strong> {result.ruleApplied}</p>
          {result.cappedReason && <p><strong>Reason for cap:</strong> {result.cappedReason}</p>}
          {result.recoveryWindowEndsAt && <p><strong>Recovery window:</strong> until {new Date(result.recoveryWindowEndsAt).toLocaleTimeString()}</p>}
          <p><strong>Event:</strong> {result.eventId}</p><p><strong>Alert:</strong> {result.alertId ?? "None"}</p>
          <p className="text-xs text-ink-mute">Synthetic input · Saved locally · Reopen from the event timeline</p>
          <Link className="font-medium text-brand-600" href={`/events/${result.eventId}`}>View event details →</Link></div>
          : <p className="text-sm text-ink-mute">Submit an observation to see the rule, risk level, alert and recovery window.</p>}
        <div className="border-t border-surface-line pt-4"><h3 className="mb-2 text-sm font-semibold">Recent runs for this person</h3><div className="space-y-2">{runs.slice(0, 8).map((run) => <Link key={run.runId} href={`/events/${run.eventId}`} className="block rounded-lg bg-surface-soft px-3 py-2 text-sm hover:text-brand-600">{run.level} · {run.eventId}</Link>)}</div></div>
      </section>
    </div>
  </div>;
}
