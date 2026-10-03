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
        store.subject = { ...store.subject, ...input.subject };
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
