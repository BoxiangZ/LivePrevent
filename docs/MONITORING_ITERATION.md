# Configurable monitoring — implementation contract

This iteration extends v3. It is a single-process local family account, with explicit simulated monitoring and optional real email. No independent production login, live hardware or verified inbox delivery is claimed.

## Routes (relative to `/api/v3`)

| Request | Behavior |
| --- | --- |
| `POST people` | Validates `createPersonSchema`; creates an isolated person/profile/contact/devices/monitoring record. No synthetic health history is assigned to a new person. Returns 201 `{personId}`. |
| `DELETE people/:id` | Recoverable removal. Stops heartbeat, alert advancement, new email and queued/running assessments; active list/session bindings exclude the person. Pending email is cancelled. Returns `{removed,personId,recoverable:true}`. |
| `POST people/:id/restore` | Owner-only restoration. Person remains paused; profiles/history remain available. |
| `GET/PATCH people/:id/settings` | Adds `profile`, `monitoring` and contact details/preferences. Complete payload/version retained. Primary Critical subscription and email channel cannot be disabled. Provider/consent/phone verification/account binding remain server-controlled. |
| `POST people/:id/simulate` | `{scenario:low|moderate|critical|data_loss|recover|longitudinal|reset}`. Deterministic backend signals go through JEV. Longitudinal preset is available only for a sample-history person. |
| `GET people/:id/evolution?window=7|30|90|180|365` | Recorded metrics, personal baseline comparison, change within the chosen window, care tasks and the cached summary for that window. |
| `POST people/:id/evolution/summary?window=...` | Generates a Kimi explanation with permitted health context or an explicit rule fallback; persists the result. |
| `POST people/:id/evolution/observations` | Up to 365 `{key,date,value}` rows. Validates person-local dates and numeric ranges. Replaces the same metric/day; does not refresh heartbeat. Learns reported baselines only after enough suitable personal samples. |
| `POST people/:id/care-tasks/:taskId` | `{outcome}`. Completes an open task, persists outcome/time and writes audit. Repeat completion returns 409. |
| `GET email-status` | `{configured,provider:"resend"}`; no secrets returned. |
| `POST notifications/:id/retry` | Requeues a failed real email on an open alert. Recipient/alert/preferences are rechecked before delivery. |

All mutations retain session/person authorization and same-origin checks. Removed people are unavailable through normal person/media/assessment/alert routes. Restore checks ownership using the retained record.

## State and policy

`monitoring` stores `lastDataReceivedAt,simulatorEnabled,dataLoss,emailEnabled`. Heartbeat runs every 45 seconds in the enabled active simulator. At 15 minutes or more without input, monitoring becomes Unknown. Critical stays visible through data loss/pause. A heartbeat updates device freshness, never health measurements.

UI labels are Stable / Low risk / Moderate risk / Critical / Unable to verify; compatible risk codes remain stable/watch/important/critical. Paused is separate. Breathing indicators respect reduced-motion preferences.

Profile schema includes sex, height/weight, a bounded local raster photo, living situation, conditions, falls, mobility, medication, lifestyle and notes. `shareWithAi` defaults false. AI context excludes names/photos/contacts; reported health fields are supplied only with opt-in. The model receives baseline and 30/90-day aggregate history plus prior resolution reasons/care outcomes. Narrative output cannot change risk or prescribe medication.

History contains the recorded dates only. Sample people have one year of labelled synthetic core history and sample gait/behaviour observations; weight/blood pressure are unavailable until recorded. New people learn baselines from their own reported measurements (14 days for basic metrics, 28 for sleep), excluding days with known abnormal events. No baseline is borrowed from another person.

`sustained_multi_area_v1` is a sample policy: deviations sustained across three weekly groups in two learned health areas can generate Moderate and a check-in task. Critical is excluded from longitudinal inference. Repeated open/recent concerns are deduplicated for 30 days. No claim of clinical validation is made.

## Delivery semantics

Real email is explicitly enabled per person. Primary Critical email is required; secondary Critical and Moderate/Low follow contact preferences. Moderate/Low defer during quiet hours. SMS/push are preview records only.

The worker persists Pending before I/O, uses a short lease and a stable Resend idempotency key, stores provider message ID on acceptance, retries transient errors up to four attempts and exposes failure reasons. Sent means accepted by provider; delivered is not inferred. Configuration failures can be retried after server configuration changes. Email includes minimal alias/category/priority/time and authenticated event links; detailed health evidence stays in the app.

Removal/pause cannot recall an email already in flight or accepted by the provider. Real sending, independent contact identity, delivery webhooks and live sensor adapters are not established by stub/offline tests.

## Verification

`tests/monitoring.cjs` uses an isolated SQLite directory and a fake email provider. It covers the exact 15-minute boundary, heartbeat/pause/data loss, settings versions, primary recipient protection, bounded retries/idempotency, health-context consent, person isolation/removal/restore, unavailable metrics, reported baseline learning and longitudinal deduplication.

`tests/monitoring-api.mjs` targets a fresh isolated offline server. It covers CRUD/session binding, settings/profile persistence, primary preference protection, risk propagation, data loss/Critical precedence, failed email/retry, valid dated measurements, 1Y history and care outcome replay protection. Existing assessment/model/API suites remain applicable.
