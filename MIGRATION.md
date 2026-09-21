# SkillVerse — MySQL → MongoDB Migration

Status of the migration from MySQL to MongoDB, and of the build-out toward the
SkillVerse product spec. Written for whoever works on this repo next.

**Backend is 100% MongoDB.** No application file references MySQL; the driver
and `config/database.js` are gone. 148 tests pass. The app runs.

Plan of record: `~/.claude/plans/enumerated-doodling-zephyr.md`

---

## Quick start

Three terminals, from `backend/` for the first two:

```bash
npm run mongo     # starts MongoDB as a single-node replica set
npm run seed      # 17 categories, 5 courses, 47 lessons, 4 users, 26 achievements
npm run dev       # API on :5000

cd ../frontend && npm run dev    # UI on :3000
```

Then open **http://localhost:3000**.

| Account | Password | State |
|---|---|---|
| `demo@skillverse.dev` | `Passw0rd!` | New learner, teaching locked |
| `ada@skillverse.dev` | `Passw0rd!` | Level 7, partway to unlocking |
| `grace@skillverse.dev` | `Passw0rd!` | Teaching unlocked, owns the 5 courses |
| `admin@skillverse.dev` | `Passw0rd!` | Admin |

### MongoDB needs a replica set

Enrollment, lesson completion and payments use multi-document transactions,
which **do not work on a standalone `mongod`** — it starts fine and then fails
every checkout. `npm run mongo` always configures a single-node replica set and
initiates it.

It finds a `mongod` binary in this order: `MONGOD_PATH` → `mongod` on `PATH` →
the binary `mongodb-memory-server` already downloaded for the test suite. That
last fallback means **no separate MongoDB install is required**. Data persists
in `.local/mongo-data/` (gitignored).

`GET /api/health` reports `transactions: "supported"` when this is correct.

---

## Decisions taken

Four choices shaped everything, all confirmed before work started:

1. **Migrate and port every feature.** Razorpay, certificates, discussions and
   follows all stay. The spec is additive, not a replacement.
2. **No ETL.** The MySQL data was dev-only, so schemas were written fresh with a
   seed script. This removed the single largest risk — no integer-FK-to-ObjectId
   remapping across 26 tables.
3. **Unify the two point ledgers.** A pre-existing bug; the migration was the
   natural moment. See below.
4. **Fix security-critical bugs only.** Correctness and dead-code cleanups were
   deferred, except where a port made them unavoidable.

---

## What changed

### Phase A — Foundation & security

- **`backend/config/mongo.js`** — Mongoose connection with a `withTransaction`
  helper used by every transactional path, so the abort-outside-transaction
  footgun in the old code can't be reproduced. Probes for replica-set support at
  startup and fails loudly.
- **NoSQL injection closed.** `sanitizeInput` rewrote *values* but preserved
  *keys*, so `{"email": {"$gt": ""}}` reached Mongoose untouched — harmless
  against parameterized MySQL, an authentication bypass against Mongoose. Now
  strips `$`-prefixed and dotted keys.
  - Split deliberately: **operator-stripping always runs**; the XSS value pass is
    skippable per route. That second half matters because `sanitizeValue` strips
    `<` and `>`, which would silently corrupt `#include <iostream>` on its way to
    the judge. `RAW_BODY_PREFIXES` in `security.middleware.js` covers it.
- MongoDB failure is now **fatal at boot** — an API that 500s on every request
  hides the real problem.
- `err.message` no longer leaks on 5xx (driver messages carry queries and paths);
  multer size errors map to 413.
- SIGTERM/SIGINT drain Mongo and Redis. `startServer()` is behind
  `require.main`, so importing the app in a test no longer binds the port.
- **Deleted `runMigrations()`** — it ran on every boot creating schemas that
  conflicted with `database/*.sql`, and never created `badge_definitions` at
  all, which broke badge awarding outright on any fresh database.

### Phase B — 32 Mongoose models

23 ported, 9 new (`Module`, `Problem`, `Submission`, `Quiz`, `QuizAttempt`,
`LearningPath`, `Challenge`, `UserChallenge`, `PlatformSettings`).

- **`models/plugins/cascade.js`** replaces 7 `ON DELETE CASCADE` chains.
  Mongoose has no cascading deletes, and three controllers deleted a parent and
  let the FK clean up. `DiscussionPost` declares **itself** as a cascade child,
  so deleting a question removes its reply subtree at any depth.
- **`role` is now only `user` | `admin`.** There's a test asserting `'both'` and
  `'instructor'` are *unstorable*.
- **`Problem.testCases` is `select: false`** — leaking the answer key now
  requires deliberately asking for it.
- **`PlatformSettings`** is a singleton holding XP values, the level curve and
  teaching requirements. The spec requires these be admin-configurable; they were
  literals in `xp.service.js` with no config path.
- Embedded where bounded (`lesson_resources` → array on `Lesson`, quiz questions
  → array on `Quiz`); referenced where unbounded (`LessonProgress`,
  `DiscussionVote`, `Submission`).
- TTL indexes on `RefreshToken.expiresAt` and `ActivityAuditLog.createdAt`
  replaced two cron jobs.

### Phase C — All 16 controllers ported

`config/database.js` is **deleted**; `mysql2` is uninstalled.

| Controller | Notable |
|---|---|
| auth | Registration no longer accepts `role`; welcome bonus is now transactional |
| users | Public route no longer leaks every user's email and balance |
| courses | 4 JOINs + 2 `COUNT(DISTINCT)` + `GROUP BY` + `HAVING` → one query |
| lessons | Resources embedded; `lessonCount` denormalized |
| categories | `is_published` stays in the `$lookup`, not the match — empty categories still listed |
| enrollments | The app's key atomicity unit; see below |
| wallet / points | Unified ledger; `/api/points` is now an alias |
| reviews | `avgRating` recalculated inside the write transaction |
| discussions | Recursive subtree delete; guarded `$inc` replaces `GREATEST(count-1,0)` |
| followers | — |
| tags | Join table gone — tags are an array, `$addToSet` replaces `INSERT IGNORE` |
| gamification | Leaderboard rank via indexed `countDocuments`, not a correlated subquery |
| instructor | **Revenue fixed** |
| certificates | Learner/course/instructor names snapshotted at issue time |
| notifications | Gained `.bulk()` — fan-out was one INSERT per follower in an unbounded loop |
| payments | Lazy client; idempotent settlement; timing-safe signature compare |

Services rewritten: `xp`, `streak`, `badge`, `antiCheat`, plus new
`wallet.service.js` and `teaching.service.js`.

---

## Bugs fixed

### The two point ledgers (the big one)

MySQL had **two independent currencies both called "points"**:

| | `users.points` + `point_transactions` | `wallets.balance` + `wallet_transactions` |
|---|---|---|
| Credited by | welcome bonus, course rewards | Razorpay purchases |
| Debited by | streak freezes | course enrollment |

So a learner who *completed a course* was credited in a currency they **could
not enroll with**. Worse, instructor revenue was computed from
`point_transactions WHERE type='spent'` — which enrollment never wrote to — so
**reported revenue was structurally always zero**.

Now one balance (`User.wallet.balance`) and one `WalletTransaction` ledger.
Every mutation goes through `services/wallet.service.js`, so no caller can move a
balance without a matching ledger row. Verified live: **150 credits** of
instructor revenue against 2 real enrolments.

XP stays separate — XP is progression, not currency. Only the two *currencies*
merged.

### Security

- **`role: 'both'` bypassed every `authorize()` check.** Any user could set it on
  themselves via `PUT /api/auth/profile`. With admin added it would have been
  self-serve privilege escalation. Resolved structurally: teaching is a
  capability, so no bypass value exists.
- **Self-promotion to instructor.** `PUT /api/auth/profile` accepted
  `role: 'instructor'`, making the whole progression cosmetic. `role` is no
  longer an accepted field anywhere.
- **NoSQL injection** (above).
- **`GET /api/users/:id`** returned the raw row on a public route, leaking every
  user's email and wallet balance.
- **Timing-safe** payment signature comparison; a plain `!==` leaks bytes.

### Correctness

- **Level curve wasn't self-inverse.** `calculateLevel` used `(xp/100)^(2/3)` and
  `getXPForLevel` used `100*(level-1)^1.5` — unrelated formulas, so "XP into
  current level" could go negative. Both now derive from one curve. A
  consequence: level 10 was titled "Specialist" instead of "Knowledge Mentor" —
  the teaching milestone itself.
- **Streak timezone off-by-one.** `toLocaleString` → `new Date` → `toISOString`
  re-applies the server offset; on any non-UTC server a learner near midnight
  silently lost their streak. Now `Intl.DateTimeFormat('en-CA')`, with dates
  stored as `YYYY-MM-DD` strings so it can't be reintroduced.
- **Daily XP caps were never enforced** — `checkDailyXPLimit` had zero call sites.
- **Razorpay crashed the server at import** when keys were missing — the SDK
  throws in its constructor, so an install without payment credentials couldn't
  start *at all*. Now lazy; missing keys fail only the payment endpoints.
- `deriveUsername` produced `"a"` from `a@example.com`, below the 3-char minimum.
- Cache invalidation called with `instructorId: undefined` from the lesson paths.

### Frontend (partial — Phase D is not done)

Five hard ObjectId breaks fixed:

| File | Was |
|---|---|
| `CourseDetail.jsx:67` | `parseInt(id)` → sent `null` as the course id; enrollment broke outright |
| `CourseDetail.jsx:250-251` | `parseInt(id)` into Review/Discussion → `/reviews/course/NaN` |
| `CourseLearn.jsx:552` | same |
| `App.jsx:34` | `/^\/my-courses\/\d+/` never matches an ObjectId → player never mounted |
| `CourseLearn.jsx:121` | `parseInt` on `?lesson=` → deep links silently dead |

---

## Tests

**148 passing across 6 suites** (`npm test`), up from a suite that could not run
at all — `server.js` bound the port on import and there was no Jest config.

| Suite | Covers |
|---|---|
| `security.middleware.test.js` | Injection defense; code survives the sanitizer |
| `models.test.js` | Cascades (incl. 3-level recursive), unique constraints, level curve, rollback |
| `auth.test.js` | Registration, login, rotation, theft detection, self-promotion refused |
| `courses.test.js` | Teaching gate, search ranking, tag AND/OR, ownership, cascade |
| `enrollment.test.js` | Wallet atomicity, concurrency, idempotency, teaching unlock |
| `social.test.js` | Reviews, discussions, follows, tags, leaderboard, revenue |

Tests run against a real **single-node replica set** via
`mongodb-memory-server`, not a standalone — a standalone would pass every unit
test while never exercising the transactional paths that matter.

> `mongodb-memory-server` is pinned to `^10.x` and mongod to `7.0.14`. v11
> bundles a second `mongodb` driver alongside Mongoose's, and the duplicate fails
> the handshake under Jest. See the comment in `__tests__/helpers/db.js` before
> bumping.

**The tests caught seven bugs in code written during this migration**, including
the sparse-vs-partial index below. That's the main argument for the ones still
missing — see *Not done*.

### Worth knowing

`razorpayPaymentId` needs a **partial** unique index, not a sparse one. The field
defaults to `null`, and sparse only skips *absent* fields — so every
non-Razorpay transaction indexed as `null` and the second one collided. This is
the double-credit guard, so it mattered.

---

## Not done

### Phases F–J — features with no routes or UI

Models, seed data and XP hooks exist; **routes and UI do not**, so these pages
are unreachable:

- **Practice Arena + Judge0** — `Problem`/`Submission` models and 3 seeded
  problems exist. No execution service. `CodeSandbox.jsx` still runs JS via
  `new Function` on the main thread with no timeout — fine as a scratchpad,
  **not** a foundation for graded submissions.
- **Quiz engine** — `Quiz`/`QuizAttempt` models, 1 seeded quiz, no routes.
- **Learning paths / daily challenges** — 2 paths and 1 challenge seeded, no routes.
- **Admin dashboard** — no UI. `PlatformSettings` is only editable directly in
  the database. `manualTriggers` in the cron module and antiCheat's
  `detectSuspiciousActivity` / `getSuspiciousActivityReport` /
  `clearSuspiciousFlags` are implemented with **no callers** — they are the
  moderation tools that panel needs.
- **Docker** — none anywhere in the repo. The Mongo service must run as a
  single-node replica set or every transaction fails.

### Phase D/E — frontend has not caught up

**The API enforces teaching correctly; the UI does not reflect it.**

- Registration still shows the role picker (`Register.jsx:59-78`, `:196-221`,
  plus `role: 'learner'` at `:23`) — the server ignores the field, so the UI is
  lying about what it does.
- No teaching-unlock progress meter or celebration. `GET /api/gamification/teaching`
  returns the full per-requirement breakdown; nothing renders it.
- `ProtectedRoute`'s `requireInstructor` silently bounces to `/` instead of
  showing unlock progress.
- `lib/api.js` still exports only the axios instance — every page calls
  `api.get()` inline. Worth grouping into service modules **before** six more
  feature domains land.
- `App.jsx` detects the player with `.includes('/learn')`, which will swallow
  `/learning-paths` and 404 it.
- `AuthProvider` sits outside `Router`, forcing the `window.location.href` hard
  redirects in `api.js`.
- No code splitting; `design/tokens.css` is unimported and actively misleading.
- `NotificationDropdown.jsx:97` reads a `localStorage` token that is never
  written, so the notification socket never connects.

### Deferred bug fixes

Known and deliberately left (only security-critical were in scope):

- **`/uploads` static and video streaming are unauthenticated** — any filename is
  publicly streamable. Deferred because `<video src>` can't send an auth header;
  the fix needs short-lived signed URLs, and doing it twice (once per database)
  would have been waste.
- **10kb JSON body cap** blocks code submissions — needs a per-route override
  when the Arena lands.
- Socket auth is an opt-in event, not `io.use()` handshake auth, so
  unauthenticated sockets connect and persist.
- Cron jobs have no distributed lock — with >1 instance every job runs N times.
- The `database/*.sql` files and the 15 root `*.md` files still describe the
  MySQL schema.

### Test gaps

No coverage yet for payments/webhook settlement, certificate PDF generation, the
cron jobs, or socket events. Given that the existing tests caught seven real
bugs, these are the next ones worth writing.

---

## Nothing is committed

All of this is **staged or unstaged in the working tree** — no commits were made.
`git status` shows 96 changed paths. Review before committing.

A few deletions to be aware of:

- `backend/config/database.js` (MySQL pool)
- `backend/create_point_transactions.js` (one-off script)
- `backend/test-tag-routes.js` (throwaway smoke script)
- `mysql2` uninstalled from `package.json`

Still present but now describing a database the app no longer uses:
`database/*.sql`, `database/ER-Diagram.md`, and the root documentation set.
