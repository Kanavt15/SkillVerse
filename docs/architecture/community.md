# Course discussions and moderation

Q&A lives at `/courses/:slug/questions`, with links from the lesson player, course overview and instructor Studio. Questions can refer to a course, a lesson or a video moment. Replies support the same sanitized Markdown as lessons. A question author or its course instructor can choose or clear an accepted answer; answers are checked against the same visible thread. Lists and replies are paginated in groups of 20. Accepted answers remain visible across reply pages.

## Access and persistence

All discussion API routes require a current session. The service checks enrollment in the requested course or ownership by its instructor. Staff inspection additionally requires the staff role and MFA gate. Other learners receive 404 without discussion content. Email verification is required to post, resolve and report. Existing members can read archived conversations, but archived courses cannot receive questions, replies or accepted-answer changes. Lesson IDs are checked against the course; timestamps require a video lesson.

`discussion_questions` stores optional lesson/timestamp context and accepted reply IDs; `discussion_replies` belongs to one question. Author deletion preserves conversations with a deleted-learner label. Lesson deletion preserves the question with course-wide context. Visibility checks occur on all learner reads, and writes recheck current publication and thread visibility in SQL.

## Reports and staff decisions

`content_reports` is a private staff queue for questions, replies and reviews. The service verifies visible target membership before accepting reports. A unique reporter/target key makes submission retries harmless. Reports are never returned to instructors or reported authors.

`/admin/reports` and every report API require a staff role and the existing MFA gate. Staff can hide, restore or dismiss with feedback. A version and a unique decision token guard one atomic D1 batch containing the report transition, content change, counter adjustment and audit record. A stale decision gets 409 and writes no content or audit changes. Hidden content remains available to authorized staff for review.

Hiding a reply clears its accepted-answer reference. Hiding a review removes it from public lists and recomputes course rating totals. An author editing a hidden review cannot bypass moderation; restoration recomputes ratings from its latest content. Dismissing a report leaves current content visibility unchanged. The audit record contains the decision and feedback, without reporting identity in learner responses.

## Validation and remaining work

Worker/D1 tests cover enrollment isolation, cross-thread solutions, verified posting, archived access, report deduplication, staff/MFA gates, hidden-content privacy, stale decisions, audit integrity and review rating restoration. Chromium exercises the ask/reply/accept/report/moderate journey and narrow-screen accessibility. Migrations are local until the normal staging/deployment workflow runs.

Editing/removing discussion posts and a formal appeal workflow remain future enhancements. Notifications are tracked separately in the [Phase 1 checklist](../phases/phase-1.md).
