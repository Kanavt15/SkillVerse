/**
 * Validation schemas for sign-up, sign-in, email verification, password reset
 * and profile editing. Used by the web forms (instant feedback) and the API
 * (the check that actually counts).
 */
import { z } from 'zod';
import { emailSchema, passwordSchema, usernameSchema } from './common';

/** Human name shown in the UI. Letters from any script, 2–60 chars, no control characters. */
export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters')
  .max(60, 'Use at most 60 characters')
  .regex(/^[^\p{C}<>]+$/u, 'Contains characters that are not allowed');

/** Opaque token from an emailed link (base64url, 43 chars for 32 bytes). */
export const emailTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{32,128}$/, 'Invalid or expired link');

export const registerSchema = z.strictObject({
  email: emailSchema,
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.strictObject({
  email: emailSchema,
  // Don't apply the length policy at sign-in: accounts may predate a policy change,
  // and the message would leak the rules. Just bound the size.
  password: z.string().min(1, 'Enter your password').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const emailOnlySchema = z.strictObject({ email: emailSchema });

export const tokenOnlySchema = z.strictObject({ token: emailTokenSchema });

export const resetPasswordSchema = z.strictObject({
  token: emailTokenSchema,
  password: passwordSchema,
});

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const LEARNING_GOALS = ['career_switch', 'upskill', 'hobby', 'teach'] as const;

export const updateProfileSchema = z.strictObject({
  displayName: displayNameSchema.optional(),
  headline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
  websiteUrl: z
    .union([
      z.literal(''),
      z.url({ protocol: /^https$/, message: 'Use a full https:// link' }).max(300),
    ])
    .optional(),
  location: z.string().trim().max(80).optional(),
  timezone: z
    .string()
    .max(64)
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Unknown timezone')
    .optional(),
  interests: z
    .array(z.string().regex(/^[a-z0-9-]{2,40}$/))
    .max(12)
    .optional(),
  goal: z.enum(LEARNING_GOALS).optional(),
  completeOnboarding: z.boolean().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
