/** Real D1 quiz privacy, server grading, retry/concurrency and current-revision completion. */
import { env } from 'cloudflare:workers';
import { createDb, schema } from '@skillverse/db';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  newId,
  playerSchema,
  type Player,
  type QuizDefinition,
  type QuizResult,
} from '@skillverse/shared';
import { call, postJson, signedInUser } from './helpers';

const db = () => createDb(env.DB);
const get = (path: string, cookie?: string) => call(path, { headers: cookie ? { cookie } : {} });
async function data<T>(res: Response): Promise<T> {
  const body = await res.json<{ ok: boolean; data: T; error?: unknown }>();
  if (!body.ok) throw new Error(`${res.status}: ${JSON.stringify(body.error)}`);
  return body.data;
}
async function fixture(passingPercent = 70) {
  const teacher = await signedInUser(),
    learner = await signedInUser();
  const teacherId = (await data<{ id: string }>(await get('/api/v1/me', teacher.cookie))).id;
  const courseId = newId(),
    sectionId = newId(),
    lessonId = newId(),
    revision = newId();
  const slug = `quiz-${courseId.slice(-12)}`;
  const definition: QuizDefinition = {
    passingPercent,
    questions: Array.from({ length: 3 }, (_, i) => {
      const correct = newId(),
        wrong = newId();
      return {
        id: newId(),
        prompt: `What is the correct choice for question ${i + 1}?`,
        options: [
          { id: correct, text: `Correct choice ${i + 1}` },
          { id: wrong, text: `Wrong choice ${i + 1}` },
        ],
        correctOptionId: correct,
        explanation: `PRIVATE_EXPLANATION_${i + 1}: remember the lesson.`,
      };
    }),
  };
  await db().batch([
    db().insert(schema.userRoles).values({ userId: teacherId, role: 'instructor' }),
    db().insert(schema.courses).values({
      id: courseId,
      instructorId: teacherId,
      slug,
      title: 'Quiz foundations',
      status: 'published',
      lessonCount: 1,
      publishedAt: new Date(),
    }),
    db().insert(schema.sections).values({ id: sectionId, courseId, title: 'Practice' }),
    db().insert(schema.lessons).values({
      id: lessonId,
      courseId,
      sectionId,
      title: 'Knowledge check',
      type: 'quiz',
      isPreview: true,
    }),
    db()
      .insert(schema.lessonQuizzes)
      .values({
        lessonId,
        revision,
        definition: JSON.stringify(definition),
        updatedAt: new Date(),
      }),
  ]);
  await postJson(`/api/v1/learning/courses/${slug}/enroll`, {}, learner.cookie);
  const path = `/api/v1/learning/courses/${slug}/lessons/${lessonId}`;
  const body = (correctCount = 3, attemptId = newId()) => ({
    attemptId,
    revision,
    answers: definition.questions.map((q, i) => ({
      questionId: q.id,
      optionId: q.options[i < correctCount ? 0 : 1]!.id,
    })),
  });
  return {
    teacher,
    learner,
    courseId,
    slug,
    lessonId,
    sectionId,
    definition,
    revision,
    path,
    body,
  };
}

describe('quiz authoring and answer privacy', () => {
  it('shows answer keys only to the owner/staff and requires a valid quiz in the submission checklist', async () => {
    const c = await fixture();
    const owner = await data<{ sections: { lessons: { quiz: QuizDefinition }[] }[] }>(
      await get(`/api/v1/studio/courses/${c.courseId}`, c.teacher.cookie),
    );
    expect(owner.sections[0]!.lessons[0]!.quiz.questions[0]!.correctOptionId).toBe(
      c.definition.questions[0]!.correctOptionId,
    );
    expect((await get(`/api/v1/studio/courses/${c.courseId}`, c.learner.cookie)).status).toBe(403);
    const other = await signedInUser();
    const id = (await data<{ id: string }>(await get('/api/v1/me', other.cookie))).id;
    await db().insert(schema.userRoles).values({ userId: id, role: 'instructor' });
    expect((await get(`/api/v1/studio/courses/${c.courseId}`, other.cookie)).status).toBe(404);
    const catalog = await get(`/api/v1/courses/${c.slug}`);
    expect(await catalog.text()).not.toMatch(/correctOptionId|PRIVATE_EXPLANATION/);
    for (const cookie of [undefined, c.learner.cookie]) {
      const res = await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonId}`, cookie);
      const text = await res.text();
      expect(text).not.toMatch(/correctOptionId|PRIVATE_EXPLANATION/);
      const player = playerSchema.parse(JSON.parse(text).data);
      expect(player.lesson.quiz?.questions).toHaveLength(3);
      expect(player.lesson.quiz?.lastAttempt).toBeNull();
    }
    await db()
      .update(schema.courses)
      .set({
        status: 'draft',
        subtitle: 'Practice with useful examples',
        description: 'Original learning material. '.repeat(15),
        categoryId: (await db().select().from(schema.categories).get())!.id,
        learningOutcomes: JSON.stringify([
          'Understand basics',
          'Choose good answers',
          'Practice a new skill',
        ]),
      })
      .where(eq(schema.courses.id, c.courseId));
    for (let i = 0; i < 2; i++)
      await db()
        .insert(schema.lessons)
        .values({
          courseId: c.courseId,
          sectionId: c.sectionId,
          title: `Article ${i}`,
          type: 'article',
          contentMarkdown: 'Original article text for a useful lesson. '.repeat(4),
        });
    await db().delete(schema.lessonQuizzes).where(eq(schema.lessonQuizzes.lessonId, c.lessonId));
    const notReady = await postJson(
      `/api/v1/studio/courses/${c.courseId}/submit`,
      {},
      c.teacher.cookie,
    );
    expect(notReady.status).toBe(400);
    expect(await notReady.text()).toContain('valid quiz');
    expect(
      (
        await postJson(
          `/api/v1/studio/lessons/${c.lessonId}`,
          { quiz: c.definition },
          c.teacher.cookie,
          'PATCH',
        )
      ).status,
    ).toBe(200);
    const submitted = await postJson(
      `/api/v1/studio/courses/${c.courseId}/submit`,
      {},
      c.teacher.cookie,
    );
    expect(submitted.status).toBe(200);
    expect(
      (
        await postJson(
          `/api/v1/studio/lessons/${c.lessonId}`,
          { quiz: { ...c.definition, passingPercent: 50 } },
          c.teacher.cookie,
          'PATCH',
        )
      ).status,
    ).toBe(409);
  });

  it('validates answer membership, unique IDs and strict server-only grading fields', async () => {
    const c = await fixture();
    const bad = structuredClone(c.definition);
    bad.questions[0]!.correctOptionId = newId();
    expect(
      (
        await postJson(
          `/api/v1/studio/lessons/${c.lessonId}`,
          { quiz: bad },
          c.teacher.cookie,
          'PATCH',
        )
      ).status,
    ).toBe(400);
    bad.questions[0]!.correctOptionId = bad.questions[0]!.options[0]!.id;
    bad.questions[0]!.options[1]!.id = bad.questions[0]!.options[0]!.id;
    expect(
      (
        await postJson(
          `/api/v1/studio/lessons/${c.lessonId}`,
          { quiz: bad },
          c.teacher.cookie,
          'PATCH',
        )
      ).status,
    ).toBe(400);
    const input = c.body();
    expect(
      (await postJson(`${c.path}/quiz-attempts`, { ...input, passed: true }, c.learner.cookie))
        .status,
    ).toBe(400);
    expect(
      (
        await postJson(
          `${c.path}/quiz-attempts`,
          { ...input, answers: input.answers.slice(1) },
          c.learner.cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await postJson(
          `${c.path}/quiz-attempts`,
          { ...input, answers: [input.answers[0], input.answers[0], input.answers[1]] },
          c.learner.cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await postJson(
          `${c.path}/quiz-attempts`,
          { ...input, answers: input.answers.map((a) => ({ ...a, optionId: newId() })) },
          c.learner.cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      await db()
        .select()
        .from(schema.quizAttempts)
        .where(eq(schema.quizAttempts.lessonId, c.lessonId)),
    ).toHaveLength(0);
  });
});

describe('server grading and completion', () => {
  it('grades, explains, persists private history and completes the course only after passing', async () => {
    const c = await fixture();
    expect(
      (await postJson(`${c.path}/progress`, { completed: true }, c.learner.cookie)).status,
    ).toBe(403);
    const failed = await data<QuizResult>(
      await postJson(`${c.path}/quiz-attempts`, c.body(1), c.learner.cookie),
    );
    expect(failed).toMatchObject({
      passed: false,
      scorePercent: 33,
      correctCount: 1,
      questionCount: 3,
    });
    expect(failed.feedback[1]).toMatchObject({
      correct: false,
      correctText: 'Correct choice 2',
      explanation: c.definition.questions[1]!.explanation,
    });
    expect(
      (await postJson(`/api/v1/learning/courses/${c.slug}/certificate`, {}, c.learner.cookie))
        .status,
    ).toBe(403);
    const pass = await data<QuizResult>(
      await postJson(`${c.path}/quiz-attempts`, c.body(), c.learner.cookie),
    );
    expect(pass).toMatchObject({ passed: true, scorePercent: 100 });
    const player = await data<Player>(
      await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonId}`, c.learner.cookie),
    );
    expect(player.completedLessonIds).toContain(c.lessonId);
    expect(player.lesson.quiz?.lastAttempt).toEqual(pass);
    expect(player.lesson.quiz?.recentAttempts).toHaveLength(2);
    expect(
      (
        await db()
          .select()
          .from(schema.enrollments)
          .where(eq(schema.enrollments.courseId, c.courseId))
          .get()
      )?.completedAt,
    ).not.toBeNull();
    expect(
      (await postJson(`/api/v1/learning/courses/${c.slug}/certificate`, {}, c.learner.cookie))
        .status,
    ).toBe(200);
    await postJson(`${c.path}/quiz-attempts`, c.body(0), c.learner.cookie);
    expect(
      (
        await data<Player>(
          await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonId}`, c.learner.cookie),
        )
      ).completedLessonIds,
    ).toContain(c.lessonId);
    const stranger = await signedInUser();
    await postJson(`/api/v1/learning/courses/${c.slug}/enroll`, {}, stranger.cookie);
    const other = await data<Player>(
      await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonId}`, stranger.cookie),
    );
    expect(other.lesson.quiz?.lastAttempt).toBeNull();
    expect(other.lesson.quiz?.recentAttempts).toEqual([]);
    expect((await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonId}`)).status).toBe(200);
    expect(
      await (await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonId}`)).text(),
    ).not.toContain('PRIVATE_EXPLANATION');
  });

  it('compares the exact score ratio at a rounding boundary', async () => {
    const c = await fixture(67);
    const result = await data<QuizResult>(
      await postJson(`${c.path}/quiz-attempts`, c.body(2), c.learner.cookie),
    );
    expect(result).toMatchObject({ scorePercent: 66, passed: false });
    expect(
      (
        await data<Player>(
          await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonId}`, c.learner.cookie),
        )
      ).completedLessonIds,
    ).toEqual([]);
  });

  it('returns the same result for concurrent identical attempts, but rejects conflicting replay', async () => {
    const c = await fixture(),
      input = c.body();
    const results = await Promise.all([
      postJson(`${c.path}/quiz-attempts`, input, c.learner.cookie),
      postJson(`${c.path}/quiz-attempts`, input, c.learner.cookie),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await results[0]!.json()).toEqual(await results[1]!.json());
    expect(
      await db()
        .select()
        .from(schema.quizAttempts)
        .where(eq(schema.quizAttempts.lessonId, c.lessonId)),
    ).toHaveLength(1);
    expect(
      await db()
        .select()
        .from(schema.lessonProgress)
        .where(eq(schema.lessonProgress.lessonId, c.lessonId)),
    ).toHaveLength(1);
    expect(
      (await postJson(`${c.path}/quiz-attempts`, c.body(0, input.attemptId), c.learner.cookie))
        .status,
    ).toBe(409);
    await postJson(`${c.path}/progress`, { completed: false }, c.learner.cookie);
    expect((await postJson(`${c.path}/quiz-attempts`, input, c.learner.cookie)).status).toBe(200);
    expect(
      (
        await data<Player>(
          await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonId}`, c.learner.cookie),
        )
      ).completedLessonIds,
    ).toEqual([]);
  });

  it('rejects cross-enrollment submission IDs and unenrolled/cross-course requests', async () => {
    const c = await fixture(),
      input = c.body();
    const other = await signedInUser();
    expect((await postJson(`${c.path}/quiz-attempts`, input)).status).toBe(401);
    expect((await postJson(`${c.path}/quiz-attempts`, input, other.cookie)).status).toBe(404);
    await postJson(`${c.path}/quiz-attempts`, input, c.learner.cookie);
    await postJson(`/api/v1/learning/courses/${c.slug}/enroll`, {}, other.cookie);
    expect((await postJson(`${c.path}/quiz-attempts`, input, other.cookie)).status).toBe(409);
    const foreign = await fixture();
    expect(
      (
        await postJson(
          `/api/v1/learning/courses/${c.slug}/lessons/${foreign.lessonId}/quiz-attempts`,
          input,
          c.learner.cookie,
        )
      ).status,
    ).toBe(404);
  });

  it('resets progress for changed definitions, preserves earned certificates and rejects stale attempts', async () => {
    const c = await fixture(),
      input = c.body();
    await postJson(`${c.path}/quiz-attempts`, input, c.learner.cookie);
    const certificate = await data<{ serial: string }>(
      await postJson(`/api/v1/learning/courses/${c.slug}/certificate`, {}, c.learner.cookie),
    );
    expect(
      (
        await postJson(
          `/api/v1/studio/lessons/${c.lessonId}`,
          { quiz: c.definition },
          c.teacher.cookie,
          'PATCH',
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await db()
          .select()
          .from(schema.lessonQuizzes)
          .where(eq(schema.lessonQuizzes.lessonId, c.lessonId))
          .get()
      )?.revision,
    ).toBe(c.revision); // identical save keeps completion
    const updated = { ...c.definition, passingPercent: 80 };
    expect(
      (
        await postJson(
          `/api/v1/studio/lessons/${c.lessonId}`,
          { quiz: updated },
          c.teacher.cookie,
          'PATCH',
        )
      ).status,
    ).toBe(200);
    const player = await data<Player>(
      await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonId}`, c.learner.cookie),
    );
    expect(player.completedLessonIds).toEqual([]);
    expect(player.lesson.quiz?.lastAttempt).toBeNull();
    expect(player.certificateSerial).toBe(certificate.serial);
    expect((await get(`/api/v1/certificates/${certificate.serial}`)).status).toBe(200);
    expect((await postJson(`${c.path}/quiz-attempts`, c.body(), c.learner.cookie)).status).toBe(
      409,
    );
    expect((await postJson(`${c.path}/quiz-attempts`, input, c.learner.cookie)).status).toBe(200); // receipt only, no new completion
    expect(
      (
        await data<Player>(
          await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonId}`, c.learner.cookie),
        )
      ).completedLessonIds,
    ).toEqual([]);
  });

  it('atomically enforces 20 attempts per lesson/hour, without charging idempotent retries', async () => {
    const c = await fixture();
    const inputs = Array.from({ length: 21 }, () => c.body(0));
    const results = await Promise.all(
      inputs.map((input) => postJson(`${c.path}/quiz-attempts`, input, c.learner.cookie)),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(20);
    expect(results.filter((r) => r.status === 429)).toHaveLength(1);
    const successful = inputs[results.findIndex((r) => r.status === 200)]!;
    expect((await postJson(`${c.path}/quiz-attempts`, successful, c.learner.cookie)).status).toBe(
      200,
    );
    expect(
      await db()
        .select()
        .from(schema.quizAttempts)
        .where(eq(schema.quizAttempts.lessonId, c.lessonId)),
    ).toHaveLength(20);
  });

  it('requires a fresh passing attempt after an edit before issuing a new certificate', async () => {
    const c = await fixture();
    await postJson(`${c.path}/quiz-attempts`, c.body(), c.learner.cookie);
    await postJson(
      `/api/v1/studio/lessons/${c.lessonId}`,
      { quiz: { ...c.definition, passingPercent: 90 } },
      c.teacher.cookie,
      'PATCH',
    );
    expect(
      (await postJson(`/api/v1/learning/courses/${c.slug}/certificate`, {}, c.learner.cookie))
        .status,
    ).toBe(403);
    const current = await data<Player>(
      await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonId}`, c.learner.cookie),
    );
    expect(
      (
        await postJson(
          `${c.path}/quiz-attempts`,
          { ...c.body(), revision: current.lesson.quiz!.revision },
          c.learner.cookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (await postJson(`/api/v1/learning/courses/${c.slug}/certificate`, {}, c.learner.cookie))
        .status,
    ).toBe(200);
  });

  it('cannot publish an imported incomplete quiz even if the course is already in review', async () => {
    const c = await fixture(),
      staff = await signedInUser();
    const staffId = (await data<{ id: string }>(await get('/api/v1/me', staff.cookie))).id;
    await db().insert(schema.userRoles).values({ userId: staffId, role: 'admin' });
    await db()
      .update(schema.courses)
      .set({ status: 'in_review' })
      .where(eq(schema.courses.id, c.courseId));
    await db().delete(schema.lessonQuizzes).where(eq(schema.lessonQuizzes.lessonId, c.lessonId));
    const res = await postJson(
      `/api/v1/admin/course-reviews/${c.courseId}/approve`,
      {},
      staff.cookie,
    );
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('valid quiz');
    expect(
      (await db().select().from(schema.courses).where(eq(schema.courses.id, c.courseId)).get())
        ?.status,
    ).toBe('in_review');
  });

  it('keeps archived courses available to enrolled learners and rejects suspended accounts', async () => {
    const c = await fixture();
    await db()
      .update(schema.courses)
      .set({ status: 'archived' })
      .where(eq(schema.courses.id, c.courseId));
    expect((await postJson(`${c.path}/quiz-attempts`, c.body(), c.learner.cookie)).status).toBe(
      200,
    );
    await db()
      .update(schema.users)
      .set({ status: 'suspended' })
      .where(eq(schema.users.email, c.learner.email));
    expect((await postJson(`${c.path}/quiz-attempts`, c.body(), c.learner.cookie)).status).toBe(
      401,
    );
  });
});
