/** Private eligibility and conditional enrollment of an authorized child account. */
import { and, eq, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';
import {
  ageOn,
  birthCutoff,
  POLICY_VERSION,
  INSTRUCTOR_POLICY_VERSION,
  newId,
  type EligibilityInput,
} from '@skillverse/shared';
import { sha256Hex } from '../lib/crypto';
import { AppError } from '../lib/errors';
const {
  accountPrivacy: privacy,
  guardianInvitations: invites,
  users,
  auditLogs,
  userProfiles,
  emailTokens,
} = schema;

/** Reusable SQL predicate for atomic entitlement/publication writes and public instructor visibility. */
// Read the database clock at execution, including predicates composed at Worker module startup.
// workerd freezes JavaScript time outside a request; a captured startup date is not an age check.
function ageCutoff(age: number, now?: Date): SQL {
  return now
    ? sql`${birthCutoff(age, now)}`
    : sql`(printf('%04d',CAST(strftime('%Y','now') AS INTEGER)-${age}) || strftime('-%m-%d','now'))`;
}
export function eligibleAccount(userId: SQLWrapper | string, teaching = false, now?: Date): SQL {
  return sql`EXISTS (SELECT 1 FROM account_privacy AS consent JOIN users AS account ON account.id = consent.user_id
    WHERE account.id = ${userId} AND account.status = 'active' AND account.email_verified_at IS NOT NULL AND consent.birth_date IS NOT NULL
    AND consent.birth_date <= ${ageCutoff(teaching ? 16 : 10, now)} AND consent.terms_version = ${POLICY_VERSION} AND consent.privacy_version = ${POLICY_VERSION}
    AND (${teaching ? 1 : 0} = 0 OR consent.instructor_version = ${INSTRUCTOR_POLICY_VERSION})
    AND (consent.birth_date <= ${ageCutoff(18, now)} OR EXISTS (
      SELECT 1 FROM guardian_requests AS permission JOIN users AS parent ON parent.id = permission.guardian_user_id
      JOIN account_privacy AS adult ON adult.user_id = parent.id
      WHERE permission.id = consent.guardian_request_id AND permission.status = 'approved' AND permission.consent_version = ${POLICY_VERSION}
      AND permission.verification_reference IS NOT NULL AND permission.identity_method = 'setu_digilocker' AND EXISTS (SELECT 1 FROM guardian_verifications AS verified WHERE verified.request_id = permission.id AND verified.verified_at IS NOT NULL) AND parent.status = 'active' AND parent.email_verified_at IS NOT NULL
      AND adult.birth_date <= ${ageCutoff(18, now)} AND adult.terms_version = ${POLICY_VERSION} AND adult.privacy_version = ${POLICY_VERSION}
      AND (${teaching ? 1 : 0} = 0 OR permission.scope = 'teaching'))))`;
}
export async function privacyState(db: Db, userId: string) {
  const row = await db.select().from(privacy).where(eq(privacy.userId, userId)).get();
  const result = await db.get<{ learning: number; teaching: number }>(
    sql`SELECT ${eligibleAccount(userId)} AS learning, ${eligibleAccount(userId, true)} AS teaching`,
  );
  return {
    confirmed: Boolean(row?.birthDate),
    canLearn: Boolean(result?.learning),
    canTeach: Boolean(result?.teaching),
    isMinor: row?.birthDate ? ageOn(row.birthDate) < 18 : false,
    externalMedia: Boolean(row?.externalMedia && row.birthDate && ageOn(row.birthDate) >= 18),
    version: row?.version ?? 0,
    needsInstructorTerms: row?.instructorVersion !== INSTRUCTOR_POLICY_VERSION,
  };
}
export async function permission(db: Db, input: EligibilityInput, email: string) {
  if (ageOn(input.birthDate) >= 18)
    return { guardianId: null, invitationId: null, eligible: sql`1 = 1` };
  if (!input.guardianCode)
    throw new AppError('VALIDATION_FAILED', 'A verified guardian permission code is required.');
  const id = await sha256Hex(input.guardianCode),
    emailHash = await sha256Hex(email.trim().toLowerCase()),
    now = Date.now();
  const row = await db
    .select({ requestId: invites.requestId })
    .from(invites)
    .where(eq(invites.id, id))
    .get();
  const eligible = sql`EXISTS (SELECT 1 FROM guardian_invitations AS invitation
    JOIN guardian_requests AS permission ON permission.id = invitation.request_id
    JOIN users AS parent ON parent.id = permission.guardian_user_id JOIN account_privacy AS adult ON adult.user_id = parent.id
    WHERE invitation.id = ${id} AND invitation.child_email_hash = ${emailHash} AND invitation.child_birth_date = ${input.birthDate}
    AND invitation.used_at IS NULL AND invitation.expires_at > ${now}
    AND permission.status = 'approved' AND permission.consent_version = ${POLICY_VERSION} AND permission.verification_reference IS NOT NULL AND permission.identity_method = 'setu_digilocker' AND EXISTS (SELECT 1 FROM guardian_verifications AS verified WHERE verified.request_id = permission.id AND verified.verified_at IS NOT NULL)
    AND parent.status = 'active' AND parent.email_verified_at IS NOT NULL AND adult.birth_date <= ${birthCutoff(18)}
    AND adult.terms_version = ${POLICY_VERSION} AND adult.privacy_version = ${POLICY_VERSION})`;
  if (!row || !(await db.get<{ eligible: number }>(sql`SELECT ${eligible} AS eligible`))?.eligible)
    throw new AppError(
      'VALIDATION_FAILED',
      'That guardian permission code is invalid, expired or does not match the child details.',
      {
        guardianCode: [
          'Ask your guardian for a current permission code for this email and date of birth.',
        ],
      },
    );
  return { guardianId: row.requestId, invitationId: id, eligible };
}
export async function registerWithConsent(
  db: Db,
  input: EligibilityInput & { email: string; username: string; displayName: string },
  userId: string,
  passwordHash: string | null,
  verificationHash: string | null,
  requestId: string,
  verified = false,
) {
  const p = await permission(db, input, input.email),
    receipt = newId(),
    now = Date.now();
  const guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE id = ${receipt})`;
  const consume = db
    .update(invites)
    .set({
      usedAt: new Date(now),
      usedByUserId: userId,
      childEmailHash: null,
      childBirthDate: null,
    })
    .where(and(eq(invites.id, p.invitationId ?? ''), guard));
  const result = await db.batch([
    db
      .insert(auditLogs)
      .select(
        sql`SELECT ${receipt}, NULL, 'auth.registered', 'user', ${userId}, ${JSON.stringify({ policyVersion: POLICY_VERSION, guardianAuthorized: Boolean(p.guardianId) })}, NULL, ${requestId}, ${now} WHERE ${p.eligible} AND NOT EXISTS (SELECT 1 FROM ${users} WHERE email = ${input.email} OR username = ${input.username})`,
      )
      .returning({ id: auditLogs.id }),
    db
      .insert(users)
      .select(
        sql`SELECT ${userId}, ${input.email}, ${verified ? now : null}, ${input.username}, ${input.displayName}, ${passwordHash}, NULL, 'active', 0, NULL, 0, NULL, ${now}, ${now} WHERE ${guard}`,
      ),
    db
      .insert(userProfiles)
      .select(
        sql`SELECT ${userId}, '', '', NULL, NULL, 'Asia/Kolkata', '[]', NULL, NULL, ${now} WHERE ${guard}`,
      ),
    db
      .insert(privacy)
      .select(
        sql`SELECT ${userId}, ${input.birthDate}, ${input.termsVersion}, ${input.privacyVersion}, NULL, ${now}, ${p.guardianId}, 0, 0, ${now} WHERE ${guard}`,
      ),
    consume,
    db
      .insert(emailTokens)
      .select(
        sql`SELECT ${verificationHash ?? ''}, ${userId}, 'verify_email', ${now + 86400000}, NULL, ${now} WHERE ${guard} AND ${verificationHash ? 1 : 0} = 1`,
      ),
  ]);
  return result[0].length === 1;
}
export async function confirmEligibility(
  db: Db,
  userId: string,
  email: string,
  input: EligibilityInput,
  requestId: string,
  sessionHash: string,
) {
  const existing = await db.select().from(privacy).where(eq(privacy.userId, userId)).get();
  if (existing?.birthDate && existing.birthDate !== input.birthDate)
    throw new AppError(
      'CONFLICT',
      'Date of birth cannot be changed here. Use the private Contact form for a verified correction.',
    );
  // An already accepted child may renew the same policy without consuming another invitation.
  const state = await privacyState(db, userId);
  const p =
    existing?.guardianRequestId && state.canLearn && existing.birthDate === input.birthDate
      ? {
          guardianId: existing.guardianRequestId,
          invitationId: null,
          eligible: eligibleAccount(userId),
        }
      : await permission(db, input, email);
  const receipt = newId(),
    now = Date.now(),
    guard = sql`EXISTS (SELECT 1 FROM ${auditLogs} WHERE id = ${receipt})`;
  const eligible = sql`${users.id} = ${userId} AND ${users.status} = 'active' AND ${p.eligible} AND EXISTS (SELECT 1 FROM sessions WHERE id = ${sessionHash} AND user_id = ${userId} AND expires_at > ${now} AND idle_expires_at > ${now}) AND NOT EXISTS (SELECT 1 FROM account_privacy WHERE user_id = ${userId} AND birth_date IS NOT NULL AND birth_date <> ${input.birthDate})`;
  const result = await db.batch([
    db
      .insert(auditLogs)
      .select(
        sql`SELECT ${receipt}, ${userId}, 'privacy.policies_accepted', 'user', ${userId}, ${JSON.stringify({ policyVersion: POLICY_VERSION })}, NULL, ${requestId}, ${now} FROM ${users} WHERE ${eligible}`,
      )
      .returning({ id: auditLogs.id }),
    db
      .insert(privacy)
      .select(
        sql`SELECT ${userId}, ${input.birthDate}, ${POLICY_VERSION}, ${POLICY_VERSION}, NULL, ${now}, ${p.guardianId}, 0, 0, ${now} WHERE ${guard}`,
      )
      .onConflictDoUpdate({
        target: privacy.userId,
        set: {
          birthDate: input.birthDate,
          termsVersion: POLICY_VERSION,
          privacyVersion: POLICY_VERSION,
          guardianRequestId: p.guardianId,
          agreedAt: new Date(now),
          version: sql`${privacy.version} + 1`,
          updatedAt: new Date(now),
        },
        setWhere: guard,
      }),
    db
      .update(invites)
      .set({
        usedAt: new Date(now),
        usedByUserId: userId,
        childEmailHash: null,
        childBirthDate: null,
      })
      .where(and(eq(invites.id, p.invitationId ?? ''), guard)),
  ]);
  if (!result[0].length)
    throw new AppError(
      'CONFLICT',
      'Eligibility or guardian permission changed. Refresh and try again.',
    );
}

export function verifiedTeacher(userId: SQLWrapper | string, now?: Date): SQL {
  const time = now ? sql`${now.getTime()}` : sql`(CAST(strftime('%s','now') AS INTEGER)*1000)`;
  return sql`${eligibleAccount(userId, true, now)} AND EXISTS (SELECT 1 FROM teacher_verifications WHERE user_id=${userId} AND verified_at IS NOT NULL AND valid_until>${time})`;
}

/** Public learner names do not reveal child identity; approved instructor aliases remain public. */
export function publicLearnerIdentity(userId: SQLWrapper, name: SQLWrapper): SQL<string>;
export function publicLearnerIdentity(
  userId: SQLWrapper,
  name: SQLWrapper,
  username: true,
): SQL<string | null>;
export function publicLearnerIdentity(
  userId: SQLWrapper,
  name: SQLWrapper,
  username = false,
): SQL<string | null> {
  return sql`CASE WHEN EXISTS (SELECT 1 FROM account_privacy WHERE user_id=${userId} AND birth_date<=${ageCutoff(18)}) OR (EXISTS (SELECT 1 FROM user_roles WHERE user_id=${userId} AND role='instructor') AND ${verifiedTeacher(userId)}) THEN ${name} ELSE ${username ? null : 'Learning member'} END`;
}

export function adultProfileField(userId: SQLWrapper, value: SQLWrapper): SQL<string> {
  return sql`CASE WHEN EXISTS (SELECT 1 FROM account_privacy WHERE user_id=${userId} AND birth_date<=${ageCutoff(18)}) THEN COALESCE(${value},'') ELSE '' END`;
}
