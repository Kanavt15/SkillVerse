import { eq, and, gt, sql } from 'drizzle-orm';
import { schema } from '@skillverse/db';
import {
  OPERATION_SETTING_RULES,
  type StaffRoleDecision,
  type StaffFlagDecision,
  type StaffSettingDecision,
  type StaffAuditQuery,
} from '@skillverse/shared';
import type { AuthContext } from '../env';
import type { RequestDeps } from '../lib/deps';
import { AppError } from '../lib/errors';
import { randomToken } from '../lib/crypto';
import { verifyPassword } from '../lib/password';
import { verifySecondFactor } from './mfa.service';
import { deleteSession, incrementMfaAttempts } from '../repositories/sessions.repository';
import { findUserForLogin } from '../repositories/users.repository';
import { findUser } from '../repositories/admin.repository';
import * as repository from '../repositories/staff-controls.repository';
import { clearFeatureCache } from './feature-flags.service';
import { auditInsert } from './audit.service';
import { clearOperationalSettingsCache } from './operational.service';

function requireAdmin(auth: AuthContext, write = false) {
  if (
    !(write
      ? auth.roles.includes('super_admin')
      : auth.roles.some((role) => role === 'admin' || role === 'super_admin'))
  )
    throw new AppError(
      'FORBIDDEN',
      write
        ? 'Only super administrators can change privileged access and platform controls.'
        : 'Administrator access required.',
    );
}

/** A fresh factor is consumed, then a short-lived nonce is stored on this session only. */
export async function verifyStaffAction(
  d: RequestDeps,
  auth: AuthContext,
  input: { password?: string; code: string },
) {
  requireAdmin(auth, true);
  if (!auth.user.mfaEnabled || !auth.session.mfaVerified)
    throw new AppError(
      'MFA_SETUP_REQUIRED',
      'Enable and verify MFA before changing privileged controls.',
    );
  const { users, sessions, mfaTotp } = schema;
  const [credential, actor] = await Promise.all([
    d.db.select().from(sessions).where(eq(sessions.id, auth.session.tokenHash)).get(),
    findUserForLogin(d.db, auth.user.email),
  ]);
  if (!credential || !actor || credential.mfaAttempts >= 5) {
    await deleteSession(d.db, auth.session.tokenHash);
    throw new AppError('UNAUTHENTICATED', 'Sign in again before trying another privileged action.');
  }
  const correctPassword =
    !actor.passwordHash ||
    Boolean(input.password && (await verifyPassword(input.password, actor.passwordHash)));
  if (!correctPassword || !(await verifySecondFactor(d, auth.user.id, input.code))) {
    const attempts = await incrementMfaAttempts(d.db, auth.session.tokenHash);
    await auditInsert(d.db, {
      action: 'admin.step_up_failed',
      actorUserId: auth.user.id,
      targetType: 'user',
      targetId: auth.user.id,
      requestId: d.requestId,
    });
    if (attempts >= 5) {
      await deleteSession(d.db, auth.session.tokenHash);
      throw new AppError('UNAUTHENTICATED', 'Too many failed checks. Sign in again.');
    }
    throw new AppError(
      'VALIDATION_FAILED',
      'Confirm your password and a fresh authenticator or unused recovery code.',
      { code: ['The security check did not pass.'] },
    );
  }
  const nonce = randomToken(),
    now = Date.now();
  const saved = await d.db
    .update(sessions)
    .set({ stepUpNonce: nonce, stepUpAt: new Date(now), mfaAttempts: 0 })
    .where(
      and(
        eq(sessions.id, auth.session.tokenHash),
        eq(sessions.userId, auth.user.id),
        gt(sessions.expiresAt, new Date(now)),
        gt(sessions.idleExpiresAt, new Date(now)),
        sql`EXISTS (SELECT 1 FROM ${users} WHERE id = ${auth.user.id} AND status = 'active') AND EXISTS (SELECT 1 FROM ${mfaTotp} WHERE user_id = ${auth.user.id} AND enabled_at IS NOT NULL)`,
      ),
    )
    .returning({ id: sessions.id });
  if (!saved.length) throw new AppError('CONFLICT', 'Your security state changed. Sign in again.');
  return nonce;
}

export async function decideRole(
  d: RequestDeps,
  auth: AuthContext,
  userId: string,
  input: StaffRoleDecision,
) {
  requireAdmin(auth, true);
  if (userId === auth.user.id)
    throw new AppError(
      'FORBIDDEN',
      'Your own privileged roles are protected. Ask an independent super administrator.',
    );
  const target = await findUser(d.db, userId, Date.now());
  if (!target) throw new AppError('NOT_FOUND', 'Account not found.');
  if (target.status === 'deleted')
    throw new AppError('FORBIDDEN', 'Deleted accounts are protected.');
  if (target.adminVersion !== input.version)
    throw new AppError('CONFLICT', 'The account changed. Refresh before confirming.');
  const nonce = await verifyStaffAction(d, auth, input);
  if (!(await repository.decideRole(d.db, auth, userId, input, nonce, d.requestId)))
    throw new AppError(
      'CONFLICT',
      'Access, MFA, role or account version changed, or the last administrator is protected. Refresh and review again.',
    );
}

export async function controls(d: RequestDeps, auth: AuthContext) {
  requireAdmin(auth);
  const [settings, flags] = await repository.configuration(d.db);
  return {
    canWrite: auth.roles.includes('super_admin'),
    settings: Object.entries(OPERATION_SETTING_RULES).map(([key, rule]) => {
      const row = settings.find((row) => row.key === key);
      let value: unknown = rule.default;
      try {
        value = row ? JSON.parse(row.value) : rule.default;
      } catch {
        /* Fall back to validated defaults. */
      }
      return {
        key: key as keyof typeof OPERATION_SETTING_RULES,
        label: rule.label,
        min: rule.min,
        max: rule.max,
        value:
          typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= rule.min &&
          value <= rule.max
            ? value
            : rule.default,
        version: row?.version ?? 0,
      };
    }),
    flags: flags.map((row) => ({
      key: row.key,
      enabled: row.enabled,
      rolloutPercent: row.rolloutPercent,
      version: row.version,
      editable: row.key === 'auth.google',
      label: row.key === 'auth.google' ? 'Google sign-in' : 'Protected: feature not available yet',
    })),
    telemetryEnabled: d.env.OPERATIONS_TELEMETRY === 'on',
    alertDeliveryConfigured: Boolean(d.env.OPS_ALERT_WEBHOOK_URL),
  };
}
export async function decideSetting(
  d: RequestDeps,
  auth: AuthContext,
  input: StaffSettingDecision,
) {
  const nonce = await verifyStaffAction(d, auth, input);
  if (!(await repository.decideSetting(d.db, auth, input, nonce, d.requestId)))
    throw new AppError(
      'CONFLICT',
      'The setting or your authority changed. Refresh before confirming.',
    );
  clearOperationalSettingsCache();
}
export async function decideFlag(d: RequestDeps, auth: AuthContext, input: StaffFlagDecision) {
  requireAdmin(auth, true);
  if (input.enabled && (!d.env.GOOGLE_CLIENT_ID || !d.env.GOOGLE_CLIENT_SECRET))
    throw new AppError('CONFLICT', 'Configure the Google OAuth provider before enabling sign-in.');
  const nonce = await verifyStaffAction(d, auth, input);
  if (!(await repository.decideFlag(d.db, auth, input, nonce, d.requestId)))
    throw new AppError(
      'CONFLICT',
      'The flag or your authority changed. Refresh before confirming.',
    );
  clearFeatureCache();
}
export async function audit(d: RequestDeps, auth: AuthContext, query: StaffAuditQuery) {
  requireAdmin(auth);
  const rows = await repository.auditPage(d.db, query),
    page = rows.slice(0, 50),
    last = page.at(-1);
  return {
    items: page.map(({ metadata, createdAt, ...row }) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(metadata) as Record<string, unknown>;
      } catch {
        /* Old imported entries are not trusted. */
      }
      return {
        ...row,
        notes: typeof parsed?.notes === 'string' ? parsed.notes.slice(0, 2000) : '',
        summary:
          typeof parsed?.summary === 'string' && row.action.startsWith('admin.')
            ? parsed.summary.slice(0, 300)
            : '',
        createdAt: createdAt.toISOString(),
      };
    }),
    nextCursor: rows.length > 50 && last ? `${last.createdAt.getTime()}:${last.id}` : null,
  };
}
