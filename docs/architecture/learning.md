# Catalog and learner journey

The API remains route → service → repository. Shared Zod schemas define filters and response contracts. The web Worker renders catalog/course pages on the server and posts ordinary forms through the same-origin API binding.

## Discovery and content access

`GET /api/v1/courses` returns 12 published courses per page. Search uses the external-content FTS5 `courses_fts` index over title, subtitle and description. Custom migration `0006_catalog_search.sql` builds the index and installs insert/update/delete triggers. It is registered in Drizzle's journal to reserve the sequence number, but the virtual table is absent from its table snapshots because the schema generator does not represent FTS. Wrangler applies all SQL migrations in filename order.

Search text becomes at most 20 quoted prefix terms joined with AND. Parameters stay bound; user FTS operators are treated as text. Filters and paging are validated, and ordering has a stable ID tie-breaker. Course listings exclude inactive instructors. Category pages return 404 for unknown category paths.

`GET /courses/{slug}` exposes outcomes, requirements and curriculum metadata, never protected Markdown or video references. `GET /instructors/{username}` exposes public profile fields and published courses, never email or account security fields. `GET /courses/{slug}/reviews` returns 20 public reviews per page.

`GET /courses/{slug}/lessons/{lessonId}` permits a published preview to anyone. Full content requires an enrollment belonging to the current user and course. A lesson ID from another course is rejected. Existing learners retain player access when their course is archived; archived courses disappear from discovery and cannot receive new enrollments. Lesson responses contain only the caller's notes and progress. GET requests do not write learning activity.

## Enrollment, progress, notes and reviews

All paths below are under `/api/v1`, require an active authenticated session, and also pass the existing CSRF middleware for mutations:

| Method | Path                                                         | Purpose                                                                |
| ------ | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| GET    | `/me/learning`                                               | Up to 200 enrollments with current progress and next unfinished lesson |
| GET    | `/learning/courses/{slug}/status`                            | Enrollment and caller's review for the course overview                 |
| POST   | `/learning/courses/{slug}/enroll`                            | Verified-email free enrollment                                         |
| POST   | `/learning/courses/{slug}/lessons/{lessonId}/progress`       | Complete or undo a lesson                                              |
| POST   | `/learning/courses/{slug}/lessons/{lessonId}/notes`          | Add a private note                                                     |
| DELETE | `/learning/courses/{slug}/lessons/{lessonId}/notes/{noteId}` | Delete only the caller's note in that lesson                           |
| POST   | `/learning/courses/{slug}/review`                            | Create/update the caller's one review                                  |
| POST   | `/learning/courses/{slug}/certificate`                       | Issue or return the completion certificate                             |
| GET    | `/me/certificates`                                           | Caller’s issued certificates                                           |

The unique `(user_id, course_id)` enrollment constraint makes retries and concurrent enrollment safe. The insert checks the current published/free state in SQL; the course counter is recomputed in the same atomic batch. Paid enrollment returns 403 until checkout grants an entitlement in Phase 2. A later price change does not remove an existing enrollment.

Progress is keyed by enrollment and lesson. Video/article completion is self-reported; quiz completion requires a server-graded passing attempt under the current definition. See [practice quizzes](quizzes.md). Repeated completion has no extra effect. A batch updates progress, activity time and completion state together; undo clears course completion. The learning shelf computes against current lessons, so new lessons reduce the percentage and become the resume target.

Notes are bounded to 5,000 characters and 100 returned per lesson; optional video timestamps are integer seconds from 0 to 36,000. Articles reject timestamps. The player rebuilds provider embed URLs from validated IDs and a numeric timestamp. Markdown disallows raw HTML, images and iframes, sanitizes links, and retains the existing CSP. Notes are never included in public course data or another learner's response.

Reviews require verified email, enrollment and at least one completed lesson. Instructors cannot review their own courses. Unique enrollment ownership permits one review, with rating counters recomputed atomically on edits. Private reporting and audited staff moderation are described in [community architecture](community.md).

## Certificates

The issuance query requires every current lesson complete and at least one lesson. A unique enrollment constraint makes concurrent issuance return the same certificate. A snapshot stores learner name, course title/slug, instructor name, lesson count and issuance time. Subsequent profile/course edits, added lessons or undone progress do not rewrite an achievement already issued.

HMAC-SHA256 signs a versioned canonical array containing all public claims and the random serial. `GET /api/v1/certificates/{serial}` verifies the signature before returning it. Tampered and nonexistent records return 404; missing signing configuration returns 503. `/verify/:serial` works signed out, carries `noindex`, and displays the snapshot, QR link and print/save-PDF controls. Browser printing provides the PDF; there is no server-generated PDF endpoint. The verification link intentionally shares the learner's display name and completion details, never their email or private notes.

Set **`CERTIFICATE_SIGNING_KEY`** separately in each environment before issuing certificates. Back it up with the database's recovery material and keep it stable: replacing or losing the only key makes existing signatures fail. A versioned key ring and revocation workflow are future work. These certificates attest to lesson completion, not a proctored skill assessment; paid exams are Phase 4.

## Verification

API tests cover previews, cross-course and cross-user access, concurrent enrollment and issuance, paid enrollment rejection, archived access, duplicate progress, undo, notes privacy, editable review aggregates and signature tampering. Component tests cover Markdown script/media/link attacks. Chromium tests use a new local account and the dev-only mailbox, then exercise sign-in, enrollment, notes, resume, completion, review and signed-out verification. Catalog screens are checked at 1280px and 390px in light/dark mode with axe WCAG scans. Automated scans complement manual accessibility testing; they do not prove complete conformance.
