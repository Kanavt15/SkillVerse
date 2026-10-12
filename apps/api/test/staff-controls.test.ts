/** Real D1 and real security proof; fixtures grant authority only in isolated test storage. */
import { env } from 'cloudflare:workers';
import { and, eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, schema } from '@skillverse/db';
import { newId, staffAuditSchema, staffControlsSchema, type Role } from '@skillverse/shared';
import { createApp } from '../src/app';
import { sha256Hex } from '../src/lib/crypto';
import { base32Decode, currentStep, hotp } from '../src/lib/totp';
import { resolveSession } from '../src/services/session.service';
import { upsertPendingTotp } from '../src/repositories/mfa.repository';
import { createLogger } from '../src/lib/logger';
import { clearFeatureCache } from '../src/services/feature-flags.service';
import * as service from '../src/services/staff-controls.service';
import * as repository from '../src/repositories/staff-controls.repository';
import { clearOperationalSettingsCache } from '../src/services/operational.service';
import { call, postJson, signedInUser, ORIGIN } from './helpers';

const db = createDb(env.DB);
const reason = 'Access was independently reviewed and approved for this staff responsibility.';
const get = (path: string, cookie?: string) => call(path, { headers: cookie ? { cookie } : {} });
async function data<T>(response: Response): Promise<T> {
  const body = await response.json<{ ok: boolean; data: T; error?: unknown }>();
  if (!body.ok) throw new Error(`${response.status}: ${JSON.stringify(body.error)}`);
  return body.data;
}
async function account(role?: Role, mfa = true) {
  const user = await signedInUser(),
    { id } = await data<{ id: string }>(await get('/api/v1/me', user.cookie));
  let codes: string[] = [];
  if (mfa) {
    const setup = await data<{ secret: string }>(
      await postJson('/api/v1/me/mfa/totp/setup', {}, user.cookie),
    );
    const enabled = await data<{ recoveryCodes: string[] }>(
      await postJson(
        '/api/v1/me/mfa/totp/enable',
        { code: await hotp(base32Decode(setup.secret), currentStep()) },
        user.cookie,
      ),
    );
    codes = enabled.recoveryCodes;
  }
  if (role) await db.insert(schema.userRoles).values({ userId: id, role });
  return { ...user, id, codes, tokenHash: await sha256Hex(user.cookie.split('=')[1]!) };
}
async function deps(actor: Awaited<ReturnType<typeof account>>) {
  const session = await resolveSession(db, actor.cookie.split('=')[1]!);
  if (session?.kind !== 'active') throw new Error('Expected active fixture session');
  return {
    auth: session.auth,
    d: {
      db,
      env,
      log: createLogger({ test: true }),
      requestId: newId(),
      ip: '127.0.0.1',
      userAgent: 'fixture',
      waitUntil() {},
    },
  };
}
const roleInput = (
  code: string,
  role: 'moderator' | 'admin' | 'super_admin' = 'moderator',
  decision: 'grant' | 'revoke' = 'grant',
  version = 0,
) => ({ role, decision, version, notes: reason, code });
const roles = (id: string) =>
  db.select().from(schema.userRoles).where(eq(schema.userRoles.userId, id));
const sessions = (id: string) =>
  db.select().from(schema.sessions).where(eq(schema.sessions.userId, id));
const history = (targetId: string, action: string) =>
  db
    .select()
    .from(schema.auditLogs)
    .where(and(eq(schema.auditLogs.targetId, targetId), eq(schema.auditLogs.action, action)));
beforeEach(async () => {
  clearFeatureCache();
  clearOperationalSettingsCache();
  // Storage is isolated per file, so each security scenario starts without prior authority.
  await db.batch([
    db.delete(schema.userRoles),
    db
      .delete(schema.platformSettings)
      .where(eq(schema.platformSettings.key, 'security.bootstrap_completed')),
  ]);
});

describe('initial provisioning', () => {
  it('requires verified/password/MFA eligibility, dry-runs and permits one atomic provisioning only', async () => {
    const first = await account(undefined, false);
    expect(await repository.bootstrap(db, first.id, reason, newId(), false)).toBe(false);
    const eligible = await account(),
      other = await account();
    expect(await repository.bootstrap(db, eligible.id, reason, newId(), false)).toBe(true);
    expect(await roles(eligible.id)).toHaveLength(0);
    expect(await sessions(eligible.id)).toHaveLength(1);
    const results = await Promise.all([
      repository.bootstrap(db, eligible.id, reason, newId(), true),
      repository.bootstrap(db, other.id, reason, newId(), true),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const winner = results[0] ? eligible : other;
    expect((await roles(winner.id)).map((row) => row.role)).toEqual(['super_admin']);
    expect(await sessions(winner.id)).toHaveLength(0);
    expect(await history(winner.id, 'security.initial_admin_provisioned')).toHaveLength(1);
    await db.delete(schema.userRoles).where(eq(schema.userRoles.userId, winner.id));
    expect(await repository.bootstrap(db, other.id, reason, newId(), true)).toBe(false);
  });
  it('rolls back role, marker, sessions and receipt if any provisioning statement fails', async () => {
    const target = await account();
    await db.run(
      sql`CREATE TRIGGER bootstrap_fail BEFORE INSERT ON user_roles WHEN NEW.role = 'super_admin' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END`,
    );
    try {
      await expect(repository.bootstrap(db, target.id, reason, newId(), true)).rejects.toThrow();
    } finally {
      await db.run(sql`DROP TRIGGER bootstrap_fail`);
    }
    expect(await roles(target.id)).toHaveLength(0);
    expect(await sessions(target.id)).toHaveLength(1);
    expect(await history(target.id, 'security.initial_admin_provisioned')).toHaveLength(0);
    expect(await repository.bootstrap(db, target.id, reason, newId(), false)).toBe(true);
  });
});

describe('privileged decisions', () => {
  it('denies learners/moderators/admin writes and always requires MFA for super-admin writes', async () => {
    const learner = await account(undefined, false),
      moderator = await account('moderator', false),
      admin = await account('admin', false),
      root = await account('super_admin', false);
    for (const path of [
      '/api/v1/admin/controls',
      '/api/v1/admin/audit',
      '/api/v1/admin/operations',
    ]) {
      expect((await get(path)).status).toBe(401);
      for (const denied of [learner, moderator])
        expect((await get(path, denied.cookie)).status).toBe(403);
    }
    expect(
      (await postJson(`/api/v1/admin/users/${learner.id}/roles`, roleInput('123456'), admin.cookie))
        .status,
    ).toBe(403);
    const noMfa = await postJson(
      `/api/v1/admin/users/${learner.id}/roles`,
      { ...roleInput('123456'), password: root.password },
      root.cookie,
    );
    expect(noMfa.status).toBe(403);
    expect((await noMfa.json<{ error: { code: string } }>()).error.code).toBe('MFA_SETUP_REQUIRED');
    const enforced = await createApp().fetch(
      new Request(`http://localhost:8787/api/v1/admin/controls`, {
        headers: { cookie: admin.cookie },
      }),
      { ...env, ENFORCE_ADMIN_MFA: 'on' },
      { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext,
    );
    expect(enforced.status).toBe(403);
  });
  it('requires fresh password/factor and version; grants and revokes sessions without exposing secrets', async () => {
    const root = await account('super_admin'),
      target = await account();
    const path = `/api/v1/admin/users/${target.id}/roles`,
      input = roleInput(root.codes[0]!);
    expect((await postJson(path, input, root.cookie)).status).toBe(400);
    expect(
      (await postJson(path, { ...input, password: root.password, version: 8 }, root.cookie)).status,
    ).toBe(409);
    expect((await postJson(path, { ...input, password: root.password }, root.cookie)).status).toBe(
      200,
    );
    expect((await roles(target.id)).map((row) => row.role)).toEqual(['moderator']);
    expect(await sessions(target.id)).toHaveLength(0);
    expect((await get('/api/v1/me', target.cookie)).status).toBe(401);
    expect(
      (
        await postJson(
          path,
          { ...roleInput(root.codes[0]!, 'moderator', 'revoke', 1), password: root.password },
          root.cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await postJson(
          path,
          { ...roleInput(root.codes[1]!, 'moderator', 'revoke', 1), password: root.password },
          root.cookie,
        )
      ).status,
    ).toBe(200);
    expect(await roles(target.id)).toHaveLength(0);
    const audit = staffAuditSchema.parse(
      await data(await get(`/api/v1/admin/audit?targetId=${target.id}`, root.cookie)),
    );
    expect(audit.items.filter((row) => row.action.startsWith('admin.role_'))).toHaveLength(2);
    expect(JSON.stringify(audit)).not.toContain(root.password);
    expect(JSON.stringify(audit)).not.toContain(root.codes[0]);
    expect(audit.items.every((row) => !('metadata' in row) && !('ipHash' in row))).toBe(true);
  });
  it('protects self/deleted targets, ineligible grants and the last usable administrator under races', async () => {
    const a = await account('super_admin'),
      b = await account('super_admin'),
      noFactor = await account(undefined, false);
    expect(
      (
        await postJson(
          `/api/v1/admin/users/${a.id}/roles`,
          { ...roleInput(a.codes[0]!), password: a.password },
          a.cookie,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await postJson(
          `/api/v1/admin/users/${noFactor.id}/roles`,
          { ...roleInput(a.codes[0]!), password: a.password },
          a.cookie,
        )
      ).status,
    ).toBe(409);
    const da = await deps(a),
      dbb = await deps(b);
    const [na, nb] = await Promise.all([
      service.verifyStaffAction(da.d, da.auth, { code: a.codes[1]!, password: a.password }),
      service.verifyStaffAction(dbb.d, dbb.auth, { code: b.codes[0]!, password: b.password }),
    ]);
    const outcomes = await Promise.all([
      repository.decideRole(db, da.auth, b.id, roleInput('', 'super_admin', 'revoke'), na, newId()),
      repository.decideRole(
        db,
        dbb.auth,
        a.id,
        roleInput('', 'super_admin', 'revoke'),
        nb,
        newId(),
      ),
    ]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    const remaining = await db
      .select()
      .from(schema.userRoles)
      .where(eq(schema.userRoles.role, 'super_admin'));
    expect(remaining).toHaveLength(1);
    const winner = outcomes[0] ? a : b;
    const current = await deps(winner),
      selfNonce = await service.verifyStaffAction(current.d, current.auth, {
        code: winner.codes[2]!,
        password: winner.password,
      });
    expect(
      await repository.decideRole(
        db,
        current.auth,
        winner.id,
        roleInput('', 'super_admin', 'revoke'),
        selfNonce,
        newId(),
      ),
    ).toBe(false);
    await db
      .update(schema.users)
      .set({ status: 'deleted' })
      .where(eq(schema.users.id, noFactor.id));
    expect(
      (
        await postJson(
          `/api/v1/admin/users/${noFactor.id}/roles`,
          { ...roleInput(winner.codes[3]!), password: winner.password },
          winner.cookie,
        )
      ).status,
    ).toBe(403);
  });
  it('rejects expired or consumed proof, current authority loss and competing stale writes', async () => {
    const a = await account('super_admin'),
      target = await account(),
      { d, auth } = await deps(a);
    const nonce = await service.verifyStaffAction(d, auth, {
      code: a.codes[0]!,
      password: a.password,
    });
    await db
      .update(schema.sessions)
      .set({ stepUpAt: new Date(Date.now() - 60001) })
      .where(eq(schema.sessions.id, a.tokenHash));
    expect(await repository.decideRole(db, auth, target.id, roleInput(''), nonce, newId())).toBe(
      false,
    );
    const fresh = await service.verifyStaffAction(d, auth, {
      code: a.codes[1]!,
      password: a.password,
    });
    const outcomes = await Promise.all([
      repository.decideRole(db, auth, target.id, roleInput(''), fresh, newId()),
      repository.decideRole(db, auth, target.id, roleInput('', 'admin'), fresh, newId()),
    ]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(await history(target.id, 'admin.role_granted')).toHaveLength(1);
    expect(
      await repository.decideRole(
        db,
        auth,
        target.id,
        roleInput('', 'super_admin', 'grant', 1),
        fresh,
        newId(),
      ),
    ).toBe(false);
    const next = await service.verifyStaffAction(d, auth, {
      code: a.codes[2]!,
      password: a.password,
    });
    await db.delete(schema.userRoles).where(eq(schema.userRoles.userId, a.id));
    expect(
      await repository.decideRole(
        db,
        auth,
        target.id,
        roleInput('', 'super_admin', 'grant', 1),
        next,
        newId(),
      ),
    ).toBe(false);
  });
  it('revokes a session after five failed fresh-proof checks and counts by actor across IP changes', async () => {
    const a = await account('super_admin');
    for (let i = 0; i < 5; i++)
      expect(
        (
          await postJson(
            '/api/v1/admin/controls/settings',
            {
              key: 'operations.error_threshold',
              value: 9,
              version: 0,
              notes: reason,
              password: 'wrong-password',
              code: a.codes[0],
            },
            a.cookie,
          )
        ).status,
      ).toBe(i === 4 ? 401 : 400);
    expect(await sessions(a.id)).toHaveLength(0);
    expect(await history(a.id, 'admin.step_up_failed')).toHaveLength(5);
  });
  it('limits privileged writes by actor when requests use different client IPs', async () => {
    const a = await account('super_admin');
    // Validation failures count too; the helper supplies a different IP each time.
    for (let i = 0; i < 11; i++)
      expect((await postJson('/api/v1/admin/controls/settings', {}, a.cookie)).status).toBe(
        i < 10 ? 400 : 429,
      );
    expect(await sessions(a.id)).toHaveLength(1);
  });
  it('rolls back access, version, sessions, proof consumption and audit when the role write fails', async () => {
    const a = await account('super_admin'),
      target = await account(),
      { d, auth } = await deps(a);
    const nonce = await service.verifyStaffAction(d, auth, {
      code: a.codes[0]!,
      password: a.password,
    });
    await db.run(
      sql`CREATE TRIGGER role_fail BEFORE INSERT ON user_roles WHEN NEW.role = 'moderator' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END`,
    );
    try {
      await expect(
        repository.decideRole(db, auth, target.id, roleInput(''), nonce, newId()),
      ).rejects.toThrow();
    } finally {
      await db.run(sql`DROP TRIGGER role_fail`);
    }
    expect(await roles(target.id)).toHaveLength(0);
    expect(await sessions(target.id)).toHaveLength(1);
    expect(await history(target.id, 'admin.role_granted')).toHaveLength(0);
    expect(await repository.decideRole(db, auth, target.id, roleInput(''), nonce, newId())).toBe(
      true,
    );
  });
  it('bounds/versions supported controls, rejects protected keys, and audits only safe values', async () => {
    const a = await account('super_admin');
    const configuration = staffControlsSchema.parse(
      await data(await get('/api/v1/admin/controls', a.cookie)),
    );
    expect(configuration.settings).toHaveLength(6);
    const input = {
      key: 'operations.error_threshold',
      value: 9,
      version: 0,
      notes: reason,
      password: a.password,
      code: a.codes[0],
    };
    expect(
      (await postJson('/api/v1/admin/controls/settings', { ...input, value: 0 }, a.cookie)).status,
    ).toBe(400);
    expect(
      (
        await postJson(
          '/api/v1/admin/controls/settings',
          { ...input, key: 'security.bootstrap_completed' },
          a.cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await postJson(
          '/api/v1/admin/controls/flags',
          { ...input, key: 'commerce.checkout', enabled: true, rolloutPercent: 100 },
          a.cookie,
        )
      ).status,
    ).toBe(400);
    expect((await postJson('/api/v1/admin/controls/settings', input, a.cookie)).status).toBe(200);
    expect(
      (await postJson('/api/v1/admin/controls/settings', { ...input, code: a.codes[1] }, a.cookie))
        .status,
    ).toBe(409);
    const updated = staffControlsSchema.parse(
      await data(await get('/api/v1/admin/controls', a.cookie)),
    );
    expect(updated.settings.find((row) => row.key === input.key)).toMatchObject({
      value: 9,
      version: 1,
    });
    expect(
      (
        await postJson(
          '/api/v1/admin/controls/flags',
          {
            key: 'auth.google',
            enabled: true,
            rolloutPercent: 100,
            version: 0,
            notes: reason,
            password: a.password,
            code: a.codes[2],
          },
          a.cookie,
        )
      ).status,
    ).toBe(200);
    const enforced = await createApp().fetch(
      new Request('http://localhost:8787/api/v1/admin/controls/flags', {
        method: 'POST',
        headers: {
          cookie: a.cookie,
          origin: ORIGIN,
          'content-type': 'application/json',
          'x-skillverse-client': 'web',
        },
        body: JSON.stringify({
          key: 'auth.google',
          enabled: true,
          rolloutPercent: 100,
          version: 1,
          notes: reason,
          password: a.password,
          code: a.codes[3],
        }),
      }),
      { ...env, GOOGLE_CLIENT_SECRET: '' },
      { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext,
    );
    expect(enforced.status).toBe(409);
    expect(await history('operations.error_threshold', 'admin.setting_changed')).toHaveLength(1);
    await db
      .update(schema.platformSettings)
      .set({ value: 'bad-json' })
      .where(eq(schema.platformSettings.key, 'operations.error_threshold'));
    expect((await get('/api/v1/admin/controls', a.cookie)).status).toBe(200);
  });
  it('uses bounded stable audit pages, exact filters and rejects invalid cursors', async () => {
    const a = await account('admin'),
      target = newId(),
      now = new Date();
    const insert = () =>
      db.insert(schema.auditLogs).values({
        action: 'admin.fixture',
        actorUserId: a.id,
        targetId: target,
        metadata: JSON.stringify({
          notes: reason,
          password: 'never-expose',
          secret: 'hidden',
          summary: 'Reviewed this fixture.',
        }),
        createdAt: now,
      });
    await db.batch([insert(), ...Array.from({ length: 54 }, insert)]);
    const first = staffAuditSchema.parse(
      await data(
        await get(
          `/api/v1/admin/audit?targetId=${target}&action=admin.fixture&actorId=${a.id}`,
          a.cookie,
        ),
      ),
    );
    expect(first.items).toHaveLength(50);
    expect(first.nextCursor).not.toBeNull();
    const next = staffAuditSchema.parse(
      await data(
        await get(
          `/api/v1/admin/audit?targetId=${target}&before=${encodeURIComponent(first.nextCursor!)}`,
          a.cookie,
        ),
      ),
    );
    expect(next.items).toHaveLength(5);
    expect(new Set([...first.items, ...next.items].map((row) => row.id)).size).toBe(55);
    expect(next.nextCursor).toBeNull();
    expect(JSON.stringify(first)).not.toContain('never-expose');
    expect(
      (await get(`/api/v1/admin/audit?before=9999999999999999:${target}`, a.cookie)).status,
    ).toBe(400);
    expect((await get('/api/v1/admin/audit?action=admin.%', a.cookie)).status).toBe(400);
  });
  it('retains staff MFA and revokes other sessions on enabling, regenerating and disabling', async () => {
    const a = await account('admin');
    expect(
      (
        await postJson(
          '/api/v1/me/mfa/disable',
          { password: a.password, code: a.codes[0] },
          a.cookie,
        )
      ).status,
    ).toBe(403);
    const extra = () =>
      db.insert(schema.sessions).values({
        id: 'fixture-extra',
        handle: newId(),
        userId: a.id,
        expiresAt: new Date(Date.now() + 60000),
        idleExpiresAt: new Date(Date.now() + 60000),
        mfaVerified: true,
      });
    await extra();
    const regenerated = await data<{ recoveryCodes: string[] }>(
      await postJson('/api/v1/me/mfa/recovery-codes', { code: a.codes[0] }, a.cookie),
    );
    expect(await sessions(a.id)).toHaveLength(1);
    await db.delete(schema.userRoles).where(eq(schema.userRoles.userId, a.id));
    await extra();
    expect(
      (
        await postJson(
          '/api/v1/me/mfa/disable',
          { password: a.password, code: regenerated.recoveryCodes[0] },
          a.cookie,
        )
      ).status,
    ).toBe(200);
    expect(await sessions(a.id)).toHaveLength(1);
    expect((await sessions(a.id))[0]!.mfaVerified).toBe(false);
  });
  it('protects enabled MFA from a stale setup and rolls back recovery/session/audit changes', async () => {
    const a = await account();
    const original = await db
      .select()
      .from(schema.mfaTotp)
      .where(eq(schema.mfaTotp.userId, a.id))
      .get();
    expect(await upsertPendingTotp(db, a.id, 'stale-setup-secret')).toHaveLength(0);
    expect(
      await db.select().from(schema.mfaTotp).where(eq(schema.mfaTotp.userId, a.id)).get(),
    ).toEqual(original);
    await db.insert(schema.sessions).values({
      id: 'rollback-device',
      handle: newId(),
      userId: a.id,
      expiresAt: new Date(Date.now() + 60000),
      idleExpiresAt: new Date(Date.now() + 60000),
      mfaVerified: true,
    });
    const previous = await db
      .select()
      .from(schema.mfaRecoveryCodes)
      .where(eq(schema.mfaRecoveryCodes.userId, a.id));
    await db.run(
      sql`CREATE TRIGGER recovery_fail BEFORE INSERT ON mfa_recovery_codes BEGIN SELECT RAISE(ABORT, 'fixture failure'); END`,
    );
    try {
      expect(
        (await postJson('/api/v1/me/mfa/recovery-codes', { code: a.codes[0] }, a.cookie)).status,
      ).toBe(500);
    } finally {
      await db.run(sql`DROP TRIGGER recovery_fail`);
    }
    expect(await sessions(a.id)).toHaveLength(2);
    expect(await history(a.id, 'auth.mfa_recovery_regenerated')).toHaveLength(0);
    const after = await db
      .select()
      .from(schema.mfaRecoveryCodes)
      .where(eq(schema.mfaRecoveryCodes.userId, a.id));
    expect(after.map((row) => row.codeHash).sort()).toEqual(
      previous.map((row) => row.codeHash).sort(),
    );
    // The submitted proof is consumed even if the later transaction fails.
    expect(after.filter((row) => row.usedAt)).toHaveLength(1);
  });
});
