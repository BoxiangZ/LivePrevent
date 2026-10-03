# Architecture

LivePrevent is a Next.js 15 App Router app. The codebase is split into three explicit layers so it's obvious where a change belongs.

```
src/
├── shared/          Pure types + pure constants. No I/O, no side effects.
│                    Safe to import from BOTH server and client code.
│   ├── types/       All TypeScript domain types (Subject, Alert, Event, …)
│   ├── constants.ts PRD initial values (thresholds, timings, plans)
│   ├── prng.ts      mulberry32 deterministic PRNG (seeded data)
│   └── labels.ts    Enum → human-readable label maps used by server
│
├── server/          Node-only. NEVER import this from client components.
│   ├── store.ts     SQLite person repository and migration of persisted sample state
│   ├── engine.ts    State advancement: recovery window, notification queue, escalation, auto-expire
│   ├── inject.ts    Demo scenario injectors (simulate fall / inactivity)
│   ├── snapshot.ts  Server → client DTO builder (what /api/demo/state returns)
│   ├── jev/         Risk-level decision engine (the only component that sets levels)
│   ├── alerts/      Escalation schedule (T+0/5/15/30) + notification templates
│   ├── llm/         Kimi integration (summarizes structured facts, template fallback)
│   └── data/        Deterministic seed data (seed.ts) + care-board mock (care.ts)
│
├── client/          Browser-only React. "use client" components, hooks, context.
│   ├── components/  Reusable UI (HeroStatus, TrendsGrid, AlertCard, ui.tsx…)
│   ├── provider/    DemoProvider — 5s polling of /api/v3/people/:id/snapshot, global state
│   ├── hooks/       (custom hooks)
│   └── cn.ts        className merge helper
│
└── app/             Next.js App Router.
    ├── (pages)      Thin client pages — they read from useDemo() and compose
    │                components from client/. Almost no business logic here.
    └── api/         Thin HTTP layer — each route: getStore() → advance() →
                     call server/* → return JSON. No business logic here either.
```

## Import rules

| You are writing…        | You may import from…                        |
| ----------------------- | ------------------------------------------- |
| `src/server/**`         | `shared/`, `server/`                        |
| `src/client/**`         | `shared/`, `client/`, `server/snapshot` (types only) |
| `src/app/api/**`        | `shared/`, `server/`                        |
| `src/app/(pages)/**`    | `shared/`, `client/`, `server/snapshot` (types only) |

Path aliases (see `tsconfig.json`): `@shared/*`, `@server/*`, `@client/*`, plus the catch-all `@/*`.

## Where do I change X?

| I want to change…                          | Go to…                                        |
| ------------------------------------------ | --------------------------------------------- |
| Risk levels, thresholds, timings           | `shared/constants.ts` + `server/jev/decide.ts`|
| What the fall/inactivity scenario looks like | `server/inject.ts` (+ `server/data/seed.ts`) |
| The persona, baselines, 90-day trends      | `server/data/seed.ts`                         |
| Care Dashboard patients                    | `server/data/care.ts`                         |
| Email / SMS / push copy                    | `server/alerts/templates.ts`                  |
| Escalation timing (T+0/5/15/30)            | `server/alerts/escalation.ts` + constants     |
| What data the UI can see                   | `server/snapshot.ts`                          |
| AI summary behavior                        | `server/llm/kimi.ts`                          |
| A page's layout/copy                       | `src/app/<page>/page.tsx`                     |
| A reusable widget                          | `client/components/`                          |
| Colors / design tokens                     | `tailwind.config.ts`                          |

## Data flow (the demo loop)

```
DemoControls / AckPage ──POST──► app/api/demo/inject|reset|ack ──► server/inject, server/engine
                                                                          │
client/provider/DemoProvider ◄──GET /api/demo/state── advance(store) ◄────┘
        │                                    ▲
        ▼                                    └── lazy: runs on every API call, no timers
   useDemo() → any page
```

- SQLite stores people in `liveprevent.sqlite`; sessions, media metadata and assessments in `assessments.sqlite`. Both live under the private data directory.
- The one-second worker drives simulated heartbeats, longitudinal review, alert advancement, the email queue, upload expiry and persisted assessment jobs. API actions also advance state when necessary.
- The client polls every 5 seconds and renders from the snapshot; countdowns use the snapshot's `nowMs` to avoid clock skew.
- Kimi is only ever a *summarizer*: it receives de-identified structured facts, its output is numerically validated, and alerts never wait for it (template fallback on any failure).

## The two-phase fall flow (the core demo)

1. `injectFall` → event `fallPhase: "candidate"` → JEV caps at **Important** while the recovery window (3 min real → 10 s demo) is open.
2. `advance` sees the window expire with no recovery → `fallPhase: "unrecovered"` → re-runs JEV → upgrades to **Critical** → `startEscalation` fires T+0 (primary contact, email+SMS+push).
3. T+5/T+15/T+30 stages fire from `advance` as their (18× accelerated) deadlines pass.
4. Any authorized contact acknowledges → escalation stops. Resolve requires a reason; Critical requires ack first.

Everything above is demo-visible: the recovery-window banner on Overview, the level history on the event page, the escalation timeline, the email preview with the one-time secure link.

## Configurable monitoring iteration

- `server/monitoring.ts`: heartbeat input adapter and the 15-minute monitoring status. Unknown is independent from risk; existing Critical wins.
- `server/simulator.ts`: deterministic inputs through JEV, shared event/alert records and escalation.
- `server/notifications/email.ts`: durable notification records, provider acceptance, bounded retries and Resend idempotency. Async calls re-read current person state before saving.
- `server/longitudinal.ts`: dated metrics, reported-baseline learning, versioned multi-area trend checks, care recommendations/outcomes and permitted AI context.
- `server/v3/people.ts`: empty person creation; recoverable removal/restore is managed by the repository and v3 route. Session bindings resolve current active people dynamically.
- `shared/contracts/monitoring.ts`: profile, monitoring, contact preferences, person creation, evolution and care outcome schemas.
- `client/components/MonitoringStatus.tsx`, `HealthProfileEditor.tsx`, `HealthEvolution.tsx`: prominent status, editable context and actionable history.

The worker uses leases for assessment work and email delivery. This remains a single-process local account; production identity, verified inbox delivery, SMS, continuous camera/watch ingestion and multi-tenant care institutions are separate work.
