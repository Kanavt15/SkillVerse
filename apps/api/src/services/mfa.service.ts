/**
 * Two-factor authentication with an authenticator app (TOTP) plus recovery codes.
 *
 * Lifecycle:
 *   1. startSetup     → new secret (stored ENCRYPTED, not active yet) + otpauth:// URI for the QR code
 *   2. enable(code)   → proves the app works; activates 2FA; returns 10 recovery codes ONCE
 *   3. at sign-in     → password OK → "pending" session → verifyPendingSession(code) → full session
 *   4. disable        → needs the password (if the account has one) AND a current code
 *
 * Protections: codes can't be replayed (last used step stored atomically);
 * 5 wrong codes kill a pending session; the session token is ROTATED after the
 * 2FA step (session-fixation defence); recovery codes are single-use and stored hashed.
 */
import { APP_NAME, STAFF_ROLES, newId } from '@skillverse/shared';
import { and, eq, sql } from 'drizzle-orm';
import { schema } from '@skillverse/db';
import type { AuthContext, PendingMfa } from '../env';
import { sha256Hex } from '../lib/crypto';
import type { RequestDeps } from '../lib/deps';
import { decrypt, encrypt } from '../lib/encryption';
import { AppError } from '../lib/errors';
import { verifyPassword } from '../lib/password';
import { base32Encode, newTotpSecret, otpauthUri, verifyTotp } from '../lib/totp';
import {
  claimTotpStep,
  countUnusedRecoveryCodes,
  findTotp,
  redeemRecoveryCode,
  upsertPendingTotp,
} from '../repositories/mfa.repository';
import { deleteSession, incrementMfaAttempts } from '../repositories/sessions.repository';
import { findUserById, findUserForLogin } from '../repositories/users.repository';
import { auditInsert } from './audit.service';
import { createSession, type NewSession } from './session.service';

export const MAX_MFA_ATTEMPTS = 5;
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I lookalikes

/** "abcde-fghjk" → "ABCDEFGHJK": what users type is forgiving; what we hash is canonical. */
export function normaliseCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

function newRecoveryCode(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

/** Codes, factor changes, session review and audit commit together. */
async function saveRecoveryCodes(
  d: RequestDeps,
  auth: AuthContext,
  action: 'enable' | 'regenerate',
  factor: { secretEncrypted: string; step: number } | null,
): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
  const hashes = await Promise.all(codes.map((c) => sha256Hex(normaliseCode(c))));
  const { mfaTotp, mfaRecoveryCodes, sessions, auditLogs, users } = schema;
  const id = newId(),
    now = Date.now();
  const guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE id = ${id})`;
  const eligible = sql`EXISTS (SELECT 1 FROM ${sessions} JOIN ${users} ON ${users.id} = ${sessions.userId} WHERE ${sessions.id} = ${auth.session.tokenHash} AND ${sessions.userId} = ${auth.user.id} AND ${sessions.expiresAt} > ${now} AND ${sessions.idleExpiresAt} > ${now} AND ${users.status} = 'active')`;
  const factorCheck = factor
    ? sql`${mfaTotp.enabledAt} IS NULL AND ${mfaTotp.secretEncrypted} = ${factor.secretEncrypted}`
    : sql`${mfaTotp.enabledAt} IS NOT NULL`;
  const result = await d.db.batch([
    d.db
      .insert(auditLogs)
      .select(
        sql`SELECT ${id}, ${auth.user.id}, ${action === 'enable' ? 'auth.mfa_enabled' : 'auth.mfa_recovery_regenerated'}, 'user', ${auth.user.id}, '{}', NULL, ${d.requestId}, ${now} FROM ${mfaTotp} WHERE ${mfaTotp.userId} = ${auth.user.id} AND ${factorCheck} AND ${eligible}`,
      )
      .returning({ id: auditLogs.id }),
    d.db
      .update(mfaTotp)
      .set(
        factor
          ? { enabledAt: new Date(now), lastUsedStep: factor.step }
          : { enabledAt: sql`${mfaTotp.enabledAt}` },
      )
      .where(and(eq(mfaTotp.userId, auth.user.id), guard)),
    d.db.delete(mfaRecoveryCodes).where(and(eq(mfaRecoveryCodes.userId, auth.user.id), guard)),
    ...hashes.map((hash) =>
      d.db
        .insert(mfaRecoveryCodes)
        .select(sql`SELECT ${newId()}, ${auth.user.id}, ${hash}, NULL, ${now} WHERE ${guard}`),
    ),
    d.db
      .delete(sessions)
      .where(
        and(
          eq(sessions.userId, auth.user.id),
          sql`${sessions.id} <> ${auth.session.tokenHash}`,
          guard,
        ),
      ),
    d.db
      .update(sessions)
      .set({ mfaVerified: true, stepUpNonce: null, stepUpAt: null })
      .where(and(eq(sessions.id, auth.session.tokenHash), guard)),
  ]);
  if (!result[0].length)
    throw new AppError('CONFLICT', 'Your security state changed. Sign in and review it again.');
  return codes;
}

/**
 * Checks a 6-digit app code or a recovery code for an account with 2FA enabled.
 * Consumes the code (step or recovery code) on success.
 */
export async function verifySecondFactor(
  d: RequestDeps,
  userId: string,
  rawCode: string,
): Promise<'totp' | 'recovery' | null> {
  const code = normaliseCode(rawCode);
  const totp = await findTotp(d.db, userId);
  if (!totp?.enabledAt) return null;

  if (/^\d{6}$/.test(code)) {
    const secret = await decrypt(totp.secretEncrypted, d.env.MFA_ENCRYPTION_KEY);
    const step = await verifyTotp(secret, code, { lastUsedStep: totp.lastUsedStep });
    if (step !== null && (await claimTotpStep(d.db, userId, step))) return 'totp';
    return null;
  }
  if (/^[A-Z0-9]{10}$/.test(code)) {
    return (await redeemRecoveryCode(d.db, userId, await sha256Hex(code))) ? 'recovery' : null;
  }
  return null;
}

// ─── Status & setup ──────────────────────────────────────────────────────────

export async function getStatus(d: RequestDeps, userId: string) {
  const totp = await findTotp(d.db, userId);
  return {
    enabled: Boolean(totp?.enabledAt),
    recoveryCodesRemaining: totp?.enabledAt ? await countUnusedRecoveryCodes(d.db, userId) : 0,
  };
}

export async function startSetup(d: RequestDeps, auth: AuthContext) {
  const existing = await findTotp(d.db, auth.user.id);
  if (existing?.enabledAt) {
    throw new AppError(
      'CONFLICT',
      'Two-factor authentication is already on. Turn it off first to switch apps.',
    );
  }
  const secret = newTotpSecret();
  const saved = await upsertPendingTotp(
    d.db,
    auth.user.id,
    await encrypt(secret, d.env.MFA_ENCRYPTION_KEY),
  );
  if (!saved.length)
    throw new AppError(
      'CONFLICT',
      'MFA became enabled while setup was starting. Refresh your security settings.',
    );
  const secretBase32 = base32Encode(secret);
  return { secret: secretBase32, otpauthUrl: otpauthUri(APP_NAME, auth.user.email, secretBase32) };
}

/** Confirms setup with a code from the app. Returns the recovery codes (shown once). */
export async function enable(
  d: RequestDeps,
  auth: AuthContext,
  rawCode: string,
): Promise<string[]> {
  const totp = await findTotp(d.db, auth.user.id);
  if (!totp) throw new AppError('CONFLICT', 'Start setup first.');
  if (totp.enabledAt) throw new AppError('CONFLICT', 'Two-factor authentication is already on.');

  const secret = await decrypt(totp.secretEncrypted, d.env.MFA_ENCRYPTION_KEY);
  const step = await verifyTotp(secret, normaliseCode(rawCode));
  if (step === null) {
    throw new AppError('VALIDATION_FAILED', 'That code is not right.', {
      code: ["That code didn't match. Check your phone's clock and try the newest code."],
    });
  }

  return saveRecoveryCodes(d, auth, 'enable', { secretEncrypted: totp.secretEncrypted, step });
}

// ─── Sign-in challenge ───────────────────────────────────────────────────────

/**
 * Completes sign-in for a pending session. On success the pending session is
 * deleted and a NEW, fully verified session is created (token rotation).
 */
export async function verifyPendingSession(
  d: RequestDeps,
  pending: PendingMfa,
  rawCode: string,
): Promise<NewSession> {
  if (pending.attempts >= MAX_MFA_ATTEMPTS) {
    await deleteSession(d.db, pending.tokenHash);
    throw new AppError('UNAUTHENTICATED', 'Too many wrong codes. Please sign in again.');
  }

  const factor = await verifySecondFactor(d, pending.userId, rawCode);
  if (!factor) {
    const attempts = await incrementMfaAttempts(d.db, pending.tokenHash);
    await auditInsert(d.db, {
      action: 'auth.mfa_failed',
      targetType: 'user',
      targetId: pending.userId,
      metadata: { attempt: attempts },
      requestId: d.requestId,
    });
    if (attempts >= MAX_MFA_ATTEMPTS) {
      await deleteSession(d.db, pending.tokenHash);
      throw new AppError('UNAUTHENTICATED', 'Too many wrong codes. Please sign in again.');
    }
    throw new AppError('VALIDATION_FAILED', 'That code is not right.', {
      code: ['That code is not right. Try the newest code from your app, or a recovery code.'],
    });
  }

  await d.db.batch([
    deleteSession(d.db, pending.tokenHash),
    auditInsert(d.db, {
      action: 'auth.mfa_passed',
      actorUserId: pending.userId,
      targetType: 'user',
      targetId: pending.userId,
      metadata: { factor },
      requestId: d.requestId,
    }),
  ]);
  return createSession(d.db, {
    userId: pending.userId,
    ip: d.ip,
    userAgent: d.userAgent,
    ipSalt: d.env.IP_HASH_SALT,
    mfaVerified: true,
  });
}

// ─── Disable & recovery codes ────────────────────────────────────────────────

async function requirePasswordIfSet(d: RequestDeps, userId: string, password: string | undefined) {
  const user = await findUserById(d.db, userId);
  const withHash = user ? await findUserForLogin(d.db, user.email) : undefined;
  if (withHash?.passwordHash) {
    if (!password || !(await verifyPassword(password, withHash.passwordHash))) {
      throw new AppError('VALIDATION_FAILED', 'Your password is incorrect.', {
        password: ['Your password is incorrect.'],
      });
    }
  }
}

export async function disable(
  d: RequestDeps,
  auth: AuthContext,
  input: { password?: string; code: string },
): Promise<void> {
  if (auth.roles.some((role) => (STAFF_ROLES as readonly string[]).includes(role)))
    throw new AppError(
      'FORBIDDEN',
      'Staff must keep MFA enabled. Ask an independent super administrator to revoke staff roles first.',
    );
  await requirePasswordIfSet(d, auth.user.id, input.password);
  if (!(await verifySecondFactor(d, auth.user.id, input.code))) {
    throw new AppError('VALIDATION_FAILED', 'That code is not right.', {
      code: ['That code is not right.'],
    });
  }
  const { mfaTotp, mfaRecoveryCodes, sessions, userRoles, auditLogs } = schema;
  const receiptId = newId(),
    now = Date.now();
  const eligible = sql`EXISTS (SELECT 1 FROM ${sessions} WHERE id = ${auth.session.tokenHash} AND user_id = ${auth.user.id} AND expires_at > ${now} AND idle_expires_at > ${now}) AND NOT EXISTS (SELECT 1 FROM ${userRoles} WHERE user_id = ${auth.user.id} AND role IN ('moderator', 'admin', 'super_admin'))`;
  const guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE id = ${receiptId})`;
  const result = await d.db.batch([
    d.db
      .insert(auditLogs)
      .select(
        sql`SELECT ${receiptId}, ${auth.user.id}, 'auth.mfa_disabled', 'user', ${auth.user.id}, '{}', NULL, ${d.requestId}, ${now} FROM ${mfaTotp} WHERE user_id = ${auth.user.id} AND enabled_at IS NOT NULL AND ${eligible}`,
      )
      .returning({ id: auditLogs.id }),
    d.db.delete(mfaTotp).where(and(eq(mfaTotp.userId, auth.user.id), guard)),
    d.db.delete(mfaRecoveryCodes).where(and(eq(mfaRecoveryCodes.userId, auth.user.id), guard)),
    d.db
      .delete(sessions)
      .where(
        and(
          eq(sessions.userId, auth.user.id),
          sql`${sessions.id} <> ${auth.session.tokenHash}`,
          guard,
        ),
      ),
    d.db
      .update(sessions)
      .set({ mfaVerified: false, stepUpNonce: null, stepUpAt: null })
      .where(and(eq(sessions.id, auth.session.tokenHash), guard)),
  ]);
  if (!result[0].length)
    throw new AppError(
      'CONFLICT',
      'Your account became staff or your security state changed. MFA was not disabled.',
    );
}

export async function regenerateRecoveryCodes(
  d: RequestDeps,
  auth: AuthContext,
  code: string,
): Promise<string[]> {
  if (!(await verifySecondFactor(d, auth.user.id, code))) {
    throw new AppError('VALIDATION_FAILED', 'That code is not right.', {
      code: ['That code is not right.'],
    });
  }
  return saveRecoveryCodes(d, auth, 'regenerate', null);
}
