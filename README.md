# LivePrevent

A configurable local workspace for older-adult monitoring, evidence review and family follow-up.

The current version uses simulated monitoring inputs and optional real Kimi analysis. It supports a 45-second heartbeat, a 15-minute data-loss status, editable people and care contacts, persistent health profiles, asynchronous assessments, longitudinal history and optional real email through Resend. It is not production identity, real device ingestion or an emergency service.

## Run

Requires Node 22.12+ with `node:sqlite` support. The npm scripts enable experimental SQLite for Node versions that require it.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 and choose **Open workspace**. Existing data stays in ignored `mockdata/`; use `LIVEPREVENT_DATA_DIR` to choose another private data directory.

## Monitoring and risk

- Status: **Stable**, **Low risk**, **Moderate risk**, **Critical**, **Unable to verify**; paused is shown separately. Internal API codes `watch` and `important` are retained for compatibility.
- Monitoring heartbeat updates every 45 seconds when simulation is enabled and monitoring is active. It never invents health measurements.
- At **15 minutes or more** without input, status becomes Unable to verify. An active Critical remains visible even if data is lost or monitoring is paused.
- **Try monitoring scenarios** on Overview opens `/demo-studio`: Low, Moderate, Critical, 17-minute data loss, restore heartbeat, persistent trend, reset and the two-phase fall flow.
- People, profiles, devices, contacts, preferences and histories are isolated per person. New people have no seeded health history or learned baseline. Removal is recoverable and stops monitoring/new email; Undo restores the person in a paused state.

## Email

Fill in server-side configuration in `.env.local`:

```dotenv
RESEND_API_KEY=
LIVEPREVENT_EMAIL_FROM=
LIVEPREVENT_APP_URL=http://localhost:3000
```

Use a sender on a verified Resend domain and an application URL recipients can reach. See the [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email).

In **Settings**, enter actual contact email addresses and enable **Send real email alerts** for the selected person. Simulation can then send real mail. Critical always targets the primary contact, regardless of quiet hours; subscribed contacts participate in escalation. Moderate respects subscriptions/quiet hours. Low defaults to dashboard only and can be opted into per contact.

The persisted queue records **Pending / Sent / Failed**, provider message ID and a bounded retry schedule. Resend idempotency keys prevent duplicate acceptance on retries. **Sent** means provider acceptance, not confirmed inbox delivery. Missing configuration produces a visible failure. A failed email on an open alert can be retried from the event page. SMS, push and calls remain preview-only.

Email contains the alias, category, priority, local time and authenticated event/dashboard links. Detailed health evidence stays in the app. Public deployment and independent recipient accounts are outside this local workspace's scope.

## Health context and longitudinal monitoring

Settings includes sex, height, weight, a local profile photo, living situation, reported conditions, falls, mobility, medication, lifestyle and notes. **Allow Kimi to use this health background** controls transmission of reported health context; names, photos and contact details are excluded from that context. Notes should omit identifying information. Model output never determines risk or changes medication.

**Health Evolution** on Overview and person details supports 7D / 30D / 90D / 6M / 1Y. It shows recorded activity, sleep, resting heart rate, mobility, gait, behavioural changes, weight, blood pressure and risk event counts. Unavailable data stays unavailable. Dated measurements can be recorded directly. New people's baselines are learned from their own sufficient dated reported measurements; known abnormal event days are excluded.

The versioned sample longitudinal policy checks sustained deviations in multiple health areas across three weeks, creates a Moderate alert and a check-in recommendation, deduplicates repeated concerns and saves care outcomes. It is an auditable sample policy, not a clinically validated predictor. The 30/90-day explanation uses permitted profile context, baselines, history and previous outcomes, with a visible rule fallback when Kimi is unavailable.

## Verification

```sh
npm run typecheck
npm run test:model
npm run test:monitoring
NEXT_DIST_DIR=.next-verify npm run build
LIVEPREVENT_DATA_DIR=/private/tmp/liveprevent-check DEMO_KIMI_OFFLINE=1 RESEND_API_KEY= LIVEPREVENT_EMAIL_FROM= NEXT_DIST_DIR=.next-verify npm run start -- --port 3105 --hostname 127.0.0.1
npm run test:api
npm run test:monitoring-api
```

Use a fresh isolated directory for API tests: they create/remove people and alter sample settings, alerts and history. Model and email adapter tests use local fetch stubs and never send real email. SQLite/jobs/uploads require one persistent Node process.

See [ARCHITECTURE.md](ARCHITECTURE.md), [API_CONTRACTS.md](docs/API_CONTRACTS.md) and [MONITORING_ITERATION.md](docs/MONITORING_ITERATION.md).
