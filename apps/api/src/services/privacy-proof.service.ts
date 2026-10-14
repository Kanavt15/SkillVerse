/** Fresh owner proof for privacy rights; OAuth-only owners need MFA before destructive actions. */
import { and, eq, gt, sql } from 'drizzle-orm';
import { schema } from '@skillverse/db';
import type { AuthContext } from '../env';
import type { RequestDeps } from '../lib/deps';
import { randomToken } from '../lib/crypto';
import { AppError } from '../lib/errors';
import { verifyPassword } from '../lib/password';
import { verifySecondFactor } from './mfa.service';
import { auditInsert } from './audit.service';
import { deleteSession, incrementMfaAttempts } from '../repositories/sessions.repository';
export async function ownerProof(
  d: RequestDeps,
  auth: AuthContext,
  input: { password?: string; code?: string },
) {
  const { users, sessions, mfaTotp } = schema;
  const actor = await d.db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(and(eq(users.id, auth.user.id), eq(users.status, 'active')))
    .get();
  if (!actor || !auth.user.emailVerified)
    throw new AppError('FORBIDDEN', 'Verify your email before using privacy controls.');
  const credential = await d.db
    .select()
    .from(sessions)
    .where(eq(sessions.id, auth.session.tokenHash))
    .get();
  if (!credential || credential.mfaAttempts >= 5)
    throw new AppError('UNAUTHENTICATED', 'Sign in again before continuing.');
  const passwordCorrect =
    !actor.passwordHash ||
    Boolean(input.password && (await verifyPassword(input.password, actor.passwordHash)));
  const factor = await d.db.select().from(mfaTotp).where(eq(mfaTotp.userId, auth.user.id)).get();
  if (!actor.passwordHash && !factor?.enabledAt)
    throw new AppError(
      'MFA_SETUP_REQUIRED',
      'Enable MFA in Security settings to verify an account without a password.',
    );
  const factorCorrect =
    passwordCorrect &&
    (!factor?.enabledAt ||
      Boolean(
        auth.session.mfaVerified &&
        input.code &&
        (await verifySecondFactor(d, auth.user.id, input.code)),
      ));
  if (!passwordCorrect || !factorCorrect) {
    const attempts = await incrementMfaAttempts(d.db, auth.session.tokenHash);
    await auditInsert(d.db, {
      action: 'privacy.step_up_failed',
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
      'Confirm your current password and, when enabled, a fresh security code.',
      { password: ['The security check did not pass.'] },
    );
  }
  const nonce = randomToken(),
    now = Date.now();
  const security = sql`EXISTS (SELECT 1 FROM ${users} WHERE id = ${auth.user.id} AND status = 'active' AND email_verified_at IS NOT NULL AND password_hash IS ${actor.passwordHash})
    AND (${factor?.enabledAt ? 1 : 0} = 0 AND NOT EXISTS (SELECT 1 FROM ${mfaTotp} WHERE user_id = ${auth.user.id} AND enabled_at IS NOT NULL)
    OR ${factor?.enabledAt ? 1 : 0} = 1 AND EXISTS (SELECT 1 FROM ${mfaTotp} WHERE user_id = ${auth.user.id} AND enabled_at IS NOT NULL AND secret_encrypted = ${factor?.secretEncrypted ?? ''}) AND ${sessions.mfaVerified} = 1)`;
  const saved = await d.db
    .update(sessions)
    .set({
      stepUpNonce: nonce,
      stepUpAt: new Date(now),
      privacyAccessUntil: new Date(now + 600000),
      mfaAttempts: 0,
    })
    .where(
      and(
        eq(sessions.id, auth.session.tokenHash),
        eq(sessions.userId, auth.user.id),
        gt(sessions.expiresAt, new Date(now)),
        gt(sessions.idleExpiresAt, new Date(now)),
        security,
      ),
    )
    .returning({ id: sessions.id });
  if (!saved.length) throw new AppError('CONFLICT', 'Your security state changed. Sign in again.');
  return {
    nonce,
    passwordHash: actor.passwordHash,
    factorSecret: factor?.enabledAt ? factor.secretEncrypted : null,
  };
}
export type OwnerProof = Awaited<ReturnType<typeof ownerProof>>;
export function ownerAuthority(auth: AuthContext, proof: OwnerProof, now: number) {
  return sql`EXISTS (SELECT 1 FROM users AS owner JOIN sessions AS credential ON credential.user_id = owner.id
    WHERE owner.id = ${auth.user.id} AND owner.status = 'active' AND owner.email_verified_at IS NOT NULL AND owner.password_hash IS ${proof.passwordHash}
    AND credential.id = ${auth.session.tokenHash} AND credential.expires_at > ${now} AND credential.idle_expires_at > ${now}
    AND credential.step_up_nonce = ${proof.nonce} AND credential.step_up_at > ${now - 60000}
    AND (${proof.factorSecret === null ? 1 : 0} = 1 AND NOT EXISTS (SELECT 1 FROM mfa_totp WHERE user_id = owner.id AND enabled_at IS NOT NULL)
    OR ${proof.factorSecret === null ? 0 : 1} = 1 AND credential.mfa_verified = 1 AND EXISTS (SELECT 1 FROM mfa_totp WHERE user_id = owner.id AND enabled_at IS NOT NULL AND secret_encrypted = ${proof.factorSecret})))`;
}
