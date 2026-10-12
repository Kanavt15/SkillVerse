# ADR 0013: Private revision copies and stable learner records

Status: accepted, 2026-10-12.

Published owner edits previously changed live content immediately. Archival was
terminal, so its status alone acted as a replay guard.

Use private relational course copies with a base publication version, and keep
the existing Studio/editor and review queue. Approval copies reviewed content
onto stable original lesson IDs in one receipt-guarded D1 batch. Retire removed
rows to preserve learner notes, progress and discussions. Keep issued
certificate claims immutable; changed quizzes require a new passing result.

Add dedicated content/lifecycle versions, review-lock triggers and a unique
active-revision index. Recheck current staff role/session/MFA and version at the
transaction boundary. Permit reason-required restoration by independent staff,
and separate emergency takedown from archival because enrolled access differs.

This preserves learner records and avoids duplicating the authoring UI. Copies
cost storage, and bounded synchronous publication limits curriculum size to
150 lessons/50 sections. Obsolete drafts must be archived and recreated rather
than silently rebased. See [lifecycle contracts](../course-revisions.md).
