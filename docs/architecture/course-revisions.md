# Reviewed course revisions and recovery

Published courses are immutable through the owner editor. **Edit draft revision**
creates or reopens a private copy, with its own course, sections, lessons, tags
and quiz definitions. That copy uses the existing Studio forms, submission
checklist, withdrawal controls and independent staff queue.

## Publication and concurrency

`courses.source_course_id` links a copy to the original. `base_version` records
the original version when the copy was created. A partial unique index permits
one active draft/rejected/in-review revision per original course. Creating it
is idempotent, including concurrent requests. Revisions never become public
courses or acquire learner enrollments.

Content and lifecycle triggers advance `courses.version`. Learner counters and
last-access changes do not invalidate a draft. Review locks reject curriculum,
quiz, tag and course-content edits while in review, including an edit that
passed the service check before another request submitted the course.

Staff approval/rejection requires the exact inspected `version`. An audit
receipt, publication writes and history commit in one D1 batch. The receipt
checks the active actor's current role, current session expiry, MFA, separation
of duties and the submitted version. Revision approval additionally requires
the original to remain published at `base_version`. A withdrawn/resubmitted
review or an archive/restore cycle cannot make an old decision valid again.

The original course ID, public slug, owner, enrollment records, original
publication timestamp and existing certificate claims stay unchanged. Approved
fields and curriculum replace the live view atomically, and the revision copy
becomes archived as an inspection record. Its approval appears in its own
history and as `revision_approved` on the original. Rejection preserves the
current publication and returns the private draft with feedback. Rejection can
also return an obsolete draft; approval of that draft is still denied. To
rebase, archive the obsolete private copy and start a new revision from the
original.

Submissions/publication are bounded to 150 lessons and 50 sections. Larger
courses need a future background revision workflow. Check the database-query
budget of the Cloudflare plan before deploying large revisions.

## Learner records and quiz behavior

`source_section_id` and `source_lesson_id` map private curriculum IDs back to
the original IDs. Approval updates matching original rows; new curriculum
gets new public IDs. Notes, discussion links, progress and old attempt records
therefore retain their foreign keys.

Removed lessons/sections are marked with `retired_at`, rather than deleted.
They leave public previews, current curriculum, progress percentages and
certificate eligibility counts. Learners enrolled before retirement can still
open their saved lesson links and notes; later enrollments cannot access them.

Changed quiz definitions get a new quiz revision at publication. The matching
lesson's passing completion is cleared, stale submissions are rejected and a
fresh passing attempt is required for unissued completion. An unchanged
definition preserves its revision and passing completion, even if an author
changed and reverted the private quiz. Other lesson progress remains intact.
Course completion is recalculated against current lessons; issued signed
credentials retain their original claims and signature.

## Archive, restore and emergency takedown

Owner archival requires a reviewed version. Independent staff can archive a
published original or restore an archived original using `{ version, notes }`;
the reason is trimmed to 10–2000 characters. Current staff authority/session/MFA
is checked again at the transaction boundary. Restoration returns a previously
published course to `published`; an archived unpublished draft returns to
`draft`. Owners cannot directly restore their own content, and private revision
copies cannot be restored as public courses.

Normal archival stops public discovery, previews and new enrollment while
retaining enrolled access. Staff **Emergency takedown** moves an original
published/archived course to `taken_down` and also removes enrolled access.
Records and existing signed credentials are preserved. Takedowns are terminal
through these endpoints; reinstatement requires a separate reviewed incident
decision and is not equivalent to archive restoration.

Every restoration/takedown has a reason and audit/history record. Archival
also retains the existing instructor email. Restoration/takedown feedback is
visible in Studio/history; a durable multi-event email outbox is later work.

## API and verification

| Endpoint                                        | Contract                                                      |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `POST /api/v1/studio/courses/:id/revisions`     | Owner-only published original; creates/reopens private editor |
| `POST /api/v1/studio/courses/:id/archive`       | Owner + `{ version }`                                         |
| `POST /api/v1/admin/course-reviews/:id/approve` | Independent staff + `{ version, notes? }`                     |
| `POST /api/v1/admin/course-reviews/:id/reject`  | Independent staff + `{ version, notes }`                      |
| `POST /api/v1/admin/courses/:id/archive`        | Published original + `{ version, notes }`                     |
| `POST /api/v1/admin/courses/:id/restore`        | Archived original + `{ version, notes }`                      |
| `POST /api/v1/admin/courses/:id/takedown`       | Published/archived original + `{ version, notes }`            |

Apply migrations `0014_course_revisions.sql` and `0015_revision_constraints.sql`
before deploying dependent code. Real D1 tests cover private draft isolation,
stable links/notes/certificates, changed quiz completion, stale submission/base
versions, races, rollback and revoked staff authority. Chromium journeys cover
native Studio revision/rejection/resubmission/approval, restoration/takedown,
JavaScript-disabled archival and responsive axe checks.
