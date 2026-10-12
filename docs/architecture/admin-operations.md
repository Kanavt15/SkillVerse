# Staff operations

Phase 1 adds current operational totals and an admin account workspace. All displayed accounts, counts and decisions come from D1. The existing instructor, course and content-report review flows retain their permissions.

## Permissions and privacy

- `/admin` and `GET /api/v1/admin/overview` allow moderators, admins and super-admins, with the existing MFA gate. Cloudflare Access remains a deployment requirement.
- `/admin/users` and `/admin/users/:userId` require admin or super-admin. Their API counterparts independently enforce that role and MFA on reads and writes. Moderators cannot inspect account emails through this workspace.
- Staff accounts, the acting admin and deleted accounts are read-only. This protects every staff account, including the last privileged account, through the ordinary account access controls. Privileged role management follows the independent super-admin workflow below.
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

Account controls do not edit roles, delete accounts, reset credentials, unlock sign-in failures or moderate course publication. Publication moderation uses the separate course workspace below.

## Overview and cost

The overview uses one batch of seven aggregate queries: users by status, active instructor accounts, published courses, enrollment/completion totals and the three pending queues. It counts full queues rather than the first list page and includes the oldest pending timestamp. There are no invented growth trends, revenue metrics or automated polling.

Migration `0011_admin_operations.sql` adds the creation/id index, expands the status index for account ordering and expands the resource audit index for recent history. `0012_admin_decision_version.sql` adds the non-personal decision counter, defaulting to zero for existing accounts. No table or personal-data column is added. Literal search and exact aggregate counts still scan matching data; this low-frequency staff workload should be monitored against D1 rows-read quotas. Move to indexed prefix/FTS search or cached aggregates if measured usage warrants it. See [free-tier limits](../operations/free-tier-limits.md).

Apply local migrations with `npm run db:migrate:local`. Apply both migrations on staging before its smoke test; this change does not deploy services automatically.

## Verification

`apps/api/test/admin.test.ts` exercises RBAC/MFA, secret exclusion, literal search/pagination, protected targets, strict inputs, preserved enrollment/course records, fresh sign-in, concurrent decisions, changed authority/revoked sessions, forced transaction rollback and counts beyond queue page limits.

`apps/web/e2e/admin.spec.ts` covers admin search, reason validation, suspension/reactivation/revocation, escaped history, preserved learner enrollment, keyboard order, both themes, 320/390/1440 px and axe checks, plus JavaScript-disabled search and protected staff inspection. API tests explicitly disable default external email/Turnstile credentials; provider-specific tests supply their own mocks.

## Publication moderation

`/admin/catalog` and `GET /api/v1/admin/courses?q=&status=all&page=1` allow moderators, admins and super-admins through the same MFA gate. Every course state is searchable, with 20 rows per page and an exact count from one batch snapshot. Bound literal substring search covers title, slug, instructor display name and username; it has the same ASCII case-folding and scan-cost limits as account search. Results omit email, lesson bodies and private learner records. Ordering is updated time descending with an id tie-breaker.

The existing `/admin/courses/:courseId` inspection shows curriculum and moderation history for any state. Staff may archive another instructor's published course using `POST /api/v1/admin/courses/:courseId/archive`, which accepts only `{ version, notes }`, trimmed to 10–2000 characters. Own-course archival stays in Studio. Draft, rejected, in-review and already archived courses cannot use this action.

One atomic D1 batch inserts an eligible audit receipt, updates status and latest staff feedback, then inserts the history event. Eligibility rechecks current staff role, active account, unexpired current session, MFA, publication status and the reviewed content/lifecycle version. History and updates depend on the receipt. Racing requests yield one success; repeats return 409 without another event or email. A failure in any statement rolls back all three. See [ADR 0011](adr/0011-course-publication-archival.md).

Independent staff may restore archived original courses with a reason and reviewed version. Every cycle advances the version, making old requests invalid. Emergency takedown also removes enrolled access and cannot be reversed through archival restoration. See [course lifecycle](course-revisions.md).

The course leaves public catalog/search/instructor listings and public previews, and rejects new enrollments. Existing enrollments, lessons, progress, notes, discussions and credentials remain intact; enrolled learners retain player access. This is publication withdrawal, not an emergency content-access removal tool. The reason appears as escaped text in staff history and instructor Studio feedback, and is emailed to the instructor after commit. Reasons must therefore be suitable to share with that instructor. They are excluded from public responses. Email delivery follows the existing asynchronous provider behavior and is not a transactional outbox.

Migrations `0014` and `0015` add revision mappings, lifecycle versions and review locks. Course substring search and exact counts remain low-frequency staff operations; monitor rows read as the catalog grows. The existing course status/instructor indexes remain in use; all-state ordering/search may require scans.

`apps/api/test/course-moderation.test.ts` covers role/MFA denial, own-course protection, strict reasons, literal search, pagination, races/replays, changed authority, revoked sessions, rollback, public visibility and retained learner records. `apps/web/e2e/course-moderation.spec.ts` covers publication, staff search, native JavaScript-disabled archival, validation, escaped reasons, instructor feedback/email, continued learner completion, both themes, 320/390/1440 px and axe checks.

Privileged provisioning and aggregate telemetry are implemented below. Provider delivery verification and staging/production deployment remain tracked work.

## Privileged authority and operational controls

P1-02 adds independent super-admin role decisions and validated operational controls
with fresh password/MFA proof, versions, session revocation and atomic audit receipts.
Admins can inspect bounded private audit and operational aggregates; moderators
retain review/moderation access. Provisioning is a one-time trusted CLI operation
with a dry-run, environment guard and protected marker, separate from demo seeds.
The [staff runbook](../operations/staff-controls.md) specifies authority, protected
accounts, security races, permitted values, alert contracts and deployment checks.
The [legacy reference](legacy-archive.md) pins verified old source before future ports.
