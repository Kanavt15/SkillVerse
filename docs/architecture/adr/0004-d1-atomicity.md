# ADR 0004: Atomic writes with D1 `batch()`

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

D1 does not support interactive transactions (`BEGIN`, read, decide, write, `COMMIT`). Money movement (purchases, refunds, payouts, wallet credits) must never be half-applied, and must never be applied twice when a webhook is retried or two requests race.

## Decision

1. Statements that must succeed or fail together are sent as **one `db.batch([...])`**, which D1 executes atomically.
2. Decisions that would normally be "read, then write" are expressed as **conditional writes**: `UPDATE … WHERE status = 'pending'` plus `RETURNING`. The caller checks whether a row was affected, and only one racing request can win.
3. Every externally-triggered money event carries an **idempotency key** stored under a `UNIQUE` constraint (e.g. `webhook_inbox.provider_event_id`, `ledger_entries.idempotency_key`). A retry hits the constraint and becomes a no-op.
4. The ledger is **double-entry and append-only**. Balances are derived from entries and never updated in place.

## Consequences

- ✅ No partial writes and no double credits, even under retries and concurrency.
- ⚠️ Code must be designed around the batch: compute everything first, then write once. Reviewers check money code for read-then-write patterns.
- ⚠️ Multi-step external flows (call Razorpay, then write) use a "pending" row first and a reconciliation job to repair anything interrupted between the steps.
