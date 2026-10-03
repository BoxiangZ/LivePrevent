"use client";
import { useState } from "react";
import type { HealthProfile } from "@/shared/contracts/monitoring";

export function HealthProfileEditor({
  value,
  onChange,
}: {
  value: HealthProfile;
  onChange: (p: HealthProfile) => void;
}) {
  const [conditions, setConditions] = useState(
    value.knownConditions.join(", "),
  );
  const [photoError, setPhotoError] = useState("");
  const update = (patch: Partial<HealthProfile>) =>
    onChange({ ...value, ...patch });
  return (
    <section className="panel space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Health profile</h2>
        <p className="mt-1 text-sm text-ink-mute">
          Reported background helps explain observations. It does not replace
          measured evidence.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Sex
          <select
            className="field"
            value={value.sex}
            onChange={(e) =>
              update({ sex: e.target.value as HealthProfile["sex"] })
            }
          >
            {["unspecified", "female", "male", "other"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {(
          [
            { key: "heightCm", label: "Height (cm)" },
            { key: "weightKg", label: "Weight (kg)" },
          ] as const
        ).map(({ key, label }) => (
          <label className="text-sm" key={key}>
            {label}
            <input
              className="field"
              type="number"
              step="0.1"
              value={value[key] ?? ""}
              onChange={(e) =>
                update({
                  [key]: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </label>
        ))}
        <label className="text-sm">
          Living situation
          <input
            className="field"
            placeholder="At home with family / independently"
            value={value.livingSituation}
            onChange={(e) => update({ livingSituation: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Profile photo · PNG, JPEG or WebP, up to 500 KB
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="field"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (
                file.size > 500 * 1024 ||
                !["image/png", "image/jpeg", "image/webp"].includes(file.type)
              ) {
                setPhotoError("Choose a PNG, JPEG or WebP up to 500 KB.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                update({ photo: String(reader.result) });
                setPhotoError("");
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
        {value.photo && (
          <div>
            <img
              src={value.photo}
              alt="Person profile"
              className="h-20 w-20 rounded-xl object-cover"
            />
            <button
              type="button"
              className="mt-2 text-sm text-brand-600"
              onClick={() => update({ photo: null })}
            >
              Remove photo
            </button>
          </div>
        )}
      </div>
      {photoError && (
        <p role="alert" className="text-sm text-critical">
          {photoError}
        </p>
      )}
      <label className="block text-sm">
        Known conditions · comma-separated
        <input
          className="field"
          placeholder="Hypertension, diabetes"
          value={conditions}
          onChange={(e) => {
            setConditions(e.target.value);
            update({
              knownConditions: e.target.value
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
            });
          }}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["previousFalls", "mobilityIssues", "otherConditions"] as const).map(
          (key) => (
            <label className="text-sm" key={key}>
              {
                {
                  previousFalls: "Previous falls",
                  mobilityIssues: "Mobility issues",
                  otherConditions: "Other health background",
                }[key]
              }
              <input
                className="field"
                value={value[key]}
                onChange={(e) => update({ [key]: e.target.value })}
              />
            </label>
          ),
        )}
      </div>
      <div>
        <h3 className="font-medium">Medication</h3>
        <p className="mt-1 text-xs text-ink-mute">
          For context and professional review. LivePrevent does not prescribe or
          change doses.
        </p>
        {value.medications.map((m, i) => (
          <div
            className="mt-3 grid gap-3 rounded-xl bg-surface-soft p-3 sm:grid-cols-2"
            key={i}
          >
            {(["name", "dose", "frequency", "notes"] as const).map((key) => (
              <label className="text-sm capitalize" key={key}>
                {key}
                <input
                  className="field"
                  value={m[key]}
                  onChange={(e) =>
                    update({
                      medications: value.medications.map((v, j) =>
                        j === i ? { ...v, [key]: e.target.value } : v,
                      ),
                    })
                  }
                />
              </label>
            ))}
            <button
              type="button"
              className="text-left text-sm text-critical"
              onClick={() =>
                update({
                  medications: value.medications.filter((_, j) => j !== i),
                })
              }
            >
              Remove medication
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary mt-3"
          disabled={value.medications.length >= 20}
          onClick={() =>
            update({
              medications: [
                ...value.medications,
                { name: "", dose: "", frequency: "", notes: "" },
              ],
            })
          }
        >
          Add medication
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            { key: "wakeTime", label: "Typical wake time" },
            { key: "sleepTime", label: "Typical sleep time" },
          ] as const
        ).map(({ key, label }) => (
          <label className="text-sm" key={key}>
            {label}
            <input
              type="time"
              className="field"
              value={value[key]}
              onChange={(e) => update({ [key]: e.target.value })}
            />
          </label>
        ))}
        <label className="text-sm">
          Activity level
          <select
            className="field"
            value={value.activityLevel}
            onChange={(e) =>
              update({
                activityLevel: e.target.value as HealthProfile["activityLevel"],
              })
            }
          >
            {["unspecified", "low", "moderate", "active"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Walking aid
          <input
            className="field"
            value={value.walkingAid}
            onChange={(e) => update({ walkingAid: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Lives alone
          <select
            className="field"
            value={
              value.livesAlone === null ? "unknown" : String(value.livesAlone)
            }
            onChange={(e) =>
              update({
                livesAlone:
                  e.target.value === "unknown"
                    ? null
                    : e.target.value === "true",
              })
            }
          >
            <option value="unknown">Not specified</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">
        Additional notes
        <textarea
          className="field"
          maxLength={1000}
          rows={3}
          value={value.notes}
          onChange={(e) => update({ notes: e.target.value })}
        />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          className="mt-1"
          type="checkbox"
          checked={value.shareWithAi}
          onChange={(e) => update({ shareWithAi: e.target.checked })}
        />
        <span>
          Allow Kimi to use this health background for explanations and care
          recommendations. Age, conditions, medication and lifestyle may be sent
          to Kimi; profile photo, name and contact details are excluded. Keep
          identifying information out of notes.
        </span>
      </label>
    </section>
  );
}
