# Commit checkpoint 2 verification

Date: 2026-10-12. Scope: P1-02 staff authority and operational controls.

Implemented initial privileged provisioning, independent fresh-proof role decisions,
protected-account/last-admin guards, session review, bounded safe audit, validated
controls, private operational aggregates/alerts and verified cached legacy source.
Additive migrations 0016 and 0017 were exercised against real isolated D1 storage;
0017 upgraded the existing local database without a reset. Generated migration
snapshots agree with the schema.

## Local evidence

- `npm run check`: lint, workspace types, 274 workspace tests (35 shared,
  201 API, 38 web), 4 Node tests and documentation validation passed.
- D1 security tests cover bootstrap dry-run/eligibility, one-time races, rollback,
  current authority/session/factor checks, stale versions, proof replay/expiry,
  cross-revocations preserving usable authority, per-actor abuse limits, protected
  keys, stable audit cursors, safe projections and recovery/session rollback.
- Operational tests cover opt-in behavior, concurrent aggregates, unique alerts,
  mock delivery leases/payloads, safe destinations, retries/exhaustion, crashed
  leases, retention, validated defaults and handled HTTP failure observations.
- The new Chromium staff journey passed: real MFA setup and fresh-proof forms,
  credential clearing after an invalid check, grant/revoke invalidating target
  sessions, read-only ordinary admin controls, exact safe audit filtering, protected
  self/MFA, native setting update/restoration, and light/dark 320/1440 px axe and
  overflow checks. Screenshots were inspected locally. This checkpoint reran the
  new staff journey; the 15 earlier journeys retain checkpoint 1's evidence.
- `npm run test:vercel`: frontend build and built SSR/proxy/CSP/cookie/CSRF
  checks passed. `npm run build` passed for the normal Cloudflare target. Render's
  Node bundle/runtime tests passed through `check`.

- `npm run format:check` and `git diff --check` passed. The production-only
  dependency audit reported zero vulnerabilities.

## Test environment and limits

The normal dev server was already running with developer provider settings.
The staff browser run used separate localhost ports 8877 (API) and 5174 (web),
a temporary secret file with external email/bot/OAuth/alert credentials blanked,
and a workspace-local dev registry. Shared browser fixtures now check the
mailbox's development-only `localMailOnly` indicator before registering any account
and refuse a real email provider. API/Node fixtures explicitly override email,
bot and operational alert credentials. Temporary test authority is created through
fixed local-only SQL and removed during journey cleanup; residual roles from
earlier interrupted/failed runs were also removed from their exact fixture IDs; there is no
production fixture or public role-grant backdoor.

A hot-reload run encountered a transient local Miniflare internal error during
MFA setup. The settled isolated rerun passed; the failure was not counted as a
successful run. Initial browser locator failures were corrected before acceptance.
No remote migration, hosting deployment, webhook delivery, operator provisioning,
provider budget notification or uptime check was performed. Those need staging
and production evidence under P1-06. See the [operator runbook](staff-controls.md)
and [Render/Vercel guide](render-vercel.md).

The remaining project backlog stays open. The next implementation checkpoint is
P1-03: eligibility (learning 10+, teaching 16+), consent/privacy and private support
without a public support email. Changes are left uncommitted for the user. Commit
messages omit co-author and AI attribution trailers.
