/** Private account rights and explicit preferences, with one atomic deletion receipt. */
import { and, eq, sql } from 'drizzle-orm';
import { schema } from '@skillverse/db';
import {
  ageOn,
  birthCutoff,
  POLICY_VERSION,
  INSTRUCTOR_POLICY_VERSION,
  newId,
} from '@skillverse/shared';
import type { AuthContext } from '../env';
import type { RequestDeps } from '../lib/deps';
import { AppError } from '../lib/errors';
import { eligibleAccount, privacyState } from '../repositories/consent.repository';
import { ownerProof, ownerAuthority } from './privacy-proof.service';

export async function details(d: RequestDeps, auth: AuthContext) {
  const row = await d.db
    .select()
    .from(schema.accountPrivacy)
    .where(eq(schema.accountPrivacy.userId, auth.user.id))
    .get();
  return {
    ...(await privacyState(d.db, auth.user.id)),
    birthDate: row?.birthDate ?? null,
    termsVersion: row?.termsVersion ?? null,
    privacyVersion: row?.privacyVersion ?? null,
    agreedAt: row?.agreedAt.toISOString() ?? null,
    canDelete: !auth.roles.some((role) => ['admin', 'moderator', 'super_admin'].includes(role)),
    currentPolicyVersion: POLICY_VERSION,
  };
}
export async function preference(
  d: RequestDeps,
  auth: AuthContext,
  kind: 'media' | 'instructor',
  enabled: boolean,
) {
  const { accountPrivacy: privacy, auditLogs } = schema;
  const row = await d.db.select().from(privacy).where(eq(privacy.userId, auth.user.id)).get();
  if (!row?.birthDate) throw new AppError('FORBIDDEN', 'Confirm account eligibility first.');
  if (kind === 'media' && enabled && ageOn(row.birthDate) < 18)
    throw new AppError(
      'FORBIDDEN',
      'External video embeds are disabled for accounts under 18. Use the guardian-guided external link instead.',
    );
  if (kind === 'instructor' && ageOn(row.birthDate) < 16)
    throw new AppError('FORBIDDEN', 'Teaching is available from age 16.');
  const receipt = newId(),
    now = Date.now(),
    guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE id = ${receipt})`;
  const eligibility =
    kind === 'instructor'
      ? sql`${eligibleAccount(auth.user.id)} AND ${privacy.birthDate} <= ${birthCutoff(16)} AND (${privacy.birthDate} <= ${birthCutoff(18)} OR EXISTS (SELECT 1 FROM guardian_requests WHERE id = ${privacy.guardianRequestId} AND status = 'approved' AND scope = 'teaching'))`
      : enabled
        ? eligibleAccount(auth.user.id)
        : sql`1=1`;
  const result = await d.db.batch([
    d.db
      .insert(auditLogs)
      .select(
        sql`SELECT ${receipt}, ${auth.user.id}, ${kind === 'media' ? (enabled ? 'privacy.media_allowed' : 'privacy.media_withdrawn') : 'privacy.instructor_terms_accepted'}, 'user', ${auth.user.id}, ${JSON.stringify({ policyVersion: POLICY_VERSION })}, NULL, ${d.requestId}, ${now} FROM ${privacy} WHERE ${privacy.userId} = ${auth.user.id} AND ${eligibility} AND EXISTS (SELECT 1 FROM sessions WHERE id = ${auth.session.tokenHash} AND user_id = ${auth.user.id} AND expires_at > ${now} AND idle_expires_at > ${now})`,
      )
      .returning({ id: auditLogs.id }),
    d.db
      .update(privacy)
      .set({
        ...(kind === 'media'
          ? { externalMedia: enabled }
          : { instructorVersion: INSTRUCTOR_POLICY_VERSION }),
        version: sql`${privacy.version} + 1`,
        updatedAt: new Date(now),
      })
      .where(and(eq(privacy.userId, auth.user.id), guard)),
  ]);
  if (!result[0].length)
    throw new AppError(
      'CONFLICT',
      'Your eligibility or session changed. Refresh before continuing.',
    );
}
export async function eraseAccount(
  d: RequestDeps,
  auth: AuthContext,
  input: { password?: string; code?: string; version: number },
) {
  if (auth.roles.some((role) => ['admin', 'moderator', 'super_admin'].includes(role)))
    throw new AppError(
      'FORBIDDEN',
      'An independent super administrator must revoke all staff roles before this account can be deleted.',
    );
  const proof = await ownerProof(d, auth, input),
    {
      auditLogs,
      users,
      sessions,
      accountPrivacy,
      guardianRequests,
      guardianInvitations,
      privacyExports,
      privacyExportParts,
      supportRequests,
      supportReplies,
    } = schema;
  const receipt = newId(),
    now = Date.now(),
    guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE id = ${receipt})`,
    uid = auth.user.id;
  const privacyVersion = sql`COALESCE((SELECT version FROM account_privacy WHERE user_id = ${uid}),0) = ${input.version}`;
  const insert = d.db
    .insert(auditLogs)
    .select(
      sql`SELECT ${receipt}, ${uid}, 'privacy.account_deleted', 'user', ${uid}, '{"summary":"Account anonymized; private learning data removed; authored publications withdrawn."}', NULL, ${d.requestId}, ${now} FROM ${users} WHERE id = ${uid} AND ${ownerAuthority(auth, proof, now)} AND ${privacyVersion} AND NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = ${uid} AND role IN ('admin','moderator','super_admin'))`,
    )
    .returning({ id: auditLogs.id });
  const result = await d.db.batch([
    insert,
    // Tombstone identity stays to preserve enrolled learners' authored-course foreign keys.
    d.db
      .update(users)
      .set({
        status: 'deleted',
        deletedAt: new Date(now),
        email: `deleted-${uid}@deleted.invalid`,
        username: `deleted_${uid.replaceAll('-', '')}`,
        displayName: 'Former member',
        passwordHash: null,
        avatarKey: null,
        failedLoginCount: 0,
        lockedUntil: null,
        adminVersion: sql`${users.adminVersion} + 1`,
        updatedAt: new Date(now),
      })
      .where(and(eq(users.id, uid), guard)),
    d.db
      .update(schema.courses)
      .set({ status: 'archived', updatedAt: new Date(now) })
      .where(
        and(
          eq(schema.courses.instructorId, uid),
          sql`${schema.courses.status} <> 'taken_down'`,
          guard,
        ),
      ),
    d.db
      .update(schema.courses)
      .set({
        enrollmentCount: sql`(SELECT count(*) FROM enrollments WHERE course_id = courses.id AND user_id <> ${uid})`,
        ratingSum: sql`COALESCE((SELECT sum(rating) FROM reviews WHERE course_id = courses.id AND user_id <> ${uid} AND hidden_at IS NULL),0)`,
        ratingCount: sql`(SELECT count(*) FROM reviews WHERE course_id = courses.id AND user_id <> ${uid} AND hidden_at IS NULL)`,
      })
      .where(
        sql`courses.id IN (SELECT course_id FROM enrollments WHERE user_id = ${uid}) AND ${guard}`,
      ),
    d.db.delete(schema.enrollments).where(and(eq(schema.enrollments.userId, uid), guard)),
    d.db
      .update(schema.discussionQuestions)
      .set({
        title: 'Removed question',
        body: '',
        authorUserId: null,
        acceptedReplyId: null,
        hiddenAt: new Date(now),
        moderationNotes: null,
        updatedAt: new Date(now),
      })
      .where(and(eq(schema.discussionQuestions.authorUserId, uid), guard)),
    d.db
      .update(schema.discussionQuestions)
      .set({ acceptedReplyId: null, updatedAt: new Date(now) })
      .where(
        sql`${schema.discussionQuestions.acceptedReplyId} IN (SELECT id FROM discussion_replies WHERE author_user_id=${uid}) AND ${guard}`,
      ),
    d.db
      .update(schema.discussionReplies)
      .set({
        body: '',
        authorUserId: null,
        hiddenAt: new Date(now),
        moderationNotes: null,
        updatedAt: new Date(now),
      })
      .where(and(eq(schema.discussionReplies.authorUserId, uid), guard)),
    d.db
      .delete(schema.contentReports)
      .where(and(eq(schema.contentReports.reporterUserId, uid), guard)),
    d.db.delete(schema.notifications).where(and(eq(schema.notifications.userId, uid), guard)),
    d.db
      .delete(schema.notificationPreferences)
      .where(and(eq(schema.notificationPreferences.userId, uid), guard)),
    d.db.delete(schema.userProfiles).where(and(eq(schema.userProfiles.userId, uid), guard)),
    d.db.delete(schema.userRoles).where(and(eq(schema.userRoles.userId, uid), guard)),
    d.db.delete(schema.emailTokens).where(and(eq(schema.emailTokens.userId, uid), guard)),
    d.db.delete(schema.mfaTotp).where(and(eq(schema.mfaTotp.userId, uid), guard)),
    d.db.delete(schema.mfaRecoveryCodes).where(and(eq(schema.mfaRecoveryCodes.userId, uid), guard)),
    d.db.delete(schema.oauthAccounts).where(and(eq(schema.oauthAccounts.userId, uid), guard)),
    d.db
      .delete(schema.instructorApplications)
      .where(and(eq(schema.instructorApplications.userId, uid), guard)),
    d.db
      .update(guardianRequests)
      .set({
        status: 'revoked',
        verificationReference: null,
        reviewNotes: '',
        version: sql`${guardianRequests.version} + 1`,
        updatedAt: new Date(now),
      })
      .where(and(eq(guardianRequests.guardianUserId, uid), guard)),
    d.db
      .update(guardianInvitations)
      .set({ childEmailHash: null, childBirthDate: null, expiresAt: new Date(now) })
      .where(
        sql`(${guardianInvitations.usedByUserId} = ${uid} OR ${guardianInvitations.requestId} IN (SELECT id FROM ${guardianRequests} WHERE guardian_user_id = ${uid})) AND ${guard}`,
      ),
    d.db
      .delete(sessions)
      .where(
        sql`(${sessions.userId} = ${uid} OR ${sessions.userId} IN (SELECT user_id FROM account_privacy WHERE birth_date > ${birthCutoff(18)} AND guardian_request_id IN (SELECT id FROM guardian_requests WHERE guardian_user_id = ${uid}))) AND ${guard}`,
      ),
    d.db
      .update(schema.teacherVerifications)
      .set({ verifiedAt: null, validUntil: null, expiresAt: new Date(now) })
      .where(and(eq(schema.teacherVerifications.userId, uid), guard)),
    d.db
      .update(accountPrivacy)
      .set({
        birthDate: null,
        guardianRequestId: null,
        instructorVersion: null,
        externalMedia: false,
        updatedAt: new Date(now),
      })
      .where(and(eq(accountPrivacy.userId, uid), guard)),
    d.db
      .delete(privacyExportParts)
      .where(
        sql`${privacyExportParts.exportId} IN (SELECT id FROM ${privacyExports} WHERE user_id = ${uid}) AND ${guard}`,
      ),
    d.db
      .update(privacyExports)
      .set({ state: 'cancelled', leaseNonce: null, leaseUntil: 0, updatedAt: new Date(now) })
      .where(and(eq(privacyExports.userId, uid), guard)),
    d.db
      .update(supportReplies)
      .set({ body: '', deliveryState: 'cancelled', updatedAt: new Date(now) })
      .where(
        sql`${supportReplies.requestId} IN (SELECT id FROM ${supportRequests} WHERE user_id = ${uid} OR email = ${auth.user.email}) AND ${guard}`,
      ),
    d.db
      .update(supportRequests)
      .set({
        email: '',
        subject: 'Erased request',
        message: '',
        status: 'erased',
        verificationHash: null,
        verificationExpiresAt: null,
        resolvedAt: new Date(now),
        updatedAt: new Date(now),
      })
      .where(
        sql`(${supportRequests.userId} = ${uid} OR ${supportRequests.email} = ${auth.user.email}) AND ${guard}`,
      ),
  ]);
  if (!result[0].length)
    throw new AppError(
      'CONFLICT',
      'The account, staff authority or security check changed. Deletion did not complete.',
    );
}
