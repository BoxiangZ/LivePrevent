import { getStore, listPeople, saveStore, appendAudit } from "@/server/store";
import { assertMinimalContent } from "@/server/alerts/templates";

export function emailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY &&
    process.env.LIVEPREVENT_EMAIL_FROM &&
    process.env.LIVEPREVENT_APP_URL,
  );
}
/** Persist before I/O. Resend's idempotency key also covers crash/retry after provider acceptance. */
export async function deliverNextEmail(now = Date.now()) {
  for (const p of listPeople()) {
    const s = getStore(p.id);
    if (!s || s.subject.monitoringPaused || !s.monitoring.emailEnabled)
      continue;
    for (const a of s.alerts) {
      const n = a.notifications.find(
        (n) =>
          n.channel === "email" &&
          n.simulated === false &&
          n.deliveryStatus === "pending" &&
          (n.leaseUntil ?? 0) <= now &&
          (!n.nextAttemptAt || Date.parse(n.nextAttemptAt) <= now),
      );
      if (!n) continue;
      const contact = s.contacts.find((c) => c.id === n.contactId);
      const body = s.notificationBodies[n.id];
      if (
        a.status !== "open" ||
        !contact ||
        contact.email !== n.recipientEmail ||
        (a.level === "important" &&
          contact.subscriptions?.moderate === false) ||
        (a.level === "watch" && contact.subscriptions?.low !== true) ||
        (a.level === "critical" &&
          contact.escalationOrder !== 1 &&
          contact.subscriptions?.critical === false)
      ) {
        n.deliveryStatus = "failed";
        n.error =
          "Email cancelled because the alert or recipient preferences changed.";
        n.retryable = false;
        saveStore(s);
        return;
      }
      n.attempts = (n.attempts ?? 0) + 1;
      n.leaseUntil = now + 30_000;
      saveStore(s);
      let providerMessageId: string | undefined;
      let error: string | undefined;
      let retryable = false;
      try {
        if (!emailConfigured())
          throw new Error(
            "Email provider is not configured. Set RESEND_API_KEY, LIVEPREVENT_EMAIL_FROM and LIVEPREVENT_APP_URL.",
          );
        if (!n.recipientEmail)
          throw new Error("The subscribed contact has no email address.");
        if (!body?.subject) throw new Error("Email content is unavailable.");
        const base = new URL(process.env.LIVEPREVENT_APP_URL!);
        if (
          !["http:", "https:"].includes(base.protocol) ||
          base.username ||
          base.password
        )
          throw new Error("Configure a valid application URL.");
        const eventUrl = new URL(
          `/events/${encodeURIComponent(a.eventId)}`,
          base,
        ).href;
        // Preview acknowledgement tokens stay in the authenticated app, not in third-party email logs.
        const content = body.rawToken
          ? body.body
              .replaceAll(`/ack/${body.rawToken}`, eventUrl)
              .replace(/One-time link expires[^\n]*\n?/, "")
          : body.body;
        const text = `${content}\n\nView event: ${eventUrl}\nView dashboard: ${new URL("/overview", base).href}`;
        assertMinimalContent({
          channel: "email",
          subject: body.subject,
          body: text,
        });
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          signal: AbortSignal.timeout(8000),
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `liveprevent/${n.id}`,
          },
          body: JSON.stringify({
            from: process.env.LIVEPREVENT_EMAIL_FROM,
            to: [n.recipientEmail],
            subject: body.subject,
            text,
          }),
        });
        if (!response.ok) {
          retryable = response.status === 429 || response.status >= 500;
          throw new Error(
            `Email provider rejected the request (${response.status}).`,
          );
        }
        const result = await response.json();
        if (typeof result.id !== "string") {
          retryable = true;
          throw new Error("Email provider response was invalid.");
        }
        providerMessageId = result.id;
      } catch (e) {
        if (
          e instanceof Error &&
          ["TimeoutError", "AbortError", "TypeError"].includes(e.name)
        )
          retryable = true;
        error =
          e instanceof Error && e.name === "Error"
            ? e.message
            : "Email provider could not be reached.";
      }
      const latest = getStore(p.id);
      const record = latest?.alerts
        .find((al) => al.id === a.id)
        ?.notifications.find((r) => r.id === n.id);
      if (!latest || !record) return;
      // Do not overwrite a cancellation/removal while the provider request was in flight.
      if (record.deliveryStatus !== "pending") return;
      record.leaseUntil = undefined;
      record.providerMessageId = providerMessageId;
      record.error = error;
      record.retryable =
        Boolean(error) && retryable && (record.attempts ?? 0) < 4;
      record.deliveryStatus = providerMessageId
        ? "sent"
        : record.retryable
          ? "pending"
          : "failed";
      record.nextAttemptAt = record.retryable
        ? new Date(now + 60_000 * (record.attempts ?? 1)).toISOString()
        : undefined;
      appendAudit(latest, {
        at: new Date().toISOString(),
        actorUserId: null,
        actorRole: "system",
        action: providerMessageId
          ? "notification_sent"
          : "notification_delivery_failed",
        targetContactId: record.contactId,
        detail: {
          alertId: a.id,
          notificationId: record.id,
          provider: "resend",
          attempts: record.attempts ?? 1,
        },
      });
      saveStore(latest);
      return;
    }
  }
}
