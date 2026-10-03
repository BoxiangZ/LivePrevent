"use client";

/**
 * Critical 安全链接落地页 — 联系人从邮件/短信打开一次性链接，确认后进入事件详情。
 */

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDemo } from "@/client/provider/DemoProvider";
import { Card, CardBody, Button } from "@/client/components/ui";

export default function AckPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { selectPerson } = useDemo();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [link, setLink] = useState<{ personId: string; alertId: string; eventId: string; contactName: string; status: string } | null>(null);
  useEffect(() => {
    fetch(`/api/demo/ack/${encodeURIComponent(token)}`).then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error("This link is not valid.");
      setLink(body); selectPerson(body.personId);
      if (body.status !== "valid") setError(body.status === "expired" ? "This link has expired." : "This one-time link has already been used.");
    }).catch((err) => setError(err.message));
  }, [token, selectPerson]);

  const ack = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/alerts/${link?.alertId ?? "unknown"}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "token_expired"
            ? "This link has expired (links are valid for 30 minutes)."
            : data.error === "token_already_used"
              ? "This one-time link has already been used."
              : data.error === "invalid_token"
                ? "This link is not valid."
                : `Could not acknowledge: ${data.error ?? res.status}`
        );
        return;
      }
      router.push(`/events/${data.eventId}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <Card>
        <CardBody className="space-y-4 text-center">
          <span className="relative mx-auto flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-critical opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-critical" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">
              Critical alert — acknowledge
            </h1>
            <p className="mt-1 text-sm text-ink-mute">
              {link
                ? `You are acknowledging as ${link.contactName} via a one-time secure link (valid 30 minutes).`
                : "Validating your one-time secure link…"}
            </p>
          </div>
          {error ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-critical">{error}</div>
          ) : (
            <Button
              variant="danger"
              onClick={ack}
              disabled={submitting || !link || link.status !== "valid"}
              className="w-full"
            >
              {submitting
                ? "Acknowledging…"
                : `Acknowledge${link ? ` as ${link.contactName.split(" ")[0]}` : ""}`}
            </Button>
          )}
          <p className="text-left text-xs leading-relaxed text-ink-mute">
            If you believe this is an emergency, contact local emergency services now. LivePrevent
            is not an emergency service.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
