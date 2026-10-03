"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { api } from "@/client/api";
import { peopleSchema } from "@/shared/contracts/assessment";
import {
  createPersonSchema,
  emptyProfile,
  statusLabels,
} from "@/shared/contracts/monitoring";
import { HealthProfileEditor } from "@/client/components/HealthProfileEditor";
import { useDemo } from "@/client/provider/DemoProvider";

export default function People() {
  const { selectPerson, refresh, selectedPersonId } = useDemo();
  const [people, setPeople] = useState<z.infer<typeof peopleSchema>>([]);
  const [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [removing, setRemoving] = useState<
    z.infer<typeof peopleSchema>[number] | null
  >(null);
  const [removed, setRemoved] = useState<{ id: string; label: string } | null>(
    null,
  );
  const [form, setForm] = useState<z.infer<typeof createPersonSchema>>(
    createPersonSchema.parse({
      name: "New person",
      alias: "New person",
      age: null,
      timeZone: "Asia/Hong_Kong",
      profile: {},
      primaryContact: { name: "Family contact" },
    }),
  );
  useEffect(() => {
    let active = true;
    const load = () =>
      api("people", peopleSchema)
        .then((v) => {
          if (active) setPeople(v);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [revision]);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setRevision((n) => n + 1);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex justify-between">
        <div>
          <h1 className="text-2xl font-semibold">People monitored</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Each person has their own profile, monitoring inputs, history and
            care network.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setAdding(!adding);
            setForm({
              ...form,
              name: "",
              alias: "",
              profile: emptyProfile(),
              primaryContact: { ...form.primaryContact, name: "", email: "" },
            });
          }}
        >
          Add person
        </button>
      </div>
      {error && (
        <p role="alert" className="text-critical">
          {error}
        </p>
      )}
      {removed && (
        <div className="panel flex items-center justify-between">
          <span>
            {removed.label} removed. Monitoring and new notifications have
            stopped.
          </span>
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() =>
              act(async () => {
                await api(
                  `people/${removed.id}/restore`,
                  z.object({ restored: z.boolean(), personId: z.string() }),
                  { method: "POST" },
                );
                setRemoved(null);
              })
            }
          >
            Undo removal
          </button>
        </div>
      )}
      {adding && (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              const input = createPersonSchema.parse({
                ...form,
                alias: form.alias || form.name,
              });
              const created = await api(
                "people",
                z.object({ personId: z.string() }),
                { method: "POST", body: JSON.stringify(input) },
              );
              selectPerson(created.personId);
              setAdding(false);
            });
          }}
        >
          <section className="panel">
            <h2 className="font-semibold">Add monitored person</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                Name
                <input
                  required
                  className="field"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="text-sm">
                Notification alias
                <input
                  className="field"
                  value={form.alias}
                  placeholder="Name or family nickname"
                  onChange={(e) => setForm({ ...form, alias: e.target.value })}
                />
              </label>
              <label className="text-sm">
                Age
                <input
                  type="number"
                  min="50"
                  max="120"
                  className="field"
                  value={form.age ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      age: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </label>
              <label className="text-sm">
                Time zone
                <input
                  required
                  className="field"
                  value={form.timeZone}
                  onChange={(e) =>
                    setForm({ ...form, timeZone: e.target.value })
                  }
                />
              </label>
            </div>
          </section>
          <HealthProfileEditor
            value={form.profile}
            onChange={(profile) => setForm({ ...form, profile })}
          />
          <section className="panel">
            <h2 className="font-semibold">Primary care contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(["name", "email", "phone", "relationship"] as const).map(
                (key) => (
                  <label className="text-sm capitalize" key={key}>
                    {key}
                    <input
                      required={
                        key === "name" || (key === "email" && form.emailEnabled)
                      }
                      type={key === "email" ? "email" : "text"}
                      className="field"
                      value={form.primaryContact[key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          primaryContact: {
                            ...form.primaryContact,
                            [key]: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                ),
              )}
            </div>
            <p className="mt-3 text-xs text-ink-mute">
              Primary contacts always subscribe to Critical email. Roles and
              other contacts can be edited in Settings.
            </p>
          </section>
          <section className="panel space-y-3">
            <h2 className="font-semibold">Monitoring & notifications</h2>
            <div className="flex gap-4">
              {(["smartwatch", "camera"] as const).map((type) => (
                <label className="text-sm" key={type}>
                  <input
                    className="mr-2"
                    type="checkbox"
                    checked={form.devices.includes(type)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        devices: e.target.checked
                          ? [...form.devices, type]
                          : form.devices.filter((d) => d !== type),
                      })
                    }
                  />
                  Sample {type}
                </label>
              ))}
            </div>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.simulatorEnabled}
                onChange={(e) =>
                  setForm({ ...form, simulatorEnabled: e.target.checked })
                }
              />
              Enable simulated monitoring heartbeat · no live devices connected
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.emailEnabled}
                onChange={(e) =>
                  setForm({ ...form, emailEnabled: e.target.checked })
                }
              />
              Send real email alerts to this care network when the provider is
              configured
            </label>
            <p className="text-xs text-ink-mute">
              New people start without a learned baseline or health history.
            </p>
          </section>
          <div className="flex gap-3">
            <button disabled={busy} className="btn-primary">
              {busy ? "Creating…" : "Create person"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {people.map((p) => (
          <article key={p.id} className="panel">
            <h2 className="text-lg font-semibold">{p.label}</h2>
            <p className="mt-1 text-sm text-ink-mute">
              {p.age !== null && p.age !== undefined ? `${p.age} years · ` : ""}
              {p.timeZone}
            </p>
            <p
              className={`mt-3 text-sm font-medium ${p.displayStatus === "critical" ? "text-critical" : p.displayStatus === "unknown" || p.displayStatus === "paused" ? "text-ink-mute" : p.displayStatus === "stable" ? "text-stable" : "text-important"}`}
            >
              {statusLabels[p.displayStatus ?? "unknown"]} · {p.openAlertCount}{" "}
              active alerts
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                className="btn-secondary"
                href={`/people/${p.id}`}
                onClick={() => selectPerson(p.id)}
              >
                View profile
              </Link>
              <Link
                href="/settings"
                className="btn-secondary"
                onClick={() => selectPerson(p.id)}
              >
                Edit / pause
              </Link>
              <button
                className="text-sm text-critical"
                onClick={() => setRemoving(p)}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
      {!people.length && !adding && (
        <div className="panel">No people monitored. Add a person to begin.</div>
      )}
      {removing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-person-title"
            className="panel max-w-lg"
          >
            <h2 className="text-xl font-semibold" id="remove-person-title">
              Remove {removing.label} from LivePrevent?
            </h2>
            <p className="mt-3 text-sm text-ink-soft">
              This stops monitoring and new notifications. Records stay local
              and removal can be undone. An email already accepted by the
              provider cannot be recalled.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                disabled={busy}
                className="btn-primary bg-critical"
                onClick={() =>
                  act(async () => {
                    await api(
                      `people/${removing.id}`,
                      z.object({
                        removed: z.boolean(),
                        personId: z.string(),
                        recoverable: z.boolean(),
                      }),
                      { method: "DELETE" },
                    );
                    setRemoved({ id: removing.id, label: removing.label });
                    if (selectedPersonId === removing.id) {
                      const next = await api("people", peopleSchema);
                      selectPerson(next[0]?.id ?? "");
                    }
                    setRemoving(null);
                  })
                }
              >
                Remove person
              </button>
              <button
                disabled={busy}
                className="btn-secondary"
                onClick={() => setRemoving(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
