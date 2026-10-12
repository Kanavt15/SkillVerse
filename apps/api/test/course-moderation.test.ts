/** Publication moderation in real D1: roles/MFA, discovery, preserved learning, races and rollback. */
import { env } from 'cloudflare:workers';
import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb, schema } from '@skillverse/db';
import { adminCourseListSchema, newId, type Role } from '@skillverse/shared';
import { createApp } from '../src/app';
import { sha256Hex } from '../src/lib/crypto';
import { moderate } from '../src/repositories/course-lifecycle.repository';
import { resolveSession } from '../src/services/session.service';
import { call, postJson, signedInUser, lastEmailTo, ORIGIN } from './helpers';

const db = () => createDb(env.DB);
const get = (path: string, cookie?: string) => call(path, { headers: cookie ? { cookie } : {} });
async function data<T>(response: Response): Promise<T> {
  const body = await response.json<{ ok: boolean; data: T; error?: unknown }>();
  if (!body.ok) throw new Error(`${response.status}: ${JSON.stringify(body.error)}`);
  return body.data;
}
async function account(role?: Role) {
  const user = await signedInUser();
  const { id } = await data<{ id: string }>(await get('/api/v1/me', user.cookie));
  if (role) await db().insert(schema.userRoles).values({ userId: id, role });
  const resolved = await resolveSession(db(), user.cookie.split('=')[1]!);
  if (resolved?.kind !== 'active') throw new Error('Expected active fixture');
  return {
    ...user,
    id,
    tokenHash: await sha256Hex(user.cookie.split('=')[1]!),
    auth: resolved.auth,
  };
}
async function course(instructorId: string, status: 'published' | 'draft' = 'published') {
  const id = newId(),
    sectionId = newId(),
    lessonId = newId(),
    slug = `moderation-${id}`;
  await db().batch([
    db()
      .insert(schema.courses)
      .values({
        id,
        slug,
        instructorId,
        title: `Moderation ${id}`,
        status,
        lessonCount: 1,
        publishedAt: new Date(),
      }),
    db().insert(schema.sections).values({ id: sectionId, courseId: id, title: 'First section' }),
    db().insert(schema.lessons).values({
      id: lessonId,
      courseId: id,
      sectionId,
      title: 'Saved lesson',
      type: 'article',
      isPreview: true,
      contentMarkdown: 'Original learning material saved for existing learners.',
    }),
  ]);
  return { id, slug, lessonId, path: `/api/v1/admin/courses/${id}/archive` };
}
const reason = {
  version: 2,
  notes: 'Reviewed the publication and archived it pending editorial follow-up.',
};
const events = (id: string) =>
  db().select().from(schema.courseReviewEvents).where(eq(schema.courseReviewEvents.courseId, id));
const receipts = (id: string) =>
  db()
    .select()
    .from(schema.auditLogs)
    .where(
      and(eq(schema.auditLogs.targetId, id), eq(schema.auditLogs.action, 'admin.course_archived')),
    );

describe('staff course moderation', () => {
  it('requires staff and MFA, protects own courses, and validates explicit reasons and filters', async () => {
    const learner = await account(),
      staff = await account('moderator'),
      target = await course(learner.id);
    expect((await get('/api/v1/admin/courses')).status).toBe(401);
    expect((await get('/api/v1/admin/courses', learner.cookie)).status).toBe(403);
    expect((await postJson(target.path, reason, learner.cookie)).status).toBe(403);
    for (const invalid of [
      { notes: 'short' },
      { ...reason, status: 'published' },
      { notes: ' '.repeat(20) },
    ])
      expect((await postJson(target.path, invalid, staff.cookie)).status).toBe(400);
    for (const query of ['page=0', 'status=unknown', `q=${'x'.repeat(101)}`])
      expect((await get(`/api/v1/admin/courses?${query}`, staff.cookie)).status).toBe(400);
    const own = await course(staff.id);
    expect((await postJson(own.path, reason, staff.cookie)).status).toBe(403);
    expect(
      (
        await data<{ canArchive: boolean }>(
          await get(`/api/v1/admin/course-reviews/${own.id}`, staff.cookie),
        )
      ).canArchive,
    ).toBe(false);
    expect(
      (await postJson(`/api/v1/admin/courses/${newId()}/archive`, reason, staff.cookie)).status,
    ).toBe(404);
    const app = createApp();
    const result = await app.fetch(
      new Request(`http://localhost:8787${target.path}`, {
        method: 'POST',
        headers: {
          cookie: staff.cookie,
          origin: ORIGIN,
          'x-skillverse-client': 'web',
          'content-type': 'application/json',
        },
        body: JSON.stringify(reason),
      }),
      { ...env, ENFORCE_ADMIN_MFA: 'on' },
    );
    expect(result.status).toBe(403);
    expect(await receipts(target.id)).toHaveLength(0);
  });

  it('searches every state with literal input, stable pagination and safe instructor fields', async () => {
    const teacher = await account('instructor'),
      staff = await account('admin'),
      tag = newId();
    const rows = Array.from({ length: 23 }, (_, i) => ({
      id: newId(),
      slug: `catalog-${tag}-${i}`,
      instructorId: teacher.id,
      title: `Catalog ${tag} ${i}`,
      status: i === 22 ? ('draft' as const) : ('published' as const),
      updatedAt: new Date(1000),
    }));
    const inserts = rows.map((row) => db().insert(schema.courses).values(row));
    await db().batch([inserts[0]!, ...inserts.slice(1)]);
    const list = async (query: string) =>
      adminCourseListSchema.parse(
        await data(await get(`/api/v1/admin/courses?${query}`, staff.cookie)),
      );
    const first = await list(`q=${tag}`),
      second = await list(`q=${tag}&page=2`);
    expect(first.total).toBe(23);
    expect(first.totalPages).toBe(2);
    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(3);
    expect(new Set([...first.items, ...second.items].map((c) => c.id)).size).toBe(23);
    expect((await list(`q=${tag}&status=draft`)).total).toBe(1);
    expect((await list(`q=${teacher.username}`)).total).toBe(23);
    expect(JSON.stringify(first)).not.toContain(teacher.email);
    expect(JSON.stringify(first)).not.toContain('contentMarkdown');
    for (const q of [`${tag}%`, `${tag}_`, "' OR 1=1 --", `${tag}\\`])
      expect((await list(`q=${encodeURIComponent(q)}`)).total).toBe(0);
    expect((await list(`q=${tag}&page=1000`)).items).toHaveLength(0);
  });

  it('archives exactly once, hides public discovery/previews/enrollment and preserves enrolled progress and notes', async () => {
    const teacher = await account('instructor'),
      staff = await account('moderator'),
      learner = await account(),
      newcomer = await account(),
      target = await course(teacher.id);
    expect(
      (await postJson(`/api/v1/learning/courses/${target.slug}/enroll`, {}, learner.cookie)).status,
    ).toBe(200);
    const notesPath = `/api/v1/learning/courses/${target.slug}/lessons/${target.lessonId}/notes`;
    expect(
      (await postJson(notesPath, { body: 'My private learning note.' }, learner.cookie)).status,
    ).toBe(201);
    const results = await Promise.all(
      Array.from({ length: 3 }, () => postJson(target.path, reason, staff.cookie)),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect((await postJson(target.path, reason, staff.cookie)).status).toBe(409);
    expect(await receipts(target.id)).toHaveLength(1);
    expect(await events(target.id)).toMatchObject([
      { event: 'archived', notes: reason.notes, actorId: staff.id },
    ]);
    expect((await lastEmailTo(teacher.email))?.text).toContain(reason.notes);
    expect((await get(`/api/v1/courses/${target.slug}`)).status).toBe(404);
    expect((await get(`/api/v1/courses/${target.slug}/lessons/${target.lessonId}`)).status).toBe(
      404,
    );
    expect(
      (await postJson(`/api/v1/learning/courses/${target.slug}/enroll`, {}, newcomer.cookie))
        .status,
    ).toBe(404);
    const catalog = await data<{ items: { id: string }[] }>(
      await get(`/api/v1/courses?q=${target.slug}`),
    );
    expect(catalog.items.some((c) => c.id === target.id)).toBe(false);
    const player = await data<{ notes: { body: string }[] }>(
      await get(`/api/v1/courses/${target.slug}/lessons/${target.lessonId}`, learner.cookie),
    );
    expect(player.notes).toMatchObject([{ body: 'My private learning note.' }]);
    expect(
      (
        await postJson(
          `/api/v1/learning/courses/${target.slug}/lessons/${target.lessonId}/progress`,
          { completed: true },
          learner.cookie,
        )
      ).status,
    ).toBe(200);
    const editor = await data<{ status: string; reviewNotes: string }>(
      await get(`/api/v1/studio/courses/${target.id}`, teacher.cookie),
    );
    expect(editor).toMatchObject({ status: 'archived', reviewNotes: reason.notes });
    expect(
      (
        await postJson(
          `/api/v1/studio/courses/${target.id}`,
          { title: 'Cannot reopen' },
          teacher.cookie,
          'PATCH',
        )
      ).status,
    ).toBe(409);
    expect(
      (await postJson(`/api/v1/studio/courses/${target.id}/submit`, {}, teacher.cookie)).status,
    ).toBe(409);
    const draft = await course(teacher.id, 'draft');
    expect((await postJson(draft.path, reason, staff.cookie)).status).toBe(409);
  });

  it('rechecks current authority/session/MFA and rolls back status, history and audit together', async () => {
    const teacher = await account(),
      staff = await account('super_admin'),
      target = await course(teacher.id);
    const archive = (requireMfa = false) =>
      moderate(
        db(),
        staff.auth,
        target.id,
        reason.version,
        'archive',
        reason.notes,
        'test-request',
        requireMfa,
      );
    await db().delete(schema.userRoles).where(eq(schema.userRoles.userId, staff.id));
    expect(await archive()).toBe(false);
    await db().insert(schema.userRoles).values({ userId: staff.id, role: 'super_admin' });
    expect(await archive(true)).toBe(false);
    await db()
      .update(schema.users)
      .set({ status: 'suspended' })
      .where(eq(schema.users.id, staff.id));
    expect(await archive()).toBe(false);
    await db().update(schema.users).set({ status: 'active' }).where(eq(schema.users.id, staff.id));
    await db().run(
      sql`CREATE TRIGGER test_course_archive_rollback BEFORE INSERT ON course_review_events BEGIN SELECT RAISE(ABORT, 'test rollback'); END`,
    );
    try {
      expect((await postJson(target.path, reason, staff.cookie)).status).toBe(500);
    } finally {
      await db().run(sql`DROP TRIGGER test_course_archive_rollback`);
    }
    expect(
      (await db().select().from(schema.courses).where(eq(schema.courses.id, target.id)).get())
        ?.status,
    ).toBe('published');
    expect(await events(target.id)).toHaveLength(0);
    expect(await receipts(target.id)).toHaveLength(0);
    await db()
      .update(schema.sessions)
      .set({ expiresAt: new Date(0) })
      .where(eq(schema.sessions.id, staff.tokenHash));
    expect(await archive()).toBe(false);
    await db()
      .update(schema.sessions)
      .set({
        expiresAt: new Date(Date.now() + 60_000),
        idleExpiresAt: new Date(Date.now() + 60_000),
        mfaVerified: false,
      })
      .where(eq(schema.sessions.id, staff.tokenHash));
    await db().insert(schema.mfaTotp).values({
      userId: staff.id,
      secretEncrypted: 'test fixture not used for verification',
      enabledAt: new Date(),
    });
    expect(await archive()).toBe(false);
    await db().delete(schema.sessions).where(eq(schema.sessions.userId, staff.id));
    expect(await archive()).toBe(false);
    expect(await receipts(target.id)).toHaveLength(0);
  });

  it('accepts a currently verified MFA staff session when enforcement is enabled', async () => {
    const teacher = await account(),
      staff = await account('admin'),
      target = await course(teacher.id);
    await db().insert(schema.mfaTotp).values({
      userId: staff.id,
      secretEncrypted: 'test fixture not used for verification',
      enabledAt: new Date(),
    });
    await db()
      .update(schema.sessions)
      .set({ mfaVerified: true })
      .where(eq(schema.sessions.id, staff.tokenHash));
    expect(
      await moderate(
        db(),
        staff.auth,
        target.id,
        reason.version,
        'archive',
        reason.notes,
        'test-request',
        true,
      ),
    ).toBe(true);
    expect(await receipts(target.id)).toHaveLength(1);
    expect(await events(target.id)).toHaveLength(1);
  });
});
