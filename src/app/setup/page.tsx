"use client";

import { useEffect, useState } from "react";
import { useDemo } from "@/client/provider/DemoProvider";
import type { Contact, AlertSubscriptionSettings } from "@/shared/types/alert";

const inputClass = "w-full rounded-lg border border-surface-line bg-white px-3 py-2 text-sm";
type Form = { personId: string; subject: { alias: string; displayName: string; age: number | null; timeZone: string }; contacts: Contact[]; subscription: AlertSubscriptionSettings; devices: Array<{ id: string; type: string; label: string; coveredRooms: string[] }> };

export default function SetupPage() {
  const { selectedPersonId, refresh } = useDemo();
  const [form, setForm] = useState<Form | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm(null); fetch(`/api/demo/config?personId=${encodeURIComponent(selectedPersonId)}`)
    .then((r) => r.json()).then(setForm).catch(() => setMessage("Unable to load configuration")); }, [selectedPersonId]);
  const setSubject = (key: keyof Form["subject"], value: string | number | null) => setForm((f) => f ? { ...f, subject: { ...f.subject, [key]: value } } : f);
  const save = async () => { if (!form) return; setBusy(true); setMessage("");
    try { const response = await fetch("/api/demo/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Save failed");
      setMessage("Saved for this person."); await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Save failed"); } finally { setBusy(false); } };
  return <div className="mx-auto max-w-3xl space-y-5 pb-12"><div><h1 className="text-2xl font-semibold">Person and alert setup</h1>
    <p className="mt-1 text-sm text-ink-mute">Changes are stored locally for the selected person. Critical fall alerts stay enabled.</p></div>
    {!form ? <p>Loading…</p> : <>
      <section className="space-y-3 rounded-2xl border border-surface-line bg-white p-5"><h2 className="font-semibold">Person</h2>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Display name<input className={inputClass} value={form.subject.displayName} onChange={(e) => setSubject("displayName", e.target.value)} /></label>
          <label className="text-sm">Notification alias<input className={inputClass} value={form.subject.alias} onChange={(e) => setSubject("alias", e.target.value)} /></label>
          <label className="text-sm">Age<input type="number" min="50" max="120" className={inputClass} value={form.subject.age ?? ""} onChange={(e) => setSubject("age", e.target.value ? Number(e.target.value) : null)} /></label>
          <label className="text-sm">Time zone<select className={inputClass} value={form.subject.timeZone} onChange={(e) => setSubject("timeZone", e.target.value)}>{["Asia/Hong_Kong", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles"].map((v) => <option key={v}>{v}</option>)}</select></label></div></section>
      <section className="space-y-3 rounded-2xl border border-surface-line bg-white p-5"><h2 className="font-semibold">Care contacts · escalation order</h2>
        {form.contacts.map((contact, index) => <div key={contact.id} className="grid gap-2 border-t border-surface-line pt-3 sm:grid-cols-[4rem_1fr_1fr]">
          <span className="text-sm text-ink-mute">#{index + 1}</span><input aria-label={`Contact ${index + 1} name`} className={inputClass} value={contact.name} onChange={(e) => setForm((f) => f ? { ...f, contacts: f.contacts.map((c, i) => i === index ? { ...c, name: e.target.value } : c) } : f)} />
          <div className="flex flex-wrap gap-2">{(["email", "sms", "push"] as const).map((ch) => <label key={ch} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={contact.channels.includes(ch)} onChange={(e) => setForm((f) => f ? { ...f, contacts: f.contacts.map((c, i) => i === index ? { ...c, channels: e.target.checked ? [...c.channels, ch] : c.channels.filter((v) => v !== ch) } : c) } : f)} />{ch}</label>)}
          <button disabled={index === 0} className="text-xs text-brand-600 disabled:opacity-30" onClick={() => setForm((f) => { if (!f || index === 0) return f; const contacts = [...f.contacts]; [contacts[index - 1], contacts[index]] = [contacts[index], contacts[index - 1]]; return { ...f, contacts }; })}>Move up</button>
          <button disabled={form.contacts.length === 1} className="text-xs text-critical disabled:opacity-30" onClick={() => setForm((f) => f ? { ...f, contacts: f.contacts.filter((c) => c.id !== contact.id) } : f)}>Remove</button></div></div>)}
        <button className="text-sm text-brand-600" onClick={() => setForm((f) => f ? { ...f, contacts: [...f.contacts, { id: crypto.randomUUID(), subjectId: f.personId, userId: null, name: "New contact", escalationOrder: f.contacts.length + 1, timeZone: f.subject.timeZone, channels: ["email"], phoneVerified: false, quietHours: null }] } : f)}>+ Add contact</button></section>
      <section className="space-y-3 rounded-2xl border border-surface-line bg-white p-5"><h2 className="font-semibold">Notification categories</h2>
        {(["possible_fall", "heart_rate_deviation", "prolonged_inactivity", "activity_drop", "device_data_gap", "sleep_change", "watchEmailEnabled"] as const).map((key) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={key === "possible_fall"} checked={form.subscription[key]} onChange={(e) => setForm((f) => f ? { ...f, subscription: { ...f.subscription, [key]: e.target.checked } } : f)} />{key.replaceAll("_", " ")}{key === "possible_fall" ? " · always on" : ""}</label>)}</section>
      <section className="space-y-3 rounded-2xl border border-surface-line bg-white p-5"><h2 className="font-semibold">Camera coverage</h2>
        {form.devices.filter((d) => d.type === "camera").map((device) => <label key={device.id} className="block text-sm">{device.label} · rooms separated by commas
          <input key={`${selectedPersonId}:${device.id}`} className={inputClass} defaultValue={device.coveredRooms.join(", ")} onBlur={(e) => setForm((f) => f ? { ...f, devices: f.devices.map((d) => d.id === device.id ? { ...d, coveredRooms: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) } : d) } : f)} /></label>)}</section>
      {message && <p role="status" className="text-sm text-ink-soft">{message}</p>}
      <button disabled={busy} onClick={save} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white">{busy ? "Saving…" : "Save setup"}</button>
    </>}
  </div>;
}
