# 0015: Privileged authority and private operational observations

- Status: Accepted
- Date: 2026-10-12

## Context

Demo admin seeds cannot provision production safely. Existing account moderation
does not manage privileged roles, and database totals cannot detect operational
failures. Both the Worker and Render API runtimes need the same authority rules,
private observations and durable alert state.

## Decision

Provision the initial verified, password-backed, MFA-enabled super administrator
through a trusted environment-bound CLI, dry-run by default. Its atomic audit,
role/session changes and protected marker permit only one successful apply and
provide no public bootstrap endpoint. Subsequent privileged decisions require an
independent super administrator, fresh password/factor, reason and current version.
Protect self/deleted targets and the last usable administrator/super administrator.

Use a server-only session-bound nonce, one use within 60 seconds. Conditional
audit receipts recheck current authority, MFA/session expiry, target eligibility
and version in D1; role/control mutations and nonce consumption depend on that
receipt. Role decisions revoke all target sessions. Staff cannot disable MFA.
MFA setup/recovery/disable commit relevant security changes, audit and other-device
revocation together. Failed proof and failed later transactions are distinct:
consumed TOTP/recovery proof does not become reusable after a conflict.

Expose bounded admin-only audit projections and six allowlisted operational
integer settings. Only Google sign-in can be toggled; secrets, provisioning and
unfinished financial/advertising switches remain protected. Cache validated
observational configuration for at most 60 seconds per process.

Record opt-in five-minute aggregates across six coarse groups, excluding health
checks and request identities/content. Persist one threshold alert per bucket/kind,
with a conditional delivery lease, at most three HTTPS attempts, timeout, no
redirects and receiver idempotency. Share maintenance between Worker Cron Triggers
and Render's running-service timer. Retention deletes bounded batches of
observations, never audit history.

## Consequences

Operators need independent MFA and recovery arrangements. CLI environment names
cannot verify a gateway's D1 destination; operators must review host/binding
configuration before applying. Full privileged recovery is a separate reviewed
infrastructure incident. Additional runtime instances converge on control changes
within a minute and cannot bypass current SQL authority checks.

Telemetry adds D1 operations and may lag or fail. Alert delivery is at least once
across crashes, so receivers deduplicate. A sleeping/stopped Render service cannot
run its timer. Application observations cannot report total service/database
outages or replace provider cost notifications. Provider delivery, independent
uptime monitoring and usage budgets require staging/production evidence.

See [the operator runbook](../../operations/staff-controls.md),
[staff operations](../admin-operations.md) and
[verified legacy source](../legacy-archive.md).
