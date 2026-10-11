/** Real D1 account authorization, secret minimization, concurrent decisions and transaction rollback. */
import { env } from 'cloudflare:workers';
import { and, eq, like, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb, schema } from '@skillverse/db';
import {
  newId,
  adminUserListSchema,
  adminUserDetailSchema,
  adminOverviewSchema,
  type AdminUserDetail,
  type Role,
} from '@skillverse/shared';
import { createApp } from '../src/app';
import { sha256Hex } from '../src/lib/crypto';
import * as repository from '../src/repositories/admin.repository';
import { call, postJson, signedInUser, ORIGIN } from './helpers';

const db = () => createDb(env.DB);
const get = (path: string, cookie: string) => call(path, { headers: { cookie } });
async function data<T>(response: Response): Promise<T> {
  const result = await response.json<{ ok: boolean; data: T; error?: unknown }>();
  if (!result.ok) throw new Error(`${response.status}: ${JSON.stringify(result.error)}`);
  return result.data;
}
async function account(role?: Role) {
  const user = await signedInUser();
  const { id } = await data<{ id: string }>(await get('/api/v1/me', user.cookie));
  if (role) await db().insert(schema.userRoles).values({ userId: id, role });
  return { ...user, id, tokenHash: await sha256Hex(user.cookie.split('=')[1]!) };
}
const inspect = async (id: string, cookie: string) =>
  adminUserDetailSchema.parse(await data(await get(`/api/v1/admin/users/${id}`, cookie)));
const decisions = (id: string) =>
  db()
    .select()
    .from(schema.auditLogs)
    .where(
      and(
        eq(schema.auditLogs.targetType, 'user'),
        eq(schema.auditLogs.targetId, id),
        like(schema.auditLogs.action, 'admin.user_%'),
      ),
    );
const input = (detail: AdminUserDetail, decision = 'suspend') => ({
  decision,
  version: detail.user.version,
  notes: 'Reviewed the account access concern and recorded this decision.',
});

describe('staff account operations', () => {
  it('denies learners and moderators account identities and writes, and enforces admin MFA', async () => {
    const learner = await account(),
      moderator = await account('moderator'),
      admin = await account('admin');
    expect((await call('/api/v1/admin/users')).status).toBe(401);
    const detail = await inspect(learner.id, admin.cookie);
    for (const cookie of [learner.cookie, moderator.cookie]) {
      expect((await get('/api/v1/admin/users', cookie)).status).toBe(403);
      expect((await get(`/api/v1/admin/users/${learner.id}`, cookie)).status).toBe(403);
      expect(
        (await postJson(`/api/v1/admin/users/${learner.id}`, input(detail), cookie)).status,
      ).toBe(403);
    }
    expect((await get('/api/v1/admin/overview', moderator.cookie)).status).toBe(200);
    for (const method of ['GET', 'POST']) {
      const response = await createApp().fetch(
        new Request(`http://localhost:8787/api/v1/admin/users/${learner.id}`, {
          method,
          headers: {
            cookie: admin.cookie,
            origin: ORIGIN,
            'content-type': 'application/json',
            'x-skillverse-client': 'web',
          },
          ...(method === 'POST' ? { body: JSON.stringify(input(detail)) } : {}),
        }),
        { ...env, ENFORCE_ADMIN_MFA: 'on' },
        { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext,
      );
      expect(response.status).toBe(403);
      expect((await response.json<{ error: { code: string } }>()).error.code).toBe(
        'MFA_SETUP_REQUIRED',
      );
    }
    expect(await decisions(learner.id)).toHaveLength(0);
  });

  it('paginates, searches literal wildcard characters, filters statuses and returns no secrets', async () => {
    const admin = await account('admin'),
      tag = `accounts-${newId()}`;
    const rows = Array.from({ length: 23 }, (_, i) => ({
      id: newId(),
      email: `${tag}-${i}@example.com`,
      username: `batch_${newId().slice(-12)}`,
      displayName: `${tag}${i === 0 ? '_%\\' : ''}`,
      passwordHash: 'never-return-this-hash',
      status: i === 0 ? ('suspended' as const) : ('active' as const),
    }));
    await db().batch([
      db().insert(schema.users).values(rows[0]!),
      ...rows.slice(1).map((row) => db().insert(schema.users).values(row)),
    ]);
    const first = adminUserListSchema.parse(
      await data(await get(`/api/v1/admin/users?q=${tag}`, admin.cookie)),
    );
    expect(first.total).toBe(23);
    expect(first.items).toHaveLength(20);
    expect(first.totalPages).toBe(2);
    const second = adminUserListSchema.parse(
      await data(await get(`/api/v1/admin/users?q=${tag}&page=2`, admin.cookie)),
    );
    expect(second.items).toHaveLength(3);
    expect(new Set([...first.items, ...second.items].map((row) => row.id)).size).toBe(23);
    const filtered = adminUserListSchema.parse(
      await data(await get(`/api/v1/admin/users?q=${tag}&status=suspended`, admin.cookie)),
    );
    expect(filtered.items.map((row) => row.id)).toEqual([rows[0]!.id]);
    for (const q of ['_%\\', `${tag}' OR 1=1 --`]) {
      const result = adminUserListSchema.parse(
        await data(await get(`/api/v1/admin/users?q=${encodeURIComponent(q)}`, admin.cookie)),
      );
      expect(result.total).toBe(q === '_%\\' ? 1 : 0);
    }
    const raw = await (await get(`/api/v1/admin/users/${rows[0]!.id}`, admin.cookie)).text();
    for (const secret of [
      'passwordHash',
      'password_hash',
      'never-return-this-hash',
      'tokenHash',
      'secretEncrypted',
      'ipHash',
      'codeHash',
    ])
      expect(raw).not.toContain(secret);
    for (const query of ['page=0', 'page=1001', 'status=invalid', `q=${'x'.repeat(101)}`])
      expect((await get(`/api/v1/admin/users?${query}`, admin.cookie)).status).toBe(400);
  });

  it('accepts a verified MFA admin under enforcement and removes both active and pending target sessions', async () => {
    const admin = await account('admin'),
      target = await account();
    const before = await inspect(target.id, admin.cookie);
    await db().insert(schema.mfaTotp).values({
      userId: admin.id,
      secretEncrypted: 'test fixture not used for TOTP verification',
      enabledAt: new Date(),
    });
    await db()
      .update(schema.sessions)
      .set({ mfaVerified: true })
      .where(eq(schema.sessions.id, admin.tokenHash));
    await db()
      .insert(schema.sessions)
      .values({
        id: 'test-pending-session-hash',
        userId: target.id,
        mfaVerified: false,
        expiresAt: new Date(Date.now() + 600_000),
        idleExpiresAt: new Date(Date.now() + 600_000),
      });
    expect((await inspect(target.id, admin.cookie)).activeSessions).toBe(2);
    expect((await inspect(admin.id, admin.cookie)).mfaEnabled).toBe(true);
    const response = await createApp().fetch(
      new Request(`http://localhost:8787/api/v1/admin/users/${target.id}`, {
        method: 'POST',
        headers: {
          cookie: admin.cookie,
          origin: ORIGIN,
          'content-type': 'application/json',
          'x-skillverse-client': 'web',
        },
        body: JSON.stringify(input(before)),
      }),
      { ...env, ENFORCE_ADMIN_MFA: 'on' },
      { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext,
    );
    expect(response.status).toBe(200);
    expect((await inspect(target.id, admin.cookie)).activeSessions).toBe(0);
    expect(
      await db()
        .select({ id: schema.sessions.id })
        .from(schema.sessions)
        .where(eq(schema.sessions.userId, target.id)),
    ).toHaveLength(0);
  });

  it('suspends and reactivates with audit history, fresh sign-in and preserved course access records', async () => {
    const admin = await account('admin'),
      learner = await account('instructor');
    const courseId = newId();
    await db()
      .insert(schema.courses)
      .values({
        id: courseId,
        instructorId: learner.id,
        title: 'Preserved course',
        slug: `preserved-${courseId}`,
        status: 'published',
      });
    await db().insert(schema.enrollments).values({ userId: learner.id, courseId });
    const before = await inspect(learner.id, admin.cookie);
    expect(before.activeSessions).toBeGreaterThan(0);
    expect(
      (await postJson(`/api/v1/admin/users/${learner.id}`, input(before), admin.cookie)).status,
    ).toBe(200);
    expect((await get('/api/v1/me', learner.cookie)).status).toBe(401);
    expect(
      (await postJson('/api/v1/auth/login', { email: learner.email, password: learner.password }))
        .status,
    ).toBe(403);
    const suspended = await inspect(learner.id, admin.cookie);
    expect(suspended.user.status).toBe('suspended');
    expect(suspended.activeSessions).toBe(0);
    expect(suspended.user.version).toBeGreaterThan(before.user.version);
    expect(suspended.history[0]?.notes).toBe(input(before).notes);
    expect(
      (
        await postJson(
          `/api/v1/admin/users/${learner.id}`,
          input(suspended, 'reactivate'),
          admin.cookie,
        )
      ).status,
    ).toBe(200);
    const active = await inspect(learner.id, admin.cookie);
    expect(active.user.status).toBe('active');
    expect(active.activeSessions).toBe(0);
    expect(active.enrollments).toBe(1);
    expect(active.authoredCourses).toBe(1);
    expect(active.user.roles).toContain('instructor');
    expect(active.history.map((entry) => entry.action)).toEqual([
      'admin.user_reactivate',
      'admin.user_suspend',
    ]);
    expect(
      (await postJson('/api/v1/auth/login', { email: learner.email, password: learner.password }))
        .status,
    ).toBe(200);
    expect((await get('/api/v1/me', learner.cookie)).status).toBe(401);
  });

  it('protects all staff roles, self and deleted accounts, and refuses unrecognized input fields', async () => {
    const admin = await account('super_admin');
    for (const target of [
      admin,
      await account('admin'),
      await account('moderator'),
      await account('super_admin'),
    ]) {
      const detail = await inspect(target.id, admin.cookie);
      expect(detail.canManage).toBe(false);
      for (const decision of ['suspend', 'reactivate', 'revoke_sessions'])
        expect(
          (
            await postJson(
              `/api/v1/admin/users/${target.id}`,
              input(detail, decision),
              admin.cookie,
            )
          ).status,
        ).toBe(403);
      expect(await decisions(target.id)).toHaveLength(0);
    }
    const target = await account();
    await db()
      .update(schema.users)
      .set({ status: 'deleted', deletedAt: new Date() })
      .where(eq(schema.users.id, target.id));
    const deleted = await inspect(target.id, admin.cookie);
    expect(deleted.canManage).toBe(false);
    expect(
      (await postJson(`/api/v1/admin/users/${target.id}`, input(deleted), admin.cookie)).status,
    ).toBe(403);
    const learner = await account(),
      detail = await inspect(learner.id, admin.cookie);
    for (const extra of [
      { roles: ['super_admin'] },
      { status: 'active' },
      { decision: 'delete' },
      { notes: 'short' },
      { version: -1 },
    ])
      expect(
        (
          await postJson(
            `/api/v1/admin/users/${learner.id}`,
            { ...input(detail), ...extra },
            admin.cookie,
          )
        ).status,
      ).toBe(400);
    expect((await get(`/api/v1/admin/users/${newId()}`, admin.cookie)).status).toBe(404);
  });

  it('allows exactly one concurrent decision and rejects stale retries without side effects', async () => {
    const admin = await account('admin'),
      target = await account();
    const before = await inspect(target.id, admin.cookie),
      path = `/api/v1/admin/users/${target.id}`;
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        postJson(path, input(before, 'revoke_sessions'), admin.cookie),
      ),
    );
    expect(results.map((response) => response.status).sort()).toEqual([200, 409, 409]);
    const after = await inspect(target.id, admin.cookie);
    expect(after.user.status).toBe('active');
    expect(after.activeSessions).toBe(0);
    expect(after.history).toHaveLength(1);
    expect((await postJson(path, input(before), admin.cookie)).status).toBe(409);
    // A non-admin account update (even with a backwards timestamp) cannot reset the decision version.
    await db()
      .update(schema.users)
      .set({ updatedAt: new Date(0), displayName: 'Updated learner name' })
      .where(eq(schema.users.id, target.id));
    expect((await postJson(path, input(before), admin.cookie)).status).toBe(409);
    expect((await postJson(path, input(after, 'reactivate'), admin.cookie)).status).toBe(409);
    expect(await decisions(target.id)).toHaveLength(1);
  });

  it('rechecks authority and target protection in the batch, and rolls back if a later write fails', async () => {
    const admin = await account('admin'),
      target = await account();
    const before = await inspect(target.id, admin.cookie),
      decision = { ...input(before), decision: 'suspend' as const };
    await db().insert(schema.userRoles).values({ userId: target.id, role: 'moderator' });
    expect(
      await repository.decideUser(db(), admin.id, target.id, 'test-request', decision, {
        tokenHash: admin.tokenHash,
        requireMfa: false,
      }),
    ).toBe(false);
    await db().delete(schema.userRoles).where(eq(schema.userRoles.userId, target.id));
    await db().delete(schema.userRoles).where(eq(schema.userRoles.userId, admin.id));
    expect(
      await repository.decideUser(db(), admin.id, target.id, 'test-request', decision, {
        tokenHash: admin.tokenHash,
        requireMfa: false,
      }),
    ).toBe(false);
    await db().insert(schema.userRoles).values({ userId: admin.id, role: 'admin' });
    expect(
      await repository.decideUser(db(), admin.id, target.id, 'test-request', decision, {
        tokenHash: admin.tokenHash,
        requireMfa: true,
      }),
    ).toBe(false);
    await db().run(
      sql`CREATE TRIGGER test_admin_rollback BEFORE UPDATE ON users BEGIN SELECT RAISE(ABORT, 'test rollback'); END`,
    );
    try {
      expect(
        (await postJson(`/api/v1/admin/users/${target.id}`, decision, admin.cookie)).status,
      ).toBe(500);
    } finally {
      await db().run(sql`DROP TRIGGER test_admin_rollback`);
    }
    const unchanged = await inspect(target.id, admin.cookie);
    expect(unchanged.user.status).toBe('active');
    expect(unchanged.user.version).toBe(before.user.version);
    expect(unchanged.activeSessions).toBe(before.activeSessions);
    expect(await decisions(target.id)).toHaveLength(0);
    await db().delete(schema.sessions).where(eq(schema.sessions.userId, admin.id));
    expect(
      await repository.decideUser(db(), admin.id, target.id, 'test-request', decision, {
        tokenHash: admin.tokenHash,
        requireMfa: false,
      }),
    ).toBe(false);
    expect(await decisions(target.id)).toHaveLength(0);
  });

  it('reports exact operational totals beyond queue page limits and oldest pending timestamps', async () => {
    const admin = await account('admin');
    const before = adminOverviewSchema.parse(
      await data(await get('/api/v1/admin/overview', admin.cookie)),
    );
    const oldest = new Date('2025-01-01T12:00:00Z');
    const courses = Array.from({ length: 105 }, (_, i) =>
      db()
        .insert(schema.courses)
        .values({
          id: newId(),
          instructorId: admin.id,
          title: `Review course ${i}`,
          slug: `review-${newId()}`,
          status: 'in_review',
          submittedAt: oldest,
        }),
    );
    await db().batch([courses[0]!, ...courses.slice(1)]);
    const after = adminOverviewSchema.parse(
      await data(await get('/api/v1/admin/overview', admin.cookie)),
    );
    expect(after.queues.courses.count - before.queues.courses.count).toBe(105);
    expect(after.queues.courses.oldestAt).toBe(oldest.toISOString());
    expect(after.publishedCourses).toBe(before.publishedCourses);
    expect(after.enrollments).toBe(before.enrollments);
  });
});
