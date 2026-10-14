/** Teacher identity is independent of staff's teaching-quality review. Both are required. */
import { and, eq, sql } from 'drizzle-orm';
import { schema } from '@skillverse/db';
import { ageOn, birthDateSchema, newId } from '@skillverse/shared';
import type { AuthContext } from '../env';
import { appBaseUrl, type RequestDeps } from '../lib/deps';
import { AppError } from '../lib/errors';
import { randomToken, sha256Hex } from '../lib/crypto';
import { ownerAuthority, ownerProof } from './privacy-proof.service';
import { eligibleAccount } from '../repositories/consent.repository';
import { provider, requestSchema, resultSchema, safeUrl, normalized } from './setu.service';
const { teacherVerifications: attempts, accountPrivacy: privacy, auditLogs, sessions } = schema;
export async function details(d: RequestDeps, auth: AuthContext) {
  const row = await d.db.select().from(attempts).where(eq(attempts.userId, auth.user.id)).get();
  return {
    verified: Boolean(row?.verifiedAt && row.validUntil && row.validUntil.getTime() > Date.now()),
    validUntil: row?.validUntil?.toISOString() ?? null,
  };
}
export async function start(
  d: RequestDeps,
  auth: AuthContext,
  input: { password?: string; code?: string },
) {
  const proof = await ownerProof(d, auth, input),
    now = Date.now(),
    nonce = `pending:${newId()}`,
    state = randomToken(),
    stateHash = await sha256Hex(state),
    guard = sql`${eligibleAccount(auth.user.id, true)} AND ${ownerAuthority(auth, proof, now)}`;
  const saved = await d.db
    .insert(attempts)
    .select(
      sql`SELECT ${auth.user.id},${nonce},${auth.session.tokenHash},${stateHash},${now + 120000},NULL,NULL,NULL,${now} WHERE ${guard}`,
    )
    .onConflictDoUpdate({
      target: attempts.userId,
      set: {
        providerId: nonce,
        sessionHash: auth.session.tokenHash,
        stateHash,
        expiresAt: new Date(now + 120000),
        verifiedAt: null,
        validUntil: null,
        revokedAt: null,
        createdAt: new Date(now),
      },
      setWhere: sql`${guard} AND ${attempts.expiresAt}<${now} AND (${attempts.validUntil} IS NULL OR ${attempts.validUntil}<${now})`,
    })
    .returning({ id: attempts.userId });
  if (!saved.length)
    throw new AppError(
      'CONFLICT',
      'A teacher check is active, or identity is already verified. Teaching requires current Instructor Terms and, under 18, guardian teaching permission.',
    );
  const redirectUrl = new URL('/settings/teacher-verification', appBaseUrl(d.env));
  redirectUrl.searchParams.set('state', state);
  const result = requestSchema.safeParse(await provider(d, '', { redirectUrl: redirectUrl.href }));
  if (
    !result.success ||
    result.data.status !== 'unauthenticated' ||
    Date.parse(result.data.validUpto) <= now
  )
    throw new AppError(
      'CONFLICT',
      'DigiLocker could not start this check. Wait two minutes before retrying.',
    );
  const url = safeUrl(result.data.url),
    expires = Math.min(Date.parse(result.data.validUpto), now + 30 * 60000);
  const updated = await d.db
    .update(attempts)
    .set({ providerId: result.data.id, expiresAt: new Date(expires) })
    .where(and(eq(attempts.userId, auth.user.id), eq(attempts.providerId, nonce), guard))
    .returning({ id: attempts.userId });
  if (!updated.length) {
    d.waitUntil(provider(d, `${result.data.id}/revoke`).catch(() => undefined));
    throw new AppError('CONFLICT', 'Consent or account security changed.');
  }
  return { url };
}
export async function finish(
  d: RequestDeps,
  auth: AuthContext,
  input: { state: string; legalName: string; password?: string; code?: string },
) {
  const attempt = await d.db.select().from(attempts).where(eq(attempts.userId, auth.user.id)).get(),
    profile = await d.db.select().from(privacy).where(eq(privacy.userId, auth.user.id)).get();
  if (
    !attempt ||
    attempt.verifiedAt ||
    attempt.expiresAt.getTime() <= Date.now() ||
    attempt.sessionHash !== auth.session.tokenHash ||
    attempt.stateHash !== (await sha256Hex(input.state)) ||
    !profile?.birthDate
  )
    throw new AppError('CONFLICT', 'This teacher verification attempt is invalid or expired.');
  const proof = await ownerProof(d, auth, input),
    status = requestSchema.safeParse(await provider(d, `${attempt.providerId}/status`));
  if (
    !status.success ||
    status.data.id !== attempt.providerId ||
    status.data.status !== 'authenticated' ||
    Date.parse(status.data.validUpto) <= Date.now()
  )
    throw new AppError('CONFLICT', 'Finish DigiLocker consent before confirming.');
  const identity = resultSchema.safeParse(await provider(d, `${attempt.providerId}/aadhaar`));
  d.waitUntil(
    provider(d, `${attempt.providerId}/revoke`)
      .then(async (response) => {
        if ((response as { success?: boolean }).success !== true) throw new Error('Revoke pending');
        await d.db
          .update(attempts)
          .set({ revokedAt: new Date() })
          .where(
            and(eq(attempts.userId, auth.user.id), eq(attempts.providerId, attempt.providerId)),
          );
      })
      .catch(() => {
        d.log.warn('privacy.teacher_provider_revoke_pending', { userId: auth.user.id });
      }),
  );
  await d.db
    .update(attempts)
    .set({ expiresAt: new Date() })
    .where(and(eq(attempts.userId, auth.user.id), eq(attempts.providerId, attempt.providerId)));
  const date = identity.success
    ? identity.data.aadhaar.dateOfBirth.split('-').reverse().join('-')
    : '';
  if (
    !identity.success ||
    identity.data.id !== attempt.providerId ||
    !birthDateSchema.safeParse(date).success ||
    ageOn(date) < 16 ||
    date !== profile.birthDate ||
    normalized(identity.data.aadhaar.name) !== normalized(input.legalName)
  )
    throw new AppError(
      'VALIDATION_FAILED',
      'Teacher identity must match your private birth date and legal name and show age 16+. Start a new check if needed.',
    );
  const now = Date.now(),
    receipt = newId(),
    guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE id=${receipt})`;
  const saved = await d.db.batch([
    d.db
      .insert(auditLogs)
      .select(
        sql`SELECT ${receipt},${auth.user.id},'privacy.teacher_verified','user',${auth.user.id},'{"provider":"setu_digilocker","teachingAgeVerified":true}',NULL,${d.requestId},${now} WHERE ${eligibleAccount(auth.user.id, true)} AND ${ownerAuthority(auth, proof, now)} AND EXISTS (SELECT 1 FROM ${privacy} WHERE user_id=${auth.user.id} AND birth_date=${date}) AND EXISTS (SELECT 1 FROM ${attempts} WHERE user_id=${auth.user.id} AND provider_id=${attempt.providerId} AND state_hash=${attempt.stateHash} AND verified_at IS NULL)`,
      )
      .returning({ id: auditLogs.id }),
    d.db
      .update(attempts)
      .set({ verifiedAt: new Date(now), validUntil: new Date(now + 180 * 86400000) })
      .where(and(eq(attempts.userId, auth.user.id), guard)),
    d.db
      .update(sessions)
      .set({ stepUpNonce: null, stepUpAt: null })
      .where(and(eq(sessions.id, auth.session.tokenHash), guard)),
  ]);
  if (!saved[0].length)
    throw new AppError('CONFLICT', 'Teaching permission or security changed during verification.');
}
export async function revokePending(d: RequestDeps) {
  if (!d.env.SETU_CLIENT_ID) return;
  const rows = await d.db
    .select()
    .from(attempts)
    .where(
      sql`${attempts.revokedAt} IS NULL AND (${attempts.verifiedAt} IS NOT NULL OR ${attempts.expiresAt}<${Date.now()})`,
    )
    .limit(1);
  for (const row of rows) {
    if (row.providerId.startsWith('pending:')) {
      await d.db
        .update(attempts)
        .set({ revokedAt: new Date() })
        .where(and(eq(attempts.userId, row.userId), eq(attempts.providerId, row.providerId)));
      continue;
    }
    try {
      const response = await provider(d, `${row.providerId}/revoke`);
      if ((response as { success?: boolean }).success === true)
        await d.db
          .update(attempts)
          .set({ revokedAt: new Date() })
          .where(and(eq(attempts.userId, row.userId), eq(attempts.providerId, row.providerId)));
    } catch {
      /* bounded retry next maintenance */
    }
  }
}
