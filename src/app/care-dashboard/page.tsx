"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { api } from "@/client/api";
import { peopleSchema } from "@/shared/contracts/assessment";
import { statusLabels } from "@/shared/contracts/monitoring";
import { useDemo } from "@/client/provider/DemoProvider";
export default function CareDashboard() {
  const { selectPerson } = useDemo();
  const [people, setPeople] = useState<z.infer<typeof peopleSchema>>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      api("people", peopleSchema)
        .then((v) => {
          if (active) {
            setPeople(v);
            setError("");
          }
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
  }, []);
  const rank = {
    critical: 0,
    important: 1,
    watch: 2,
    unknown: 3,
    paused: 4,
    stable: 5,
  };
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Who needs attention today?</h1>
      <p className="text-sm text-ink-soft">
        People in this family's local workspace · simulated monitoring inputs.
      </p>
      {error && (
        <p role="alert" className="text-critical">
          {error}
        </p>
      )}
      <section className="panel overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-surface-line">
              <th className="pb-3">Person</th>
              <th>Status</th>
              <th>Last monitoring input</th>
              <th>Active alerts</th>
            </tr>
          </thead>
          <tbody>
            {[...people]
              .sort(
                (a, b) =>
                  rank[a.displayStatus ?? "unknown"] -
                  rank[b.displayStatus ?? "unknown"],
              )
              .map((p) => (
                <tr
                  className="border-b border-surface-line last:border-0"
                  key={p.id}
                >
                  <td className="py-4">
                    <Link
                      href={`/people/${p.id}`}
                      className="font-medium text-brand-600"
                      onClick={() => selectPerson(p.id)}
                    >
                      {p.label}
                    </Link>
                  </td>
                  <td>{statusLabels[p.displayStatus ?? "unknown"]}</td>
                  <td>
                    {p.lastDataReceivedAt
                      ? new Date(p.lastDataReceivedAt).toLocaleString()
                      : "No data"}
                  </td>
                  <td>{p.openAlertCount}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {!people.length && <p className="mt-4">No people monitored.</p>}
      </section>
    </div>
  );
}
