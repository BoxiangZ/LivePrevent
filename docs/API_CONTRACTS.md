# LivePrevent desktop demo API contract (v2)

All routes return JSON. All health observations and delivery records are synthetic. Every person-scoped request includes `personId`; unknown IDs return 404. The local SQLite file is `mockdata/liveprevent.sqlite` and is ignored by Git. This contract is for the demo, not a production authentication or device-ingestion service.

## Shared data and pages

`GET /api/demo/state?personId=…` returns `DemoStateSnapshot` from `src/server/snapshot.ts`. The header selector uses `people[]` (`id`, `label`, `alias`, `overallLevel`, `openAlertCount`); the connection banner uses `dataStatus` (`source`, `synthetic`, `asOf`, `stale`). The body is scoped to the selected person.

| Page | State fields consumed |
| --- | --- |
| Overview | `subject`, `overallLevel`, `dataStatus`, `deviceDetails`, `devices`, `activeCriticalAlertId`, `pendingFallEventId`, `alerts`, `events`, `metricSummaries`, `baselines`, `trends`, `demoTimeScale`, `nowMs` |
| Alerts | `alerts` including `level`, `status`, `levelHistory`, `notifications`, `escalation`; `events`, `contacts`, `notifications` |
| Event details | `events` including `signals`, `fallPhase`, `recoveryWindowEndsAt`; `alerts`, `deviations`, `baselines`, `trends`, `kimiSummaries`, `contacts`, `notifications`, `auditLog`, `subject.timeZone` |
| Person details | `subject`, `deviceDetails`, `devices`, `baselines`, `metricSummaries`, `trends`, `events`, `alerts` |
| Care Network | `contacts` including `name`, `escalationOrder`, `channels`, `phoneVerified`, `quietHours`; `subscription`; `alerts` |
| Settings | `subscription`, `contacts`, `deviceDetails`, `subject.monitoringPaused` |
| Care Dashboard preview | `carePatients` including `name`, `age`, `level`, `reason`, `statusLabel`, `lastUpdatedIso`, `live` |
| Notification preview | `notifications` list with `id`, `alertId`, `contactId`, `contactName`, `channel`, `sentAt`, `subject`, `body`, `secureLinkAvailable`; action URL fetched separately |

`GET /api/demo/config?personId=…` returns `subject`, `contacts`, `devices`, `subscription`. `PUT /api/demo/config` accepts those same editable fields plus `personId`; it validates name, alias, age, time zone, 1–8 ordered contacts, channel selection, notification booleans and camera rooms. `possible_fall` is always `true`. The Setup page provides inputs for these fields and saves per person. This is the onboarding/configuration seam for a future account service.

## Synthetic observation input and output

`POST /api/demo/observations` accepts `ObservationInput` (`src/shared/types/demo-api.ts`):

```json
{
  "personId": "sub_margaret",
  "idempotencyKey": "demo-run-0001",
  "eventType": "possible_fall",
  "occurredAt": "2026-10-03T10:00:00.000Z",
  "signals": [
    { "source": "camera_posture", "description": "Possible fall posture", "withinCoverage": true },
    { "source": "watch_impact", "description": "Sudden impact" }
  ],
  "probabilities": { "normal": 0.01, "notice": 0.02, "important": 0.03, "critical": 0.94 },
  "insufficientData": false,
  "recoveryObserved": false,
  "note": "Synthetic test"
}
```

Returns 201 with `runId`, `personId`, `eventId`, nullable `alertId`, `level`, `probabilities`, `ruleApplied`, nullable `cappedReason`, nullable `recoveryWindowEndsAt`, `synthetic: true`. Repeating `(personId, idempotencyKey)` returns the saved result. `GET /api/demo/observations?personId=…` returns the 30 most recent input/output runs. The Demo I/O page exposes every input and displays the rule and linked event. The decision engine owns the risk level; the summary service does not change it. Fall candidates remain capped during the recovery window, then use the submitted probabilities when the window closes.

## Actions and notification links

| Request | Input | Output / effect |
| --- | --- | --- |
| `POST /api/demo/inject` | `personId`, `scenario: fall \| inactivity` | Preset event and alert IDs; local demo state updated |
| `POST /api/demo/reset` | `personId` | Resets only that person's demo state and runs |
| `POST /api/demo/pause` | `personId`, `paused` | `monitoringPaused`; audit entry |
| `POST /api/alerts/:id/ack` | `personId`, optional `contactId` or one-time `token` | Acknowledged alert and event ID; stops escalation |
| `POST /api/alerts/:id/resolve` | `personId`, `reason`, optional `note` | Resolved alert; audit entry |
| `POST /api/kimi/summary` | `eventId` | Structured `KimiSummary`; template fallback if unavailable |
| `GET /api/demo/notifications/:id?personId=…` | Notification ID | Exact preview `subject`, `body`, demo-only `actionUrl` |
| `GET /api/demo/ack/:token` | One-time token | `personId`, `alertId`, `eventId`, `contactName`, `status` (`valid`, `used`, `expired`) |

The shared state response contains `secureLinkAvailable`, never a raw one-time token. A preview requests the action URL only when opened. This is still a local demo flow; production requires authenticated authorization and contact verification on these endpoints.
