/** Setu DigiLocker: authenticated server reads, never callback claims or browser-supplied receipts. */
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { schema } from '@skillverse/db';
import { ageOn, birthCutoff, birthDateSchema, POLICY_VERSION, newId } from '@skillverse/shared';
import type { AuthContext } from '../env';
import { appBaseUrl, type RequestDeps } from '../lib/deps';
import { AppError } from '../lib/errors';
import { randomToken, sha256Hex } from '../lib/crypto';
import { ownerAuthority, ownerProof } from './privacy-proof.service';
import { eligibleAccount } from '../repositories/consent.repository';

const {
  guardianRequests: requests,
  guardianVerifications: attempts,
  accountPrivacy: privacy,
  auditLogs,
  sessions,
} = schema;
export const requestSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['unauthenticated', 'authenticated', 'revoked']),
  url: z.string().url(),
  validUpto: z.string().datetime({ offset: true }),
});
export const resultSchema = z.object({
  id: z.string().uuid(),
  status: z.literal('complete'),
  aadhaar: z.object({
    name: z.string().min(2),
    dateOfBirth: z.string(),
    verified: z.object({ signature: z.literal(true) }),
  }),
});
function configured(env: Env) {
  if (
    !env.SETU_CLIENT_ID ||
    !env.SETU_CLIENT_SECRET ||
    !env.SETU_PRODUCT_INSTANCE_ID ||
    !['sandbox', 'production'].includes(env.SETU_ENVIRONMENT ?? '') ||
    (env.ENVIRONMENT === 'production' && env.SETU_ENVIRONMENT !== 'production')
  )
    throw new AppError(
      'FORBIDDEN',
      'Guardian verification is not configured. Use Contact to request help.',
    );
}
export async function provider(d: RequestDeps, path: string, body?: unknown): Promise<unknown> {
  configured(d.env);
  const origin =
    d.env.SETU_ENVIRONMENT === 'production' ? 'https://dg.setu.co' : 'https://dg-sandbox.setu.co';
  try {
    const response = await fetch(`${origin}/api/digilocker/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'x-client-id': d.env.SETU_CLIENT_ID!,
        'x-client-secret': d.env.SETU_CLIENT_SECRET!,
        'x-product-instance-id': d.env.SETU_PRODUCT_INSTANCE_ID!,
        'content-type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 404 && path.endsWith('/revoke')) return { success: true }; // Expired/unknown requests cannot authorize document access.
    if (!response.ok) throw new Error('Provider unavailable');
    // Never log identity data, URLs, credentials, or upstream error bodies.
    return await response.json();
  } catch {
    throw new AppError('CONFLICT', 'DigiLocker could not complete this check. Try again later.');
  }
}
export function safeUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !['setu.co', 'digilocker.gov.in', 'meripehchaan.gov.in'].some(
      (domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    )
  )
    throw new AppError('CONFLICT', 'DigiLocker returned an unexpected sign-in link.');
  return url.href;
}
export const normalized = (value: string) =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN');

export async function start(
  d: RequestDeps,
  auth: AuthContext,
  id: string,
  input: { version: number; password?: string; code?: string },
) {
  configured(d.env);
  const proof = await ownerProof(d, auth, input),
    state = randomToken(),
    nonce = `pending:${newId()}`,
    now = Date.now();
  const owner = sql`EXISTS (SELECT 1 FROM ${requests} WHERE id = ${id} AND guardian_user_id = ${auth.user.id} AND status = 'pending' AND version = ${input.version} AND consent_version = ${POLICY_VERSION}) AND ${eligibleAccount(auth.user.id)} AND EXISTS (SELECT 1 FROM account_privacy WHERE user_id = ${auth.user.id} AND birth_date <= ${birthCutoff(18)}) AND ${ownerAuthority(auth, proof, now)}`;
  const saved = await d.db
    .insert(attempts)
    .select(
      sql`SELECT ${id}, ${nonce}, ${auth.session.tokenHash}, ${await sha256Hex(state)}, ${now + 120000}, NULL, NULL, ${now} WHERE ${owner}`,
    )
    .onConflictDoUpdate({
      target: attempts.requestId,
      set: {
        providerId: nonce,
        sessionHash: auth.session.tokenHash,
        stateHash: await sha256Hex(state),
        expiresAt: new Date(now + 120000),
        createdAt: new Date(now),
      },
      setWhere: sql`${owner} AND ${attempts.verifiedAt} IS NULL AND ${attempts.expiresAt} < ${now}`,
    })
    .returning({ id: attempts.requestId });
  if (!saved.length)
    throw new AppError(
      'CONFLICT',
      'A verification attempt is still active, or consent/security changed.',
    );
  const redirectUrl = new URL('/settings/guardians', appBaseUrl(d.env));
  redirectUrl.searchParams.set('request', id);
  redirectUrl.searchParams.set('state', state);
  let result: z.infer<typeof requestSchema>;
  try {
    result = requestSchema.parse(await provider(d, '', { redirectUrl: redirectUrl.href }));
    safeUrl(result.url);
  } catch {
    throw new AppError(
      'CONFLICT',
      'Could not start DigiLocker. Wait two minutes before trying again.',
    );
  }
  const expires = Math.min(Date.parse(result.validUpto), now + 30 * 60000);
  if (expires <= now || result.status !== 'unauthenticated')
    throw new AppError('CONFLICT', 'DigiLocker returned an expired request.');
  const updated = await d.db
    .update(attempts)
    .set({ providerId: result.id, expiresAt: new Date(expires) })
    .where(and(eq(attempts.requestId, id), eq(attempts.providerId, nonce), owner))
    .returning({ id: attempts.requestId });
  if (!updated.length) {
    d.waitUntil(provider(d, `${result.id}/revoke`).catch(() => undefined));
    throw new AppError('CONFLICT', 'Consent or security changed. Start again.');
  }
  return { url: safeUrl(result.url), expiresAt: new Date(expires).toISOString() };
}
export async function finish(
  d: RequestDeps,
  auth: AuthContext,
  id: string,
  input: { version: number; state: string; legalName: string; password?: string; code?: string },
) {
  const attempt = await d.db.select().from(attempts).where(eq(attempts.requestId, id)).get();
  const target = await d.db
    .select()
    .from(requests)
    .where(and(eq(requests.id, id), eq(requests.guardianUserId, auth.user.id)))
    .get();
  const profile = await d.db.select().from(privacy).where(eq(privacy.userId, auth.user.id)).get();
  if (
    !target ||
    !attempt ||
    attempt.sessionHash !== auth.session.tokenHash ||
    attempt.stateHash !== (await sha256Hex(input.state)) ||
    attempt.verifiedAt ||
    attempt.expiresAt.getTime() <= Date.now() ||
    target.status !== 'pending' ||
    target.version !== input.version ||
    !profile?.birthDate
  )
    throw new AppError('CONFLICT', 'This verification attempt is invalid or expired.');
  const proof = await ownerProof(d, auth, input);
  const status = requestSchema.safeParse(await provider(d, `${attempt.providerId}/status`));
  if (
    !status.success ||
    status.data.id !== attempt.providerId ||
    status.data.status !== 'authenticated' ||
    Date.parse(status.data.validUpto) <= Date.now()
  )
    throw new AppError(
      'CONFLICT',
      'Finish DigiLocker sign-in and share your identity document before confirming.',
    );
  const identity = resultSchema.safeParse(await provider(d, `${attempt.providerId}/aadhaar`));
  // Fetch is consented; raw identity exists only within this request. Revoke provider access afterwards.
  d.waitUntil(
    provider(d, `${attempt.providerId}/revoke`)
      .then(async (response) => {
        if (!z.object({ success: z.literal(true) }).safeParse(response).success)
          throw new Error('Revocation pending');
        await d.db
          .update(attempts)
          .set({ revokedAt: new Date() })
          .where(and(eq(attempts.requestId, id), eq(attempts.providerId, attempt.providerId)));
      })
      .catch(() => {
        d.log.warn('privacy.provider_revoke_pending', { requestId: id });
      }),
  );
  await d.db
    .update(attempts)
    .set({ expiresAt: new Date() })
    .where(and(eq(attempts.requestId, id), eq(attempts.providerId, attempt.providerId)));
  const date = identity.success
    ? identity.data.aadhaar.dateOfBirth.split('-').reverse().join('-')
    : '';
  if (
    !identity.success ||
    identity.data.id !== attempt.providerId ||
    !birthDateSchema.safeParse(date).success ||
    ageOn(date) < 18 ||
    date !== profile.birthDate ||
    normalized(identity.data.aadhaar.name) !== normalized(input.legalName)
  )
    throw new AppError(
      'VALIDATION_FAILED',
      'Verified identity must match your private birth date and legal name, and show an age of at least 18. Start a new verification if needed.',
    );
  const now = Date.now(),
    receipt = newId(),
    guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE id = ${receipt})`;
  const saved = await d.db.batch([
    d.db
      .insert(auditLogs)
      .select(
        sql`SELECT ${receipt}, ${auth.user.id}, 'privacy.guardian_verified', 'guardian', ${id}, '{"provider":"setu_digilocker","adultVerified":true}', NULL, ${d.requestId}, ${now} FROM ${requests} WHERE id = ${id} AND guardian_user_id = ${auth.user.id} AND status = 'pending' AND version = ${input.version} AND consent_version = ${POLICY_VERSION} AND ${eligibleAccount(auth.user.id)} AND ${ownerAuthority(auth, proof, now)} AND EXISTS (SELECT 1 FROM ${privacy} WHERE user_id = ${auth.user.id} AND birth_date = ${date}) AND EXISTS (SELECT 1 FROM ${attempts} WHERE request_id = ${id} AND provider_id = ${attempt.providerId} AND session_hash = ${auth.session.tokenHash} AND state_hash = ${attempt.stateHash} AND verified_at IS NULL)`,
      )
      .returning({ id: auditLogs.id }),
    d.db
      .update(attempts)
      .set({ verifiedAt: new Date(now) })
      .where(and(eq(attempts.requestId, id), guard)),
    d.db
      .update(requests)
      .set({
        status: 'approved',
        identityMethod: 'setu_digilocker',
        verificationReference: receipt,
        reviewedAt: new Date(now),
        verificationValidUntil: new Date(now + 180 * 86400000),
        version: sql`${requests.version}+1`,
        updatedAt: new Date(now),
      })
      .where(and(eq(requests.id, id), guard)),
    d.db
      .update(sessions)
      .set({ stepUpNonce: null, stepUpAt: null })
      .where(and(eq(sessions.id, auth.session.tokenHash), guard)),
  ]);
  if (!saved[0].length)
    throw new AppError('CONFLICT', 'Consent or security changed during verification.');
}

/** Retry failed provider revocations without retaining the fetched document. Bounded to five. */
export async function revokePending(d: RequestDeps) {
  if (!d.env.SETU_CLIENT_ID) return;
  const rows = await d.db
    .select()
    .from(attempts)
    .where(
      sql`${attempts.revokedAt} IS NULL AND (${attempts.verifiedAt} IS NOT NULL OR ${attempts.expiresAt} < ${Date.now()})`,
    )
    .limit(1);
  for (const row of rows) {
    if (row.providerId.startsWith('pending:')) {
      await d.db
        .update(attempts)
        .set({ revokedAt: new Date() })
        .where(and(eq(attempts.requestId, row.requestId), eq(attempts.providerId, row.providerId)));
      continue;
    }
    try {
      const response = await provider(d, `${row.providerId}/revoke`);
      if (z.object({ success: z.literal(true) }).safeParse(response).success)
        await d.db
          .update(attempts)
          .set({ revokedAt: new Date() })
          .where(
            and(eq(attempts.requestId, row.requestId), eq(attempts.providerId, row.providerId)),
          );
    } catch {
      /* Provider token also expires; operational runbook records failures. */
    }
  }
}
