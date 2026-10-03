# LivePrevent

**Calm home monitoring for aging in place — alerts that explain themselves.**

LivePrevent watches over an older adult living independently (our demo persona: **Margaret Chan, 76, Hong Kong**) through everyday devices — a smartwatch and a living-room camera — learns *her personal baseline*, and notifies her care network when something meaningfully deviates from it.

> **Boundary**: LivePrevent is an assistive monitoring tool. It does not provide medical diagnosis, does not replace a clinician, and is not an emergency-call service. It may miss events or raise false alarms. It promises only earlier awareness and faster notification — never prevention.

## What the MVP delivers

- **Personal-baseline detection** — compares against *this person's own normal*, not population averages
- **Four risk levels** — Stable / Watch / Important / Critical, consistent across the whole product
- **Two-phase fall detection** — a possible fall is capped at Important during a short recovery window, then escalates to Critical only if there's no recovery
- **Escalation chain** — T+0 primary contact → T+5 second contact → T+15 everyone → T+30 unacknowledged with repeating reminders
- **Explainable events** — supporting signals, baseline comparison, 7/30/90-day trends, and an AI summary (Kimi) generated only from de-identified structured facts — it never decides the risk level
- **Privacy-first** — the camera processes on-device; raw video never leaves the home; monitoring can be paused at any time
- **Care Dashboard** — a provider view ("Who needs attention today?") sharing the same underlying data

## Repo layout

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** — the codebase is split into explicit `src/shared` / `src/server` / `src/client` layers with a "where do I change X" table.

## Quick start

```bash
npm install
cp .env.example .env.local   # KIMI_API_KEY optional — template fallback without it
npm run dev                  # http://localhost:3000
```

See [START.md](./START.md) for the demo walkthrough (simulate fall / inactivity, acknowledge via the secure link, reset).

## Docs

- [PRD v0.2](./docs/PRD.md) — full product spec (Chinese)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — layers, import rules, data flow
- [START.md](./START.md) — run & demo operations

## One-liner

> Families pay for peace of mind and a reliable way to respond. Care providers pay for monitoring efficiency.
