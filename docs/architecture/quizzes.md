# Practice quiz lessons

Quiz lessons check understanding inside a course. Instructors author one correct choice per question, 2–6 choices, up to 20 questions, optional explanations and a 1–100% passing threshold. These are learning exercises with retries and post-submission feedback. Proctored exams, question banks, paid credentials and code execution belong to later phases.

## Authoring and review

Studio can add a `quiz` lesson and edit its questions at `/studio/courses/:courseId/lessons/:lessonId`. Shared Zod validates choice membership, unique IDs and text/collection bounds; the API rejects unknown fields. A quiz must have a valid definition before course submission. Staff inspect questions, correct answers and explanations behind the existing role/MFA gate. Public curriculum contains only lesson metadata.

Definitions live in `lesson_quizzes` as validated JSON with a UUIDv7 revision. Missing/malformed definitions fail closed. Owner edits are allowed only under the existing draft/rejected/published policy; courses in review and archived courses are locked. An identical save keeps the revision and completion. Changed questions, explanations or threshold create a new revision and clear that lesson’s progress and course completion in the same D1 batch. Past attempts remain immutable; issued certificates keep their original achievement snapshot. A broader review workflow for published edits remains tracked in [teaching](teaching.md).

## Learner access and grading

The player uses the same preview/enrollment policy as other lessons. Preview visitors can read questions; submission requires an enrollment for exactly this published or archived course. Before submission the player returns only question/choice IDs and text plus the threshold, never correct choice IDs or explanations. A learner’s own recent feedback is returned only after an attempt; other learners and anonymous visitors never see it.

`POST /api/v1/learning/courses/{slug}/lessons/{lessonId}/quiz-attempts` accepts only `{ attemptId, revision, answers: [{ questionId, optionId }] }`. Choose exactly one existing choice for every question. The server grades against the stored revision; score and pass values supplied by the client are rejected. Passing compares the exact ratio; the displayed percentage is rounded down. The response includes the score, selected/correct answer text and explanations for practice.

The UUIDv7 attempt ID is an idempotency key. Identical concurrent retries return the same stored result; another enrollment, revision, lesson or set of answers using the ID receives 409. Answers are canonicalized so array order does not change identity. Stale new attempts receive 409. A SQL condition limits each enrollment/lesson to 20 new attempts per hour across IPs; replay does not spend another attempt.

One atomic D1 batch conditionally inserts the attempt, marks progress when passed, and recomputes enrollment completion. It rechecks lesson/course/enrollment/revision at write time. An internal receipt guards side effects when an insert loses to a concurrent retry. Failed retries preserve a previous passing completion; manual completion cannot bypass grading. A replay of an old revision never restores progress after editing. See [ADR 0007](adr/0007-practice-quiz-grading.md).

The player shows the most recent feedback and up to ten recent attempts for the current revision. Explanations are plain escaped text. The radio groups use legends, visible labels and normal keyboard controls. The authored choice IDs and text order stay stable; randomized exams are outside this increment.

## Persistence and local verification

Migration `0009_lesson_quizzes.sql` adds `lesson_quizzes` and `quiz_attempts`, with enrollment/lesson cascades and a scoped attempt-time index. Apply migrations before deploying the updated API; no additional service, binding, secret or paid product is needed. Locally run `npm run db:migrate:local`, then `npm run dev`.

API coverage: `apps/api/test/quizzes.test.ts` exercises privacy, malformed answers, ownership, exact grading, atomic retries, attempt limits, revision changes, archival and certificates. The browser test `apps/web/e2e/quizzes.spec.ts` creates a fresh instructor course, authors questions, preserves invalid input, publishes as separate staff, retries as a learner and verifies completion. It scans mobile authoring and light/dark feedback pages with axe, and writes screenshots to ignored test results.
