/** Learner journeys in real D1/workerd, including content privacy, retries and credential tampering. */
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createDb, schema } from '@skillverse/db';
import { eq } from 'drizzle-orm';
import {
  catalogResultSchema,
  newId,
  playerSchema,
  type Certificate,
  type LearningCourse,
  type Player,
} from '@skillverse/shared';
import { call, postJson, signedInUser } from './helpers';

const db = () => createDb(env.DB);
async function data<T>(response: Response): Promise<T> {
  const body = await response.json<{ ok: boolean; data: T; error?: unknown }>();
  if (!body.ok) throw new Error(`${response.status}: ${JSON.stringify(body.error)}`);
  return body.data;
}
const get = (path: string, cookie?: string) => call(path, { headers: cookie ? { cookie } : {} });

async function fixture(status: 'published' | 'draft' | 'archived' = 'published', priceInPaise = 0) {
  const teacher = await signedInUser();
  const teacherId = (await data<{ id: string }>(await get('/api/v1/me', teacher.cookie))).id;
  const id = newId();
  const slug = `python-${id.slice(-12)}`;
  const sectionId = newId();
  const videoId = newId();
  const articleId = newId();
  const category = (
    await data<{ id: string; slug: string }[]>(await get('/api/v1/categories'))
  )[0]!;
  await db().batch([
    db().insert(schema.userRoles).values({ userId: teacherId, role: 'instructor' }),
    db()
      .insert(schema.courses)
      .values({
        id,
        instructorId: teacherId,
        slug,
        title: `Python foundations ${id}`,
        subtitle: 'Build a useful first project',
        description: 'Learn Python syntax and loops.',
        categoryId: category.id,
        status,
        priceInPaise,
        lessonCount: 2,
        durationMinutes: 10,
        publishedAt: new Date(),
      }),
    db()
      .insert(schema.sections)
      .values({ id: sectionId, courseId: id, title: 'Start here', position: 0 }),
    db()
      .insert(schema.lessons)
      .values([
        {
          id: videoId,
          courseId: id,
          sectionId,
          title: 'Introduction',
          type: 'video',
          position: 0,
          isPreview: true,
          videoProvider: 'youtube',
          videoRef: 'dQw4w9WgXcQ',
          durationMinutes: 5,
        },
        {
          id: articleId,
          courseId: id,
          sectionId,
          title: 'Private exercise',
          type: 'article',
          position: 1,
          contentMarkdown: 'PROTECTED_LESSON_SECRET: build a loop and test it.',
          durationMinutes: 5,
        },
      ]),
  ]);
  return { id, slug, sectionId, videoId, articleId, teacher, teacherId, category };
}
const base = (slug: string) => `/api/v1/learning/courses/${slug}`;

describe('published catalog', () => {
  it('searches FTS5, filters categories/prices and never exposes drafts or private lesson bodies', async () => {
    const c = await fixture();
    const draft = await fixture('draft');
    const res = await data<unknown>(
      await get(`/api/v1/courses?q=Python&category=${c.category.slug}&price=free`),
    );
    const result = catalogResultSchema.parse(res);
    const course = result.items.find((r) => r.id === c.id)!;
    expect(course.slug).toBe(c.slug); // D1 joins must not overwrite it with the category slug.
    expect(course.category?.slug).toBe(c.category.slug);
    expect(course.instructor.username).toBe(c.teacher.username);
    expect(result.items.some((r) => r.id === draft.id)).toBe(false);
    const detail = await get(`/api/v1/courses/${c.slug}`);
    expect(await detail.text()).not.toContain('PROTECTED_LESSON_SECRET');
    expect((await get(`/api/v1/courses/${draft.slug}`)).status).toBe(404);
    expect((await get(`/api/v1/courses/${draft.slug}/lessons/${draft.videoId}`)).status).toBe(404);
    for (const q of ['"', 'OR (x) *', "' UNION SELECT", ': NEAR -']) {
      expect((await get(`/api/v1/courses?q=${encodeURIComponent(q)}`)).status).toBe(200);
    }
    expect((await get('/api/v1/courses?page=-1')).status).toBe(400);
    expect((await get('/api/v1/courses?unknown=1')).status).toBe(400);
  });

  it('keeps the search index current after course edits and hides archived courses', async () => {
    const c = await fixture();
    await db()
      .update(schema.courses)
      .set({ title: `Uniquequasar ${c.id}` })
      .where(eq(schema.courses.id, c.id));
    const result = await data<{ items: { id: string }[] }>(
      await get('/api/v1/courses?q=Uniquequasar'),
    );
    expect(result.items.some((r) => r.id === c.id)).toBe(true);
    await db()
      .update(schema.courses)
      .set({ status: 'archived' })
      .where(eq(schema.courses.id, c.id));
    expect(
      (
        await data<{ items: { id: string }[] }>(await get('/api/v1/courses?q=Uniquequasar'))
      ).items.some((r) => r.id === c.id),
    ).toBe(false);
  });

  it('exposes only public instructor data', async () => {
    const c = await fixture();
    const res = await get(`/api/v1/instructors/${c.teacher.username}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(c.teacher.email);
    expect(text).not.toContain('passwordHash');
    const learner = await signedInUser();
    expect((await get(`/api/v1/instructors/${learner.username}`)).status).toBe(404);
  });
});

describe('enrollment and lesson access', () => {
  it('protects instructor-authored timelines with the video and preserves them through partial edits', async () => {
    const c = await fixture();
    const learner = await signedInUser();
    const timeline = {
      chapters: [
        { atSeconds: 0, title: 'Begin here' },
        { atSeconds: 90, title: 'Build a loop' },
      ],
      transcript: [{ atSeconds: 0, text: 'PROTECTED_TRANSCRIPT_SECRET' }],
      checkpoints: [
        { atSeconds: 90, prompt: 'PROTECTED_CHECKPOINT_SECRET', explanation: 'Try a short loop.' },
      ],
    };
    const path = `/api/v1/studio/lessons/${c.videoId}`;
    expect(
      (await postJson(path, { videoLearning: timeline }, c.teacher.cookie, 'PATCH')).status,
    ).toBe(200);
    const preview = playerSchema.parse(
      await data(await get(`/api/v1/courses/${c.slug}/lessons/${c.videoId}`)),
    );
    expect(preview.lesson.videoLearning).toEqual(timeline);
    expect(await (await get(`/api/v1/courses/${c.slug}`)).text()).not.toContain(
      'PROTECTED_TRANSCRIPT_SECRET',
    );
    expect(await (await get(`/api/v1/courses/${c.slug}`)).text()).not.toContain(
      'PROTECTED_CHECKPOINT_SECRET',
    );
    expect(
      (
        await postJson(
          path,
          { isPreview: false, title: 'A revised title' },
          c.teacher.cookie,
          'PATCH',
        )
      ).status,
    ).toBe(200);
    expect((await get(`/api/v1/courses/${c.slug}/lessons/${c.videoId}`)).status).toBe(404);
    expect(
      (await get(`/api/v1/courses/${c.slug}/lessons/${c.videoId}`, learner.cookie)).status,
    ).toBe(404);
    await postJson(`${base(c.slug)}/enroll`, {}, learner.cookie);
    const full = playerSchema.parse(
      await data(await get(`/api/v1/courses/${c.slug}/lessons/${c.videoId}`, learner.cookie)),
    );
    expect(full.lesson.videoLearning).toEqual(timeline);
    const other = await fixture();
    expect(
      (await postJson(path, { videoLearning: {} }, other.teacher.cookie, 'PATCH')).status,
    ).toBe(404);
    expect(
      (await get(`/api/v1/courses/${other.slug}/lessons/${c.videoId}`, learner.cookie)).status,
    ).toBe(404);
    expect((await postJson(path, { videoLearning: {} }, learner.cookie, 'PATCH')).status).toBe(403);
  });

  it('refuses timelines on articles, invalid order, and edits while a course is in review', async () => {
    const c = await fixture();
    expect(
      (
        await postJson(
          `/api/v1/studio/lessons/${c.articleId}`,
          { videoLearning: {} },
          c.teacher.cookie,
          'PATCH',
        )
      ).status,
    ).toBe(400);
    const path = `/api/v1/studio/lessons/${c.videoId}`;
    expect(
      (
        await postJson(
          path,
          {
            videoLearning: {
              chapters: [
                { atSeconds: 5, title: 'First' },
                { atSeconds: 0, title: 'Second' },
              ],
            },
          },
          c.teacher.cookie,
          'PATCH',
        )
      ).status,
    ).toBe(400);
    await db()
      .update(schema.courses)
      .set({ status: 'in_review' })
      .where(eq(schema.courses.id, c.id));
    expect((await postJson(path, { videoLearning: {} }, c.teacher.cookie, 'PATCH')).status).toBe(
      409,
    );
  });

  it('allows previews and requires an enrollment for the remaining content, progress and notes', async () => {
    const c = await fixture();
    const learner = await signedInUser();
    const preview = playerSchema.parse(
      await data(await get(`/api/v1/courses/${c.slug}/lessons/${c.videoId}`)),
    );
    expect(preview.enrolled).toBe(false);
    expect(preview.notes).toEqual([]);
    expect(
      (await get(`/api/v1/courses/${c.slug}/lessons/${c.articleId}`, learner.cookie)).status,
    ).toBe(404);
    expect(
      (
        await postJson(
          `${base(c.slug)}/lessons/${c.videoId}/progress`,
          { completed: true },
          learner.cookie,
        )
      ).status,
    ).toBe(404);
    expect((await postJson(`${base(c.slug)}/enroll`, {}, learner.cookie)).status).toBe(200);
    const player = await data<Player>(
      await get(`/api/v1/courses/${c.slug}/lessons/${c.articleId}`, learner.cookie),
    );
    expect(player.lesson.contentMarkdown).toContain('PROTECTED_LESSON_SECRET');
    expect(player.enrolled).toBe(true);
    const otherCourse = await fixture();
    expect(
      (await get(`/api/v1/courses/${c.slug}/lessons/${otherCourse.articleId}`, learner.cookie))
        .status,
    ).toBe(404);
    expect(
      (
        await postJson(
          `${base(c.slug)}/lessons/${otherCourse.articleId}/progress`,
          { completed: true },
          learner.cookie,
        )
      ).status,
    ).toBe(404);
  });

  it('makes concurrent enrollment retry-safe and rejects paid courses', async () => {
    const c = await fixture();
    const learner = await signedInUser();
    const results = await Promise.all(
      Array.from({ length: 3 }, () => postJson(`${base(c.slug)}/enroll`, {}, learner.cookie)),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    const course = await db()
      .select()
      .from(schema.courses)
      .where(eq(schema.courses.id, c.id))
      .get();
    expect(course?.enrollmentCount).toBe(1);
    const paid = await fixture('published', 19900);
    expect((await postJson(`${base(paid.slug)}/enroll`, {}, learner.cookie)).status).toBe(403);
    const rows = await data<LearningCourse[]>(await get('/api/v1/me/learning', learner.cookie));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.slug).toBe(c.slug);
    expect(rows[0]?.lastAccessedAt).toMatch(/^\d{4}-/);
  });

  it('requires verified email and preserves enrolled access after archival', async () => {
    const c = await fixture();
    const learner = await signedInUser();
    const userId = (await data<{ id: string }>(await get('/api/v1/me', learner.cookie))).id;
    await db()
      .update(schema.users)
      .set({ emailVerifiedAt: null })
      .where(eq(schema.users.id, userId));
    expect((await postJson(`${base(c.slug)}/enroll`, {}, learner.cookie)).status).toBe(403);
    await db()
      .update(schema.users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(schema.users.id, userId));
    await postJson(`${base(c.slug)}/enroll`, {}, learner.cookie);
    await db()
      .update(schema.courses)
      .set({ status: 'archived' })
      .where(eq(schema.courses.id, c.id));
    expect(
      (await get(`/api/v1/courses/${c.slug}/lessons/${c.articleId}`, learner.cookie)).status,
    ).toBe(200);
    expect((await get(`/api/v1/courses/${c.slug}`)).status).toBe(404);
    expect((await get(`/api/v1/courses/${c.slug}/lessons/${c.videoId}`)).status).toBe(404);
    const archivedShelf = await data<LearningCourse[]>(
      await get('/api/v1/me/learning', learner.cookie),
    );
    expect(archivedShelf[0]?.status).toBe('archived');
  });
});

describe('progress, notes and reviews', () => {
  it('counts each completed lesson once, supports undo and derives the next lesson', async () => {
    const c = await fixture();
    const learner = await signedInUser();
    await postJson(`${base(c.slug)}/enroll`, {}, learner.cookie);
    for (let i = 0; i < 2; i++)
      expect(
        (
          await postJson(
            `${base(c.slug)}/lessons/${c.videoId}/progress`,
            { completed: true },
            learner.cookie,
          )
        ).status,
      ).toBe(200);
    let shelf = await data<LearningCourse[]>(await get('/api/v1/me/learning', learner.cookie));
    expect(shelf[0]?.completedLessons).toBe(1);
    expect(shelf[0]?.progressPercent).toBe(50);
    expect(shelf[0]?.nextLessonId).toBe(c.articleId);
    const status = await data<{ nextLessonId: string | null }>(
      await get(`${base(c.slug)}/status`, learner.cookie),
    );
    expect(status.nextLessonId).toBe(c.articleId);
    await postJson(
      `${base(c.slug)}/lessons/${c.articleId}/progress`,
      { completed: true },
      learner.cookie,
    );
    shelf = await data<LearningCourse[]>(await get('/api/v1/me/learning', learner.cookie));
    expect(shelf[0]?.progressPercent).toBe(100);
    expect(shelf[0]?.completedAt).not.toBeNull();
    await postJson(
      `${base(c.slug)}/lessons/${c.videoId}/progress`,
      { completed: false },
      learner.cookie,
    );
    shelf = await data<LearningCourse[]>(await get('/api/v1/me/learning', learner.cookie));
    expect(shelf[0]?.progressPercent).toBe(50);
    expect(shelf[0]?.completedAt).toBeNull();
  });

  it('keeps timestamped notes private and rejects cross-user deletion', async () => {
    const c = await fixture();
    const a = await signedInUser();
    const b = await signedInUser();
    await postJson(`${base(c.slug)}/enroll`, {}, a.cookie);
    await postJson(`${base(c.slug)}/enroll`, {}, b.cookie);
    const note = await data<{ id: string }>(
      await postJson(
        `${base(c.slug)}/lessons/${c.videoId}/notes`,
        { body: 'A private question about this moment', timestampSeconds: 45 },
        a.cookie,
      ),
    );
    expect(
      (await data<Player>(await get(`/api/v1/courses/${c.slug}/lessons/${c.videoId}`, b.cookie)))
        .notes,
    ).toEqual([]);
    expect(
      (await data<Player>(await get(`/api/v1/courses/${c.slug}/lessons/${c.videoId}`, a.cookie)))
        .notes[0]?.timestampSeconds,
    ).toBe(45);
    const path = `${base(c.slug)}/lessons/${c.videoId}/notes/${note.id}`;
    expect((await postJson(path, {}, b.cookie, 'DELETE')).status).toBe(404);
    expect((await postJson(path, {}, a.cookie, 'DELETE')).status).toBe(200);
    expect(
      (
        await postJson(
          `${base(c.slug)}/lessons/${c.articleId}/notes`,
          { body: 'An article note', timestampSeconds: 3 },
          a.cookie,
        )
      ).status,
    ).toBe(400);
  });

  it('allows one editable review per enrollment after learning, with retry-safe aggregates', async () => {
    const c = await fixture();
    const learner = await signedInUser();
    await postJson(`${base(c.slug)}/enroll`, {}, learner.cookie);
    expect(
      (
        await postJson(
          `${base(c.slug)}/review`,
          { rating: 5, body: 'A clear and useful introduction' },
          learner.cookie,
        )
      ).status,
    ).toBe(403);
    await postJson(
      `${base(c.slug)}/lessons/${c.videoId}/progress`,
      { completed: true },
      learner.cookie,
    );
    for (const rating of [5, 5, 3])
      expect(
        (
          await postJson(
            `${base(c.slug)}/review`,
            { rating, body: 'A clear and useful introduction' },
            learner.cookie,
          )
        ).status,
      ).toBe(200);
    const course = await db()
      .select()
      .from(schema.courses)
      .where(eq(schema.courses.id, c.id))
      .get();
    expect(course?.ratingCount).toBe(1);
    expect(course?.ratingSum).toBe(3);
    const reviews = await data<{ author: { username: string } }[]>(
      await get(`/api/v1/courses/${c.slug}/reviews`),
    );
    expect(reviews[0]?.author.username).toBe(learner.username);
    await postJson(`${base(c.slug)}/enroll`, {}, c.teacher.cookie);
    await postJson(
      `${base(c.slug)}/lessons/${c.videoId}/progress`,
      { completed: true },
      c.teacher.cookie,
    );
    expect(
      (
        await postJson(
          `${base(c.slug)}/review`,
          { rating: 5, body: 'My own course is excellent' },
          c.teacher.cookie,
        )
      ).status,
    ).toBe(403);
  });
});

describe('completion certificates', () => {
  it('requires all lessons, issues once, verifies snapshots and detects tampering', async () => {
    const c = await fixture();
    const learner = await signedInUser();
    await postJson(`${base(c.slug)}/enroll`, {}, learner.cookie);
    expect((await postJson(`${base(c.slug)}/certificate`, {}, learner.cookie)).status).toBe(403);
    for (const lessonId of [c.videoId, c.articleId])
      await postJson(
        `${base(c.slug)}/lessons/${lessonId}/progress`,
        { completed: true },
        learner.cookie,
      );
    const certificates = await Promise.all(
      [1, 2].map(async () =>
        data<Certificate>(await postJson(`${base(c.slug)}/certificate`, {}, learner.cookie)),
      ),
    );
    expect(certificates[0]?.serial).toBe(certificates[1]?.serial);
    const certificate = certificates[0]!;
    expect(certificate.signature).toMatch(/^[a-f0-9]{64}$/);
    expect((await get(`/api/v1/certificates/${certificate.serial}`)).status).toBe(200);
    await db()
      .update(schema.courses)
      .set({ title: 'Renamed course' })
      .where(eq(schema.courses.id, c.id));
    expect(
      (await data<Certificate>(await get(`/api/v1/certificates/${certificate.serial}`)))
        .courseTitle,
    ).toBe(certificate.courseTitle);
    expect(
      await data<Certificate[]>(await get('/api/v1/me/certificates', learner.cookie)),
    ).toHaveLength(1);
    await db()
      .update(schema.certificates)
      .set({ learnerName: 'Forged name' })
      .where(eq(schema.certificates.serial, certificate.serial));
    expect((await get(`/api/v1/certificates/${certificate.serial}`)).status).toBe(404);
    expect((await get(`/api/v1/certificates/${newId()}`)).status).toBe(404);
  });
});
