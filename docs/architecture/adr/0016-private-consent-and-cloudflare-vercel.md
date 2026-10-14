# 0016: Private consent, provider identity and Cloudflare/Vercel hosting

Status: Accepted for implementation; live provider/operator acceptance remains a release gate.
Date: 2026-10-14.

The user selected learning minimum age 10, teaching minimum age 16, no public
support email, Setu DigiLocker for guardian identity, and Cloudflare for the
backend with Vercel frontend. The latest instruction leaves deployment to the
owner. This supersedes Render as the selected deployment target in ADR 0014;
its compatibility adapter remains available.

Use private versioned account agreements and immutable birth dates. Verify an
adult guardian before child identity is collected, then issue a bound hashed
one-use invitation. Server-side provider reads approve identities; callback
parameters, manual references and uploaded-document checkboxes cannot approve.
Teacher identity at 16+ is separate from staff teaching-quality review. Receipts
expire, and SQL guards prevent races after permission/credential changes. The
guardian relationship itself is an explicit declaration requiring operator
assessment, not a claim that DigiLocker proves family relationships.

Rights/security remain accessible when domain eligibility is missing. Exports
are bounded owner-only NDJSON jobs with leases, expiry and rechecked streaming.
Static SQL identifiers come from a closed compile-time resource allowlist; all
owner/cursor values are bound. Fresh proof gates access/deletion. Erasure uses a
tombstone to preserve other learners' licensed material and FK integrity. Signed
credential snapshots are validated unchanged and display-redacted afterwards.

Private Contact uses verified guest email, owner-only history and an admin inbox;
responses are durable, idempotent and visibly fail when delivery fails. Cron runs
privacy work even when telemetry is disabled. Public pages accurately describe
current free features and external-media consent; children never load embeds.

Deploy the API directly with D1/native limits/cron. An authenticated Vercel proxy
keeps browser requests same-origin and provides a trusted visitor IP. Secrets stay
server-side and excluded from CLI uploads. Closed preview is explicit; launch
requires provider settings and operator identity. No feature checkbox substitutes
for live provider credentials, legal review or production acceptance.
