"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { api } from "@/client/api";
import {
  assessmentSchema,
  createAssessmentSchema,
  mediaSchema,
  optionSchema,
  envelope,
  type Media,
  type Observation,
} from "@/shared/contracts/assessment";
import { useDemo } from "@/client/provider/DemoProvider";
const toLocal = (v: Date) =>
  new Date(v.getTime() - v.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
export default function NewAssessment() {
  const { selectedPersonId } = useDemo();
  return <Form key={selectedPersonId} personId={selectedPersonId} />;
}
function Form({ personId }: { personId: string }) {
  const router = useRouter();
  const [options, setOptions] = useState<z.infer<typeof optionSchema> | null>(
    null,
  );
  const [scenario, setScenario] =
    useState<z.infer<typeof createAssessmentSchema>["scenario"]>(
      "general_check",
    );
  const [at, setAt] = useState(toLocal(new Date()));
  const [observations, setObservations] = useState<Observation[]>([]);
  const [sensor, setSensor] = useState<Media | null>(null);
  const [video, setVideo] = useState<Media | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<Observation["kind"]>("impact");
  const [value, setValue] = useState("true");
  const [coverage, setCoverage] = useState(true);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const alive = useRef(true);
  const key = useRef(crypto.randomUUID());
  useEffect(() => {
    alive.current = true;
    api("assessment-options", optionSchema)
      .then((v) => {
        if (alive.current) setOptions(v);
      })
      .catch((e) => setError(e.message));
    return () => {
      alive.current = false;
      xhr.current?.abort();
    };
  }, []);
  function edit() {
    key.current = crypto.randomUUID();
    setError("");
  }
  async function upload(file: File, kind: "sensor" | "video") {
    setError("");
    setProgress(0);
    let assetId: string | null = null;
    try {
      const created = await api(
        "media/uploads",
        z.object({ media: mediaSchema, uploadUrl: z.string() }),
        {
          method: "POST",
          body: JSON.stringify({
            personId,
            name: file.name,
            kind,
            size: file.size,
            mime: file.type || "application/octet-stream",
          }),
        },
      );
      assetId = created.media.assetId;
      if (!alive.current) return;
      const result = await new Promise<Media>((resolve, reject) => {
        const request = new XMLHttpRequest();
        xhr.current = request;
        request.open("PUT", created.uploadUrl);
        request.upload.onprogress = (e) => {
          if (e.lengthComputable && alive.current)
            setProgress(Math.round((e.loaded / e.total) * 100));
        };
        request.onload = () => {
          try {
            const body = JSON.parse(request.responseText);
            if (request.status >= 400)
              throw new Error(body.message ?? "Upload failed");
            resolve(envelope(mediaSchema).parse(body).data);
          } catch (e) {
            reject(e);
          }
        };
        request.onerror = () =>
          reject(new Error("Upload interrupted. Select the file to retry."));
        request.onabort = () => reject(new Error("Upload cancelled."));
        request.send(file);
      });
      if (alive.current) {
        if (kind === "video") setVideo(result);
        else {
          setSensor(result);
          if (result.observations[0])
            setAt(toLocal(new Date(result.observations[0].at)));
        }
        edit();
      }
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Upload failed");
      if (assetId)
        await api(`media/${assetId}`, z.object({ deleted: z.boolean() }), {
          method: "DELETE",
        }).catch(() => undefined);
    } finally {
      if (alive.current) setProgress(null);
      xhr.current = null;
    }
  }
  async function remove(m: Media) {
    try {
      await api(`media/${m.assetId}`, z.object({ deleted: z.boolean() }), {
        method: "DELETE",
      });
      if (m.kind === "video") setVideo(null);
      else setSensor(null);
      edit();
    } catch (e) {
      setError(String(e));
    }
  }
  function example() {
    edit();
    const time = new Date(at).toISOString();
    setObservations([
      { kind: "device_online", value: true, at: time, source: "sample_sensor" },
      { kind: "worn", value: true, at: time, source: "sample_sensor" },
    ]);
    setScenario("general_check");
  }
  function add() {
    try {
      const time = new Date(at).toISOString();
      const type = options?.kinds.find((k) => k.value === kind)?.type;
      setObservations((v) => [
        ...v,
        {
          kind,
          value:
            type === "boolean"
              ? value === "true"
              : type === "number"
                ? Number(value)
                : value,
          at: time,
          source: "sample_manual",
          ...(kind === "fall_posture" ? { withinCoverage: coverage } : {}),
        },
      ]);
      edit();
    } catch {
      setError("Choose a valid observation time.");
    }
  }
  async function analyze() {
    setBusy(true);
    setError("");
    try {
      const input = createAssessmentSchema.parse({
        personId,
        scenario,
        observedAt: new Date(at).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        observations,
        sensorAssetIds: sensor ? [sensor.assetId] : [],
        ...(video ? { videoAssetId: video.assetId } : {}),
        note,
        provenance: "sample_user_uploaded",
        consent,
        idempotencyKey: key.current,
      });
      const created = await api("assessments", assessmentSchema, {
        method: "POST",
        body: JSON.stringify(input),
      });
      await api(
        `assessments/${created.assessmentId}/analyze`,
        assessmentSchema,
        { method: "POST" },
      );
      if (alive.current) router.push(`/assessments/${created.assessmentId}`);
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof z.ZodError
            ? e.issues.map((i) => i.message).join("; ")
            : e instanceof Error
              ? e.message
              : "Unable to start analysis",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/assessments" className="text-sm text-ink-mute">
        ← Assessments
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">New assessment</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Add observations and, if available, a short video clip.
        </p>
      </div>
      <section className="panel space-y-5">
        <div>
          <p className="eyebrow">1 · Add information</p>
          <h2 className="mt-2 text-lg font-semibold">Information to review</h2>
          <p className="mt-1 text-xs text-ink-mute">
            For selected person · Times are entered in{" "}
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            What would you like reviewed?
            <select
              className="field"
              value={scenario}
              onChange={(e) => {
                setScenario(e.target.value as typeof scenario);
                edit();
              }}
            >
              {options?.scenarios.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Time of observation
            <input
              className="field"
              type="datetime-local"
              value={at}
              onChange={(e) => {
                setAt(e.target.value);
                edit();
              }}
            />
          </label>
        </div>
        <div className="rounded-xl border border-dashed border-surface-line p-5">
          <div className="flex justify-between">
            <h3 className="font-medium">Sensor observations</h3>
            <button className="text-sm text-brand-600" onClick={example}>
              Use example
            </button>
          </div>
          <p className="mt-2 text-sm text-ink-mute">
            Upload CSV or JSON, or add observations below. Maximum 1 MB / 1,000
            rows.
          </p>
          <a
            className="mt-2 inline-block text-sm text-brand-600"
            href="/samples/observations.csv"
            download
          >
            Download example CSV
          </a>
          <input
            aria-label="Upload sensor observations"
            type="file"
            accept=".csv,.json"
            className="mt-3 block text-sm"
            disabled={progress !== null || !!sensor}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f, "sensor");
              e.target.value = "";
            }}
          />
          {sensor && (
            <div className="mt-3">
              <p className="text-sm">
                {sensor.name} · {sensor.observations.length} observations{" "}
                <button
                  className="ml-3 text-brand-600"
                  onClick={() => remove(sensor)}
                >
                  Remove file
                </button>
              </p>
              <details className="mt-2 text-sm">
                <summary>Preview imported data</summary>
                {sensor.observations.slice(0, 10).map((o, i) => (
                  <p key={i}>
                    {o.kind.replaceAll("_", " ")}: {String(o.value)} ·{" "}
                    {new Date(o.at).toLocaleString()}
                  </p>
                ))}
              </details>
            </div>
          )}
        </div>
        <details open={!sensor && !observations.length}>
          <summary className="cursor-pointer text-sm font-medium">
            Add observations manually
          </summary>
          <div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-3">
            <label className="text-sm">
              Observation
              <select
                className="field"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as typeof kind);
                  setValue(
                    options?.kinds.find((k) => k.value === e.target.value)
                      ?.type === "boolean"
                      ? "true"
                      : "",
                  );
                }}
              >
                {options?.kinds.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Value
              {options?.kinds.find((k) => k.value === kind)?.type ===
              "boolean" ? (
                <select
                  className="field"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  className="field"
                  value={value}
                  type={
                    options?.kinds.find((k) => k.value === kind)?.type ===
                    "number"
                      ? "number"
                      : "text"
                  }
                  min="0"
                  maxLength={300}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
            </label>
            <button
              className="btn-secondary"
              onClick={add}
              disabled={!value || observations.length >= 1000}
            >
              Add
            </button>
          </div>
          {kind === "fall_posture" && (
            <label className="mt-3 block text-sm">
              <input
                type="checkbox"
                checked={coverage}
                onChange={(e) => setCoverage(e.target.checked)}
              />{" "}
              Within camera coverage
            </label>
          )}
        </details>
        {!!observations.length && (
          <ul className="divide-y divide-surface-line">
            {observations.map((o, i) => (
              <li key={i} className="flex justify-between py-2 text-sm">
                <span>
                  {options?.kinds.find((k) => k.value === o.kind)?.label}:{" "}
                  <strong>
                    {typeof o.value === "boolean"
                      ? o.value
                        ? "Yes"
                        : "No"
                      : o.value}
                  </strong>
                  <span className="ml-3 text-xs text-ink-mute">
                    {new Date(o.at).toLocaleString()} ·{" "}
                    {o.source === "sample_manual"
                      ? "Manual observation"
                      : "Example information"}
                  </span>
                </span>
                <button
                  onClick={() => {
                    setObservations((v) => v.filter((_, j) => j !== i));
                    edit();
                  }}
                  className="text-brand-600"
                  aria-label={`Remove observation ${i + 1}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="rounded-xl bg-surface-soft p-5">
          <h3 className="font-medium">
            Video clip{" "}
            <span className="text-sm font-normal text-ink-mute">
              · optional
            </span>
          </h3>
          <p className="mt-2 text-sm text-ink-soft">{options?.videoMessage}</p>
          <p className="mt-2 text-xs text-ink-mute">
            Use a sample clip you have permission to share. Analysis sends the
            clip to Kimi. Local files expire after{" "}
            {options?.limits.retentionHours ?? 24} hours and can be deleted
            sooner.
          </p>
          <input
            aria-label="Upload optional sample video"
            type="file"
            accept="video/mp4,.mp4"
            disabled={progress !== null || !!video}
            className="mt-3 block text-sm"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f, "video");
              e.target.value = "";
            }}
          />
          {video && (
            <div className="mt-4">
              <video
                className="max-h-64 w-full rounded-lg bg-black"
                controls
                src={`/api/v3/media/${video.assetId}/content`}
              />
              <p className="mt-2 text-sm">
                {video.name} · {video.durationSeconds?.toFixed(1)} seconds{" "}
                <button
                  onClick={() => remove(video)}
                  className="ml-4 text-brand-600"
                >
                  Delete video
                </button>
              </p>
            </div>
          )}
        </div>
        {progress !== null && (
          <div role="status" className="flex items-center gap-3">
            <progress max={100} value={progress} />
            <span>{progress}% uploaded</span>
            <button
              className="text-sm text-brand-600"
              onClick={() => xhr.current?.abort()}
            >
              Cancel upload
            </button>
          </div>
        )}
        <label className="block text-sm">
          Additional context · optional
          <textarea
            className="field"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              edit();
            }}
          />
        </label>
      </section>
      <section className="panel space-y-4">
        <p className="eyebrow">2 · Review and analyze</p>
        <p className="text-sm">
          {observations.length + (sensor?.observations.length ?? 0)}{" "}
          observations{video ? " and one video clip" : " · no video attached"}
        </p>
        <label className="flex items-start gap-2 text-sm text-ink-soft">
          <input
            className="mt-1"
            type="checkbox"
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              edit();
            }}
          />
          I confirm these are sample materials I am allowed to share for this
          analysis.
        </label>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-critical"
          >
            {error}
          </p>
        )}
        <button
          className="btn-primary"
          onClick={analyze}
          disabled={
            busy ||
            progress !== null ||
            !consent ||
            (!observations.length && !sensor)
          }
        >
          {busy ? "Starting analysis…" : "Analyze information"}
        </button>
      </section>
    </div>
  );
}
