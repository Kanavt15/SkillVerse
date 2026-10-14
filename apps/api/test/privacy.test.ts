import { issueCertificate, verifyCertificate } from '../src/services/learning.service';
/** Real D1 integration coverage for consent races, private rights and provider-backed verification. */
import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDb, schema } from '@skillverse/db';
import { and, eq, sql } from 'drizzle-orm';
import { privacyState, verifiedTeacher } from '../src/repositories/consent.repository';
import { POLICY_VERSION, ageOn, birthCutoff, eligibilitySchema, newId } from '@skillverse/shared';
import type { RequestDeps } from '../src/lib/deps';
import { createLogger } from '../src/lib/logger';
import { resolveSession } from '../src/services/session.service';
import * as guardians from '../src/services/guardian.service';
import * as setu from '../src/services/setu.service';
import * as teacher from '../src/services/teacher-verification.service';
import * as exports from '../src/services/privacy-export.service';
import * as support from '../src/services/support.service';
import {
  call,
  newUser,
  postJson,
  signedInUser,
  lastEmailTo,
  tokenFrom,
  sessionCookieFrom,
} from './helpers';
const db = () => createDb(env.DB);
async function actor(cookie: string) {
  const resolved = await resolveSession(db(), cookie.slice(cookie.indexOf('=') + 1));
  if (resolved?.kind !== 'active') throw new Error('Missing fixture session');
  return resolved.auth;
}
function dependencies() {
  const pending: Promise<unknown>[] = [];
  const d: RequestDeps = {
    db: db(),
    env: {
      ...env,
      SETU_ENVIRONMENT: 'sandbox',
      SETU_CLIENT_ID: 'fake-id',
      SETU_CLIENT_SECRET: 'fake-secret',
      SETU_PRODUCT_INSTANCE_ID: 'fake-product',
    },
    log: createLogger(),
    requestId: newId(),
    ip: '127.0.0.1',
    userAgent: 'vitest',
    waitUntil: (p) => pending.push(p),
  };
  return { d, flush: () => Promise.all(pending) };
}
function providerStub(
  overrides: { dob?: string; signature?: boolean; status?: string; name?: string } = {},
) {
  const id = crypto.randomUUID();
  let redirect = '';
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    expect(url).toMatch(/^https:\/\/dg-sandbox\.setu\.co\/api\/digilocker\//);
    if (init?.method === 'POST') {
      redirect = JSON.parse(String(init.body)).redirectUrl;
      return Response.json({
        id,
        status: 'unauthenticated',
        url: 'https://dg-sandbox.setu.co/mock-sign-in',
        validUpto: new Date(Date.now() + 600000).toISOString(),
      });
    }
    if (url.endsWith('/status'))
      return Response.json({
        id,
        status: overrides.status ?? 'authenticated',
        url: 'https://dg-sandbox.setu.co/mock-sign-in',
        validUpto: new Date(Date.now() + 600000).toISOString(),
      });
    if (url.endsWith('/aadhaar'))
      return Response.json({
        id,
        status: 'complete',
        aadhaar: {
          name: overrides.name ?? 'Verified Adult',
          dateOfBirth: overrides.dob ?? '01-01-1990',
          verified: { signature: overrides.signature ?? true },
          maskedNumber: 'xxxx-xxxx-1234',
          address: { street: 'NEVER STORE THIS' },
          photo: 'NEVER STORE THIS',
        },
      });
    return Response.json({ success: true });
  });
  vi.stubGlobal('fetch', fetch);
  return { fetch, state: () => new URL(redirect).searchParams.get('state')! };
}
afterEach(() => vi.unstubAllGlobals());
describe('private eligibility and guardian provider verification', () => {
  it('enforces real dates, exact birthdays and minimum ages without creating child records', async () => {
    expect(ageOn('2016-10-14', new Date('2026-10-13'))).toBe(9);
    expect(ageOn('2010-10-14', new Date('2026-10-14'))).toBe(16);
    expect(birthCutoff(18, new Date('2024-02-29'))).toBe('2006-02-28');
    const user = newUser();
    expect(eligibilitySchema.safeParse({ ...user, birthDate: '2026-02-30' }).success).toBe(false);
    const child = { ...newUser(), birthDate: '2012-01-01' };
    expect((await postJson('/api/v1/auth/register', child)).status).toBe(400);
    expect(
      await db().select().from(schema.users).where(eq(schema.users.email, child.email)).get(),
    ).toBeUndefined();
  });
  it('verifies a guardian server-side, binds one-use invitations and revokes child sessions and writes', async () => {
    const adult = await signedInUser(),
      auth = await actor(adult.cookie),
      { d, flush } = dependencies(),
      mock = providerStub();
    const request = await guardians.requestConsent(d, auth, 'learning');
    await setu.start(d, auth, request.id, { version: 0, password: adult.password });
    await setu.finish(d, auth, request.id, {
      version: 0,
      state: mock.state(),
      legalName: 'Verified Adult',
      password: adult.password,
    });
    await flush();
    const verified = await db()
      .select()
      .from(schema.guardianRequests)
      .where(eq(schema.guardianRequests.id, request.id))
      .get();
    expect(verified?.status).toBe('approved');
    const child = { ...newUser(), birthDate: '2012-01-01' };
    const invite = await guardians.invite(d, auth, {
      requestId: request.id,
      version: 1,
      childEmail: child.email,
      childBirthDate: child.birthDate,
      password: adult.password,
    });
    expect(
      (
        await postJson('/api/v1/auth/register', {
          ...child,
          email: 'wrong@example.com',
          guardianCode: invite.code,
        })
      ).status,
    ).toBe(400);
    const race = await Promise.all([
      postJson('/api/v1/auth/register', { ...child, guardianCode: invite.code }),
      postJson('/api/v1/auth/register', {
        ...child,
        username: `other_${Date.now()}`,
        guardianCode: invite.code,
      }),
    ]);
    expect(race.some((r) => r.ok)).toBe(true);
    const identities = await db()
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, child.email));
    expect(identities).toHaveLength(1);
    const response = await postJson('/api/v1/auth/verify-email', {
        token: tokenFrom(await lastEmailTo(child.email)),
      }),
      cookie = sessionCookieFrom(response)!;
    expect((await call('/api/v1/me', { headers: { cookie } })).status).toBe(200);
    expect(
      (
        await postJson(
          '/api/v1/me/privacy/media',
          { enabled: true, version: POLICY_VERSION },
          cookie,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await postJson(
          '/api/v1/me/privacy/instructor-terms',
          { accepted: true, version: POLICY_VERSION },
          cookie,
        )
      ).status,
    ).toBe(403);
    const stored = JSON.stringify(await db().select().from(schema.guardianVerifications));
    expect(stored).not.toContain('NEVER STORE THIS');
    expect(stored).not.toContain('Verified Adult');
    await guardians.withdraw(d, auth, request.id, { version: 1, password: adult.password });
    expect((await call('/api/v1/me', { headers: { cookie } })).status).toBe(401);
    await expect(
      db().insert(schema.enrollments).values({ userId: identities[0]!.id, courseId: newId() }),
    ).rejects.toThrow();
  });
  it('allows a guardian-authorized 16-year-old teacher and blocks content writes after withdrawal', async () => {
    const parent = await signedInUser(),
      parentAuth = await actor(parent.cookie),
      { d, flush } = dependencies(),
      parentProvider = providerStub();
    const request = await guardians.requestConsent(d, parentAuth, 'teaching');
    await setu.start(d, parentAuth, request.id, { version: 0, password: parent.password });
    await setu.finish(d, parentAuth, request.id, {
      version: 0,
      state: parentProvider.state(),
      legalName: 'Verified Adult',
      password: parent.password,
    });
    await flush();
    const child = { ...newUser(), birthDate: '2010-01-01' };
    const invite = await guardians.invite(d, parentAuth, {
      requestId: request.id,
      version: 1,
      childEmail: child.email,
      childBirthDate: child.birthDate,
      password: parent.password,
    });
    expect(
      (await postJson('/api/v1/auth/register', { ...child, guardianCode: invite.code })).ok,
    ).toBe(true);
    const verified = await postJson('/api/v1/auth/verify-email', {
      token: tokenFrom(await lastEmailTo(child.email)),
    });
    const cookie = sessionCookieFrom(verified)!,
      childAuth = await actor(cookie);
    expect(
      (
        await postJson(
          '/api/v1/me/privacy/instructor-terms',
          { accepted: true, version: POLICY_VERSION },
          cookie,
        )
      ).ok,
    ).toBe(true);
    const childProvider = providerStub({ dob: '01-01-2010', name: 'Verified Teacher' });
    await teacher.start(d, childAuth, { password: child.password });
    await teacher.finish(d, childAuth, {
      state: childProvider.state(),
      legalName: 'Verified Teacher',
      password: child.password,
    });
    await flush();
    expect((await teacher.details(d, childAuth)).verified).toBe(true);
    // The fixture grants the role explicitly; identity verification itself never grants it.
    await db().insert(schema.userRoles).values({ userId: childAuth.user.id, role: 'instructor' });
    const courseId = newId();
    await db()
      .insert(schema.courses)
      .values({
        id: courseId,
        instructorId: childAuth.user.id,
        slug: `minor-${courseId}`,
        title: 'Authorized teaching',
      });
    await db()
      .update(schema.courses)
      .set({ title: 'Current permission' })
      .where(eq(schema.courses.id, courseId));
    await guardians.withdraw(d, parentAuth, request.id, { version: 1, password: parent.password });
    expect((await call('/api/v1/me', { headers: { cookie } })).status).toBe(401);
    await expect(
      db()
        .update(schema.courses)
        .set({ title: 'Revoked permission' })
        .where(eq(schema.courses.id, courseId)),
    ).rejects.toThrow();
    expect((await privacyState(d.db, childAuth.user.id)).canTeach).toBe(false);
    expect(
      (await db().select().from(schema.courses).where(eq(schema.courses.id, courseId)).get())
        ?.title,
    ).toBe('Current permission');
  });
  it('rejects callback replay, unsigned provider data and guardian birth-date mismatch', async () => {
    const adult = await signedInUser(),
      auth = await actor(adult.cookie),
      { d, flush } = dependencies(),
      mock = providerStub({ signature: false });
    const request = await guardians.requestConsent(d, auth, 'teaching');
    await setu.start(d, auth, request.id, { version: 0, password: adult.password });
    await expect(
      setu.finish(d, auth, request.id, {
        version: 0,
        state: 'x'.repeat(43),
        legalName: 'Verified Adult',
        password: adult.password,
      }),
    ).rejects.toThrow('invalid');
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    await expect(
      setu.finish(d, auth, request.id, {
        version: 0,
        state: mock.state(),
        legalName: 'Verified Adult',
        password: adult.password,
      }),
    ).rejects.toThrow('Verified identity');
    await flush();
    expect(
      (
        await db()
          .select()
          .from(schema.guardianRequests)
          .where(eq(schema.guardianRequests.id, request.id))
          .get()
      )?.status,
    ).toBe('pending');
    expect(
      (
        await postJson(
          `/api/v1/admin/guardians/${request.id}/decision`,
          { decision: 'approve', version: 0, notes: 'Manual approval must not be possible.' },
          adult.cookie,
        )
      ).status,
    ).toBe(403);
  });
  it('requires teacher provider identity in addition to age, terms and application review', async () => {
    const adult = await signedInUser(),
      auth = await actor(adult.cookie),
      { d, flush } = dependencies();
    await db()
      .delete(schema.teacherVerifications)
      .where(eq(schema.teacherVerifications.userId, auth.user.id));
    expect(
      (
        await postJson(
          '/api/v1/studio/courses',
          { title: 'A verified teacher course' },
          adult.cookie,
        )
      ).status,
    ).toBe(403);
    const mock = providerStub();
    await teacher.start(d, auth, { password: adult.password });
    await teacher.finish(d, auth, {
      state: mock.state(),
      legalName: 'Verified Adult',
      password: adult.password,
    });
    await flush();
    expect((await teacher.details(d, auth)).verified).toBe(true);
    // The Worker composes catalog fields outside a request, when JavaScript time is frozen.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(0));
    const startupPredicate = verifiedTeacher(auth.user.id);
    vi.useRealTimers();
    expect(
      (await d.db.get<{ eligible: number }>(sql`SELECT ${startupPredicate} AS eligible`))?.eligible,
    ).toBe(1);
    await expect(
      teacher.finish(d, auth, {
        state: mock.state(),
        legalName: 'Verified Adult',
        password: adult.password,
      }),
    ).rejects.toThrow('invalid');
    const row = await db()
      .select()
      .from(schema.teacherVerifications)
      .where(eq(schema.teacherVerifications.userId, auth.user.id))
      .get();
    expect(JSON.stringify(row)).not.toContain('Verified Adult');
    await db()
      .update(schema.teacherVerifications)
      .set({ validUntil: new Date(0) })
      .where(eq(schema.teacherVerifications.userId, auth.user.id));
    expect((await teacher.details(d, auth)).verified).toBe(false);
  });
});
describe('private export, deletion and support', () => {
  it('requires the current database factor for passwordless owners despite a stale auth snapshot', async () => {
    const user = await signedInUser(),
      auth = await actor(user.cookie),
      { d } = dependencies();
    await db()
      .update(schema.users)
      .set({ passwordHash: null })
      .where(eq(schema.users.id, auth.user.id));
    auth.user.mfaEnabled = true;
    auth.session.mfaVerified = true;
    await expect(exports.unlock(d, auth, {})).rejects.toThrow('Enable MFA');
  });

  it('exports bounded owner records without authentication secrets or another person’s notes', async () => {
    const user = await signedInUser(),
      other = await signedInUser(),
      auth = await actor(user.cookie),
      stranger = await actor(other.cookie),
      { d, flush } = dependencies();
    const created = await exports.create(d, auth, { password: user.password });
    await flush();
    for (let i = 0; i < 8; i++) await exports.process(d, created.id, 8);
    const own = await exports.list(d, auth);
    expect(own[0]?.state).toBe('ready');
    const text = await new Response(await exports.download(d, auth, created.id)).text();
    expect(text).toContain(user.email);
    expect(text).not.toContain(other.email);
    expect(text).not.toMatch(
      /password_hash|secret_encrypted|state_hash|provider_user_id|step_up_nonce|privacy_access_until|token_hash/,
    );
    expect(
      text
        .trim()
        .split('\n')
        .every((line) => Boolean(JSON.parse(line).resource)),
    ).toBe(true);
    await expect(exports.download(d, stranger, created.id)).rejects.toThrow('unavailable');
    await d.db
      .update(schema.sessions)
      .set({ privacyAccessUntil: new Date(0) })
      .where(eq(schema.sessions.id, auth.session.tokenHash));
    await expect(exports.download(d, auth, created.id)).rejects.toThrow('unavailable');
  });
  it('deletes identity and private records atomically while retaining another learner’s access', async () => {
    const instructor = await signedInUser(),
      learner = await signedInUser(),
      author = await actor(instructor.cookie),
      student = await actor(learner.cookie),
      courseId = newId(),
      sectionId = newId(),
      lessonId = newId(),
      enrollmentId = newId();
    await db().insert(schema.userRoles).values({ userId: author.user.id, role: 'instructor' });
    await db()
      .insert(schema.courses)
      .values({
        id: courseId,
        instructorId: author.user.id,
        title: 'Retained learning course',
        slug: `retained-${Date.now()}`,
        status: 'published',
        lessonCount: 1,
      });
    await db().insert(schema.sections).values({ id: sectionId, courseId, title: 'First section' });
    await db().insert(schema.lessons).values({
      id: lessonId,
      courseId,
      sectionId,
      title: 'Retained article',
      type: 'article',
      contentMarkdown: 'Licensed learning material remains.',
    });
    await db()
      .insert(schema.enrollments)
      .values({ id: enrollmentId, userId: student.user.id, courseId });
    await db()
      .insert(schema.notes)
      .values({ enrollmentId, lessonId, body: 'Other learner private note' });
    const ownEnrollment = newId();
    await db()
      .insert(schema.enrollments)
      .values({ id: ownEnrollment, userId: author.user.id, courseId });
    await db()
      .insert(schema.notes)
      .values({ enrollmentId: ownEnrollment, lessonId, body: 'Deleted private note' });
    const { d } = dependencies();
    await db()
      .insert(schema.lessonProgress)
      .values({ enrollmentId, lessonId, completedAt: new Date() });
    const credential = await issueCertificate(
      d,
      student,
      (await db().select().from(schema.courses).where(eq(schema.courses.id, courseId)).get())!.slug,
    );
    await support.create(d, author, {
      email: author.user.email,
      subject: 'Private erasure request',
      message: 'Sensitive private support text should disappear.',
      category: 'privacy',
      acceptPrivacy: true,
      adultOrGuardian: true,
      website: '',
    });
    expect(
      (
        await postJson(
          '/api/v1/me/privacy/delete',
          { confirmation: 'DELETE', version: 999, password: instructor.password },
          instructor.cookie,
        )
      ).status,
    ).toBe(409);
    expect(
      (await db().select().from(schema.users).where(eq(schema.users.id, author.user.id)).get())
        ?.status,
    ).toBe('active');
    expect(
      (
        await postJson(
          '/api/v1/me/privacy/delete',
          { confirmation: 'DELETE', version: 1, password: instructor.password },
          instructor.cookie,
        )
      ).status,
    ).toBe(200);
    expect((await call('/api/v1/me', { headers: { cookie: instructor.cookie } })).status).toBe(401);
    const row = await db()
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, author.user.id))
      .get();
    expect(row?.displayName).toBe('Former member');
    expect(row?.passwordHash).toBeNull();
    const retained = await verifyCertificate(d, credential.serial);
    expect(retained.instructorName).toBe('Former member');
    expect(retained.signature).toBe(credential.signature);
    expect(
      (await db().select().from(schema.courses).where(eq(schema.courses.id, courseId)).get())
        ?.status,
    ).toBe('archived');
    expect(
      await db().select().from(schema.notes).where(eq(schema.notes.enrollmentId, ownEnrollment)),
    ).toEqual([]);
    expect(
      await db().select().from(schema.notes).where(eq(schema.notes.enrollmentId, enrollmentId)),
    ).toHaveLength(1);
    expect(
      (
        await db()
          .select()
          .from(schema.supportRequests)
          .where(eq(schema.supportRequests.userId, author.user.id))
          .get()
      )?.message,
    ).toBe('');
  });
  it('hides unverified guest support, makes confirmation scanner-safe and keeps private replies owner-only', async () => {
    const admin = await signedInUser(),
      other = await signedInUser(),
      auth = await actor(admin.cookie),
      { d, flush } = dependencies();
    await db().insert(schema.userRoles).values({ userId: auth.user.id, role: 'admin' });
    auth.roles.push('admin');
    const email = `guest_${Date.now()}@example.com`;
    await support.create(d, null, {
      email,
      subject: 'Guest privacy request',
      message: 'Please explain the account correction process privately.',
      category: 'privacy',
      acceptPrivacy: true,
      adultOrGuardian: true,
      website: '',
    });
    await flush();
    expect(await support.list(d, auth, true)).toEqual([]);
    const token = tokenFrom(await lastEmailTo(email));
    expect((await call('/api/v1/support/confirm?token=' + token)).status).toBe(404);
    await support.confirm(d, token);
    await expect(support.confirm(d, token)).rejects.toThrow('invalid');
    const [ticket] = await support.list(d, auth, true);
    expect(ticket?.email).toBe(email);
    await support.reply(d, auth, ticket!.id, {
      version: ticket!.version,
      reply:
        'Please confirm your account ownership through your verified account before a correction.',
      resolve: true,
    });
    await flush();
    expect((await support.list(d, auth, true))[0]?.replies[0]?.deliveryState).toBe('delivered');
    expect(await support.list(d, await actor(other.cookie))).toEqual([]);
    await expect(
      support.reply(d, auth, ticket!.id, {
        version: ticket!.version,
        reply: 'A stale reply should not change this private request.',
        resolve: false,
      }),
    ).rejects.toThrow('changed');
    await db()
      .update(schema.supportRequests)
      .set({ resolvedAt: new Date(0) })
      .where(
        and(
          eq(schema.supportRequests.id, ticket!.id),
          eq(schema.supportRequests.status, 'resolved'),
        ),
      );
    await support.maintain(d);
    expect(await support.list(d, auth, true)).toEqual([]);
  });
});
