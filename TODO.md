# SkillVerse implementation checklist

Updated: **2026-10-12**. Branch: **v2**. Strategy: [plan.txt](plan.txt).

`[x]` means implemented in this repository; `[ ]` means unfinished or unverified.
Completed code does not imply provider configuration or production deployment.
When part of a feature exists, its remaining work is listed separately below.
Local seeds and isolated fixtures are development data, not production content.

## Phase status

| Phase                         | Status      | What remains                                                                |
| ----------------------------- | ----------- | --------------------------------------------------------------------------- |
| 0 - Foundation                | Implemented | Local legacy source verified; staging was deferred                          |
| 1 - Core learning             | In progress | Revision/review, staff/privacy controls, public policies and release checks |
| 2 - Monetization              | Planned     | Paid commerce and operating integrations                                    |
| 3 - Engagement                | Planned     | Practice, gamification and social learning                                  |
| 4 - Paid certifications       | Planned     | Exams, credentials and portfolios                                           |
| 5 - Mentoring and skill swap  | Planned     | Booking, barter, chat and disputes                                          |
| 6 - Subscriptions and growth  | Planned     | Plus, creator pools, AI and growth tools                                    |
| 7 - Teams, careers and global | Planned     | Organizations, recruiting and international commerce                        |

## Completed foundation and documentation

- [x] Replace the legacy Express/MySQL/Redis application in the working tree.
- [x] npm workspaces for API, web, database and shared validation/types.
- [x] Strict TypeScript, ESLint security rules, Prettier and editor conventions.
- [x] One-command setup, generated local secrets, migrations and development seeds.
- [x] Concurrent API/web development and stale dev-registry cleanup.
- [x] D1/Drizzle schema, migration journal and local database tooling.
- [x] Hono API with request IDs, redacted logs and standard error responses.
- [x] Security headers, CSRF checks, API/auth rate limits and bounded request bodies.
- [x] Generated OpenAPI and development API documentation.
- [x] React Router SSR with same-origin service binding and CSP nonce.
- [x] CI for lint, formatting, types, tests, docs, build, browser checks and dependency audit; Dependabot and contributor templates.
- [x] Contributor/setup guides, architecture/schema references, ADRs, security/business/design/operations documentation and docs checking.
- [x] Backup/restore runbook and certificate-key recovery instructions (automation and restore evidence remain open).

Evidence: [Phase 0](docs/phases/phase-0.md), [architecture](docs/architecture/overview.md), [CI](.github/workflows/ci.yml).

## Completed Phase 1 functionality

### Accounts and security

- [x] Registration, email verification, password login, reset and password changes.
- [x] Hashed server sessions, expiry, device inspection and revocation.
- [x] Email-link sign-in with safe return URLs, scanner-safe confirmation, single-use links and mailbox cooldown.
- [x] Google sign-in implementation with PKCE/state/nonce and account-linking protections; enabled only when configured.
- [x] TOTP enrollment/challenge, recovery codes, replay protection and staff MFA gate.
- [x] Turnstile integration and breached-password checks; provider deployment checks remain open.
- [x] Profile settings and onboarding interests, goal and timezone.
- [x] Server-enforced role/ownership rules and deny-by-default route tests.

### Teaching and review

- [x] Instructor applications, staff approval/rejection and applicant feedback emails.
- [x] Owner-only pending application withdrawal and private latest-20 submission history, including after approval.
- [x] Atomic application submission/audit and decision/status/role grants with current access checks, race and rollback coverage.
- [x] Studio draft creation, course details, category, level/language, price fields, outcomes, requirements and tags.
- [x] Sections and lessons with rename, reorder, move and delete controls.
- [x] Video links, article lessons and versioned practice-quiz authoring.
- [x] Submission checklist, pending-review editing lock and owner withdrawal.
- [x] Staff inspection, publication/rejection, feedback and moderation history; self-review is denied.
- [x] Staff catalog search across all states and reason-required publication archival with atomic audit/history.
- [x] Archived publications disappear from public discovery/new enrollment while existing learners retain access.

### Discovery and learning

- [x] SSR catalog, D1 FTS5 search, categories, filters and bounded pagination.
- [x] Public course/instructor pages and permission-filtered lesson metadata/previews.
- [x] Idempotent free enrollment; paid enrollment remains unavailable.
- [x] Learning shelf/dashboard with actual progress and next unfinished lesson.
- [x] Video/article player, curriculum, complete/undo/next controls and focused keyboard navigation.
- [x] Server-graded practice quizzes, private attempt history/feedback, retries and atomic limits.
- [x] Revision-aware quiz completion and passing results linked to progress.
- [x] Private Markdown notes with optional video timestamps and jump-back links.
- [x] Authored chapter markers, searchable timed transcripts and learner-opened reflection checkpoints.
- [x] Editable learner reviews requiring a completed lesson; ratings reflect moderation.
- [x] Signed course-completion certificates, public verification, QR links and browser PDF printing.

### Community and staff operations

- [x] Enrollment-scoped course/lesson Q&A, timestamp links, replies and accepted answers.
- [x] Private reports and staff hide/restore/dismiss with audited decisions.
- [x] Notification inbox, read/unread/read-all and discussion preferences.
- [x] Per-user live notification hints through WebSockets/Durable Objects.
- [x] Admin account search/inspection, protected suspension/reactivation and session revocation with reasons and audit history.
- [x] Current platform/queue totals and oldest pending work from actual database records.

Evidence: [authentication](docs/architecture/authentication.md), [teaching](docs/architecture/teaching.md), [learning](docs/architecture/learning.md), [quizzes](docs/architecture/quizzes.md), [video learning](docs/architecture/video-learning.md), [community](docs/architecture/community.md), [notifications](docs/architecture/notifications.md), [staff operations](docs/architecture/admin-operations.md).

## Completed design and local verification

- [x] Professional harbor-blue/slate redesign across public, account, learner, Studio and staff pages using shared React/Radix components.
- [x] Light/dark/system themes with cookie persistence and self-hosted typography.
- [x] Working hero search, connected learning diagram, scroll-down cue and scroll-linked orbit.
- [x] Reduced-motion support, native discovery navigation and public fallback behavior without JavaScript.
- [x] Real API content and honest empty states; no invented testimonials or platform metrics.
- [x] Responsive layout and long-feedback wrapping at narrow widths.
- [x] Public Help/About pages explaining current product behavior.
- [x] API authorization/privacy, concurrent decision/rollback and Markdown security tests.
- [x] Browser journeys for learning/certificates, email links, community, quizzes, video learning, applications, course review, staff operations and redesign.
- [x] Axe/theme/overflow checks and native-form/browser keyboard coverage on exercised surfaces.
- [x] Last functional baseline: 247 automated tests, all 15 Chromium journeys across the full run and corrected targeted rerun, production build and code/docs checks.
- [x] Last measured initial homepage JavaScript: 178,322 bytes gzip across 34 static chunks, below the 180,000-byte budget.

These are local results from this session, not a new test run or production certification. See [test guide](docs/guides/writing-tests.md) and [design verification](docs/design/redesign.md).

## Remaining Phase 1 tasks - execute in this order

### P1-01: Reviewed edits and restoration

- [x] Add draft revisions for published courses so proposed edits do not replace the live version immediately.
- [x] Review/approve/reject revisions with atomic publication, audit/history, current permissions and stale-request guards.
- [x] Preserve enrolled learner access, notes/progress and certificate claims; define quiz-revision behavior before publishing changes.
- [x] Add reason-required archive restoration with concurrency/version guards and an explicit owner/staff policy.
- [x] Define emergency takedown separately from archival, including whether enrolled access is removed.
- [x] Add Studio/staff revision and restoration journeys, rollback/privacy tests and updated lifecycle docs.

Implemented: private relational revision drafts; receipt-guarded, versioned review/publication; stable learner references and retired curriculum; reason-required independent restoration; separate emergency takedown. Additive migrations `0014` and `0015`. See [lifecycle contracts](docs/architecture/course-revisions.md).

### P1-02: Staff authority and operational controls

- [x] Add secure initial privileged-account provisioning outside local demo seeding.
- [x] Add audited, reason-required grant/revoke controls for privileged roles with step-up/MFA, protected accounts and prevention of last-admin lockout.
- [x] Review session rotation/revocation after privilege changes and sensitive account operations.
- [x] Provide bounded audit inspection and validated platform-setting/feature-flag controls with protected values and audit records.
- [x] Add production error/usage alerts and operational telemetry; overview database totals alone are insufficient.
- [x] Verify local legacy availability before domain ports: cached commit `eaa052e8d4723e9b0ec582f311ed7085f3c69195`; the local `legacy-v1` tag is absent. See [archive reference](docs/architecture/legacy-archive.md).

Implemented with additive migrations `0016` and `0017`. See [staff provisioning, authority and alert runbook](docs/operations/staff-controls.md) and [ADR 0015](docs/architecture/adr/0015-privileged-authority-and-observations.md). Provider alert delivery, independent uptime checks, budget notifications and staging/production rollout still require external evidence in P1-06.

### P1-03: Public policies and account privacy

- [ ] Add public Contact with a maintained private support/grievance workflow and spam controls; do not publish a support email (user decision, 2026-10-12).
- [ ] Publish reviewed Terms, Privacy, Cookies, Community Guidelines, Instructor Terms and refund/cancellation information appropriate to available features.
- [ ] Implement account eligibility and consent handling before public launch. User decision: learning 10+, teaching 16+ (2026-10-12); enforcement and guardian-consent workflow remain open.
- [ ] Add authenticated data export with owner privacy and bounded/background processing where needed.
- [ ] Add account deletion with step-up, session revocation, retention/anonymization rules and tested effects on courses/community/certificates.
- [ ] Review marketing copy so future payments, mentoring and other services are clearly marked as planned.

Repository policy files and business/compliance notes do not replace public reviewed pages or implemented privacy controls.

### P1-04: Remaining learning and accessibility acceptance

- [ ] Complete graded/timed in-video quiz checkpoints; existing reflection checkpoints and standalone practice quizzes cover different behavior.
- [ ] Cover Google sign-in and MFA enrollment/challenge/recovery/staff gating in browser journeys with isolated provider mocks/test configuration.
- [ ] Perform broader manual keyboard, zoom/reflow and screen-reader checks on critical learner/teacher/staff flows; record results.
- [ ] Resolve resulting accessibility defects and extend regression coverage where useful.

### P1-05: Search visibility and performance

- [ ] Generate a sitemap from published public content, excluding private, rejected and archived data.
- [ ] Complete canonical/metadata/social-image and structured course-data checks using actual content.
- [ ] Add repeatable Lighthouse/performance budgets and record the network/device profile.
- [ ] Measure staging/production LCP, CLS, Worker CPU, D1 rows read and request/storage/email usage.

### P1-06: Deployment, security and recovery gates

- [ ] Replace environment placeholders and provision separate staging/production resources and secrets.
- [ ] Apply/review migrations through `0013_instructor_application_withdrawal.sql` before dependent deployments.
- [ ] Verify same-origin web/API routing, service binding and NotificationHub migration.
- [ ] Verify staff Cloudflare Access, enforced MFA, HIBP, Turnstile, Google callbacks and email sender/provider configuration.
- [ ] Add secret scanning and review dependency/action pinning; CI currently uses action version tags, not commit SHAs. Production audit is clean after separating/bundling hosting tooling; build dependencies still require review, including the [unpatched braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- [ ] Run staging smoke/provider checks and a security baseline scan; retain evidence and resolve findings.
- [ ] Perform a clean-clone setup check and scratch-database backup/restore rehearsal, including certificate verification after recovery.
- [ ] Confirm monitoring, incident ownership and a rollback/deployment runbook before production release.

R2 uploads and code execution remain later-phase extensions. Phase 1 can release with external video links after its listed acceptance gates are satisfied. Completing Phase 1 does not enable paid checkout.

## Phase 2 - monetization and operating integrations (not started)

- [ ] Write Phase 2 scope/acceptance record and confirm commercial/provider prerequisites.
- [ ] Products, prices, wishlist/cart, server-calculated totals, orders and order history.
- [ ] Razorpay provider adapter and test-mode checkout with payment/cancellation/failure UX.
- [ ] Raw-body webhook signatures, unique inbox events, replay handling and atomic payment-to-enrollment settlement.
- [ ] Immutable double-entry ledger, split arithmetic, wallet/credit packs, gift cards and transaction history.
- [ ] Coupons, referrals, bundles, early-bird and pay-what-you-want pricing with minimum-price/abuse checks.
- [ ] Invoices/tax handling and refund/cancellation rules reviewed before implementation and real sales.
- [ ] Refund API/staff workflow with reversal entries and entitlement adjustments; retry and concurrency tests.
- [ ] Instructor earnings/statistics and provider-hosted KYC/linked accounts, payout scheduling and status history.
- [ ] Queue-backed durable email outbox, retries/dead letters and delivery visibility.
- [ ] Reconciliation/cleanup jobs, provider drift alerts and automated financial backup/restore procedures.
- [ ] AdSlot/house ads, consent-managed AdSense, placement controls, layout reservation and `ads.txt`; leave disabled until approved.
- [ ] Demand Radar based on actual search gaps and requests, with privacy/aggregation rules.
- [ ] Direct R2 uploads/assets with scoped authorization, size/type checks, quarantine and private delivery; retain video-link support.
- [ ] Creator improvements: drag-and-drop curriculum, bulk assets and Q&A/review/student workspaces with scoped permissions.
- [ ] Provider/account activation and commercial compliance review; paid purchase/refund/payout test journeys before real transactions.
- [ ] Payments, uploads and realtime/background-job beginner guides; updated schema, threat model, ADRs and operating budget.

Seeded prices, commission/refund defaults, money utilities and flags are foundations only. Checkout, wallets, invoices, payouts, ads and durable jobs are not implemented. AdSense approval is required for enabling AdSense, not for releasing commerce with ads disabled.

## Phase 3 - engagement and practice (not started)

- [ ] XP events, levels, achievements, streaks/freezes, challenges and real leaderboards; port legacy rules only after archive verification.
- [ ] Practice catalog/editor with isolated browser runners (JavaScript/Pyodide) and secure external graded submissions/hidden tests.
- [ ] Submission states, grading/anti-cheat, quotas and failure recovery; never execute untrusted code on the host.
- [ ] Contests, sponsorship support and live Durable Object leaderboards.
- [ ] Learning paths, useful recommendations and weekly digest preferences/jobs.
- [ ] Offline PWA for permitted articles/notes with privacy, cache expiry and logout cleanup.
- [ ] Skill Map roadmaps based on authored paths and actual progress.
- [ ] Study Pods, shared goals and scoped pod chat.
- [ ] Weekly Leagues and Skill Duels with matchmaking, ELO and abuse controls.
- [ ] Teach-back submissions and peer rubric feedback/instructor fast-track; AI scoring waits for Phase 6 AI controls.

## Phase 4 - paid certifications and proof of skill (not started)

- [ ] Question banks, approved exam authors and exam builder with protected answer keys.
- [ ] Server-timed randomized attempts, integrity events, grading, accessibility and appeal rules.
- [ ] Exam fees, retakes and pre-attempt refunds through the commerce layer.
- [ ] Signed verifiable exam credentials/Open Badges, verification and LinkedIn add-to-profile.
- [ ] Skill Passport with opt-in visibility, Skill DNA radar and QR sharing of actual achievements.
- [ ] Capstone submissions, rubric-based peer reviews and paid expert review using fraud/dispute controls.

Existing course-completion certificates remain a separate implemented feature; they do not prove the exam/credential work above is complete.

## Phase 5 - mentoring and skill swap (not started)

- [ ] Mentor profiles/application, timezone-aware availability and booking rules.
- [ ] Paid bookings, supported payment holds/settlement, cancellation/refunds, disputes and mentor payouts.
- [ ] Meeting links, `.ics` invites, reminders and post-session reviews; built-in video is a separate later extension.
- [ ] Skill-swap offers/matching, no-show handling, time-credit ledger and Swap Chains.
- [ ] Scoped DM conversations/chat, blocking/reporting and retention controls.
- [ ] Skill Bounties with acceptance/disputes and replay-safe reward settlement.
- [ ] Recurring Office Hours and any later Plus priority rules.

## Phase 6 - subscriptions and growth (not started)

- [ ] Plus subscriptions, provider webhooks, billing/dunning/cancellation and correct entitlements/ad suppression.
- [ ] Plus catalog and instructor revenue pools with auditable engaged-minute measurement and abuse checks.
- [ ] Sponsored CPC campaigns, promoted labels, budget accounting and click-fraud deduplication.
- [ ] Affiliate attribution/commission settlement separate from the Phase 2 referral-credit program.
- [ ] Course-scoped AI tutor with citations/hints, protected access, quotas and privacy controls.
- [ ] Semantic search, instructor quiz generation and AI course co-pilot with human review.
- [ ] Auto captions, Hindi translation, article text-to-speech and low-bandwidth delivery.
- [ ] Auto flashcards/spaced repetition and adaptive AI Study Planner with `.ics` export/reminders.
- [ ] Skill Snacks instructor-authored clips/feed with content and consent controls.
- [ ] Seasons/free and Plus reward tracks, Guilds and guild events.
- [ ] Sponsor a Learner/scholarships with verified allocation and appropriate public impact reporting.
- [ ] Commitment Pledge with reviewed legal/product rules and auditable scholarship-fund settlement.
- [ ] Passkeys and additional account-security UX, with recovery and browser coverage.

## Phase 7 - teams, careers and international expansion (not started)

- [ ] Organizations, membership/invites, seat billing, assigned paths and access lifecycle.
- [ ] Org administration, progress reports/CSV and organization privacy boundaries.
- [ ] Cohorts/live workshops, seat capacity, ticketing and cancellations.
- [ ] Opt-in careers/job board, paid listings and recruiter search/subscriptions over Skill Passports.
- [ ] Stripe adapter, multi-currency, regional pricing and international financial/compliance review.
- [ ] UI localization (Hindi first), locale/timezone formatting and translated public policies.

## Completion and handoff rules

For every increment, satisfy its acceptance checks, update docs/ADR/CHANGELOG and mark only evidenced work complete. Before closing a phase, finish required items or record accepted deferrals with a destination phase and rationale.

Inspect the diff, run checks appropriate to the change and state material limitations. Leave changes uncommitted on `v2` and provide a conventional commit message; the user commits/pushes unless explicitly authorized otherwise. Any authorized commit uses **Kanavt15 <kanavt.15@gmail.com>**. Do not include co-author or AI attribution trailers; the user handles committing and pushing.

## Commit checkpoint 1 ? 2026-10-12

- [x] P1-01 reviewed publication lifecycle and restoration/takedown acceptance.
- [x] Render Node backend with a protected D1/rate-limit Worker adapter.
- [x] Vercel SSR frontend with same-origin proxy, cookie relay, CSRF and CSP nonce.
- [x] Persistent notifications and visible-page polling on Render/Vercel; Cloudflare WebSockets remain supported on the Worker target.
- [x] [Render/Vercel deployment and rollback guide](docs/operations/render-vercel.md), hosting ADR and runtime verification.
- [ ] Provision/deploy external resources and complete staging/production provider/recovery gates.

Next implementation checkpoint after checkpoint 1 was **P1-02 staff authority and operational controls**. P1-03 will enforce the agreed ages and private support workflow. Phases 2-7 remain open; this commit is not completion of the entire backlog.

Checkpoint validation: `npm run check` passed (255 workspace tests + 3 Node tests), all 15 Chromium journeys passed, formatting/diff checks passed, both hosting builds passed and the built Vercel runtime passed its SSR/proxy/CSP/CSRF checks. Production-only dependency audit reported zero vulnerabilities. See [verification record](docs/operations/checkpoint-1-verification.md).

## Commit checkpoint 2 - 2026-10-12

- [x] P1-02 staff authority and operational controls implemented and locally verified.
- [x] One-time privileged CLI provisioning, role/security guards, audit/control pages and operational alerts/runbook.
- [x] Legacy cached source verified before later domain ports.
- [ ] Configure provider receiver, uptime/usage notifications, deploy and capture external release evidence under P1-06.

Validation: 274 workspace tests plus 4 Node tests, the new native/responsive staff
Chromium journey, both hosting builds and Vercel runtime checks passed. See
[checkpoint 2 evidence](docs/operations/checkpoint-2-verification.md).

Next implementation checkpoint: **P1-03 privacy, consent, account eligibility and private support**.
Learning minimum age is **10**; teaching minimum age is **16**. Do not add a public
support email. Phases 2-7 and the remaining TODO items are still open. Leave this
checkpoint uncommitted for the user with a conventional message and no co-author
or AI attribution trailer.
