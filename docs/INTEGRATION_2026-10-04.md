# Repository integration — 2026-10-04

All remote branch heads fetched from `origin` are included in `test/integrated-20261004`. Existing local branch commits are also included. The integration combines `feat/live-monitoring` with `fix/assessment-model-fallback`; the other branches are ancestors and require no additional content merge.

## Branch audit

| Remote branch | Audited head | Included work |
| --- | --- | --- |
| `main` | `ef9a2ca` | Base UI and layered architecture |
| `frontend` | `ef9a2ca` | Same base commit as main |
| `backend` | `ef9a2ca` | Same base commit as main |
| `60days-csv` | `ad98611` | Original MVP demo loop |
| `feat/product-experience-api` | `e7c60da` | Person-scoped product workflow and APIs |
| `feat/assessment-and-results` | `44f2f4e` | Assessments, uploaded observations/video and results |
| `feat/live-monitoring` | `cba01c2` | Heartbeat/data-loss status, risk simulation, people/profiles, longitudinal care, Resend queue and K3 compatibility |
| `fix/assessment-model-fallback` | `4447b2d` | Optional-model fallback/retry diagnostics, video normalization/repair, completed results with limitations and source labels |

Remote heads were fetched again after validation to confirm there were no additional updates. Commit ancestry was checked for every remote branch, excluding the symbolic `origin/HEAD` reference.

## Resolved conflicts

Three files had textual conflicts:

- `src/server/llm/kimi.ts`: retain the monitoring branch's shared K3 generation options and health-context prompt while adding the fallback branch's bounded explanation retry and persisted diagnostics.
- `src/server/v3/assessments.ts`: keep saving risk decisions and notification queues before waiting for AI text; re-read person state afterward to preserve concurrent changes. Merge the completed-with-limitations result behavior and retry eligibility.
- `tests/v3-model.cjs`: combine the K3 protocol assertions with video repair, explanation retry and fallback tests.

The automatically merged video repair request also needed correction: it now uses the same K3-compatible options as the other requests instead of restoring unsupported thinking/max-token controls. API assertions were aligned with the new completed-result behavior: a successful rule assessment cannot be retried just because optional AI text was unavailable.

Additional regression coverage verifies that a completed assessment with unavailable video can be retried without duplicate events, and that email queueing happens before AI summary generation. A concurrent acknowledgement, email delivery update and profile edit during summary generation must survive completion.

## Validation

All checks passed against the final integrated application code:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run test:model` | Passed, including the combined merge regressions |
| `npm run test:monitoring` | Passed |
| Production `npm run build` with `.next-verify` | Passed |
| `npm run test:api` against isolated production port 3105 | Passed |
| `npm run test:monitoring-api` against isolated production port 3105 | Passed |
| Conflict-marker and whitespace checks | Passed |

Model tests use a stub provider. API tests use a fresh temporary SQLite directory with Kimi offline and Resend disabled; they send no real email and do not alter the existing workspace data. The temporary API server was stopped after verification. Local `.env.local`, mail/Kimi keys and the existing database are excluded from the integration commit.
