# Commit checkpoint 3 verification

Date: 2026-10-14. Scope: P1-03 implementation, teacher identity verification and
Cloudflare API/Vercel frontend deployment handoff. The owner handles deployment
and Git commit/push; no co-author trailer is requested.

## Implemented

Learning age 10+, teaching age 16+, private birth dates and current agreements;
server-verified Setu DigiLocker guardian permission and bound one-use child
invitations; separate expiring teacher identity receipts with independent staff
quality review; protected minor public identity/external video consent; private
verified Contact/staff replies; bounded owner exports and fresh-proof atomic
account anonymization/deletion. Migrations `0018` through `0023` add the tables
and database guards. Optional provider integrations remain disabled until configured.

The backend now runs directly on Cloudflare Workers/D1. The Vercel server proxy
requires a private transport key before the API trusts visitor IPs. Public launch
is closed by default. Five-minute scheduled maintenance handles privacy jobs,
retention, provider revocation and durable support delivery. The release helper
validates required settings/verified email sender; trusted Cloudflare bootstrap
verifies its own audit/role receipt after import. The legacy Node/Render adapter
remains available but is not required for this target.

## Local evidence

- `npm run check`: lint, types, 284 workspace tests (35 shared, 211 API, 38 web),
  six Node tests and documentation validation. Provider mocks use no live identity
  documents or email delivery; browser fixtures refuse a real email provider.
- Real isolated D1 tests cover guardian authorization/bound invitation races,
  withdrawal/session revocation, a guardian-authorized 16-year-old teacher,
  provider signatures/name/DOB/replay/expiry, independent quality review,
  current-factor proof despite stale authentication snapshots, owner-only export
  projections and deletion effects on other learners/certificate verification.
- A regression composes teacher eligibility while JavaScript time is frozen at
  Worker startup, then executes against the current database clock. Public
  catalog/detail/learning permissions and profile masking use execution-time checks.
- Native browser signup, private support/reply, unconfigured guardian failure,
  instructor agreements, export/download isolation and deletion passed. Guest
  confirmation remains scanner-safe; all six public policies passed axe. Privacy
  settings passed 320/1440 px overflow/axe checks; its screenshot was inspected.
- The full Chromium run passed 17 journeys. Its remaining video journey had an
  obsolete anonymous-embed expectation. Both corrected video-file journeys passed
  in the targeted rerun, including native chapter/transcript navigation, adult
  opt-in embeds and timestamp-preserving external links. All 18 distinct journeys
  are verified across these runs; this is not a claim of a single 18/18 run.
- Cloudflare production preview `--dry-run` bundled successfully without publishing
  or provider calls; the temporary secret upload file was removed. Cloudflare
  frontend build and Vercel SSR build/runtime checks passed (proxy, trusted visitor
  IP, matching CSP nonce, CSRF, cookies and notification polling fallback).
- Production dependency audit: zero vulnerabilities. Secret/project files are
  Git-ignored and excluded from Vercel uploads. Formatting and diff checks passed;
  a local scan found none of the private credential values in Git-visible files.

## Owner launch prerequisites

Isolated staging/production D1 databases were prepared through `0022`; apply the
later `0023` remotely before deployment. An empty Vercel project was prepared.
No Worker or frontend was published, and no remote synthetic accounts/courses
were seeded. The example Vercel alias is not an assigned live deployment.

Configure valid Resend credentials/verified transactional sender, approved live
Setu credentials, actual operator details and final public origins. The supplied
email key was rejected during read-only validation. Complete real guardian/teacher
provider, delivered-email and operator/legal acceptance before opening accounts.
Local tests do not establish provider approval, parental relationship verification,
legal compliance or production recovery evidence. Follow the
[deployment guide](cloudflare-vercel.md) and [privacy runbook](privacy.md).

P1-04/P1-05 and external P1-06 acceptance remain listed in `TODO.md`. Future
commerce, mentoring, paid exams and Phases 2-7 are planned work, not falsely
checked off by this deployment handoff.
