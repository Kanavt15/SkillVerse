/**
 * Teaching: apply to teach → admin approval → build a course → submit →
 * admin review → published. Plus the authorization edges (IDOR, roles,
 * separation of duties) and the rules that keep the curriculum consistent.
 */
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import type { Role } from '@skillverse/shared';
import { call, callAsWebApp, lastEmailTo, postJson, signedInUser } from './helpers';

interface Lesson {
  id: string;
  title: string;
  type: string;
  video: { provider: string; ref: string; url: string } | null;
}
interface Section {
  id: string;
  title: string;
  lessons: Lesson[];
}
interface Course {
  id: string;
  slug: string;
  status: string;
  tags: string[];
  lessonCount: number;
  durationMinutes: number;
  reviewNotes: string | null;
  sections: Section[];
}

/** Grants a role directly in the database (what an admin approval or the seed would do). */
async function grant(userId: string, role: Role) {
  await env.DB.prepare('INSERT INTO user_roles (user_id, role, created_at) VALUES (?, ?, ?)')
    .bind(userId, role, Date.now())
    .run();
}

async function userId(cookie: string): Promise<string> {
  const res = await call('/api/v1/me', { headers: { cookie } });
  return (await res.json<{ data: { id: string } }>()).data.id;
}

async function asRole(role: Role) {
  const user = await signedInUser();
  const id = await userId(user.cookie);
  await grant(id, role);
  return { ...user, id };
}

function get(path: string, cookie: string) {
  return call(path, { headers: { cookie } });
}

async function data<T>(res: Response): Promise<T> {
  const body = await res.json<{ ok: boolean; data: T; error?: unknown }>();
  if (!body.ok) throw new Error(`Expected ok, got ${res.status}: ${JSON.stringify(body.error)}`);
  return body.data;
}

async function errorOf(res: Response) {
  return (await res.json<{ error: { code: string; fields?: Record<string, string[]> } }>()).error;
}

async function firstCategoryId(): Promise<string> {
  const cats = await data<{ id: string }[]>(await call('/api/v1/categories'));
  return cats[0]!.id;
}

const application = {
  headline: 'Senior web developer and weekend guitar teacher',
  topics: ['web-development', 'music'],
  experience:
    'Eight years building web products for startups, and four years teaching guitar to beginners at a local school.',
  sampleUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
};

/** Creates a course and fills it until the review checklist passes. */
async function readyCourse(cookie: string): Promise<Course> {
  let course = await data<Course>(
    await postJson('/api/v1/studio/courses', { title: 'Guitar from zero' }, cookie),
  );
  const categoryId = await firstCategoryId();
  course = await data<Course>(
    await postJson(
      `/api/v1/studio/courses/${course.id}`,
      {
        subtitle: 'Play your first songs in four weeks',
        description: 'A practical, friendly course. '.repeat(10),
        categoryId,
        learningOutcomes: ['Tune a guitar', 'Play open chords', 'Strum in time'],
        tags: ['Guitar', 'music-basics'],
      },
      cookie,
      'PATCH',
    ),
  );
  course = await data<Course>(
    await postJson(`/api/v1/studio/courses/${course.id}/sections`, { title: 'Basics' }, cookie),
  );
  const sectionId = course.sections[0]!.id;
  for (const title of ['Holding the guitar', 'Tuning', 'First chords']) {
    course = await data<Course>(
      await postJson(
        `/api/v1/studio/sections/${sectionId}/lessons`,
        { title, type: 'article' },
        cookie,
      ),
    );
  }
  for (const lesson of course.sections[0]!.lessons) {
    course = await data<Course>(
      await postJson(
        `/api/v1/studio/lessons/${lesson.id}`,
        {
          contentMarkdown: `# ${lesson.title}\n\n${'Practise slowly and keep your wrist relaxed. '.repeat(3)}`,
          durationMinutes: 5,
        },
        cookie,
        'PATCH',
      ),
    );
  }
  return course;
}

describe('applying to teach', () => {
  it('learner applies, admin approves, learner gets Studio access and an email', async () => {
    const learner = await signedInUser();
    const admin = await asRole('admin');

    expect(await data(await get('/api/v1/me/instructor-application', learner.cookie))).toBeNull();
    expect((await get('/api/v1/studio/courses', learner.cookie)).status).toBe(403);

    const applied = await data<{ id: string; status: string; topics: string[] }>(
      await postJson('/api/v1/me/instructor-application', application, learner.cookie),
    );
    expect(applied.status).toBe('pending');
    expect(applied.topics).toEqual(['web-development', 'music']);

    // One pending application at a time.
    const again = await postJson('/api/v1/me/instructor-application', application, learner.cookie);
    expect(again.status).toBe(409);

    // Learners can't see the review queue.
    expect((await get('/api/v1/admin/instructor-applications', learner.cookie)).status).toBe(403);

    const queue = await data<{ id: string; applicant: { email: string } }[]>(
      await get('/api/v1/admin/instructor-applications', admin.cookie),
    );
    expect(queue.find((a) => a.id === applied.id)?.applicant.email).toBe(learner.email);

    const approve = await postJson(
      `/api/v1/admin/instructor-applications/${applied.id}/approve`,
      {},
      admin.cookie,
    );
    expect(approve.status).toBe(200);
    expect((await lastEmailTo(learner.email))?.subject).toMatch(/you can now teach/i);

    expect((await get('/api/v1/studio/courses', learner.cookie)).status).toBe(200);
    const mine = await data<{ status: string }>(
      await get('/api/v1/me/instructor-application', learner.cookie),
    );
    expect(mine.status).toBe('approved');

    // Deciding twice is a conflict, not a second role grant.
    const twice = await postJson(
      `/api/v1/admin/instructor-applications/${applied.id}/approve`,
      {},
      admin.cookie,
    );
    expect(twice.status).toBe(409);
  });

  it('rejection needs feedback, and the applicant may apply again', async () => {
    const learner = await signedInUser();
    const admin = await asRole('moderator');
    const applied = await data<{ id: string }>(
      await postJson('/api/v1/me/instructor-application', application, learner.cookie),
    );

    const noNotes = await postJson(
      `/api/v1/admin/instructor-applications/${applied.id}/reject`,
      { notes: 'no' },
      admin.cookie,
    );
    expect(noNotes.status).toBe(400);

    const rejected = await postJson(
      `/api/v1/admin/instructor-applications/${applied.id}/reject`,
      { notes: 'Please add a sample lesson we can watch.' },
      admin.cookie,
    );
    expect(rejected.status).toBe(200);
    const mine = await data<{ status: string; reviewNotes: string }>(
      await get('/api/v1/me/instructor-application', learner.cookie),
    );
    expect(mine).toMatchObject({
      status: 'rejected',
      reviewNotes: 'Please add a sample lesson we can watch.',
    });
    expect((await get('/api/v1/studio/courses', learner.cookie)).status).toBe(403);

    const reapply = await postJson(
      '/api/v1/me/instructor-application',
      application,
      learner.cookie,
    );
    expect(reapply.status).toBe(201);
  });

  it('staff cannot approve their own application', async () => {
    const admin = await asRole('admin');
    const applied = await data<{ id: string }>(
      await postJson('/api/v1/me/instructor-application', application, admin.cookie),
    );
    const res = await postJson(
      `/api/v1/admin/instructor-applications/${applied.id}/approve`,
      {},
      admin.cookie,
    );
    expect(res.status).toBe(403);
  });

  it('rejects invalid applications field by field', async () => {
    const learner = await signedInUser();
    const res = await postJson(
      '/api/v1/me/instructor-application',
      { ...application, experience: 'short', sampleUrl: 'http://insecure.example.com' },
      learner.cookie,
    );
    expect(res.status).toBe(400);
    const error = await errorOf(res);
    expect(Object.keys(error.fields ?? {})).toEqual(
      expect.arrayContaining(['experience', 'sampleUrl']),
    );
  });
});

describe('the course builder', () => {
  it('creates a draft with a unique slug and normalised tags', async () => {
    const teacher = await asRole('instructor');
    const a = await data<Course>(
      await postJson('/api/v1/studio/courses', { title: 'Café Barista Basics' }, teacher.cookie),
    );
    const b = await data<Course>(
      await postJson('/api/v1/studio/courses', { title: 'Café Barista Basics' }, teacher.cookie),
    );
    expect(a.status).toBe('draft');
    expect(a.slug).toMatch(/^cafe-barista-basics/);
    expect(b.slug).not.toBe(a.slug);

    const updated = await data<Course>(
      await postJson(
        `/api/v1/studio/courses/${a.id}`,
        { tags: ['Latte-Art', 'coffee', 'coffee'] },
        teacher.cookie,
        'PATCH',
      ),
    );
    expect(updated.tags.sort()).toEqual(['coffee', 'latte-art']);

    const list = await data<{ id: string }[]>(await get('/api/v1/studio/courses', teacher.cookie));
    expect(list.map((c) => c.id)).toEqual(expect.arrayContaining([a.id, b.id]));
  });

  it('validates prices and categories', async () => {
    const teacher = await asRole('instructor');
    const course = await data<Course>(
      await postJson('/api/v1/studio/courses', { title: 'Pricing test' }, teacher.cookie),
    );
    const url = `/api/v1/studio/courses/${course.id}`;
    expect((await postJson(url, { priceInPaise: 5000 }, teacher.cookie, 'PATCH')).status).toBe(400);
    expect((await postJson(url, { priceInPaise: 49_950 }, teacher.cookie, 'PATCH')).status).toBe(
      400,
    );
    expect((await postJson(url, { priceInPaise: 49_900 }, teacher.cookie, 'PATCH')).status).toBe(
      200,
    );
    expect((await postJson(url, { priceInPaise: 0 }, teacher.cookie, 'PATCH')).status).toBe(200);
    const badCategory = await postJson(
      url,
      { categoryId: '01890000-0000-7000-8000-000000000bad' },
      teacher.cookie,
      'PATCH',
    );
    expect(badCategory.status).toBe(400);
  });

  it('parses video links and rejects unsupported ones', async () => {
    const teacher = await asRole('instructor');
    let course = await data<Course>(
      await postJson('/api/v1/studio/courses', { title: 'Video test' }, teacher.cookie),
    );
    course = await data<Course>(
      await postJson(
        `/api/v1/studio/courses/${course.id}/sections`,
        { title: 'One' },
        teacher.cookie,
      ),
    );
    course = await data<Course>(
      await postJson(
        `/api/v1/studio/sections/${course.sections[0]!.id}/lessons`,
        { title: 'Intro', type: 'video' },
        teacher.cookie,
      ),
    );
    const lessonUrl = `/api/v1/studio/lessons/${course.sections[0]!.lessons[0]!.id}`;

    const bad = await postJson(
      lessonUrl,
      { videoUrl: 'https://evil.example.com/video.mp4' },
      teacher.cookie,
      'PATCH',
    );
    expect(bad.status).toBe(400);

    course = await data<Course>(
      await postJson(
        lessonUrl,
        { videoUrl: 'https://youtu.be/dQw4w9WgXcQ' },
        teacher.cookie,
        'PATCH',
      ),
    );
    expect(course.sections[0]!.lessons[0]!.video).toMatchObject({
      provider: 'youtube',
      ref: 'dQw4w9WgXcQ',
    });

    course = await data<Course>(
      await postJson(lessonUrl, { videoUrl: '' }, teacher.cookie, 'PATCH'),
    );
    expect(course.sections[0]!.lessons[0]!.video).toBeNull();
  });

  it('reorders sections and lessons, and moves lessons between sections', async () => {
    const teacher = await asRole('instructor');
    let course = await data<Course>(
      await postJson('/api/v1/studio/courses', { title: 'Order test' }, teacher.cookie),
    );
    for (const title of ['A', 'B', 'C']) {
      course = await data<Course>(
        await postJson(`/api/v1/studio/courses/${course.id}/sections`, { title }, teacher.cookie),
      );
    }
    const [a, b, c] = course.sections.map((s) => s.id) as [string, string, string];

    course = await data<Course>(
      await postJson(
        `/api/v1/studio/courses/${course.id}/sections/reorder`,
        { ids: [c, a, b] },
        teacher.cookie,
      ),
    );
    expect(course.sections.map((s) => s.title)).toEqual(['C', 'A', 'B']);

    // Missing or duplicated ids are refused, so rows can never drop out of order.
    const partial = await postJson(
      `/api/v1/studio/courses/${course.id}/sections/reorder`,
      { ids: [c, a] },
      teacher.cookie,
    );
    expect(partial.status).toBe(400);
    const dupes = await postJson(
      `/api/v1/studio/courses/${course.id}/sections/reorder`,
      { ids: [c, a, a] },
      teacher.cookie,
    );
    expect(dupes.status).toBe(400);

    for (const title of ['one', 'two']) {
      course = await data<Course>(
        await postJson(
          `/api/v1/studio/sections/${a}/lessons`,
          { title, type: 'article' },
          teacher.cookie,
        ),
      );
    }
    const [one, two] = course.sections.find((s) => s.id === a)!.lessons.map((l) => l.id) as [
      string,
      string,
    ];
    course = await data<Course>(
      await postJson(
        `/api/v1/studio/sections/${a}/lessons/reorder`,
        { ids: [two, one] },
        teacher.cookie,
      ),
    );
    expect(course.sections.find((s) => s.id === a)!.lessons.map((l) => l.title)).toEqual([
      'two',
      'one',
    ]);

    course = await data<Course>(
      await postJson(`/api/v1/studio/lessons/${one}`, { sectionId: b }, teacher.cookie, 'PATCH'),
    );
    expect(course.sections.find((s) => s.id === b)!.lessons.map((l) => l.title)).toEqual(['one']);
    expect(course.lessonCount).toBe(2);

    course = await data<Course>(
      await postJson(`/api/v1/studio/sections/${a}`, {}, teacher.cookie, 'DELETE'),
    );
    expect(course.sections.map((s) => s.title)).toEqual(['C', 'B']);
    expect(course.lessonCount).toBe(1);
  });

  it('refuses to submit an incomplete course and lists what is missing', async () => {
    const teacher = await asRole('instructor');
    const course = await data<Course>(
      await postJson('/api/v1/studio/courses', { title: 'Not ready yet' }, teacher.cookie),
    );
    const res = await postJson(`/api/v1/studio/courses/${course.id}/submit`, {}, teacher.cookie);
    expect(res.status).toBe(400);
    const error = await errorOf(res);
    expect(error.fields?.checklist).toEqual(
      expect.arrayContaining(['Choose a category.', 'Add at least 3 lessons.']),
    );
  });
});

describe('course access control (IDOR)', () => {
  it("another instructor can't see or change someone else's course", async () => {
    const owner = await asRole('instructor');
    const other = await asRole('instructor');
    let course = await data<Course>(
      await postJson('/api/v1/studio/courses', { title: 'Private draft' }, owner.cookie),
    );
    course = await data<Course>(
      await postJson(`/api/v1/studio/courses/${course.id}/sections`, { title: 'S' }, owner.cookie),
    );
    const sectionId = course.sections[0]!.id;
    course = await data<Course>(
      await postJson(
        `/api/v1/studio/sections/${sectionId}/lessons`,
        { title: 'L', type: 'article' },
        owner.cookie,
      ),
    );
    const lessonId = course.sections[0]!.lessons[0]!.id;

    // 404, not 403: don't reveal that the id exists.
    const attempts = [
      get(`/api/v1/studio/courses/${course.id}`, other.cookie),
      postJson(
        `/api/v1/studio/courses/${course.id}`,
        { title: 'Hijacked title' },
        other.cookie,
        'PATCH',
      ),
      postJson(`/api/v1/studio/courses/${course.id}/sections`, { title: 'x' }, other.cookie),
      postJson(`/api/v1/studio/courses/${course.id}/submit`, {}, other.cookie),
      postJson(`/api/v1/studio/sections/${sectionId}`, { title: 'x' }, other.cookie, 'PATCH'),
      postJson(
        `/api/v1/studio/sections/${sectionId}/lessons`,
        { title: 'x', type: 'article' },
        other.cookie,
      ),
      postJson(`/api/v1/studio/lessons/${lessonId}`, { title: 'x' }, other.cookie, 'PATCH'),
      postJson(`/api/v1/studio/lessons/${lessonId}`, {}, other.cookie, 'DELETE'),
      postJson(`/api/v1/studio/sections/${sectionId}`, {}, other.cookie, 'DELETE'),
    ];
    for (const res of await Promise.all(attempts)) expect(res.status).toBe(404);

    const unchanged = await data<Course>(
      await get(`/api/v1/studio/courses/${course.id}`, owner.cookie),
    );
    expect(unchanged.sections[0]!.lessons).toHaveLength(1);
  });

  it("can't reorder or move rows using another course's ids", async () => {
    const owner = await asRole('instructor');
    const other = await asRole('instructor');
    let victim = await data<Course>(
      await postJson('/api/v1/studio/courses', { title: 'Victim course' }, owner.cookie),
    );
    victim = await data<Course>(
      await postJson(`/api/v1/studio/courses/${victim.id}/sections`, { title: 'V' }, owner.cookie),
    );
    let mine = await data<Course>(
      await postJson('/api/v1/studio/courses', { title: 'Attacker course' }, other.cookie),
    );
    mine = await data<Course>(
      await postJson(`/api/v1/studio/courses/${mine.id}/sections`, { title: 'M' }, other.cookie),
    );
    mine = await data<Course>(
      await postJson(
        `/api/v1/studio/sections/${mine.sections[0]!.id}/lessons`,
        { title: 'L', type: 'article' },
        other.cookie,
      ),
    );

    const reorder = await postJson(
      `/api/v1/studio/courses/${mine.id}/sections/reorder`,
      { ids: [mine.sections[0]!.id, victim.sections[0]!.id] },
      other.cookie,
    );
    expect(reorder.status).toBe(400);

    const move = await postJson(
      `/api/v1/studio/lessons/${mine.sections[0]!.lessons[0]!.id}`,
      { sectionId: victim.sections[0]!.id },
      other.cookie,
      'PATCH',
    );
    expect(move.status).toBe(400);
  });

  it('learners without the instructor role are kept out of the Studio', async () => {
    const learner = await signedInUser();
    const res = await postJson(
      '/api/v1/studio/courses',
      { title: 'Sneaky course' },
      learner.cookie,
    );
    expect(res.status).toBe(403);
  });
});

describe('course review', () => {
  it('submit → locked while in review → withdraw → resubmit → approve → published', async () => {
    const teacher = await asRole('instructor');
    const reviewer = await asRole('admin');
    const course = await readyCourse(teacher.cookie);
    expect(course.lessonCount).toBe(3);
    expect(course.durationMinutes).toBe(15);

    const submitted = await data<Course>(
      await postJson(`/api/v1/studio/courses/${course.id}/submit`, {}, teacher.cookie),
    );
    expect(submitted.status).toBe('in_review');

    // Content can't change under the reviewer's feet.
    const edit = await postJson(
      `/api/v1/studio/courses/${course.id}`,
      { title: 'Changed mid-review' },
      teacher.cookie,
      'PATCH',
    );
    expect(edit.status).toBe(409);

    expect(
      (
        await data<Course>(
          await postJson(`/api/v1/studio/courses/${course.id}/withdraw`, {}, teacher.cookie),
        )
      ).status,
    ).toBe('draft');
    await postJson(`/api/v1/studio/courses/${course.id}/submit`, {}, teacher.cookie);

    const queue = await data<
      { id: string; lessonCount: number; durationMinutes: number; instructor: { id: string } }[]
    >(await get('/api/v1/admin/course-reviews', reviewer.cookie));
    // The stored counters (used by the catalog) match the curriculum.
    expect(queue.find((q) => q.id === course.id)).toMatchObject({
      lessonCount: 3,
      durationMinutes: 15,
      instructor: { id: teacher.id },
    });

    const inspection = await data<{ checklist: string[]; history: { event: string }[] }>(
      await get(`/api/v1/admin/course-reviews/${course.id}`, reviewer.cookie),
    );
    expect(inspection.checklist).toEqual([]);
    expect(inspection.history.map((h) => h.event)).toEqual(expect.arrayContaining(['submitted']));

    const approve = await postJson(
      `/api/v1/admin/course-reviews/${course.id}/approve`,
      {},
      reviewer.cookie,
    );
    expect(approve.status).toBe(200);
    expect((await lastEmailTo(teacher.email))?.subject).toMatch(/is live/i);

    const published = await data<Course>(
      await get(`/api/v1/studio/courses/${course.id}`, teacher.cookie),
    );
    expect(published.status).toBe('published');

    // Deciding again is a conflict.
    const again = await postJson(
      `/api/v1/admin/course-reviews/${course.id}/approve`,
      {},
      reviewer.cookie,
    );
    expect(again.status).toBe(409);
  });

  it('rejection sends feedback and the instructor can fix and resubmit', async () => {
    const teacher = await asRole('instructor');
    const reviewer = await asRole('moderator');
    const course = await readyCourse(teacher.cookie);
    await postJson(`/api/v1/studio/courses/${course.id}/submit`, {}, teacher.cookie);

    const res = await postJson(
      `/api/v1/admin/course-reviews/${course.id}/reject`,
      { notes: 'Lesson 2 audio is hard to hear; please re-record.' },
      reviewer.cookie,
    );
    expect(res.status).toBe(200);

    const rejected = await data<Course>(
      await get(`/api/v1/studio/courses/${course.id}`, teacher.cookie),
    );
    expect(rejected).toMatchObject({
      status: 'rejected',
      reviewNotes: 'Lesson 2 audio is hard to hear; please re-record.',
    });

    const edit = await postJson(
      `/api/v1/studio/courses/${course.id}`,
      { subtitle: 'Now with clearer audio!' },
      teacher.cookie,
      'PATCH',
    );
    expect(edit.status).toBe(200);
    const resubmit = await postJson(
      `/api/v1/studio/courses/${course.id}/submit`,
      {},
      teacher.cookie,
    );
    expect((await data<Course>(resubmit)).status).toBe('in_review');
  });

  it("staff can't approve their own course, and instructors can't use the review queue", async () => {
    const staffTeacher = await asRole('admin');
    await grant(staffTeacher.id, 'instructor');
    const plainTeacher = await asRole('instructor');
    const course = await readyCourse(staffTeacher.cookie);
    await postJson(`/api/v1/studio/courses/${course.id}/submit`, {}, staffTeacher.cookie);

    const self = await postJson(
      `/api/v1/admin/course-reviews/${course.id}/approve`,
      {},
      staffTeacher.cookie,
    );
    expect(self.status).toBe(403);
    expect((await get('/api/v1/admin/course-reviews', plainTeacher.cookie)).status).toBe(403);
    const byTeacher = await postJson(
      `/api/v1/admin/course-reviews/${course.id}/approve`,
      {},
      plainTeacher.cookie,
    );
    expect(byTeacher.status).toBe(403);
  });

  it('archived courses leave the editor locked', async () => {
    const teacher = await asRole('instructor');
    const course = await data<Course>(
      await postJson('/api/v1/studio/courses', { title: 'Old course' }, teacher.cookie),
    );
    const archived = await data<Course>(
      await postJson(`/api/v1/studio/courses/${course.id}/archive`, {}, teacher.cookie),
    );
    expect(archived.status).toBe('archived');
    const edit = await callAsWebApp(`/api/v1/studio/courses/${course.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Revived course' }),
      headers: { cookie: teacher.cookie },
    });
    expect(edit.status).toBe(409);
  });
});
