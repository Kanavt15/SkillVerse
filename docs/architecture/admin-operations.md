# Staff operations

Phase 1 adds current operational totals and an admin account workspace. All displayed accounts, counts and decisions come from D1. The existing instructor, course and content-report review flows retain their permissions.

## Permissions and privacy

- `/admin` and `GET /api/v1/admin/overview` allow moderators, admins and super-admins, with the existing MFA gate. Cloudflare Access remains a deployment requirement.
- `/admin/users` and `/admin/users/:userId` require admin or super-admin. Their API counterparts independently enforce that role and MFA on reads and writes. Moderators cannot inspect account emails through this workspace.
- Staff accounts, the acting admin and deleted accounts are read-only. This protects every staff account, including the last privileged account, without a role-editor escape hatch.
- Responses explicitly select identity fields, role labels, verification/MFA indicators and counts. They omit password hashes, token hashes, device/IP details, TOTP secrets, recovery codes, private notes and quiz answers.
- Reasons are staff-only escaped text. They are not sent by email or published to learners. API responses use the existing `no-store` policy.

## Account search and inspection

`GET /api/v1/admin/users?q=&status=all&page=1` returns 20 accounts per page, newest first with an id tie-breaker, plus an exact count. Search is a literal substring over display name, username and email using bound `instr(lower(...), lower(?))` parameters. `%`, `_`, backslash and SQL-looking text have no special meaning. SQLite's built-in lower-case conversion folds ASCII; this is not a full Unicode fuzzy search. Query text is limited to 100 characters and page to 1–1000.

The detail response includes unexpired session rows (including pending MFA sessions), enrollment/course counts, a dedicated decision version and up to 20 recent account decisions. Counts do not expose the contents of learning records. Deleted status is visible, but the account-deletion/export lifecycle remains separate work.

## Decisions and concurrency

`POST /api/v1/admin/users/:userId` accepts a strict `{ decision, version, notes }` body. Decisions are `suspend`, `reactivate` and `revoke_sessions`; reasons require 10–2000 trimmed characters. Unknown fields, including roles and arbitrary status values, are rejected.

In one D1 `batch()`:

1. A conditional insert creates a unique append-only audit receipt. It checks the expected `users.admin_version`, applicable status, target protection, current actor role/status and an unexpired current admin session. Enabled MFA must still be satisfied; outside the explicit local-development exception it must be enabled and verified.
2. The user update and session deletion run only if that receipt exists. The decision version increments by one, including for session-only decisions. Profile/authentication timestamp updates cannot reset it or make an old decision eligible again.
3. The batch commits all three statements or rolls them all back.

One racing decision wins. Stale/replayed decisions return 409 without extra audit entries or session changes. A later write failure rolls back the receipt. Reasons, actor, request id and target are recorded, without session credentials. See [ADR 0010](adr/0010-admin-account-decisions.md).

Suspension immediately makes future authenticated requests fail and prevents normal sign-in. Reactivation requires a fresh sign-in: every successful decision deletes all existing sessions, including pending sessions. Enrollment, progress, notes, authored courses and instructor roles are preserved. Existing course visibility is not changed by account suspension; reported content still uses the content-report workflow.

This increment does not edit roles, delete accounts, reset credentials, unlock sign-in failures or moderate course publication through account controls.

## Overview and cost

The overview uses one batch of seven aggregate queries: users by status, active instructor accounts, published courses, enrollment/completion totals and the three pending queues. It counts full queues rather than the first list page and includes the oldest pending timestamp. There are no invented growth trends, revenue metrics or automated polling.

Migration `0011_admin_operations.sql` adds the creation/id index, expands the status index for account ordering and expands the resource audit index for recent history. `0012_admin_decision_version.sql` adds the non-personal decision counter, defaulting to zero for existing accounts. No table or personal-data column is added. Literal search and exact aggregate counts still scan matching data; this low-frequency staff workload should be monitored against D1 rows-read quotas. Move to indexed prefix/FTS search or cached aggregates if measured usage warrants it. See [free-tier limits](../operations/free-tier-limits.md).

Apply local migrations with `npm run db:migrate:local`. Apply both migrations on staging before its smoke test; this change does not deploy services automatically.

## Verification

`apps/api/test/admin.test.ts` exercises RBAC/MFA, secret exclusion, literal search/pagination, protected targets, strict inputs, preserved enrollment/course records, fresh sign-in, concurrent decisions, changed authority/revoked sessions, forced transaction rollback and counts beyond queue page limits.

`apps/web/e2e/admin.spec.ts` covers admin search, reason validation, suspension/reactivation/revocation, escaped history, preserved learner enrollment, keyboard order, both themes, 320/390/1440 px and axe checks, plus JavaScript-disabled search and protected staff inspection. API tests explicitly disable default external email/Turnstile credentials; provider-specific tests supply their own mocks.

Broader course moderation, privileged role provisioning, real production telemetry and staging deployment remain tracked work.
