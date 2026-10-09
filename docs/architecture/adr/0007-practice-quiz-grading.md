# ADR 0007: Server-graded, versioned practice quizzes

- Status: Accepted
- Date: 2026-10-09

## Context

Quiz lessons must earn completion without trusting client scores or exposing answer keys before a learner submits. D1 has no interactive transactions, and network retries, definition edits and parallel submissions must not duplicate completion effects.

## Decision

Store a versioned validated quiz definition per lesson and immutable enrollment-scoped attempt snapshots. Grade the exact score ratio on the server. Return explanations after submission because these quizzes support learning through repeated practice. Keep proctored assessment separate.

Use a client UUIDv7 attempt ID for idempotency, canonicalized answers for replay identity, and a server receipt for side-effect guards. A single D1 batch inserts only against the current accessible revision, completes a passing lesson and derives course completion. SQL enforces the hourly attempt limit across concurrent requests. Changed definitions clear current progress atomically while preserving earned certificate snapshots.

## Consequences

- Public/preview DTOs omit answer keys; feedback is private to the submitting enrollment.
- Retrying identical input returns the existing result without advancing progress again.
- Definition edits require learners to pass the new revision before new completion issuance.
- Practice quizzes permit retries with explanations and are not evidence of a supervised assessment.
- No new paid infrastructure or browser grading library is required.
