# ADR 0011: Course publication archival with atomic history

- **Status:** Accepted
- **Date:** 2026-10-11

## Context

Staff need to inspect courses beyond the pending review queue and withdraw an existing publication with an explained decision. Existing learners must retain access, and a failed or competing decision must not leave status without matching history and audit records.

## Decision

Provide a staff-only catalog across all existing lifecycle states, keeping pending reviews in their existing queue. Reuse the existing inspection and `archived` state; staff archival accepts only another instructor's published course and a required reason suitable to share with its instructor.

Extend the receipt pattern from [ADR 0010](0010-admin-account-decisions.md): insert a conditional audit receipt that rechecks current actor role/status/session/MFA and target publication status, then update the course and insert review history guarded by that receipt, all within one D1 batch. Email is scheduled only after a successful commit.

Archival remains terminal. No restoration is added, so the one-way transition itself prevents repeated decisions without another database counter. A future restore or re-review cycle must add a dedicated decision version before permitting publication to return to the same state.

## Consequences

- Public catalog/search, instructor listings, previews and new enrollments use their existing published-state filters. Existing learning records and enrolled player access are preserved.
- Archival does not remove content access from enrolled learners; emergency takedown is a separate policy and feature.
- Concurrent decisions produce one receipt/history event and one notification scheduling request. A later write failure rolls everything back.
- Feedback is escaped text in staff history, Studio and the instructor email; public read models exclude it.
- No migration, extra paid provider or polling is needed. Bounded staff substring search and exact counts can scan data and require production rows-read monitoring.
- The existing owner archival and pending-review flows retain their behavior. Published edits still go live immediately; draft revisions and restoration remain planned.
