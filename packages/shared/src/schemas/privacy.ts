/** Versioned agreements and private account workflows; dates use UTC calendar birthdays. */
import { z } from 'zod';
import { emailSchema, idSchema } from './common';
import { secondFactorCodeSchema } from './second-factor';
export const POLICY_VERSION = '2026-10-12';
export const INSTRUCTOR_POLICY_VERSION = '2026-10-12';
export const MIN_LEARNING_AGE = 10;
export const MIN_TEACHING_AGE = 16;
export const GUARDIAN_AGE = 18;
export function ageOn(birthDate: string, now = new Date()): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  return (
    now.getUTCFullYear() -
    year! -
    (now.getUTCMonth() + 1 < month! || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day!)
      ? 1
      : 0)
  );
}
export function birthCutoff(age: number, now = new Date()): string {
  const year = now.getUTCFullYear() - age,
    month = now.getUTCMonth();
  const day = Math.min(now.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a complete date of birth.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      value >= '1900-01-01' &&
      date.getTime() <= Date.now()
    );
  }, 'Enter a real date of birth, from 1900 through today.');
export const agreementFields = {
  birthDate: birthDateSchema,
  termsVersion: z.literal(POLICY_VERSION),
  privacyVersion: z.literal(POLICY_VERSION),
  acceptTerms: z.literal(true, { error: 'Agree to the Terms and Community Guidelines.' }),
  acceptPrivacy: z.literal(true, { error: 'Read and accept the Privacy Notice.' }),
  guardianCode: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/, 'Enter the guardian permission code.')
    .optional(),
};
export const eligibilitySchema = z.strictObject(agreementFields).superRefine((input, context) => {
  const age = ageOn(input.birthDate);
  if (age < MIN_LEARNING_AGE)
    context.addIssue({
      code: 'custom',
      path: ['birthDate'],
      message: 'Learning accounts are available from age 10.',
    });
  if (age < GUARDIAN_AGE && !input.guardianCode)
    context.addIssue({
      code: 'custom',
      path: ['guardianCode'],
      message:
        'A verified guardian must provide a permission code before an account for someone under 18 is created.',
    });
});
export const googleRegistrationSchema = eligibilitySchema.safeExtend({
  email: emailSchema,
  displayName: z.string().trim().min(2).max(60).optional(),
});
export type EligibilityInput = z.infer<typeof eligibilitySchema>;
export const ownProofFields = {
  password: z.string().max(128).optional(),
  code: secondFactorCodeSchema.optional(),
};
export const ownProofSchema = z.strictObject(ownProofFields);
export const deleteAccountSchema = z.strictObject({
  confirmation: z.literal('DELETE'),
  version: z.number().int().nonnegative(),
  ...ownProofFields,
});
export const instructorAgreementSchema = z.strictObject({
  version: z.literal(INSTRUCTOR_POLICY_VERSION),
  accepted: z.literal(true),
});
export const mediaConsentSchema = z.strictObject({
  enabled: z.boolean(),
  version: z.literal(POLICY_VERSION),
});
export const guardianRequestSchema = z.strictObject({
  scope: z.enum(['learning', 'teaching']),
  consentVersion: z.literal(POLICY_VERSION),
  consent: z.literal(true),
});
export const guardianDecisionSchema = z.strictObject({
  decision: z.literal('reject'),
  version: z.number().int().nonnegative(),
  notes: z.string().trim().min(10).max(2000),
  ...ownProofFields,
});
export const guardianStartSchema = z.strictObject({
  version: z.number().int().nonnegative(),
  shareIdentity: z.literal(true),
  guardianDeclaration: z.literal(true),
  ...ownProofFields,
});
export const guardianFinishSchema = z.strictObject({
  version: z.number().int().nonnegative(),
  state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  legalName: z.string().trim().min(2).max(120),
  ...ownProofFields,
});
export const guardianInviteSchema = z
  .strictObject({
    requestId: idSchema,
    version: z.number().int().nonnegative(),
    childEmail: emailSchema,
    childBirthDate: birthDateSchema,
    ...ownProofFields,
  })
  .refine((input) => ageOn(input.childBirthDate) >= 10 && ageOn(input.childBirthDate) < 18, {
    path: ['childBirthDate'],
    message: 'Guardian invitations are for children aged 10–17.',
  });
export const guardianWithdrawSchema = z.strictObject({
  version: z.number().int().nonnegative(),
  confirmation: z.literal('WITHDRAW'),
  ...ownProofFields,
});
export const supportRequestSchema = z.strictObject({
  email: emailSchema,
  subject: z.string().trim().min(5).max(120),
  message: z.string().trim().min(20).max(4000),
  category: z.enum(['account', 'privacy', 'guardian', 'content', 'general']),
  acceptPrivacy: z.literal(true),
  adultOrGuardian: z.boolean(),
  website: z.string().max(200).default(''),
});
export const supportReplySchema = z.strictObject({
  version: z.number().int().nonnegative(),
  reply: z.string().trim().min(20).max(4000),
  resolve: z.boolean().default(false),
});
export const privatePageQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type GuardianDecision = z.infer<typeof guardianDecisionSchema>;
export type GuardianInvite = z.infer<typeof guardianInviteSchema>;
export type SupportRequest = z.infer<typeof supportRequestSchema>;
export type SupportReply = z.infer<typeof supportReplySchema>;
export const eligibilityViewSchema = z.object({
  confirmed: z.boolean(),
  canLearn: z.boolean(),
  canTeach: z.boolean(),
  isMinor: z.boolean(),
  externalMedia: z.boolean(),
  version: z.number().int(),
  needsInstructorTerms: z.boolean(),
});
export const privacyDetailsSchema = eligibilityViewSchema.extend({
  birthDate: z.string().nullable(),
  termsVersion: z.string().nullable(),
  privacyVersion: z.string().nullable(),
  agreedAt: z.string().nullable(),
  canDelete: z.boolean(),
  currentPolicyVersion: z.string(),
});
export type PrivacyDetails = z.infer<typeof privacyDetailsSchema>;
export const guardianViewSchema = z.object({
  id: idSchema,
  scope: z.enum(['learning', 'teaching']),
  status: z.enum(['pending', 'approved', 'rejected', 'revoked']),
  version: z.number().int(),
  reviewNotes: z.string(),
  createdAt: z.string(),
  reviewedAt: z.string().nullable(),
  verificationValidUntil: z.string().nullable(),
  guardianUserId: idSchema.optional(),
  guardianName: z.string().optional(),
  guardianEmail: z.string().optional(),
  identityMethod: z.string().nullable().optional(),
  verificationReference: z.string().nullable().optional(),
});
export type GuardianView = z.infer<typeof guardianViewSchema>;
export const exportViewSchema = z.object({
  id: idSchema,
  state: z.enum(['queued', 'building', 'ready', 'failed', 'expired', 'cancelled']),
  bytes: z.number(),
  error: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
  canDownload: z.boolean(),
});
export type ExportView = z.infer<typeof exportViewSchema>;
export const supportViewSchema = z.object({
  id: idSchema,
  email: z.string(),
  subject: z.string(),
  message: z.string(),
  category: z.string(),
  status: z.string(),
  version: z.number().int(),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  replies: z.array(
    z.object({
      id: idSchema,
      body: z.string(),
      deliveryState: z.string(),
      attempts: z.number().int(),
      createdAt: z.string(),
    }),
  ),
});
export type SupportView = z.infer<typeof supportViewSchema>;
