# Phase 1: Core learning platform

Status: **in progress**. This checklist reflects the current code, rather than treating the whole phase as complete.

## Implemented

- [x] Password registration, email verification, reset/change, sessions and device revocation.
- [x] Google sign-in, TOTP with recovery codes, Turnstile integration and admin MFA gate.
- [x] Email-link sign-in with scanner-safe confirmation, mailbox cooldown, safe return destinations and mandatory second factor for 2FA accounts.
- [x] Profile editing and onboarding interests, goals and timezone.
- [x] Instructor applications and staff decisions.
- [x] Studio course details, sections, video/article lessons, ordering and submission checklist.
- [x] Quiz authoring/review, server grading, private feedback/history, retries, atomic attempt limits and revision-aware lesson completion.
- [x] Course review queue, publish/reject/archive transitions and moderation history.
- [x] SSR catalog, FTS5 search, category pages, bounded pagination and level/language/price/sort filters.
- [x] Public course and instructor pages with protected lesson bodies.
- [x] Idempotent free enrollment; paid enrollment waits for Phase 2 checkout.
- [x] My learning and dashboard with real progress and the next unfinished lesson.
- [x] YouTube/Vimeo and article player, previews, complete/undo/next controls and curriculum.
- [x] Private Markdown notes with optional video timestamps and jump-back links.
- [x] One editable review per learner/course, requiring a completed lesson.
- [x] Enrollment-scoped course/lesson Q&A, timestamp links, replies and accepted answers.
- [x] Private reports for questions/replies/reviews, staff hide/restore/dismiss, audited decisions and hidden-review rating recalculation.
- [x] Persistent notification inbox, unread/read-all controls, discussion preferences and per-user live WebSocket updates.
- [x] Completion certificates with immutable claims, HMAC verification, QR links and browser PDF printing.
- [x] Three locally seeded courses with usable article lessons; repeated seeding preserves edits.
- [x] API authorization/concurrency tests, Markdown security tests and Chromium learner/accessibility regression in CI.

## Remaining before Phase 1 is complete

- [ ] Interactive video chapters/checkpoints, transcript and keyboard shortcuts.
- [ ] Admin user management, broader moderation and operational dashboards.
- [ ] Public help/about/contact and reviewed legal/community pages.
- [ ] End-to-end instructor applications, Google/MFA and review rejection/withdrawal; broader manual keyboard/screen-reader checks (quiz authoring, publication and learner keyboard controls are covered).
- [ ] Production performance measurements, sitemap/metadata follow-up, staging deployment and smoke tests.

R2 uploads and the workflow for reviewing edits to published courses remain tracked in the [teaching notes](../architecture/teaching.md). Payments, commercial credentials, engagement, mentoring, subscriptions and organizations belong to later phases.

## Try this increment

Run `npm run setup`, then `npm run dev`. Use the development learner from the [root README](../../README.md#7-demo-accounts), browse `/courses`, enroll, save a note, complete lessons, post a review and verify a certificate while signed out. Light/dark themes and narrow screens use the existing design tokens.

Run `npm run check`, `npm run build` and `npm run test:e2e` before shipping. Browser setup: `npx playwright install chromium`. Details of permissions, search and certificate persistence are in [learning architecture](../architecture/learning.md).

Course Q&A and the staff reporting queue are described in [community architecture](../architecture/community.md).

The notification bell and inbox are described in [notification architecture](../architecture/notifications.md).
