/** Persistent event delivery, recipient isolation, preferences and real hibernating WebSockets. */
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, schema } from '@skillverse/db';
import { newId, notificationInboxSchema, type ModerationList } from '@skillverse/shared';
import { addQuestion } from '../src/repositories/community.repository';
import { call, postJson, signedInUser, ORIGIN } from './helpers';
const db = () => createDb(env.DB);
async function data<T>(response: Response): Promise<T> {
  const body = await response.json<{ ok: boolean; data: T; error?: unknown }>();
  if (!body.ok) throw new Error(`${response.status}: ${JSON.stringify(body.error)}`);
  return body.data;
}
const get = (path: string, cookie: string) => call(path, { headers: { cookie } });
const inbox = async (cookie: string, query = '') =>
  notificationInboxSchema.parse(await data(await get(`/api/v1/me/notifications${query}`, cookie)));
async function fixture() {
  const teacher = await signedInUser(),
    learner = await signedInUser();
  const teacherId = (await data<{ id: string }>(await get('/api/v1/me', teacher.cookie))).id,
    learnerId = (await data<{ id: string }>(await get('/api/v1/me', learner.cookie))).id;
  const id = newId(),
    slug = `alerts-${id.slice(-12)}`,
    base = `/api/v1/community/courses/${slug}`;
  await db().batch([
    db().insert(schema.userRoles).values({ userId: teacherId, role: 'instructor' }),
    db().insert(schema.courses).values({
      id,
      instructorId: teacherId,
      slug,
      title: 'Notification course',
      status: 'published',
    }),
    db().insert(schema.enrollments).values({ courseId: id, userId: learnerId }),
  ]);
  const ask = async (cookie = learner.cookie) =>
    data<{ id: string }>(
      await postJson(
        `${base}/questions`,
        {
          title: 'How does this example work?',
          body: 'I need help understanding this example and what to try next.',
        },
        cookie,
      ),
    );
  return { teacher, teacherId, learner, learnerId, id, slug, base, ask };
}
describe('persistent notifications', () => {
  it('delivers to the right participants, suppresses self alerts and deduplicates accepted-answer retries', async () => {
    const c = await fixture(),
      q = await c.ask();
    let teacher = await inbox(c.teacher.cookie);
    expect(teacher.unreadCount).toBe(1);
    expect(teacher.items[0]?.kind).toBe('question');
    expect((await inbox(c.learner.cookie)).items).toHaveLength(0);
    const reply = await data<{ id: string }>(
      await postJson(
        `${c.base}/questions/${q.id}/replies`,
        { body: 'Here is the instructor explanation for that example.' },
        c.teacher.cookie,
      ),
    );
    expect((await inbox(c.learner.cookie)).items[0]?.kind).toBe('reply');
    for (let i = 0; i < 2; i++)
      expect(
        (
          await postJson(
            `${c.base}/questions/${q.id}/solution`,
            { replyId: reply.id },
            c.learner.cookie,
          )
        ).status,
      ).toBe(200);
    teacher = await inbox(c.teacher.cookie);
    expect(teacher.unreadCount).toBe(2);
    expect(teacher.items.filter((n) => n.kind === 'answer')).toHaveLength(1);
    await c.ask(c.teacher.cookie);
    expect((await inbox(c.teacher.cookie)).unreadCount).toBe(2);
    await postJson(
      `${c.base}/questions/${q.id}/replies`,
      { body: 'Thank you, this explanation clears things up.' },
      c.learner.cookie,
    );
    expect((await inbox(c.teacher.cookie)).unreadCount).toBe(3);
    expect((await inbox(c.learner.cookie)).unreadCount).toBe(1);
  });
  it('checks ownership for reads, keeps retries stable, and isolates read-all and preferences', async () => {
    const c = await fixture();
    await c.ask();
    const notification = (await inbox(c.teacher.cookie)).items[0]!;
    const path = `/api/v1/me/notifications/${notification.id}/read`;
    expect((await postJson(path, {}, c.learner.cookie)).status).toBe(404);
    expect((await postJson('/api/v1/me/notifications/read-all', {}, c.learner.cookie)).status).toBe(
      200,
    );
    expect((await inbox(c.teacher.cookie)).unreadCount).toBe(1);
    await postJson(path, {}, c.teacher.cookie);
    const firstRead = (await inbox(c.teacher.cookie)).items[0]?.readAt;
    await postJson(path, {}, c.teacher.cookie);
    expect((await inbox(c.teacher.cookie)).items[0]?.readAt).toBe(firstRead);
    expect((await inbox(c.teacher.cookie, '?unreadOnly=true')).items).toEqual([]);
    await postJson(
      '/api/v1/me/notifications/preferences',
      { discussions: false },
      c.teacher.cookie,
      'PATCH',
    );
    await c.ask();
    expect((await inbox(c.teacher.cookie)).total).toBe(1);
    expect((await inbox(c.learner.cookie)).preferences.discussions).toBe(true);
    await postJson(
      '/api/v1/me/notifications/preferences',
      { discussions: true },
      c.teacher.cookie,
      'PATCH',
    );
    await c.ask();
    expect((await inbox(c.teacher.cookie)).unreadCount).toBe(1);
    expect((await get('/api/v1/me/notifications?page=1001', c.teacher.cookie)).status).toBe(400);
    expect((await get('/api/v1/me/notifications?unreadOnly=1', c.teacher.cookie)).status).toBe(400);
  });
  it('delivers moderation feedback even when discussions are disabled, without reporter details or stale-decision alerts', async () => {
    const c = await fixture(),
      q = await c.ask(),
      staff = await signedInUser({ displayName: 'Private reporting identity' });
    const staffId = (await data<{ id: string }>(await get('/api/v1/me', staff.cookie))).id;
    await db().insert(schema.userRoles).values({ userId: staffId, role: 'moderator' });
    await postJson(
      '/api/v1/me/notifications/preferences',
      { discussions: false },
      c.learner.cookie,
      'PATCH',
    );
    await postJson(
      `${c.base}/reports`,
      {
        targetType: 'question',
        targetId: q.id,
        reason: 'other',
        details: 'Please review this discussion question.',
      },
      staff.cookie,
    );
    const report = (
      await data<ModerationList>(await get('/api/v1/admin/reports', staff.cookie))
    ).items.find((r) => r.targetId === q.id)!;
    const path = `/api/v1/admin/reports/${report.id}`,
      decision = {
        decision: 'hide',
        notes: 'Please keep the discussion focused on learning.',
        version: 0,
      };
    expect((await postJson(path, decision, staff.cookie)).status).toBe(200);
    expect((await postJson(path, decision, staff.cookie)).status).toBe(409);
    const alerts = await inbox(c.learner.cookie);
    expect(alerts.total).toBe(1);
    expect(alerts.items[0]?.kind).toBe('moderation');
    expect(alerts.items[0]?.message).toBe(decision.notes);
    expect(JSON.stringify(alerts)).not.toContain('Private reporting identity');
  });
  it('paginates a persisted inbox and does not create an alert when the guarded event fails', async () => {
    const c = await fixture();
    await db()
      .update(schema.courses)
      .set({ status: 'archived' })
      .where(eq(schema.courses.id, c.id));
    expect(
      await addQuestion(
        db(),
        c.id,
        c.learnerId,
        {
          title: 'A concurrent course change',
          body: 'This question cannot be inserted after archiving.',
          lessonId: null,
          timestampSeconds: null,
        },
        c.teacherId,
        c.slug,
      ),
    ).toBeUndefined();
    expect((await inbox(c.teacher.cookie)).total).toBe(0);
    const rows = Array.from({ length: 25 }, (_, index) => ({
      userId: c.teacherId,
      kind: 'question' as const,
      title: `Question ${index}`,
      message: 'A persisted test notification',
      href: `/courses/${c.slug}/questions`,
      eventKey: `seed:${index}`,
    }));
    // D1 permits at most 100 bound parameters per statement.
    await db().batch([
      db().insert(schema.notifications).values(rows.slice(0, 10)),
      db().insert(schema.notifications).values(rows.slice(10, 20)),
      db().insert(schema.notifications).values(rows.slice(20)),
    ]);
    const page = await inbox(c.teacher.cookie, '?page=2');
    expect(page.items).toHaveLength(5);
    expect(page.total).toBe(25);
    expect(page.totalPages).toBe(2);
    expect(page.unreadCount).toBe(25);
  });
});

const live = '/api/v1/me/notifications/live';
async function connect(cookie: string, extra: Record<string, string> = {}) {
  const response = await call(live, {
    headers: { cookie, origin: ORIGIN, upgrade: 'websocket', ...extra },
  });
  expect(response.status).toBe(101);
  const socket = response.webSocket!;
  socket.accept();
  return socket;
}
function nextMessage(socket: WebSocket) {
  return new Promise<string>((resolve) =>
    socket.addEventListener('message', (event) => resolve(String(event.data)), { once: true }),
  );
}
function closed(socket: WebSocket) {
  return new Promise<number>((resolve) =>
    socket.addEventListener('close', (event) => resolve(event.code), { once: true }),
  );
}
describe('live notification delivery', () => {
  it('requires authentication and an allowed Origin, and routes hints by the session user', async () => {
    const c = await fixture();
    expect((await call(live, { headers: { origin: ORIGIN, upgrade: 'websocket' } })).status).toBe(
      401,
    );
    expect(
      (await call(live, { headers: { cookie: c.teacher.cookie, upgrade: 'websocket' } })).status,
    ).toBe(403);
    expect(
      (
        await call(live, {
          headers: {
            cookie: c.teacher.cookie,
            origin: 'https://attacker.test',
            upgrade: 'websocket',
          },
        })
      ).status,
    ).toBe(403);
    expect((await get(live, c.teacher.cookie)).status).toBe(403);
    const teacher = await connect(c.teacher.cookie),
      learner = await connect(c.learner.cookie, { 'x-user-id': c.teacherId });
    const learnerMessages: string[] = [];
    learner.addEventListener('message', (event) => {
      learnerMessages.push(String(event.data));
    });
    try {
      const message = nextMessage(teacher);
      await c.ask();
      expect(await message).toBe('{"type":"refresh"}');
      expect(learnerMessages).toEqual([]);
      const pong = nextMessage(learner);
      learner.send('ping');
      expect(await pong).toBe('pong');
    } finally {
      teacher.close(1000);
      learner.close(1000);
    }
  });
  it('rejects client broadcasts and closes a revoked session before publishing a hint', async () => {
    const c = await fixture(),
      socket = await connect(c.learner.cookie);
    const revoked = closed(socket);
    await postJson('/api/v1/auth/logout', {}, c.learner.cookie);
    await env.NOTIFICATIONS.getByName(c.learnerId).fetch('https://notifications.internal/publish', {
      method: 'POST',
    });
    expect(await revoked).toBe(1008);
    const other = await connect(c.teacher.cookie),
      rejected = closed(other);
    other.send('broadcast arbitrary notification');
    expect(await rejected).toBe(1008);
  });
  it('bounds connections per user while allowing a separate user to connect', async () => {
    const c = await fixture(),
      sockets: WebSocket[] = [];
    try {
      for (let i = 0; i < 5; i++) sockets.push(await connect(c.teacher.cookie));
      expect(
        (
          await call(live, {
            headers: { cookie: c.teacher.cookie, origin: ORIGIN, upgrade: 'websocket' },
          })
        ).status,
      ).toBe(429);
      sockets.push(await connect(c.learner.cookie));
    } finally {
      for (const socket of sockets) socket.close(1000);
    }
  });
});
