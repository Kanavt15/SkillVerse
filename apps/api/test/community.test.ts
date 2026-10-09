/** Discussion isolation, hidden-content privacy, retries and atomic moderation in real D1. */
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, schema } from '@skillverse/db';
import {
  newId,
  questionDetailSchema,
  questionListSchema,
  type ModerationList,
  type QuestionDetail,
} from '@skillverse/shared';
import { createApp } from '../src/app';
import { call, postJson, signedInUser, ORIGIN } from './helpers';

const db = () => createDb(env.DB);
async function data<T>(response: Response): Promise<T> {
  const body = await response.json<{ ok: boolean; data: T; error?: unknown }>();
  if (!body.ok) throw new Error(`${response.status}: ${JSON.stringify(body.error)}`);
  return body.data;
}
const get = (path: string, cookie: string) => call(path, { headers: { cookie } });
async function fixture() {
  const teacher = await signedInUser(),
    learner = await signedInUser(),
    other = await signedInUser(),
    staff = await signedInUser();
  const userId = async (cookie: string) =>
    (await data<{ id: string }>(await get('/api/v1/me', cookie))).id;
  const teacherId = await userId(teacher.cookie),
    learnerId = await userId(learner.cookie),
    staffId = await userId(staff.cookie);
  const id = newId(),
    sectionId = newId(),
    lessonId = newId(),
    slug = `discussion-${id.slice(-12)}`;
  await db().batch([
    db()
      .insert(schema.userRoles)
      .values([
        { userId: teacherId, role: 'instructor' },
        { userId: staffId, role: 'moderator' },
      ]),
    db().insert(schema.courses).values({
      id,
      instructorId: teacherId,
      slug,
      title: 'Discussion course',
      status: 'published',
      lessonCount: 1,
    }),
    db()
      .insert(schema.sections)
      .values({ id: sectionId, courseId: id, title: 'Start', position: 0 }),
    db().insert(schema.lessons).values({
      id: lessonId,
      courseId: id,
      sectionId,
      title: 'A video lesson',
      type: 'video',
      position: 0,
    }),
    db().insert(schema.enrollments).values({ userId: learnerId, courseId: id }),
  ]);
  const base = `/api/v1/community/courses/${slug}`;
  const ask = async (cookie = learner.cookie, overrides = {}) =>
    data<{ id: string }>(
      await postJson(
        `${base}/questions`,
        {
          title: 'How does this example work?',
          body: 'I tried this example but need help understanding the result.',
          ...overrides,
        },
        cookie,
      ),
    );
  return {
    id,
    slug,
    lessonId,
    teacher,
    teacherId,
    learner,
    learnerId,
    other,
    staff,
    staffId,
    base,
    ask,
  };
}
describe('course Q&A', () => {
  it('requires membership, scopes lessons and hides discussion bodies from outsiders', async () => {
    const c = await fixture(),
      question = await c.ask(c.learner.cookie, { lessonId: c.lessonId, timestampSeconds: 45 });
    expect((await get(`${c.base}/questions`, c.other.cookie)).status).toBe(404);
    expect((await get(`${c.base}/questions/${question.id}`, c.other.cookie)).status).toBe(404);
    expect(
      (
        await postJson(
          `${c.base}/questions`,
          { title: 'Outsider question', body: 'This should not be allowed.' },
          c.other.cookie,
        )
      ).status,
    ).toBe(404);
    const list = questionListSchema.parse(
      await data(await get(`${c.base}/questions?lessonId=${c.lessonId}`, c.teacher.cookie)),
    );
    expect(list.items[0]?.timestampSeconds).toBe(45);
    expect(list.items[0]?.lesson?.id).toBe(c.lessonId);
    expect(list.items[0]?.canResolve).toBe(true);
    expect(
      (
        await postJson(
          `${c.base}/questions`,
          {
            title: 'Wrong lesson question',
            body: 'A question about an unknown lesson.',
            lessonId: newId(),
          },
          c.learner.cookie,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await postJson(
          `${c.base}/questions`,
          {
            title: 'Wrong timestamp',
            body: 'There is no selected video lesson.',
            timestampSeconds: 30,
          },
          c.learner.cookie,
        )
      ).status,
    ).toBe(400);
    expect((await get(`${c.base}/questions?page=-1`, c.learner.cookie)).status).toBe(400);
  });
  it('accepts only visible replies in this question, with author/instructor ownership', async () => {
    const c = await fixture(),
      q = await c.ask(),
      second = await c.ask();
    const reply = await data<{ id: string }>(
      await postJson(
        `${c.base}/questions/${q.id}/replies`,
        { body: 'Here is an explanation from the instructor.' },
        c.teacher.cookie,
      ),
    );
    const wrong = await data<{ id: string }>(
      await postJson(
        `${c.base}/questions/${second.id}/replies`,
        { body: 'An answer to a completely different question.' },
        c.teacher.cookie,
      ),
    );
    const otherId = (await data<{ id: string }>(await get('/api/v1/me', c.other.cookie))).id;
    await db().insert(schema.enrollments).values({ userId: otherId, courseId: c.id });
    expect(
      (
        await postJson(
          `${c.base}/questions/${q.id}/solution`,
          { replyId: reply.id },
          c.other.cookie,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await postJson(
          `${c.base}/questions/${q.id}/solution`,
          { replyId: wrong.id },
          c.learner.cookie,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await postJson(
          `${c.base}/questions/${q.id}/solution`,
          { replyId: reply.id },
          c.learner.cookie,
        )
      ).status,
    ).toBe(200);
    const detail = questionDetailSchema.parse(
      await data(await get(`${c.base}/questions/${q.id}`, c.learner.cookie)),
    );
    expect(detail.acceptedReply?.author.instructor).toBe(true);
    expect(detail.acceptedReply?.id).toBe(reply.id);
    const resolved = questionListSchema.parse(
      await data(await get(`${c.base}/questions?status=resolved`, c.learner.cookie)),
    );
    expect(resolved.items.map((q) => q.id)).toEqual([q.id]);
    expect(
      (await postJson(`${c.base}/questions/${q.id}/solution`, { replyId: null }, c.teacher.cookie))
        .status,
    ).toBe(200);
  });
  it('keeps archived conversations readable, rejects writes and unverified posting', async () => {
    const c = await fixture(),
      q = await c.ask();
    await db()
      .update(schema.users)
      .set({ emailVerifiedAt: null })
      .where(eq(schema.users.id, c.learnerId));
    expect(
      (
        await postJson(
          `${c.base}/questions/${q.id}/replies`,
          { body: 'An unverified answer to this question.' },
          c.learner.cookie,
        )
      ).status,
    ).toBe(403);
    await db()
      .update(schema.courses)
      .set({ status: 'archived' })
      .where(eq(schema.courses.id, c.id));
    expect((await get(`${c.base}/questions/${q.id}`, c.learner.cookie)).status).toBe(200);
    expect(
      (
        await postJson(
          `${c.base}/questions/${q.id}/replies`,
          { body: 'An answer after the course was archived.' },
          c.teacher.cookie,
        )
      ).status,
    ).toBe(403);
  });
});

describe('reporting and moderation', () => {
  it('deduplicates reports, enforces staff/MFA and atomically hides/restores with audit history', async () => {
    const c = await fixture(),
      q = await c.ask();
    const input = {
      targetType: 'question',
      targetId: q.id,
      reason: 'spam',
      details: 'This question contains promotional spam.',
    };
    expect(
      (await postJson(`${c.base}/reports`, { ...input, targetId: newId() }, c.learner.cookie))
        .status,
    ).toBe(404);
    for (let i = 0; i < 2; i++)
      expect((await postJson(`${c.base}/reports`, input, c.learner.cookie)).status).toBe(200);
    expect((await get('/api/v1/admin/reports', c.teacher.cookie)).status).toBe(403);
    const blocked = await createApp().fetch(
      new Request('http://localhost:8787/api/v1/admin/reports', {
        headers: { cookie: c.staff.cookie, origin: ORIGIN },
      }),
      { ...env, ENFORCE_ADMIN_MFA: 'on' },
      { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext,
    );
    expect(blocked.status).toBe(403);
    const queue = await data<ModerationList>(await get('/api/v1/admin/reports', c.staff.cookie));
    const report = queue.items.find((r) => r.targetId === q.id)!;
    expect(queue.items.filter((r) => r.targetId === q.id)).toHaveLength(1);
    const path = `/api/v1/admin/reports/${report.id}`;
    expect(
      (
        await postJson(
          path,
          {
            decision: 'hide',
            notes: 'Removed promotional spam from the discussion.',
            version: report.version,
          },
          c.staff.cookie,
        )
      ).status,
    ).toBe(200);
    expect((await get(`${c.base}/questions/${q.id}`, c.learner.cookie)).status).toBe(404);
    expect(
      (
        await postJson(
          `${c.base}/questions/${q.id}/replies`,
          { body: 'Trying to reply to hidden content.' },
          c.teacher.cookie,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await postJson(
          path,
          {
            decision: 'restore',
            notes: 'This stale decision should be refused.',
            version: report.version,
          },
          c.staff.cookie,
        )
      ).status,
    ).toBe(409);
    expect((await get(`${c.base}/questions/${q.id}`, c.learner.cookie)).status).toBe(404);
    const inspection = await (await get(path, c.staff.cookie)).text();
    expect(inspection).toContain('I tried this example');
    expect(
      (
        await postJson(
          path,
          {
            decision: 'restore',
            notes: 'Restored after reviewing the context.',
            version: report.version + 1,
          },
          c.staff.cookie,
        )
      ).status,
    ).toBe(200);
    expect((await get(`${c.base}/questions/${q.id}`, c.learner.cookie)).status).toBe(200);
    const audits = await db()
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.targetId, q.id));
    expect(audits.map((a) => a.action)).toEqual(['content.hide', 'content.restore']);
  });
  it('hiding an accepted reply clears resolution and never leaks its body', async () => {
    const c = await fixture(),
      q = await c.ask();
    const reply = await data<{ id: string }>(
      await postJson(
        `${c.base}/questions/${q.id}/replies`,
        { body: 'HIDDEN_REPLY_SECRET and some inappropriate advice.' },
        c.teacher.cookie,
      ),
    );
    await postJson(`${c.base}/questions/${q.id}/solution`, { replyId: reply.id }, c.learner.cookie);
    await postJson(
      `${c.base}/reports`,
      {
        targetType: 'reply',
        targetId: reply.id,
        reason: 'unsafe',
        details: 'The accepted advice is unsafe to follow.',
      },
      c.learner.cookie,
    );
    const queue = await data<ModerationList>(await get('/api/v1/admin/reports', c.staff.cookie)),
      report = queue.items.find((r) => r.targetId === reply.id)!;
    expect(
      (
        await postJson(
          `/api/v1/admin/reports/${report.id}`,
          { decision: 'hide', notes: 'Unsafe advice is hidden pending review.', version: 0 },
          c.staff.cookie,
        )
      ).status,
    ).toBe(200);
    const response = await get(`${c.base}/questions/${q.id}`, c.learner.cookie),
      text = await response.text();
    expect(text).not.toContain('HIDDEN_REPLY_SECRET');
    const result = JSON.parse(text).data as QuestionDetail;
    expect(result.question.acceptedReplyId).toBeNull();
    expect(result.totalReplies).toBe(0);
  });
  it('hidden reviews stay hidden when edited and ratings recover on staff restoration', async () => {
    const c = await fixture(),
      enrollment = await db()
        .select()
        .from(schema.enrollments)
        .where(eq(schema.enrollments.userId, c.learnerId))
        .get();
    await db()
      .insert(schema.lessonProgress)
      .values({ enrollmentId: enrollment!.id, lessonId: c.lessonId, completedAt: new Date() });
    const reviewPath = `/api/v1/learning/courses/${c.slug}/review`;
    await postJson(
      reviewPath,
      { rating: 5, body: 'A useful course with good examples.' },
      c.learner.cookie,
    );
    const review = await db()
      .select()
      .from(schema.reviews)
      .where(eq(schema.reviews.courseId, c.id))
      .get();
    await postJson(
      `${c.base}/reports`,
      {
        targetType: 'review',
        targetId: review!.id,
        reason: 'misleading',
        details: 'Please review this course feedback.',
      },
      c.teacher.cookie,
    );
    const queue = await data<ModerationList>(await get('/api/v1/admin/reports', c.staff.cookie)),
      report = queue.items.find((r) => r.targetId === review!.id)!;
    const path = `/api/v1/admin/reports/${report.id}`;
    expect(
      (
        await postJson(
          path,
          { decision: 'hide', notes: 'Review hidden until context is clarified.', version: 0 },
          c.staff.cookie,
        )
      ).status,
    ).toBe(200);
    await postJson(
      reviewPath,
      { rating: 3, body: 'Updated feedback with more context.' },
      c.learner.cookie,
    );
    expect(await data(await call(`/api/v1/courses/${c.slug}/reviews`))).toEqual([]);
    let course = await db().select().from(schema.courses).where(eq(schema.courses.id, c.id)).get();
    expect(course?.ratingCount).toBe(0);
    expect(course?.ratingSum).toBe(0);
    expect(
      (
        await postJson(
          path,
          { decision: 'restore', notes: 'Context is clarified; restoring the review.', version: 1 },
          c.staff.cookie,
        )
      ).status,
    ).toBe(200);
    course = await db().select().from(schema.courses).where(eq(schema.courses.id, c.id)).get();
    expect(course?.ratingCount).toBe(1);
    expect(course?.ratingSum).toBe(3);
  });
});
