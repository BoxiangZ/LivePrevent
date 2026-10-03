"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="mx-auto max-w-lg py-16">
      <div className="panel space-y-5">
        <p className="eyebrow">LivePrevent</p>
        <h1 className="text-3xl font-semibold">A clearer view of care.</h1>
        <p className="text-ink-soft">
          Review observations, understand changes and coordinate the next step.
        </p>
        <button
          className="btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await fetch("/api/v3/session", { method: "POST" });
              if (!r.ok) {
                const body = await r.json();
                throw new Error(body.message ?? "Unable to open workspace");
              }
              router.push("/overview");
            } catch (e) {
              setError(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Opening…" : "Open workspace"}
        </button>
        <p className="text-xs text-ink-mute">
          This sample workspace uses a local family account and example records.
          Devices are simulated. Real email alerts can be enabled for configured
          care contacts.
        </p>
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  );
}
