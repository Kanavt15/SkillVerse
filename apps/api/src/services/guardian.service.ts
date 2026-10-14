/** A verified adult consents before any child identifiers are collected; Setu DigiLocker verifies adult identity. */
import { and, desc, eq, sql } from 'drizzle-orm';
import { schema } from '@skillverse/db';
import {
  ageOn,
  birthCutoff,
  POLICY_VERSION,
  newId,
  type GuardianDecision,
  type GuardianInvite,
  type GuardianView,
} from '@skillverse/shared';
import type { AuthContext } from '../env';
import type { RequestDeps } from '../lib/deps';
import { AppError } from '../lib/errors';
import { randomToken, sha256Hex } from '../lib/crypto';
import { eligibleAccount } from '../repositories/consent.repository';
import { ownerProof, ownerAuthority } from './privacy-proof.service';
import { verifyStaffAction } from './staff-controls.service';
import { superAuthority } from '../repositories/staff-controls.repository';
const {
  guardianRequests: requests,
  guardianInvitations: invitations,
  accountPrivacy: privacy,
  users,
  sessions,
  auditLogs,
} = schema;
const adult = (id: string) =>
  sql`${eligibleAccount(id)} AND EXISTS (SELECT 1 FROM ${privacy} WHERE user_id = ${id} AND birth_date <= ${birthCutoff(18)})`;
const liveSession = (auth: AuthContext, now: number) =>
  sql`EXISTS (SELECT 1 FROM ${sessions} WHERE id = ${auth.session.tokenHash} AND user_id = ${auth.user.id} AND expires_at > ${now} AND idle_expires_at > ${now})`;
function view(row: typeof requests.$inferSelect): GuardianView {
  return {
    id: row.id,
    scope: row.scope,
    status: row.status,
    version: row.version,
    reviewNotes: row.reviewNotes,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    verificationValidUntil: row.verificationValidUntil?.toISOString() ?? null,
  };
}
export async function list(d: RequestDeps, auth: AuthContext, staff = false, page = 1) {
  if (staff && !auth.roles.some((role) => role === 'admin' || role === 'super_admin'))
    throw new AppError('FORBIDDEN', 'Administrator access required.');
  const rows = await d.db
    .select({ request: requests, name: users.displayName, email: users.email })
    .from(requests)
    .innerJoin(users, eq(users.id, requests.guardianUserId))
    .where(staff ? undefined : eq(requests.guardianUserId, auth.user.id))
    .orderBy(desc(requests.createdAt), desc(requests.id))
    .limit(20)
    .offset((page - 1) * 20);
  return rows.map((row) => ({
    ...view(row.request),
    ...(staff
      ? {
          guardianUserId: row.request.guardianUserId,
          guardianName: row.name,
          guardianEmail: row.email,
          identityMethod: row.request.identityMethod,
          verificationReference: row.request.verificationReference,
        }
      : {}),
  }));
}
export async function requestConsent(
  d: RequestDeps,
  auth: AuthContext,
  scope: 'learning' | 'teaching',
) {
  const id = newId(),
    now = Date.now();
  const insert = d.db
    .insert(requests)
    .select(
      sql`SELECT ${id}, ${auth.user.id}, ${scope}, 'pending', ${POLICY_VERSION}, 0, NULL, NULL, NULL, '', NULL, NULL, ${now}, ${now}
    WHERE ${adult(auth.user.id)} AND ${liveSession(auth, now)} AND NOT EXISTS (SELECT 1 FROM ${requests} WHERE guardian_user_id = ${auth.user.id} AND status = 'pending')
    AND (SELECT count(*) FROM ${requests} WHERE guardian_user_id = ${auth.user.id} AND created_at > ${now - 86400000}) < 3`,
    )
    .returning({ id: requests.id });
  const result = await d.db.batch([
    insert,
    d.db
      .insert(auditLogs)
      .select(
        sql`SELECT ${newId()}, ${auth.user.id}, 'privacy.guardian_requested', 'guardian', ${id}, ${JSON.stringify({ scope, policyVersion: POLICY_VERSION })}, NULL, ${d.requestId}, ${now} WHERE EXISTS (SELECT 1 FROM ${requests} WHERE id = ${id})`,
      ),
  ]);
  if (!result[0].length)
    throw new AppError(
      'CONFLICT',
      'Verify an adult account and current policies first. One pending request and up to three requests per day are allowed.',
    );
  return { id };
}
export async function decide(
  d: RequestDeps,
  auth: AuthContext,
  id: string,
  input: GuardianDecision,
) {
  const target = await d.db.select().from(requests).where(eq(requests.id, id)).get();
  if (!target) throw new AppError('NOT_FOUND', 'Guardian request not found.');
  if (target.guardianUserId === auth.user.id)
    throw new AppError('FORBIDDEN', 'You cannot review your own guardian request.');
  const nonce = await verifyStaffAction(d, auth, {
    password: input.password,
    code: input.code ?? '',
  });
  const receipt = newId(),
    now = Date.now(),
    guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE id = ${receipt})`;
  const result = await d.db.batch([
    d.db
      .insert(auditLogs)
      .select(
        sql`SELECT ${receipt}, ${auth.user.id}, ${'admin.guardian_rejected'}, 'guardian', ${id}, ${JSON.stringify({ notes: input.notes, summary: 'Guardian verification rejected.' })}, NULL, ${d.requestId}, ${now} FROM ${requests} WHERE id = ${id} AND version = ${input.version} AND status = 'pending' AND guardian_user_id <> ${auth.user.id} AND ${adult(target.guardianUserId)} AND ${superAuthority(auth, nonce, now)}`,
      )
      .returning({ id: auditLogs.id }),
    d.db
      .update(requests)
      .set({
        status: 'rejected',
        reviewNotes: input.notes,
        reviewedBy: auth.user.id,
        reviewedAt: new Date(now),
        verificationValidUntil: null,
        version: sql`${requests.version} + 1`,
        updatedAt: new Date(now),
      })
      .where(and(eq(requests.id, id), guard)),
    d.db
      .update(sessions)
      .set({ stepUpNonce: null, stepUpAt: null })
      .where(and(eq(sessions.id, auth.session.tokenHash), guard)),
  ]);
  if (!result[0].length)
    throw new AppError(
      'CONFLICT',
      'The request, guardian eligibility or reviewer authority changed. Refresh before deciding.',
    );
}
export async function invite(d: RequestDeps, auth: AuthContext, input: GuardianInvite) {
  const target = await d.db
    .select()
    .from(requests)
    .where(and(eq(requests.id, input.requestId), eq(requests.guardianUserId, auth.user.id)))
    .get();
  if (!target) throw new AppError('NOT_FOUND', 'Guardian request not found.');
  if (target.scope === 'teaching' && ageOn(input.childBirthDate) < 16)
    throw new AppError('VALIDATION_FAILED', 'Teaching permission requires a child aged 16–17.', {
      childBirthDate: ['Teaching starts at age 16.'],
    });
  const proof = await ownerProof(d, auth, input),
    code = randomToken(),
    hash = await sha256Hex(code),
    now = Date.now(),
    receipt = newId(),
    guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE id = ${receipt})`;
  const result = await d.db.batch([
    d.db
      .insert(auditLogs)
      .select(
        sql`SELECT ${receipt}, ${auth.user.id}, 'privacy.guardian_invitation_created', 'guardian', ${input.requestId}, '{}', NULL, ${d.requestId}, ${now} FROM ${requests} WHERE id = ${input.requestId} AND guardian_user_id = ${auth.user.id} AND version = ${input.version} AND status = 'approved' AND identity_method = 'setu_digilocker' AND verification_reference IS NOT NULL AND EXISTS (SELECT 1 FROM guardian_verifications WHERE request_id = ${input.requestId} AND verified_at IS NOT NULL) AND verification_valid_until > ${now} AND ${adult(auth.user.id)} AND ${ownerAuthority(auth, proof, now)} AND (SELECT count(*) FROM ${invitations} WHERE request_id = ${input.requestId} AND created_at > ${now - 86400000}) < 5`,
      )
      .returning({ id: auditLogs.id }),
    d.db
      .insert(invitations)
      .select(
        sql`SELECT ${hash}, ${input.requestId}, ${await sha256Hex(input.childEmail)}, ${input.childBirthDate}, ${now + 14 * 86400000}, ${now}, NULL, NULL WHERE ${guard}`,
      ),
    d.db
      .update(sessions)
      .set({ stepUpNonce: null, stepUpAt: null })
      .where(and(eq(sessions.id, auth.session.tokenHash), guard)),
  ]);
  if (!result[0].length)
    throw new AppError(
      'CONFLICT',
      'Approval, verification or security state changed. Up to five invitations per day are allowed.',
    );
  return { code, expiresAt: new Date(now + 14 * 86400000).toISOString() };
}
export async function withdraw(
  d: RequestDeps,
  auth: AuthContext,
  id: string,
  input: { version: number; password?: string; code?: string },
) {
  const proof = await ownerProof(d, auth, input),
    receipt = newId(),
    now = Date.now(),
    guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE id = ${receipt})`;
  const result = await d.db.batch([
    d.db
      .insert(auditLogs)
      .select(
        sql`SELECT ${receipt}, ${auth.user.id}, 'privacy.guardian_withdrawn', 'guardian', ${id}, '{}', NULL, ${d.requestId}, ${now} FROM ${requests} WHERE id = ${id} AND guardian_user_id = ${auth.user.id} AND version = ${input.version} AND status IN ('pending','approved') AND ${ownerAuthority(auth, proof, now)}`,
      )
      .returning({ id: auditLogs.id }),
    d.db
      .update(requests)
      .set({ status: 'revoked', version: sql`${requests.version} + 1`, updatedAt: new Date(now) })
      .where(and(eq(requests.id, id), guard)),
    d.db
      .update(invitations)
      .set({ expiresAt: new Date(now), childEmailHash: null, childBirthDate: null })
      .where(and(eq(invitations.requestId, id), guard)),
    d.db
      .delete(sessions)
      .where(
        sql`${sessions.userId} IN (SELECT user_id FROM ${privacy} WHERE guardian_request_id = ${id} AND birth_date > ${birthCutoff(18)}) AND ${guard}`,
      ),
    d.db
      .update(sessions)
      .set({ stepUpNonce: null, stepUpAt: null })
      .where(and(eq(sessions.id, auth.session.tokenHash), guard)),
  ]);
  if (!result[0].length)
    throw new AppError(
      'CONFLICT',
      'Permission or security state changed. Refresh before withdrawing.',
    );
}
