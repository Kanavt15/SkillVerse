# ADR 0012: Atomic instructor application decisions and private history

- **Status:** Accepted
- **Date:** 2026-10-11

## Context

Applicants need to withdraw a pending submission, revise it and retain staff feedback. Concurrent submissions and competing decisions must not create duplicate pending work or grant an instructor role without matching status and audit records.

## Decision

Add terminal `withdrawn` status and nullable `withdrawn_at` through additive migration `0013_instructor_application_withdrawal.sql`. Reapplication creates a new ID; old submissions remain read-only. Return the latest 20 submissions only to their owner, including after approval.

Submission uses a conditional insert checking current account, verified email, session/MFA, absence of an instructor role and absence of a pending application. Its audit insert is guarded by the new application ID in the same D1 batch.

Use the audit receipt pattern from [ADR 0010](0010-admin-account-decisions.md) for pending decisions. The receipt checks current actor authority, session/MFA, ownership or separation of duties, and application status. Approval also checks the applicant's active, verified account and absence of the instructor role. Receipt, status and role grant commit together. Only successful staff decisions schedule email.

## Consequences

- Competing approval, rejection and withdrawal requests have one winner; stale attempts return `409`. Other users cannot withdraw or read someone else's history.
- Withdrawals have their own timestamp and no reviewer identity, feedback or review timestamp. Staff can inspect the withdrawn queue without decision controls.
- Failure of an audit, status or role write rolls back the whole batch. No extra provider, job or polling is added.
- Terminal states never return to pending, so application IDs provide replay protection without a decision version. Any future reopening feature must revisit that assumption.
- The UI uses native forms, escaped feedback and existing light/dark design tokens. History is bounded but may sort an applicant's submissions using the existing user index; monitor D1 rows read as volume grows.
