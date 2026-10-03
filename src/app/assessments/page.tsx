"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import { api } from "@/client/api";
import {
  assessmentSchema,
  type Assessment,
} from "@/shared/contracts/assessment";
import { useDemo } from "@/client/provider/DemoProvider";
export default function Assessments() {
  const { selectedPersonId } = useDemo();
  const [items, setItems] = useState<Assessment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setItems([]);
    setLoading(true);
    const load = () =>
      api(`people/${selectedPersonId}/assessments`, z.array(assessmentSchema))
        .then((v) => {
          if (active) {
            setItems(v);
            setError("");
            setLoading(false);
          }
        })
        .catch((e) => {
          if (active) {
            setError(e.message);
            setLoading(false);
          }
        });
    load();
    const t = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [selectedPersonId]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Assessments</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Review observations and understand the next step.
          </p>
        </div>
        <Link href="/assessments/new" className="btn-primary">
          New assessment
        </Link>
      </div>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <div className="panel">Loading assessments…</div>
      ) : !items.length ? (
        <section className="panel py-12 text-center">
          <h2 className="text-lg font-semibold">
            Start with a set of observations
          </h2>
          <p className="mt-3 text-sm text-ink-mute">
            Add sensor information and an optional video clip to review.
          </p>
          <Link href="/assessments/new" className="btn-secondary mt-5">
            Add information
          </Link>
        </section>
      ) : (
        <div className="panel divide-y divide-surface-line">
          {items.map((a) => (
            <Link
              href={`/assessments/${a.assessmentId}`}
              key={a.assessmentId}
              className="flex items-center justify-between gap-4 py-5"
            >
              <div>
                <h2 className="font-semibold">
                  {a.finding?.headline ?? a.stage}
                </h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {new Date(a.input.observedAt).toLocaleString()} · Observations
                  {a.input.videoAssetId ? " + video" : ""}
                </p>
                <p className="mt-1 text-xs text-ink-mute">
                  Sample information · Created{" "}
                  {new Date(a.createdAt).toLocaleString()}
                </p>
              </div>
              <span className="rounded-full bg-surface-soft px-3 py-1 text-sm capitalize">
                {a.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
