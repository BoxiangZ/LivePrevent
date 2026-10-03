"use client";
import { useEffect, useState } from "react";
import { api } from "@/client/api";
import { settingsSchema, type Settings } from "@/shared/contracts/settings";
import { emptyProfile } from "@/shared/contracts/monitoring";
import { HealthProfileEditor } from "@/client/components/HealthProfileEditor";
import { useDemo } from "@/client/provider/DemoProvider";
const labels = {
  possible_fall: "Possible fall · always enabled",
  heart_rate_deviation: "Heart rate changes",
  prolonged_inactivity: "Prolonged inactivity",
  activity_drop: "Activity changes",
  device_data_gap: "Device data gaps",
  sleep_change: "Sleep changes",
  watchEmailEnabled: "Email for Low risk alerts",
  importantEscalationEnabled: "Escalate Moderate alerts",
};
export default function SettingsPage() {
  const { selectedPersonId } = useDemo();
  return <Editor key={selectedPersonId} personId={selectedPersonId} />;
}
function Editor({ personId }: { personId: string }) {
  const { refresh } = useDemo();
  const [form, setForm] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState<Settings | null>(null);
  useEffect(() => {
    let active = true;
    api(`people/${personId}/settings`, settingsSchema)
      .then((f) => {
        if (active) {
          setForm(f);
          const saved = localStorage.getItem(`lp-settings-draft-${personId}`);
          if (saved) {
            const parsed = settingsSchema.safeParse(JSON.parse(saved));
            if (parsed.success)
              setDraft({ ...parsed.data, version: f.version });
          }
        }
      })
      .catch((e) => setMessage(e.message));
    return () => {
      active = false;
    };
  }, [personId]);
  useEffect(() => {
    if (dirty && form)
      localStorage.setItem(
        `lp-settings-draft-${personId}`,
        JSON.stringify(form),
      );
  }, [form, dirty, personId]);
  const change = (fn: (f: Settings) => Settings) => {
    setDirty(true);
    setMessage("");
    setForm((f) => (f ? fn(f) : f));
  };
  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      const f = await api(`people/${personId}/settings`, settingsSchema, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setForm(f);
      setDirty(false);
      setDraft(null);
      localStorage.removeItem(`lp-settings-draft-${personId}`);
      setMessage("Changes saved for the selected person.");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  if (!form)
    return (
      <div className="panel" role="status">
        {message || "Loading settings…"}
      </div>
    );
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Manage the selected person's information and care preferences.
        </p>
      </div>
      {draft && (
        <div className="panel flex justify-between">
          <span>There is an unsaved local draft.</span>
          <button
            className="text-brand-600"
            onClick={() => {
              setForm(draft);
              setDraft(null);
              setDirty(true);
            }}
          >
            Restore draft
          </button>
          <button
            className="text-ink-mute"
            onClick={() => {
              localStorage.removeItem(`lp-settings-draft-${personId}`);
              setDraft(null);
            }}
          >
            Discard draft
          </button>
        </div>
      )}
      <section className="panel">
        <h2 className="text-lg font-semibold">Person & access</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <label className="text-sm">
            Display name
            <input
              className="field"
              value={form.subject.displayName}
              onChange={(e) =>
                change((f) => ({
                  ...f,
                  subject: { ...f.subject, displayName: e.target.value },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Notification alias
            <input
              className="field"
              value={form.subject.alias}
              onChange={(e) =>
                change((f) => ({
                  ...f,
                  subject: { ...f.subject, alias: e.target.value },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Age
            <input
              type="number"
              min="50"
              max="120"
              className="field"
              value={form.subject.age ?? ""}
              onChange={(e) =>
                change((f) => ({
                  ...f,
                  subject: {
                    ...f.subject,
                    age: e.target.value ? Number(e.target.value) : null,
                  },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Time zone
            <select
              className="field"
              value={form.subject.timeZone}
              onChange={(e) =>
                change((f) => ({
                  ...f,
                  subject: { ...f.subject, timeZone: e.target.value },
                }))
              }
            >
              {Intl.supportedValuesOf("timeZone").map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-4 text-xs text-ink-mute">
          Sample consent record: {form.consent.status}
          {form.consent.grantedAt
            ? ` · ${new Date(form.consent.grantedAt).toLocaleDateString()}`
            : ""}
          . Real monitoring requires consent from the person or their legal
          guardian.
        </p>
      </section>
      <HealthProfileEditor
        value={form.profile ?? emptyProfile()}
        onChange={(profile) => change((f) => ({ ...f, profile }))}
      />
      <section className="panel">
        <h2 className="text-lg font-semibold">Monitoring & email delivery</h2>
        <p className="mt-2 text-sm text-ink-mute">
          Heartbeat runs every 45 seconds. After 15 minutes without data, the
          status becomes Unable to verify. Health measurements are not created
          by heartbeat.
        </p>
        {form.monitoring && (
          <div className="mt-4 space-y-3">
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.monitoring.simulatorEnabled}
                onChange={(e) =>
                  change((f) => ({
                    ...f,
                    monitoring: {
                      ...f.monitoring!,
                      simulatorEnabled: e.target.checked,
                    },
                  }))
                }
              />
              Enable simulated monitoring heartbeat
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.monitoring.emailEnabled}
                onChange={(e) =>
                  change((f) => ({
                    ...f,
                    monitoring: {
                      ...f.monitoring!,
                      emailEnabled: e.target.checked,
                    },
                  }))
                }
              />
              Send real email alerts to subscribed care contacts
            </label>
            <p className="text-xs text-ink-mute">
              Enabling real email requires a primary email address and server
              provider configuration. Critical always emails the primary
              contact. Moderate follows each contact's preference and quiet
              hours. SMS, push and phone remain simulated previews.
            </p>
          </div>
        )}
      </section>
      <section className="panel">
        <h2 className="text-lg font-semibold">Devices & coverage</h2>
        <div className="mt-4 space-y-4">
          {form.devices.map((d) => (
            <div key={d.id}>
              <p className="font-medium text-sm">{d.label}</p>
              {d.type === "camera" ? (
                <label className="mt-2 block text-sm text-ink-soft">
                  Covered rooms · comma-separated
                  <input
                    className="field"
                    value={d.coveredRooms.join(",")}
                    onChange={(e) =>
                      change((f) => ({
                        ...f,
                        devices: f.devices.map((v) =>
                          v.id === d.id
                            ? { ...v, coveredRooms: e.target.value.split(",") }
                            : v,
                        ),
                      }))
                    }
                  />
                </label>
              ) : (
                <p className="mt-1 text-sm text-ink-mute">
                  Review sync and wearing status on Overview.
                </p>
              )}
            </div>
          ))}
        </div>
        <label className="mt-5 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.subject.monitoringPaused}
            onChange={(e) =>
              change((f) => ({
                ...f,
                subject: { ...f.subject, monitoringPaused: e.target.checked },
              }))
            }
          />
          Pause sample monitoring
        </label>
        <p className="mt-2 text-xs text-ink-mute">
          Pausing suppresses inactivity alerts. Existing alerts remain available
          for follow-up.
        </p>
      </section>
      <section className="panel">
        <h2 className="text-lg font-semibold">Care contacts & notifications</h2>
        <p className="mt-2 text-sm text-ink-mute">
          Contacts are listed in escalation order. The first contact is primary.
          Email can be delivered through the configured provider; other channels
          are previews.
        </p>
        {form.contacts.map((c, i) => (
          <div
            className="mt-5 space-y-3 border-t border-surface-line pt-4"
            key={c.id}
          >
            <div className="flex items-end gap-3">
              <span className="pb-3 text-ink-mute">{i + 1}</span>
              <label className="flex-1 text-sm">
                Contact name
                <input
                  className="field"
                  value={c.name}
                  onChange={(e) =>
                    change((f) => ({
                      ...f,
                      contacts: f.contacts.map((v) =>
                        v.id === c.id ? { ...v, name: e.target.value } : v,
                      ),
                    }))
                  }
                />
              </label>
              <button
                className="btn-secondary"
                disabled={i === 0}
                onClick={() =>
                  change((f) => {
                    const contacts = [...f.contacts];
                    const [primary] = contacts.splice(i, 1);
                    primary.channels = [
                      ...new Set<
                        Settings["contacts"][number]["channels"][number]
                      >(["email", ...primary.channels]),
                    ];
                    primary.subscriptions = {
                      ...primary.subscriptions,
                      critical: true,
                    };
                    contacts.unshift(primary);
                    return { ...f, contacts };
                  })
                }
              >
                Set as primary
              </button>
              <button
                className="btn-secondary"
                disabled={!!c.userId}
                title={
                  c.userId
                    ? "Your account contact must remain"
                    : "Remove contact"
                }
                onClick={() =>
                  change((f) => ({
                    ...f,
                    contacts: f.contacts.filter((v) => v.id !== c.id),
                  }))
                }
              >
                Remove
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["email", "phone", "relationship"] as const).map((key) => (
                <label className="text-sm capitalize" key={key}>
                  {key}
                  <input
                    type={key === "email" ? "email" : "text"}
                    className="field"
                    value={c[key]}
                    onChange={(e) =>
                      change((f) => ({
                        ...f,
                        contacts: f.contacts.map((v) =>
                          v.id === c.id ? { ...v, [key]: e.target.value } : v,
                        ),
                      }))
                    }
                  />
                </label>
              ))}
              <label className="text-sm">
                Role
                <select
                  className="field"
                  value={c.role}
                  onChange={(e) =>
                    change((f) => ({
                      ...f,
                      contacts: f.contacts.map((v) =>
                        v.id === c.id
                          ? {
                              ...v,
                              role: e.target
                                .value as Settings["contacts"][number]["role"],
                            }
                          : v,
                      ),
                    }))
                  }
                >
                  {["family", "caregiver", "healthcare_provider"].map(
                    (role) => (
                      <option key={role}>{role}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-5">
              {(["critical", "moderate", "low"] as const).map((level) => (
                <label className="text-sm capitalize" key={level}>
                  <input
                    className="mr-2"
                    type="checkbox"
                    disabled={i === 0 && level === "critical"}
                    checked={c.subscriptions[level]}
                    onChange={(e) =>
                      change((f) => ({
                        ...f,
                        contacts: f.contacts.map((v) =>
                          v.id === c.id
                            ? {
                                ...v,
                                subscriptions: {
                                  ...v.subscriptions,
                                  [level]: e.target.checked,
                                },
                              }
                            : v,
                        ),
                      }))
                    }
                  />
                  {level}
                  {i === 0 && level === "critical" && " (required)"}
                </label>
              ))}
            </div>
            <div className="flex gap-5">
              {(["email", "sms", "push"] as const).map((channel) => (
                <label className="text-sm" key={channel}>
                  <input
                    className="mr-2"
                    type="checkbox"
                    disabled={channel !== "email" || i === 0}
                    checked={c.channels.includes(channel)}
                    onChange={(e) =>
                      change((f) => ({
                        ...f,
                        contacts: f.contacts.map((v) =>
                          v.id === c.id
                            ? {
                                ...v,
                                channels: e.target.checked
                                  ? [...v.channels, channel]
                                  : v.channels.filter((ch) => ch !== channel),
                              }
                            : v,
                        ),
                      }))
                    }
                  />
                  {channel.toUpperCase()}
                  {channel !== "email" && " (preview only)"}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm">
                Time zone
                <select
                  className="field"
                  value={c.timeZone}
                  onChange={(e) =>
                    change((f) => ({
                      ...f,
                      contacts: f.contacts.map((v) =>
                        v.id === c.id ? { ...v, timeZone: e.target.value } : v,
                      ),
                    }))
                  }
                >
                  {Intl.supportedValuesOf("timeZone").map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Quiet hours start
                <input
                  type="time"
                  className="field"
                  value={c.quietHours?.start ?? ""}
                  onChange={(e) =>
                    change((f) => ({
                      ...f,
                      contacts: f.contacts.map((v) =>
                        v.id === c.id
                          ? {
                              ...v,
                              quietHours: e.target.value
                                ? {
                                    start: e.target.value,
                                    end: v.quietHours?.end ?? "07:00",
                                  }
                                : null,
                            }
                          : v,
                      ),
                    }))
                  }
                />
              </label>
              <label className="text-sm">
                Quiet hours end
                <input
                  type="time"
                  className="field"
                  value={c.quietHours?.end ?? ""}
                  onChange={(e) =>
                    change((f) => ({
                      ...f,
                      contacts: f.contacts.map((v) =>
                        v.id === c.id
                          ? {
                              ...v,
                              quietHours: e.target.value
                                ? {
                                    start: v.quietHours?.start ?? "22:00",
                                    end: e.target.value,
                                  }
                                : null,
                            }
                          : v,
                      ),
                    }))
                  }
                />
              </label>
            </div>
          </div>
        ))}
        <button
          disabled={form.contacts.length >= 8}
          className="btn-secondary mt-4"
          onClick={() =>
            change((f) => ({
              ...f,
              contacts: [
                ...f.contacts,
                {
                  id: crypto.randomUUID(),
                  subjectId: personId,
                  userId: null,
                  name: "",
                  email: "",
                  phone: "",
                  relationship: "",
                  role: "family",
                  subscriptions: { critical: true, moderate: true, low: false },
                  escalationOrder: f.contacts.length + 1,
                  timeZone: f.subject.timeZone,
                  channels: ["email"],
                  phoneVerified: false,
                  quietHours: null,
                },
              ],
            }))
          }
        >
          Add contact
        </button>
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-surface-line pt-5">
          {Object.entries(labels).map(([key, label]) => (
            <label key={key} className="text-sm">
              <input
                className="mr-2"
                type="checkbox"
                disabled={key === "possible_fall"}
                checked={Boolean(
                  form.subscription[key as keyof Settings["subscription"]],
                )}
                onChange={(e) =>
                  change((f) => ({
                    ...f,
                    subscription: {
                      ...f.subscription,
                      [key]: e.target.checked,
                    },
                  }))
                }
              />
              {label}
            </label>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2 className="text-lg font-semibold">Privacy & data</h2>
        <p className="mt-3 text-sm text-ink-soft">
          Automatic device monitoring is designed around structured
          observations. Optional clips are uploaded only when you choose them
          for an assessment and confirm permission. Clips are sent to Kimi for
          analysis, retained locally for {form.policy.retentionHours} hours, and
          can be deleted from the assessment. The provider file is requested for
          deletion after processing.
        </p>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer">Data sources</summary>
          <p className="mt-2 text-ink-mute">
            This workspace contains sample device information and uploaded
            sample observations. It does not represent live monitoring. Analysis
            results identify whether a model or rules were used.
          </p>
        </details>
      </section>
      <div className="sticky bottom-4 flex items-center justify-between gap-5 rounded-xl border border-surface-line bg-white p-4 shadow-lift">
        <p role="status" className="text-sm text-ink-soft">
          {message ||
            (dirty
              ? "Unsaved changes · draft stored on this browser"
              : "All changes saved")}
        </p>
        <button
          className="btn-primary shrink-0"
          disabled={busy || !dirty}
          onClick={save}
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
