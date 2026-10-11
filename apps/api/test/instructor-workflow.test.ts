/** Real D1 instructor submissions: private history, terminal withdrawals, racing decisions and rollback. */
import { env } from 'cloudflare:workers';
import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb, schema } from '@skillverse/db';
import { newId, type Role } from '@skillverse/shared';
import { sha256Hex } from '../src/lib/crypto';
import {
  insertApplication,
  transitionApplication,
} from '../src/repositories/instructor-applications.repository';
import { call, postJson, signedInUser, lastEmailTo } from './helpers';

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
  return { ...user, id, tokenHash: await sha256Hex(user.cookie.split('=')[1]!) };
}
const input = {
  headline: 'Writing teacher with practical workshop experience',
  topics: ['web-development'],
  experience:
    'I have taught structured writing in workshops for four years, with original examples and personal feedback for each learner.',
  sampleUrl: '',
};
interface Application {
  id: string;
  status: string;
  headline: string;
  reviewedAt: string | null;
  withdrawnAt: string | null;
  reviewNotes: string | null;
}
const submit = (cookie: string) => postJson('/api/v1/me/instructor-application', input, cookie);
const withdraw = (id: string, cookie: string, body = {}) =>
  postJson(`/api/v1/me/instructor-applications/${id}/withdraw`, body, cookie);
const history = (cookie: string) =>
  get('/api/v1/me/instructor-applications', cookie).then(data<Application[]>);
const instructorRole = (id: string) =>
  db()
    .select()
    .from(schema.userRoles)
    .where(and(eq(schema.userRoles.userId, id), eq(schema.userRoles.role, 'instructor')));
const decisions = (id: string) =>
  db()
    .select()
    .from(schema.auditLogs)
    .where(sql`json_extract(${schema.auditLogs.metadata}, '$.applicationId') = ${id}`);

describe('instructor application workflow', () => {
  it('allows one concurrent pending submission and commits its audit with it', async () => {
    const learner = await account();
    expect((await get('/api/v1/me/instructor-applications')).status).toBe(401);
    expect((await withdraw(newId(), '')).status).toBe(401);
    const responses = await Promise.all(Array.from({ length: 3 }, () => submit(learner.cookie)));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409, 409]);
    const rows = await history(learner.cookie);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('pending');
    const audits = await db()
      .select()
      .from(schema.auditLogs)
      .where(
        and(
          eq(schema.auditLogs.action, 'instructor.applied'),
          eq(schema.auditLogs.targetId, rows[0]!.id),
        ),
      );
    expect(audits).toHaveLength(1);
  });

  it('permits only the owner to withdraw a pending application, preserving private history across reapplication', async () => {
    const owner = await account(),
      other = await account(),
      staff = await account('moderator');
    const application = await data<Application>(await submit(owner.cookie));
    for (const cookie of [other.cookie, staff.cookie])
      expect((await withdraw(application.id, cookie)).status).toBe(404);
    expect((await withdraw(newId(), owner.cookie)).status).toBe(404);
    expect((await withdraw(application.id, owner.cookie, { status: 'approved' })).status).toBe(400);
    const withdrawn = await data<Application>(await withdraw(application.id, owner.cookie));
    expect(withdrawn).toMatchObject({ status: 'withdrawn', reviewedAt: null, reviewNotes: null });
    expect(Date.parse(withdrawn.withdrawnAt!)).toBeGreaterThan(0);
    expect((await withdraw(application.id, owner.cookie)).status).toBe(409);
    expect(
      (
        await postJson(
          `/api/v1/admin/instructor-applications/${application.id}/approve`,
          {},
          staff.cookie,
        )
      ).status,
    ).toBe(409);
    const next = await data<Application>(await submit(owner.cookie));
    expect(next.id).not.toBe(application.id);
    expect((await history(owner.cookie)).map((row) => row.status)).toEqual([
      'pending',
      'withdrawn',
    ]);
    expect(await history(other.cookie)).toEqual([]);
    expect(await instructorRole(owner.id)).toHaveLength(0);
    expect(await decisions(application.id)).toMatchObject([{ action: 'instructor.withdrawn' }]);
    const queue = await data<Application[]>(
      await get('/api/v1/admin/instructor-applications?status=withdrawn', staff.cookie),
    );
    expect(queue.find((row) => row.id === application.id)?.withdrawnAt).toBe(withdrawn.withdrawnAt);
  });

  it('allows exactly one review or withdrawal winner and grants a role only when approval wins', async () => {
    const staff = await account('admin');
    for (const competitor of ['withdraw', 'reject']) {
      const owner = await account(),
        application = await data<Application>(await submit(owner.cookie));
      const results = await Promise.all([
        postJson(
          `/api/v1/admin/instructor-applications/${application.id}/approve`,
          {},
          staff.cookie,
        ),
        competitor === 'withdraw'
          ? withdraw(application.id, owner.cookie)
          : postJson(
              `/api/v1/admin/instructor-applications/${application.id}/reject`,
              { notes: 'Please improve the teaching sample and apply again.' },
              staff.cookie,
            ),
      ]);
      expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
      const final = (await history(owner.cookie))[0]!;
      expect(await instructorRole(owner.id)).toHaveLength(final.status === 'approved' ? 1 : 0);
      expect(await decisions(application.id)).toHaveLength(1);
      expect((await withdraw(application.id, owner.cookie)).status).toBe(409);
    }
  });

  it('rolls back a failed role grant, failed withdrawal and failed submission audit', async () => {
    const owner = await account(),
      staff = await account('admin');
    const application = await data<Application>(await submit(owner.cookie));
    await db().run(
      sql`CREATE TRIGGER test_instructor_grant_failure BEFORE INSERT ON user_roles WHEN NEW.role = 'instructor' BEGIN SELECT RAISE(ABORT, 'test rollback'); END`,
    );
    try {
      expect(
        (
          await postJson(
            `/api/v1/admin/instructor-applications/${application.id}/approve`,
            {},
            staff.cookie,
          )
        ).status,
      ).toBe(500);
    } finally {
      await db().run(sql`DROP TRIGGER test_instructor_grant_failure`);
    }
    expect((await history(owner.cookie))[0]?.status).toBe('pending');
    expect(await instructorRole(owner.id)).toHaveLength(0);
    expect(await decisions(application.id)).toHaveLength(0);
    expect((await lastEmailTo(owner.email))?.subject).not.toContain('approved');
    await db().run(
      sql`CREATE TRIGGER test_instructor_withdraw_failure BEFORE UPDATE ON instructor_applications WHEN NEW.status = 'withdrawn' BEGIN SELECT RAISE(ABORT, 'test rollback'); END`,
    );
    try {
      expect((await withdraw(application.id, owner.cookie)).status).toBe(500);
    } finally {
      await db().run(sql`DROP TRIGGER test_instructor_withdraw_failure`);
    }
    expect((await history(owner.cookie))[0]?.status).toBe('pending');
    expect(await decisions(application.id)).toHaveLength(0);
    const second = await account();
    await db().run(
      sql`CREATE TRIGGER test_instructor_submission_failure BEFORE INSERT ON audit_logs WHEN NEW.action = 'instructor.applied' BEGIN SELECT RAISE(ABORT, 'test rollback'); END`,
    );
    try {
      expect((await submit(second.cookie)).status).toBe(500);
    } finally {
      await db().run(sql`DROP TRIGGER test_instructor_submission_failure`);
    }
    expect(await history(second.cookie)).toEqual([]);
    expect((await submit(second.cookie)).status).toBe(201);
  });

  it('rechecks current reviewer authority, session, MFA and applicant eligibility before granting instructor access', async () => {
    const owner = await account(),
      staff = await account('super_admin'),
      application = await data<Application>(await submit(owner.cookie));
    const approve = (requireMfa = false) =>
      transitionApplication(
        db(),
        application.id,
        owner.id,
        staff.id,
        'approved',
        null,
        'test-request',
        { tokenHash: staff.tokenHash, requireMfa },
      );
    await db().delete(schema.userRoles).where(eq(schema.userRoles.userId, staff.id));
    expect(await approve()).toBe(false);
    await db().insert(schema.userRoles).values({ userId: staff.id, role: 'super_admin' });
    expect(await approve(true)).toBe(false);
    await db()
      .update(schema.users)
      .set({ status: 'suspended' })
      .where(eq(schema.users.id, owner.id));
    expect(await approve()).toBe(false);
    await db()
      .update(schema.users)
      .set({ status: 'active', emailVerifiedAt: null })
      .where(eq(schema.users.id, owner.id));
    expect(await approve()).toBe(false);
    await db()
      .update(schema.users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(schema.users.id, owner.id));
    await db()
      .update(schema.sessions)
      .set({ expiresAt: new Date(0) })
      .where(eq(schema.sessions.id, staff.tokenHash));
    expect(await approve()).toBe(false);
    await db()
      .update(schema.sessions)
      .set({ expiresAt: new Date(Date.now() + 60_000), mfaVerified: false })
      .where(eq(schema.sessions.id, staff.tokenHash));
    await db()
      .insert(schema.mfaTotp)
      .values({
        userId: staff.id,
        secretEncrypted: 'test fixture not used for verification',
        enabledAt: new Date(),
      });
    expect(await approve()).toBe(false);
    expect(await instructorRole(owner.id)).toHaveLength(0);
    expect(await decisions(application.id)).toHaveLength(0);
    await db()
      .update(schema.sessions)
      .set({ mfaVerified: true })
      .where(eq(schema.sessions.id, staff.tokenHash));
    expect(await approve(true)).toBe(true);
    expect(await instructorRole(owner.id)).toHaveLength(1);
    const other = await account();
    await db().delete(schema.sessions).where(eq(schema.sessions.id, other.tokenHash));
    expect(
      await insertApplication(db(), other.id, input, 'test-request', {
        tokenHash: other.tokenHash,
        requireMfa: false,
      }),
    ).toBeUndefined();
    expect(await history(owner.cookie)).toHaveLength(1);
  });

  it('bounds private history to 20 rows with deterministic ties and no reviewer credentials', async () => {
    const owner = await account(),
      other = await account();
    const rows = Array.from({ length: 23 }, () => ({
      id: newId(),
      userId: owner.id,
      status: 'rejected' as const,
      headline: input.headline,
      experience: input.experience,
      createdAt: new Date(1000),
      reviewedAt: new Date(2000),
      reviewNotes: 'Please share a clearer teaching example.',
    }));
    const inserts = rows.map((row) => db().insert(schema.instructorApplications).values(row));
    await db().batch([inserts[0]!, ...inserts.slice(1)]);
    const mine = await history(owner.cookie);
    expect(mine).toHaveLength(20);
    expect(mine.map((row) => row.id)).toEqual(
      rows
        .map((row) => row.id)
        .sort()
        .reverse()
        .slice(0, 20),
    );
    expect(
      (await data<Application>(await get('/api/v1/me/instructor-application', owner.cookie))).id,
    ).toBe(mine[0]!.id);
    expect(JSON.stringify(mine)).not.toContain('reviewerId');
    expect(JSON.stringify(mine)).not.toContain('tokenHash');
    expect(await history(other.cookie)).toEqual([]);
  });
});
