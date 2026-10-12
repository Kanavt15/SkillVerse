/** Revisions, restoration and takedown against real transactional D1. */
import { env } from 'cloudflare:workers';
import { and, eq, sql } from 'drizzle-orm';
import { createDb, schema } from '@skillverse/db';
import { newId, type QuizDefinition, type Role } from '@skillverse/shared';
import { describe, expect, it } from 'vitest';
import { call, postJson, signedInUser } from './helpers';
import { resolveSession } from '../src/services/session.service';
import { reviewDecision } from '../src/repositories/course-lifecycle.repository';

const db = () => createDb(env.DB);
const get = (path: string, cookie?: string) => call(path, { headers: cookie ? { cookie } : {} });
async function data<T>(res: Response): Promise<T> {
  const body = await res.json<{ ok: boolean; data: T; error?: unknown }>();
  if (!body.ok) throw new Error(`${res.status}: ${JSON.stringify(body.error)}`);
  return body.data;
}
async function account(role?: Role) {
  const user = await signedInUser();
  const { id } = await data<{ id: string }>(await get('/api/v1/me', user.cookie));
  if (role) await db().insert(schema.userRoles).values({ userId: id, role });
  return { ...user, id };
}
const version = async (id: string) =>
  (await db().select().from(schema.courses).where(eq(schema.courses.id, id)).get())!.version;
interface Editor {
  id: string;
  slug: string;
  version: number;
  sourceCourseId: string | null;
  status: string;
  sections: { id: string; lessons: { id: string; title: string }[] }[];
}
async function fixture() {
  const teacher = await account('instructor'),
    staff = await account('admin'),
    learner = await account();
  const id = newId(),
    sectionId = newId(),
    lessonIds = [newId(), newId(), newId()],
    quizId = newId();
  const quiz: QuizDefinition = {
    passingPercent: 100,
    questions: [
      {
        id: newId(),
        prompt: 'Which option explains the lesson?',
        options: [
          { id: newId(), text: 'The correct explanation' },
          { id: newId(), text: 'An unrelated explanation' },
        ],
        correctOptionId: '',
        explanation: 'Private answer explanation.',
      },
    ],
  };
  quiz.questions[0]!.correctOptionId = quiz.questions[0]!.options[0]!.id;
  await db().batch([
    db()
      .insert(schema.courses)
      .values({
        id,
        instructorId: teacher.id,
        slug: `lifecycle-${id}`,
        title: 'Original course title',
        subtitle: 'Learn to write clear explanations',
        description: 'A useful original course with practical explanations and exercises. '.repeat(
          5,
        ),
        categoryId: (await db().select().from(schema.categories).get())!.id,
        learningOutcomes: JSON.stringify(['Write clearly', 'Revise drafts', 'Explain ideas']),
        status: 'published',
        publishedAt: new Date(),
        lessonCount: 4,
      }),
    db().insert(schema.sections).values({ id: sectionId, courseId: id, title: 'Original section' }),
    db()
      .insert(schema.lessons)
      .values(
        lessonIds.map((lessonId, position) => ({
          id: lessonId,
          courseId: id,
          sectionId,
          title: `Original lesson ${position}`,
          type: 'article' as const,
          position,
          isPreview: true,
          contentMarkdown:
            'Original private article material used to practise clear explanations. '.repeat(3),
        })),
      ),
    db().insert(schema.lessons).values({
      id: quizId,
      courseId: id,
      sectionId,
      title: 'Practice quiz',
      type: 'quiz',
      position: 3,
    }),
    db()
      .insert(schema.lessonQuizzes)
      .values({
        lessonId: quizId,
        revision: newId(),
        definition: JSON.stringify(quiz),
        updatedAt: new Date(),
      }),
  ]);
  const slug = `lifecycle-${id}`;
  await postJson(`/api/v1/learning/courses/${slug}/enroll`, {}, learner.cookie);
  return { id, slug, sectionId, lessonIds, quizId, quiz, teacher, staff, learner };
}
async function draft(c: Awaited<ReturnType<typeof fixture>>) {
  return data<Editor>(
    await postJson(`/api/v1/studio/courses/${c.id}/revisions`, {}, c.teacher.cookie),
  );
}
async function decide(
  c: Awaited<ReturnType<typeof fixture>>,
  id: string,
  decision = 'approve',
  expected = -1,
) {
  return postJson(
    `/api/v1/admin/course-reviews/${id}/${decision}`,
    {
      version: expected < 0 ? await version(id) : expected,
      notes: 'Reviewed all proposed content and learning changes.',
    },
    c.staff.cookie,
  );
}

describe('reviewed course lifecycle', () => {
  it('isolates private drafts and preserves stable lesson links, notes, progress and signed certificates', async () => {
    const c = await fixture();
    for (const id of c.lessonIds)
      expect(
        (
          await postJson(
            `/api/v1/learning/courses/${c.slug}/lessons/${id}/progress`,
            { completed: true },
            c.learner.cookie,
          )
        ).status,
      ).toBe(200);
    const quizRow = (await db()
      .select()
      .from(schema.lessonQuizzes)
      .where(eq(schema.lessonQuizzes.lessonId, c.quizId))
      .get())!;
    expect(
      (
        await postJson(
          `/api/v1/learning/courses/${c.slug}/lessons/${c.quizId}/quiz-attempts`,
          {
            attemptId: newId(),
            revision: quizRow.revision,
            answers: c.quiz.questions.map((q) => ({
              questionId: q.id,
              optionId: q.correctOptionId,
            })),
          },
          c.learner.cookie,
        )
      ).status,
    ).toBe(200);
    const certificate = await data<{ serial: string }>(
      await postJson(`/api/v1/learning/courses/${c.slug}/certificate`, {}, c.learner.cookie),
    );
    const credential = await (await get(`/api/v1/certificates/${certificate.serial}`)).text();
    expect(
      (
        await postJson(
          `/api/v1/learning/courses/${c.slug}/lessons/${c.lessonIds[0]}/notes`,
          { body: 'Private note retained through approval.' },
          c.learner.cookie,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await postJson(
          `/api/v1/studio/courses/${c.id}`,
          { title: 'Unreviewed live edit' },
          c.teacher.cookie,
          'PATCH',
        )
      ).status,
    ).toBe(409);
    const d = await draft(c);
    expect(d.sourceCourseId).toBe(c.id);
    expect((await draft(c)).id).toBe(d.id);
    expect((await get(`/api/v1/courses/${d.slug}`)).status).toBe(404);
    expect((await get(`/api/v1/studio/courses/${d.id}`, c.learner.cookie)).status).toBe(403);
    const outsider = await account('instructor');
    expect((await get(`/api/v1/studio/courses/${d.id}`, outsider.cookie)).status).toBe(404);
    await postJson(
      `/api/v1/studio/courses/${d.id}`,
      { title: 'Reviewed new title' },
      c.teacher.cookie,
      'PATCH',
    );
    await postJson(
      `/api/v1/studio/lessons/${d.sections[0]!.lessons[0]!.id}`,
      { contentMarkdown: 'New private revision text after editorial review. '.repeat(3) },
      c.teacher.cookie,
      'PATCH',
    );
    await postJson(
      `/api/v1/studio/lessons/${d.sections[0]!.lessons[2]!.id}`,
      {},
      c.teacher.cookie,
      'DELETE',
    );
    await postJson(
      `/api/v1/studio/lessons/${d.sections[0]!.lessons[3]!.id}`,
      { quiz: { ...c.quiz, passingPercent: 90 } },
      c.teacher.cookie,
      'PATCH',
    );
    const extended = await data<Editor>(
      await postJson(
        `/api/v1/studio/courses/${d.id}/sections`,
        { title: 'New reviewed section' },
        c.teacher.cookie,
      ),
    );
    const newSection = extended.sections.at(-1)!;
    const added = await data<Editor>(
      await postJson(
        `/api/v1/studio/sections/${newSection.id}/lessons`,
        { title: 'New reviewed lesson', type: 'article' },
        c.teacher.cookie,
      ),
    );
    const privateNewLessonId = added.sections.find((s) => s.id === newSection.id)!.lessons[0]!.id;
    await postJson(
      `/api/v1/studio/lessons/${privateNewLessonId}`,
      {
        contentMarkdown:
          'New private material for an additional reviewed learning exercise. '.repeat(3),
      },
      c.teacher.cookie,
      'PATCH',
    );
    await postJson(
      `/api/v1/studio/lessons/${d.sections[0]!.lessons[0]!.id}`,
      { sectionId: newSection.id },
      c.teacher.cookie,
      'PATCH',
    );
    await postJson(
      `/api/v1/studio/courses/${d.id}/sections/reorder`,
      { ids: [newSection.id, d.sections[0]!.id] },
      c.teacher.cookie,
    );
    await postJson(
      `/api/v1/studio/courses/${d.id}`,
      { tags: ['reviewed-writing'] },
      c.teacher.cookie,
      'PATCH',
    );
    expect((await data<{ title: string }>(await get(`/api/v1/courses/${c.slug}`))).title).toBe(
      'Original course title',
    );
    const before = await data<{ lesson: { contentMarkdown: string } }>(
      await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonIds[0]}`, c.learner.cookie),
    );
    expect(before.lesson.contentMarkdown).toContain('Original private');
    expect(
      (await postJson(`/api/v1/studio/courses/${d.id}/submit`, {}, c.teacher.cookie)).status,
    ).toBe(200);
    expect((await decide(c, d.id)).status).toBe(200);
    const after = await data<{
      lesson: { id: string; contentMarkdown: string };
      notes: { body: string }[];
      completedLessonIds: string[];
      sections: { lessons: { id: string }[] }[];
    }>(await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonIds[0]}`, c.learner.cookie));
    expect(after.lesson.id).toBe(c.lessonIds[0]);
    expect(after.lesson.contentMarkdown).toContain('New private revision');
    expect(after.notes[0]?.body).toContain('Private note');
    expect(after.completedLessonIds).toContain(c.lessonIds[0]);
    expect(after.completedLessonIds).not.toContain(c.quizId);
    expect(after.sections[0]!.lessons.map((l) => l.id)).toContain(c.lessonIds[0]);
    const liveAdded = after.sections
      .flatMap((s) => s.lessons)
      .find((l) => l.id !== privateNewLessonId && ![...c.lessonIds, c.quizId].includes(l.id));
    expect(liveAdded).toBeDefined();
    const detail = await data<{ tags: string[]; lessonCount: number }>(
      await get(`/api/v1/courses/${c.slug}`),
    );
    expect(detail.tags).toEqual(['reviewed-writing']);
    expect(detail.lessonCount).toBe(4);
    expect(after.sections.flatMap((s) => s.lessons.map((l) => l.id))).not.toContain(c.lessonIds[2]);
    expect(
      (await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonIds[2]}`, c.learner.cookie)).status,
    ).toBe(200);
    expect((await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonIds[2]}`)).status).toBe(404);
    expect(await (await get(`/api/v1/certificates/${certificate.serial}`)).text()).toBe(credential);
    expect((await draft(c)).id).not.toBe(d.id);
  });

  it('guards stale submissions, withdrawn reviews, self-review, concurrent decisions and immutable review content', async () => {
    const c = await fixture(),
      d = await draft(c);
    await postJson(`/api/v1/studio/courses/${d.id}/submit`, {}, c.teacher.cookie);
    const old = await version(d.id);
    expect(
      (
        await postJson(
          `/api/v1/admin/course-reviews/${d.id}/approve`,
          { version: old },
          c.teacher.cookie,
        )
      ).status,
    ).toBe(403);
    await postJson(`/api/v1/studio/courses/${d.id}/withdraw`, {}, c.teacher.cookie);
    await postJson(
      `/api/v1/studio/courses/${d.id}`,
      { title: 'New submission contents' },
      c.teacher.cookie,
      'PATCH',
    );
    await postJson(`/api/v1/studio/courses/${d.id}/submit`, {}, c.teacher.cookie);
    expect((await decide(c, d.id, 'approve', old)).status).toBe(409);
    await expect(
      db()
        .update(schema.lessons)
        .set({ title: 'Edit during review' })
        .where(eq(schema.lessons.id, d.sections[0]!.lessons[0]!.id)),
    ).rejects.toThrow();
    const reviewed = await version(d.id);
    const results = await Promise.all([
      decide(c, d.id, 'approve', reviewed),
      decide(c, d.id, 'reject', reviewed),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await db()
        .select()
        .from(schema.auditLogs)
        .where(
          and(
            eq(schema.auditLogs.targetId, d.id),
            sql`${schema.auditLogs.action} IN ('course.approved', 'course.rejected')`,
          ),
        ),
    ).toHaveLength(1);
  });

  it('rolls back publication, lesson changes, history and audit and rechecks revoked staff authority', async () => {
    const c = await fixture(),
      d = await draft(c);
    await postJson(
      `/api/v1/studio/courses/${d.id}`,
      { title: 'Must roll back this title' },
      c.teacher.cookie,
      'PATCH',
    );
    await postJson(`/api/v1/studio/courses/${d.id}/submit`, {}, c.teacher.cookie);
    await db().run(
      sql`CREATE TRIGGER lifecycle_test_rollback BEFORE INSERT ON course_review_events WHEN NEW.event = 'revision_approved' BEGIN SELECT RAISE(ABORT, 'rollback fixture'); END`,
    );
    try {
      expect((await decide(c, d.id)).status).toBe(500);
    } finally {
      await db().run(sql`DROP TRIGGER lifecycle_test_rollback`);
    }
    expect((await data<{ title: string }>(await get(`/api/v1/courses/${c.slug}`))).title).toBe(
      'Original course title',
    );
    expect(
      (await db().select().from(schema.courses).where(eq(schema.courses.id, d.id)).get())?.status,
    ).toBe('in_review');
    expect(
      await db()
        .select()
        .from(schema.auditLogs)
        .where(
          and(eq(schema.auditLogs.targetId, d.id), eq(schema.auditLogs.action, 'course.approved')),
        ),
    ).toHaveLength(0);
    const session = await resolveSession(db(), c.staff.cookie.split('=')[1]!);
    if (session?.kind !== 'active') throw new Error('Expected active staff');
    await db().delete(schema.userRoles).where(eq(schema.userRoles.userId, c.staff.id));
    expect(
      await reviewDecision(
        db(),
        session.auth,
        d.id,
        await version(d.id),
        'approved',
        null,
        'stale-staff',
        false,
      ),
    ).toBe(false);
  });

  it('restores with an independent reason and rejects archive replay and revisions based on an older publication', async () => {
    const c = await fixture(),
      d = await draft(c),
      old = await version(c.id);
    const path = `/api/v1/admin/courses/${c.id}`;
    const notes = 'Independently reviewed this publication decision.';
    expect(
      (await postJson(`${path}/archive`, { version: old, notes }, c.staff.cookie)).status,
    ).toBe(200);
    expect(
      (await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonIds[0]}`, c.learner.cookie)).status,
    ).toBe(200);
    expect(
      (
        await postJson(
          `${path}/restore`,
          { version: await version(c.id), notes: 'short' },
          c.staff.cookie,
        )
      ).status,
    ).toBe(400);
    const current = await version(c.id);
    const restored = await Promise.all([
      postJson(`${path}/restore`, { version: current, notes }, c.staff.cookie),
      postJson(`${path}/restore`, { version: current, notes }, c.staff.cookie),
    ]);
    expect(restored.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (await postJson(`${path}/archive`, { version: old, notes }, c.staff.cookie)).status,
    ).toBe(409);
    expect((await get(`/api/v1/courses/${c.slug}`)).status).toBe(200);
    await postJson(`/api/v1/studio/courses/${d.id}/submit`, {}, c.teacher.cookie);
    expect((await decide(c, d.id)).status).toBe(409);
    expect(
      (await postJson(`${path}/takedown`, { version: await version(c.id), notes }, c.staff.cookie))
        .status,
    ).toBe(200);
    expect(
      (await get(`/api/v1/courses/${c.slug}/lessons/${c.lessonIds[0]}`, c.learner.cookie)).status,
    ).toBe(404);
    expect(
      (await postJson(`${path}/restore`, { version: await version(c.id), notes }, c.staff.cookie))
        .status,
    ).toBe(409);
  });
});
