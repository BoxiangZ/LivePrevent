import { calendarDay } from "@/shared/date";
import {
  createPersonSchema,
  evolutionSchema,
} from "@/shared/contracts/monitoring";
import { createPerson } from "@/server/v3/people";
import { archivedStore, setArchived, resetStore } from "@/server/store";
import { heartbeat } from "@/server/monitoring";
import {
  evolution,
  summarizeEvolution,
  initializeSampleHistory,
  metricDefinitions,
  advanceLongitudinal,
  learnReportedBaselines,
} from "@/server/longitudinal";
import { createRiskEvent } from "@/server/simulator";
import { advance } from "@/server/engine";
import { emailConfigured } from "@/server/notifications/email";
import { POST as acknowledge } from "@/app/api/alerts/[id]/ack/route";
import { POST as resolveAlert } from "@/app/api/alerts/[id]/resolve/route";
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { session, newSession, sameOrigin, ApiError } from "@/server/v3/auth";
import { all } from "@/server/v3/repository";
import {
  limits,
  createMedia,
  publicMedia,
  mediaFor,
  upload,
  readMedia,
  deleteMedia,
} from "@/server/v3/media";
import {
  createAssessment,
  getAssessment,
  publicAssessment,
  listAssessments,
  queueAssessment,
  cancelAssessment,
  type StoredAssessment,
} from "@/server/v3/assessments";
import {
  createAssessmentSchema,
  uploadInputSchema,
  peopleSchema,
  assessmentSchema,
  mediaSchema,
  optionSchema,
} from "@/shared/contracts/assessment";
import { settingsSchema } from "@/shared/contracts/settings";
import { overview, settings } from "@/server/v3/views";
import {
  getStore,
  listPeople,
  saveStore,
  appendAudit,
  findStoreByAlertId,
} from "@/server/store";
import { buildSnapshot } from "@/server/snapshot";
import { kimiAvailable } from "@/server/v3/kimi";
import { startWorker } from "@/server/v3/worker";
import { snapshotSchema, snapshotFields } from "@/shared/contracts/snapshot";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const options = {
  scenarios: [
    { value: "possible_fall", label: "Possible fall" },
    { value: "prolonged_inactivity", label: "Reduced activity" },
    { value: "heart_rate_deviation", label: "Heart rate change" },
    { value: "activity_drop", label: "Activity change" },
    { value: "general_check", label: "General check" },
    { value: "device_data_gap", label: "Device issue" },
  ],
  kinds: [
    { value: "impact", label: "Sudden impact observed", type: "boolean" },
    { value: "fall_posture", label: "Possible fall posture", type: "boolean" },
    {
      value: "inactivity_minutes",
      label: "Minutes without activity",
      type: "number",
    },
    { value: "heart_rate", label: "Heart rate (bpm)", type: "number" },
    { value: "activity_steps", label: "Daily steps", type: "number" },
    { value: "worn", label: "Watch was worn", type: "boolean" },
    { value: "sleeping", label: "Sleeping", type: "boolean" },
    { value: "recovery", label: "Recovery movement observed", type: "boolean" },
    { value: "device_online", label: "Device online", type: "boolean" },
    { value: "note", label: "Other observation", type: "text" },
  ],
  limits,
};
async function handle(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const requestId = randomUUID();
  const send = (data: unknown, status = 200) =>
    NextResponse.json(
      {
        schemaVersion: "3",
        requestId,
        generatedAt: new Date().toISOString(),
        data,
      },
      { status },
    );
  try {
    startWorker();
    const { path } = await params;
    const [resource, id, action, detail] = path;
    const url = new URL(req.url);
    const method = req.method;
    if (method !== "GET") sameOrigin(req);
    if (resource === "session" && method === "POST") {
      const token = newSession();
      const response = send({ ok: true });
      response.cookies.set("lp_session", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: url.protocol === "https:",
        path: "/",
        maxAge: 86400,
      });
      return response;
    }
    const user = session(req);
    if (resource === "session" && method === "GET")
      return send({
        userId: user.userId,
        personIds: user.personIds,
        workspaceMode: "sample",
      });
    if (resource === "people" && !id && method === "POST") {
      const created = createPerson(
        createPersonSchema.parse(await req.json()),
        user.userId,
      );
      return send({ personId: created.subject.id }, 201);
    }
    if (
      resource === "people" &&
      id &&
      action === "restore" &&
      method === "POST"
    ) {
      const removed = archivedStore(id);
      if (!removed || removed.user.id !== user.userId || !removed.archived)
        throw new ApiError(
          404,
          "person_not_found",
          "Removed person not found.",
        );
      setArchived(removed, false);
      appendAudit(removed, {
        at: new Date().toISOString(),
        actorUserId: user.userId,
        actorRole: "primary_family",
        action: "person_restored",
      });
      saveStore(removed);
      return send({ restored: true, personId: id });
    }
    if (resource === "email-status" && method === "GET")
      return send({ configured: emailConfigured(), provider: "resend" });
    if (resource === "people" && !id && method === "GET")
      return send(
        peopleSchema.parse(
          listPeople().filter((p) => user.personIds.includes(p.id)),
        ),
      );
    if (resource === "assessment-options" && method === "GET")
      return send(
        optionSchema.parse({
          ...options,
          videoAvailable: kimiAvailable(),
          videoMessage: kimiAvailable()
            ? "Optional MP4 clip · up to 50 MB / 2 minutes"
            : "Video can be uploaded, but model analysis is unavailable until the provider is configured.",
        }),
      );
    if (resource === "media") {
      if (id === "uploads" && method === "POST") {
        const input = uploadInputSchema.parse(await req.json());
        session(req, input.personId);
        const m = createMedia(input, user.userId);
        return send(
          {
            media: mediaSchema.parse(publicMedia(m)),
            uploadUrl: `/api/v3/media/${m.assetId}/content?token=${m.uploadToken}`,
          },
          201,
        );
      }
      const m = mediaFor(id);
      session(req, m.personId);
      if (action === "content" && method === "PUT")
        return send(
          mediaSchema.parse(
            await upload(req, id, url.searchParams.get("token") ?? ""),
          ),
        );
      if (action === "content" && method === "GET") {
        if (m.status !== "ready")
          throw new ApiError(409, "media_unavailable", "File is not ready.");
        return new Response(new Uint8Array(readMedia(id)), {
          headers: {
            "Content-Type":
              m.kind === "video" ? "video/mp4" : "application/octet-stream",
            "Content-Length": String(m.size),
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (method === "GET" || (action === "complete" && method === "POST"))
        return send(mediaSchema.parse(publicMedia(m)));
      if (method === "DELETE") {
        for (const a of all<StoredAssessment>("assessment"))
          if (
            ["queued", "analyzing"].includes(a.status) &&
            (a.input.videoAssetId === id || a.input.sensorAssetIds.includes(id))
          )
            cancelAssessment(a.assessmentId);
        deleteMedia(id);
        return send({ deleted: true });
      }
    }
    if (resource === "assessments") {
      if (!id && method === "POST") {
        const input = createAssessmentSchema.parse(await req.json());
        session(req, input.personId);
        return send(
          publicAssessment(createAssessment(input, user.userId)),
          201,
        );
      }
      const a = getAssessment(id);
      session(req, a.personId);
      if (method === "GET") return send(publicAssessment(a));
      if (method === "POST" && action === "analyze")
        return send(publicAssessment(queueAssessment(id)), 202);
      if (method === "POST" && action === "retry")
        return send(publicAssessment(queueAssessment(id, true)), 202);
      if (method === "POST" && action === "cancel")
        return send(publicAssessment(cancelAssessment(id)));
    }
    if (resource === "people" && id) {
      session(req, id);
      const store = getStore(id);
      if (!store)
        throw new ApiError(404, "person_not_found", "Person not found.");
      if (method === "DELETE" && !action) {
        for (const a of all<StoredAssessment>("assessment"))
          if (
            a.personId === id &&
            ["created", "queued", "analyzing"].includes(a.status)
          )
            cancelAssessment(a.assessmentId);
        appendAudit(store, {
          at: new Date().toISOString(),
          actorUserId: user.userId,
          actorRole: "primary_family",
          action: "person_removed",
        });
        setArchived(store, true);
        return send({ removed: true, personId: id, recoverable: true });
      }
      if (action === "simulate" && method === "POST") {
        const input = z
          .object({
            scenario: z.enum([
              "low",
              "moderate",
              "critical",
              "data_loss",
              "recover",
              "longitudinal",
              "reset",
            ]),
          })
          .strict()
          .parse(await req.json());
        if (input.scenario === "reset") {
          resetStore(id);
          return send({ reset: true });
        }
        if (input.scenario === "data_loss") {
          store.monitoring.dataLoss = true;
          store.monitoring.lastDataReceivedAt = new Date(
            Date.now() - 17 * 60000,
          ).toISOString();
          for (const d of store.devices) {
            d.online = false;
            d.lastSyncAt = store.monitoring.lastDataReceivedAt;
          }
        } else if (input.scenario === "recover") {
          store.monitoring.dataLoss = false;
          store.monitoring.simulatorEnabled = true;
          store.monitoring.lastDataReceivedAt = null;
          for (const d of store.devices) d.online = true;
          heartbeat(store);
        } else if (input.scenario === "longitudinal") {
          if (store.historyMode !== "sample")
            throw new ApiError(
              409,
              "sample_history_required",
              "Use a sample person to simulate a historical trend.",
            );
          for (const metric of ["activity", "mobility"] as const) {
            const baseline = store.baselines.find(
              (b) => b.metric === metric && b.learned,
            )?.median;
            if (baseline)
              store.trends[metric] = store.trends[metric].map((p, i, arr) =>
                arr.length - i <= 42 ? { ...p, value: baseline * 0.72 } : p,
              );
          }
          store.trendReviewedAt = undefined;
          advanceLongitudinal(store);
        } else {
          if (store.subject.monitoringPaused)
            throw new ApiError(
              409,
              "monitoring_paused",
              "Resume monitoring before simulating risk.",
            );
          if (!store.monitoring.dataLoss) {
            store.monitoring.lastDataReceivedAt = null;
            heartbeat(store);
          }
          const result = createRiskEvent(
            store,
            input.scenario === "low"
              ? "watch"
              : input.scenario === "moderate"
                ? "important"
                : "critical",
            "simulator",
          );
          advance(store, Date.now());
          saveStore(store);
          return send(result, 201);
        }
        saveStore(store);
        return send({ ok: true });
      }
      if (action === "evolution") {
        const days = z.coerce
          .number()
          .refine(
            (n) => [7, 30, 90, 180, 365].includes(n),
            "Choose 7, 30, 90, 180 or 365 days",
          )
          .parse(url.searchParams.get("window") ?? 30);
        if (method === "GET")
          return send(evolutionSchema.parse(evolution(store, days)));
        if (detail === "summary" && method === "POST") {
          const summary = await summarizeEvolution(store, days);
          const latest = getStore(id);
          if (!latest)
            throw new ApiError(404, "person_not_found", "Person was removed.");
          latest.evolutionSummary = summary;
          saveStore(latest);
          return send(evolutionSchema.parse(evolution(latest, days)));
        }
        if (detail === "observations" && method === "POST") {
          const rows = z
            .array(
              z
                .object({
                  key: z.string(),
                  date: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/)
                    .refine((v) => {
                      const d = new Date(v);
                      return (
                        Number.isFinite(d.getTime()) &&
                        d.toISOString().slice(0, 10) === v &&
                        v <= calendarDay(new Date(), store.subject.timeZone)
                      );
                    }, "Use a valid date in the past or today"),
                  value: z.number().finite().nonnegative(),
                })
                .strict(),
            )
            .min(1)
            .max(365)
            .parse(await req.json());
          for (const row of rows) {
            if (
              !metricDefinitions.some((m) => m.key === row.key) ||
              row.key === "risk_events"
            )
              throw new ApiError(
                422,
                "invalid_metric",
                "Choose a supported health measurement.",
              );
            const ceilings: Record<string, number> = {
              activity: 100000,
              sleep: 24,
              resting_hr: 300,
              mobility: 10,
              gait: 100,
              behaviour: 1000,
              weight: 400,
              bp_systolic: 300,
              bp_diastolic: 200,
            };
            if (row.value > ceilings[row.key])
              throw new ApiError(
                422,
                "invalid_value",
                "Measurement is outside the supported range.",
              );
            if (
              ["activity", "sleep", "resting_hr", "mobility"].includes(row.key)
            ) {
              const key = row.key as
                "activity" | "sleep" | "resting_hr" | "mobility";
              store.trends[key] = [
                ...store.trends[key].filter((p) => p.date !== row.date),
                { ...row, metric: key, synthetic: true },
              ].sort((a, b) => a.date.localeCompare(b.date));
            } else
              store.evolutionSeries[row.key] = [
                ...(store.evolutionSeries[row.key] ?? []).filter(
                  (p) => p.date !== row.date,
                ),
                { date: row.date, value: row.value },
              ].sort((a, b) => a.date.localeCompare(b.date));
          }
          store.evolutionSummary = undefined;
          store.trendReviewedAt = undefined;
          learnReportedBaselines(store);
          advanceLongitudinal(store);
          saveStore(store);
          return send(evolutionSchema.parse(evolution(store, days)));
        }
      }
      if (action === "care-tasks" && detail && method === "POST") {
        const input = z
          .object({ outcome: z.string().trim().min(1).max(1000) })
          .strict()
          .parse(await req.json());
        const task = store.careTasks.find((t) => t.id === detail);
        if (!task)
          throw new ApiError(
            404,
            "task_not_found",
            "Care recommendation not found.",
          );
        if (task.status !== "open")
          throw new ApiError(
            409,
            "task_completed",
            "This outcome has already been recorded.",
          );
        task.status = "completed";
        task.completedAt = new Date().toISOString();
        task.outcome = input.outcome;
        appendAudit(store, {
          at: task.completedAt,
          actorUserId: user.userId,
          actorRole: "primary_family",
          action: "care_outcome_recorded",
          detail: { taskId: task.id },
        });
        saveStore(store);
        return send({ ok: true });
      }
      if (method === "GET") {
        if (action === "overview") return send(overview(store));
        if (action === "snapshot")
          return send(
            snapshotSchema.parse({
              ...buildSnapshot(store, Date.now()),
              people: listPeople().filter((p) => user.personIds.includes(p.id)),
            }),
          );
        if (action === "settings") return send(settings(store));
        if (action === "assessments")
          return send(
            z
              .array(assessmentSchema)
              .parse(listAssessments(id).map(publicAssessment)),
          );
        if (action === "devices")
          return send(overview(store).dataFreshness.devices);
        if (action === "trends") {
          const window = url.searchParams.get("window") ?? "30d";
          if (!["7d", "30d", "90d"].includes(window))
            throw new ApiError(400, "invalid_window", "Choose 7d, 30d or 90d.");
          const s = snapshotSchema.parse(buildSnapshot(store, Date.now()));
          return send({
            trends: Object.fromEntries(
              Object.entries(s.trends).map(([k, v]) => [
                k,
                v.slice(-parseInt(window)),
              ]),
            ),
            baselines: s.baselines,
            metricSummaries: s.metricSummaries,
          });
        }
        if (action === "events" && detail) {
          const validated = snapshotSchema.parse(
            buildSnapshot(store, Date.now()),
          );
          const event = validated.events.find((e) => e.id === detail);
          if (!event)
            throw new ApiError(404, "event_not_found", "Event not found.");
          return send({
            event,
            alert: validated.alerts.find((a) => a.eventId === detail) ?? null,
            assessment:
              listAssessments(id).find((a) => a.finding?.eventId === detail)
                ?.assessmentId ?? null,
            summary: validated.kimiSummaries[detail] ?? null,
          });
        }
        if (action === "history")
          return send(
            snapshotFields.events.parse(
              buildSnapshot(store, Date.now()).events,
            ),
          );
        if (action === "alerts") {
          const status = url.searchParams.get("status");
          const alerts = snapshotFields.alerts.parse(
            buildSnapshot(store, Date.now()).alerts,
          );
          return send(
            alerts.filter(
              (a) =>
                !status ||
                status === "all" ||
                (status === "active"
                  ? ["open", "acknowledged"].includes(a.status)
                  : a.status === "resolved" || a.status === "auto_expired"),
            ),
          );
        }
      }
      if (action === "settings" && method === "PATCH") {
        const input = settingsSchema.parse(await req.json());
        if (input.personId !== id)
          throw new ApiError(
            400,
            "person_mismatch",
            "Person does not match this request.",
          );
        if (input.version !== settings(store).version)
          throw new ApiError(
            409,
            "settings_changed",
            "Settings changed. Reload before saving.",
          );
        if (
          JSON.stringify(input.policy) !==
          JSON.stringify(settings(store).policy)
        )
          throw new ApiError(
            403,
            "policy_read_only",
            "Upload policy is managed by the server.",
          );
        if (
          JSON.stringify(input.consent) !==
          JSON.stringify(settings(store).consent)
        )
          throw new ApiError(
            403,
            "consent_read_only",
            "Consent records require the subject or legal guardian.",
          );
        const oldContacts = new Map(store.contacts.map((c) => [c.id, c]));
        if (
          input.contacts.some(
            (c) =>
              c.phoneVerified !==
              (oldContacts.get(c.id)?.phoneVerified ?? false),
          )
        )
          throw new ApiError(
            400,
            "verification_read_only",
            "Phone verification cannot be set manually.",
          );
        if (
          !input.contacts[0].channels.includes("email") ||
          input.contacts[0].subscriptions.critical !== true
        )
          throw new ApiError(
            422,
            "primary_critical_required",
            "The primary contact must subscribe to Critical email.",
          );
        store.subject = { ...store.subject, ...input.subject };
        if (input.profile) store.profile = input.profile;
        if (input.monitoring) {
          if (
            !store.monitoring.simulatorEnabled &&
            input.monitoring.simulatorEnabled
          ) {
            store.monitoring.dataLoss = false;
            store.monitoring.lastDataReceivedAt = null;
            for (const d of store.devices) d.online = true;
          }
          store.monitoring.simulatorEnabled = input.monitoring.simulatorEnabled;
          store.monitoring.emailEnabled = input.monitoring.emailEnabled;
        }
        heartbeat(store);
        store.contacts = input.contacts.map((c, i) => ({
          ...c,
          subjectId: id,
          escalationOrder: i + 1,
          userId: oldContacts.get(c.id)?.userId ?? null,
        }));
        if (!store.contacts.some((c) => c.userId === user.userId))
          throw new ApiError(
            400,
            "primary_contact_required",
            "Keep your account's care contact in the list.",
          );
        store.subscription = { ...input.subscription, subjectId: id };
        for (const d of input.devices) {
          const existing = store.devices.find((v) => v.id === d.id);
          if (existing?.type === "camera")
            existing.coveredRooms = d.coveredRooms;
        }
        appendAudit(store, {
          at: new Date().toISOString(),
          actorUserId: user.userId,
          actorRole: "primary_family",
          action: "permission_changed",
          detail: { target: "settings" },
        });
        saveStore(store);
        return send(settings(store));
      }
    }
    if (
      resource === "notifications" &&
      id &&
      action === "retry" &&
      method === "POST"
    ) {
      const owner = listPeople()
        .map((p) => getStore(p.id))
        .find((s) =>
          s?.alerts.some((a) => a.notifications.some((n) => n.id === id)),
        );
      if (!owner)
        throw new ApiError(
          404,
          "notification_not_found",
          "Notification not found.",
        );
      session(req, owner.subject.id);
      const alert = owner.alerts.find((a) =>
        a.notifications.some((n) => n.id === id),
      )!;
      const record = alert.notifications.find((n) => n.id === id)!;
      if (
        record.simulated !== false ||
        record.deliveryStatus !== "failed" ||
        alert.status !== "open"
      )
        throw new ApiError(
          409,
          "retry_unavailable",
          "Only a failed real email on an open alert can be retried.",
        );
      record.deliveryStatus = "pending";
      record.attempts = 0;
      record.nextAttemptAt = undefined;
      record.error = undefined;
      saveStore(owner);
      return send({ ok: true }, 202);
    }
    if (resource === "alerts" && id) {
      const store = findStoreByAlertId(id);
      if (!store)
        throw new ApiError(404, "alert_not_found", "Alert not found.");
      session(req, store.subject.id);
      const alert = store.alerts.find((a) => a.id === id)!;
      if (
        method === "POST" &&
        (action === "ack" || action === "resolve" || action === "feedback")
      ) {
        const response = await (action === "ack" ? acknowledge : resolveAlert)(
          req,
          { params: Promise.resolve({ id }) },
        );
        const body = await response.json();
        if (!response.ok)
          throw new ApiError(
            response.status,
            "action_failed",
            body.error ?? "Action failed",
          );
        return send(
          z
            .object({
              ok: z.literal(true),
              alertId: z.string(),
              eventId: z.string().optional(),
            })
            .parse(body),
        );
      }
      if (method === "GET" && (action === "audit" || action === "timeline")) {
        const rows =
          action === "audit"
            ? snapshotFields.auditLog
                .parse(store.auditLog)
                .filter((e) => e.detail.alertId === id)
            : snapshotFields.alerts.element.shape.escalation.shape.stageLog.parse(
                alert.escalation.stageLog,
              );
        const offset = Number(url.searchParams.get("cursor") ?? 0);
        if (!Number.isInteger(offset) || offset < 0)
          throw new ApiError(400, "invalid_cursor", "Invalid page cursor.");
        return send({
          items: rows.slice(offset, offset + 50),
          nextCursor: offset + 50 < rows.length ? String(offset + 50) : null,
        });
      }
    }
    throw new ApiError(404, "not_found", "Endpoint not found.");
  } catch (error) {
    const validation = error instanceof z.ZodError;
    const malformed = error instanceof SyntaxError;
    const status =
      error instanceof ApiError
        ? error.status
        : validation
          ? 422
          : malformed
            ? 400
            : 500;
    return NextResponse.json(
      {
        code:
          error instanceof ApiError
            ? error.code
            : validation
              ? "validation_error"
              : malformed
                ? "invalid_json"
                : "internal_error",
        message:
          error instanceof ApiError
            ? error.message
            : validation
              ? error.issues
                  .map((i) => `${i.path.join(".")}: ${i.message}`)
                  .slice(0, 5)
                  .join("; ")
              : malformed
                ? "Provide valid JSON."
                : "Unable to complete this request.",
        ...(validation ? { fieldErrors: error.flatten().fieldErrors } : {}),
        requestId,
        retryable: status >= 500,
      },
      { status },
    );
  }
}
export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as PUT,
  handle as DELETE,
};
