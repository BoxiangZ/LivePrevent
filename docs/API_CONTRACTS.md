# LivePrevent desktop API contract — v3

Implementation contract, 2026-10-03. Product design: [PRODUCT_EXPERIENCE_AND_API.md](PRODUCT_EXPERIENCE_AND_API.md). This document describes implemented routes; it replaces the v2 contract. This is a single-process, local sample workspace, with optional real Kimi inference. It is not a production account or real device-ingestion service. Optional Resend integration sends real email when explicitly enabled per person; other notification channels remain simulated.

## Shared validation and access

Runtime schemas are the source of truth:

- `src/shared/contracts/assessment.ts`: people, overview, options, observation, upload, media, assessment, findings, envelopes.
- `src/shared/contracts/settings.ts`: settings, contact channels, quiet hours, time zones, version and consent.
- `src/shared/contracts/snapshot.ts`: existing alerts, events, trends, notification previews, contacts, baselines and audit fields.
- `src/client/api.ts`: validates v3 response envelopes and data; provider validates snapshot responses.

Success: `{schemaVersion:"3",requestId,generatedAt,data}`. Errors: `{code,message,fieldErrors?,requestId,retryable}`. Timestamps are ISO 8601 with offsets. IDs are opaque. A missing session returns 401, unbound person 403, missing record 404, conflict 409, expired media 410, oversized upload 413, unsupported extension 415, invalid input 422. Invalid JSON returns 400. No user names, API keys, paths or upload tokens appear in logs or assessment results.

`POST /api/v3/session` issues an opaque HttpOnly, SameSite=Strict cookie for the local sample family account. `GET /api/v3/session` returns `userId,personIds,workspaceMode:"sample"`. Write requests check Origin/Host and reject cross-site fetches. A person binding is checked for every person/assessment/media/alert request. This sample login is deliberately not production authentication. Do not expose this server publicly with real health data.

## Page-to-field map

| Page or component | Request and complete data groups |
| --- | --- |
| Person selector | `GET people`: `{id,label,alias,overallLevel,openAlertCount}[]`. Local selection is stored by the client; access is enforced by the server. |
| Overview: current status | `GET people/:id/overview`: `personId,displayStatus,statusReason,evaluatedAt,riskLevel,sourceLabel,learningProgress{currentDay,totalDays}?`. `displayStatus` is stable/watch/important/critical/unknown/paused. Stale data never becomes Stable. An active Critical remains visible. |
| Overview: freshness | Same response: `dataFreshness{verifiable,devices[]{id,label,online,worn?,batteryPct?,lastSyncAt?,reason,coveredRooms[]}}`. Null means unavailable, never zero. |
| Overview: next action | Same response: `primaryAction{label,href,description}` supplied by the server. |
| Recent observations, personal history and trends | `GET people/:id/snapshot`: `events`, `alerts`, `subject`, `trends`, `baselines`, `metricSummaries`, `devices`, `deviceDetails`. Snapshot runtime schema lists every nested field. Dates/colors/labels and chart selection may be derived in the client. |
| Alerts and event detail | Snapshot: `alerts` includes level/status/history, acknowledgement/resolution actor/time/note, escalation and `recommendedAction`; `events` includes type/time/signals/fallPhase/recoveryWindowEndsAt/dedupeKey; `kimiSummaries`, `deviations`, `contacts`, `notifications`, `auditLog`, `nowMs`, `demoTimeScale` support the evidence, countdown and audit panels. |
| Notifications | Snapshot: contact/name/channel/sentAt/subject/body, `deliveryStatus`, `simulated`, `secureLinkAvailable`. The sample records do not claim external delivery. |
| Assessment list | `GET people/:id/assessments`: full `Assessment[]`, newest created first. List derives observation time, kind, progress and source from `input`, `status`, `stage`, `finding`, `createdAt`. This local version has no list pagination. |
| New assessment | `GET assessment-options`: scenarios and observation kinds with labels/types; `limits{sensorBytes,videoBytes,videoSeconds,retentionHours}`; `videoAvailable,videoMessage`. Inputs and outputs below. |
| Assessment result | `GET assessments/:id`: `assessmentId,personId,input,status,stage,createdAt,updatedAt,startedAt?,completedAt?,attempt,error?,retryable,finding?`. Findings listed below. |
| Settings | `GET/PATCH people/:id/settings`: `personId,subject{alias,displayName,age?,timeZone,monitoringPaused},contacts[],devices[],subscription,consent,policy{retentionHours,workspaceMode},version`. Exact nested fields in settings schema. Consent and phone verification are read-only; contact account binding is server-controlled. Settings now includes `profile`, `monitoring` and per-contact email/phone/relationship/role/subscriptions. Heartbeat timestamps do not affect the settings edit version. Contact order is derived from array order. The current account contact must remain present. |

All paths in tables are relative to `/api/v3`. People/profile management is described in [MONITORING_ITERATION.md](MONITORING_ITERATION.md). No plan/billing/invitation UI is retained, so no placeholder plan API is advertised. `/setup` uses the same Settings editor; `/care-network` redirects there. Developer tools stay at `/demo-studio` outside family navigation.

Additional read endpoints: `people/:id/devices`, `people/:id/history` (events), `people/:id/trends?window=7d|30d|90d` (trends/baselines/metricSummaries), `people/:id/alerts?status=all|active|resolved` (array), `people/:id/events/:eventId` (`event,alert?,assessment?,summary?`). These use the same snapshot fields. `alerts/:id/audit` and `/timeline` accept an offset `cursor` and return `{items,nextCursor}` in pages of 50. Event details work even without an alert.

## Upload contract

1. `POST media/uploads`: `{personId,name,kind:"sensor"|"video",size,mime}` → 201 `{media,uploadUrl}`. Upload URL is private, session-bound and includes a one-use random token.
2. `PUT {uploadUrl}` with raw bytes → validated `Media`. Browser XHR derives upload percentage; abort stops the request. Failed uploads require a new upload reservation.
3. Optional `POST media/:id/complete` returns current Media (PUT already completes validation).
4. `GET media/:id` returns metadata and parsed sensor rows. `GET media/:id/content` returns private bytes with no-store and nosniff.
5. `DELETE media/:id` removes the local file and cancels queued/running assessments using it; retained result evidence remains. Expiry after 24 hours also removes files. Metadata can remain for audit; original contents are no longer returned.

`Media`: `assetId,personId,name,kind,mime,size,durationSeconds?,status,createdAt,expiresAt,error?,observations[]`. Status: awaiting_upload/ready/failed/deleted. Owner and token are never included in public metadata.

CSV/JSON: up to 1 MiB, 1,000 rows, schema-validated values. JSON accepts an array or `{observations:[...]}`. CSV columns `kind,value,at,source` and optional `withinCoverage`; quoted commas and newlines are supported. `value` follows the selected kind: boolean, non-negative number, or bounded text. Row errors are returned rather than silently discarding rows. Aggregate input across up to three files plus manual rows must be at most 1,000.

Video: optional MP4, up to 50 MiB and 120 seconds; server validates container/header duration and actual received size. This is structural validation, not antivirus scanning or a complete codec validation service. Browser playback/model failure remains possible and is reported. No continuous camera stream is uploaded.

## Assessment input, lifecycle and findings

`POST assessments` accepts:

```json
{
  "personId":"sub_margaret",
  "primaryConcern":"possible_fall",
  "observedAt":"2026-10-03T10:00:00Z",
  "timeZone":"Asia/Hong_Kong",
  "observations":[{"kind":"impact","value":true,"at":"2026-10-03T10:00:00Z","source":"sample_manual"}],
  "sensorAssetIds":[],
  "note":"",
  "provenance":"sample_user_uploaded",
  "consent":true,
  "idempotencyKey":"unique-submission-123"
}
```

`primaryConcern` is optional and only changes result presentation; omission requests an overall review. The legacy `scenario` field remains accepted for stored records and older clients but no longer gates risk evaluation. `videoAssetId` and `videoObservedAt` are optional; the form asks users to confirm recording start time when a clip is attached. Without that time, the clip can be described but visual evidence does not drive the risk decision. At least one observation or parsed sensor file is required. Reusing the same key/input returns the same assessment; changing that input returns 409. Person mismatch, unfinished upload and invalid file kind are rejected. Sources: sample_manual/sample_sensor. Concern and kind enums are provided by options and the shared schema.

`POST assessments/:id/analyze` → 202 queued. A persisted background worker advances queued → analyzing → completed/partial/failed. `GET assessments/:id` is read-only. `POST .../cancel` cancels created/queued/analyzing; `POST .../retry` retries partial/failed/cancelled. A server restart recovers queued work; expired analyzing leases become retryable failures. Event IDs remain stable across retry; resolved alerts are not reopened. Failed or deleted attachments must be uploaded again in a new assessment.

`Finding`: `displayStatus,level?,headline,plainSummary,recommendedAction,limitations[],findings[]?,alertReason?,observations[],video?,sourceBreakdown[],model{provider,modelId?,used,fallbackReason?},decision{engine,version,ruleId},eventId?,alertId?`. Each new `findings[]` entry includes `category,status,summary,supportingEvidence[],conflictingEvidence[],limitations[],recommendedAction,ruleId,alertRecommended`. Older saved assessments may lack `findings`.

`video`: `summary,uncertain,limitations[],evidence[]{atSeconds,description,kind,confidence}`. Timestamps must be within the clip; kind is fall_posture/recovery/movement/unclear. Evidence links seek the private video while it remains available. Model observation is separate from the rule decision. Missing evidence is Unknown, not Stable. Observations outside the five-minute selection window or explicitly outside coverage are excluded from rule decisions; video evidence is decision-relevant only when its confirmed recording time places it in that window. Conflicts are disclosed. Uploaded historical clips never trigger critical escalation merely because they end without visible recovery.

Kimi receives the full structured sample observations and optional clip through `video_url` using a base64 payload. The default visual model is configurable via `KIMI_VISION_MODEL` (`kimi-k3`); see the [official Kimi vision guide](https://platform.kimi.com/docs/guide/use-kimi-vision-model). The existing text summary adapter uses `KIMI_MODEL`; a separate call summarizes user-reported free text as unverified context. The risk decision uses auditable sample rules, not an asserted medical prediction. No key/offline/provider failure/invalid model output → explicit partial result or a controlled fallback; `model.used` and `fallbackReason` report the video/text summary path. The local 24-hour policy does not promise deletion from a third-party provider's internal logs.

## Mutations and compatibility

- `POST alerts/:id/ack`: acting contact comes from session; a submitted contactId cannot impersonate another person.
- `POST alerts/:id/resolve` or `/feedback`: `{personId,reason,note}`; allowed reason enums are validated; repeated/invalid state returns conflict. Response `{ok,alertId,eventId?}`.
- Settings PATCH requires the complete current settings payload and `version`. Stale version → 409; reload explicitly before retrying. Monitoring pause/resume is `subject.monitoringPaused` in this same contract.
- Legacy `/api/demo/*` and `/api/alerts/*` are session-guarded compatibility/developer routes. `PUT /api/demo/config` is retired (410); writes must use v3. `/api/kimi/summary` remains a guarded explicit text-summary action for older sample events.

## Running and verification

Requires Node with `node:sqlite`. SQLite state, sessions, jobs and private uploads use `LIVEPREVENT_DATA_DIR` (default ignored `mockdata/`). Deploy as one persistent Node process; distributed workers/serverless and production identity/notifications are outside this version.

```sh
npm run typecheck
npm run test:model
NEXT_DIST_DIR=.next-verify npm run build
LIVEPREVENT_DATA_DIR=/private/tmp/liveprevent-v3-check DEMO_KIMI_OFFLINE=1 NEXT_DIST_DIR=.next-verify npm run start -- --port 3105 --hostname 127.0.0.1
npm run test:api
```

Use an isolated directory for tests; they mutate sample settings/events. The API test covers browser Origin, unauthenticated access, person isolation, schema responses, saved settings/version conflicts, pause state, invalid input, idempotency, async/offline partial results, events without alerts, fall review, actor binding, resolution, CSV upload/errors/deletion, size limits and cancellation. Browser checks cover login, Overview, sample submission, result and linked event. Live video inference quality needs representative permitted clips and a configured provider; it is not established by offline tests.

`npm run test:model` 使用隔离 SQLite 和本地 fetch 替身，验证完整观察数据/视频载荷、成功输出、越界时间戳拒绝、部分失败、冲突与不确定性、重置保留上传事件及文件删除。MP4 仅为元数据夹具，不测试视频解码或模型识别准确率。
