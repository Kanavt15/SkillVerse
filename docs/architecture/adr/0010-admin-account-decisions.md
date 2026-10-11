# ADR 0010: Protected account decisions with atomic audit receipts

- **Status:** Accepted
- **Date:** 2026-10-11

## Context

Staff need to suspend/reactivate learner accounts and revoke compromised sessions. The operation must not partially commit, permit a content moderator to inspect account identities, remove staff access or accept competing decisions from stale pages. D1 supports atomic batches, rather than interactive application transactions.

## Decision

Account inspection and writes require admin/super-admin plus the existing MFA gate. All staff, self and deleted accounts are protected; role changes are outside this workspace.

Use a dedicated `users.admin_version` counter as the optimistic version, incremented only by successful account decisions. General account timestamp updates must not reset the guard or make an old request eligible again. The first batch statement conditionally inserts a unique append-only audit receipt after checking version, target, action applicability and the actor's current role, status, session and MFA. User updates and session deletions depend on that receipt in the same batch. This extends [ADR 0004](0004-d1-atomicity.md) without a mutable decision-token column.

Every success revokes all existing sessions, including reactivation. Preserve learning records, course content and non-staff roles. Reasons stay in restricted account history and are rendered as escaped text. The overview exposes real aggregate totals to review staff; detailed identities remain restricted to account admins.

## Consequences

- Competing/replayed decisions yield one success and side-effect-free conflicts; later write failures roll back all changes, including the receipt.
- Current authority is checked inside the transaction, rather than relying solely on a prior middleware read.
- Index-only migration `0011_admin_operations.sql` supports bounded account pagination and recent resource history.
- Additive migration `0012_admin_decision_version.sql` initializes existing accounts at decision version zero.
- Reasons share the existing append-only audit retention policy. Its id acts as the transaction receipt and never leaves the server as a credential.
- Competing access decisions invalidate an open account form; admins must refresh before a new decision. Unrelated profile/authentication updates do not change the counter. Account suspension does not independently unpublish courses or remove existing content.
- Staff role provisioning, deletion/export lifecycle and broader publication moderation remain separate features.
