/**
 * Response schemas shared by several route files (documented in OpenAPI).
 */
import { z } from '@hono/zod-openapi';
import { ROLES } from '@skillverse/shared';

export const MeSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    mfaEnabled: z.boolean(),
    username: z.string(),
    displayName: z.string(),
    roles: z.array(z.enum(ROLES)),
    profile: z.object({
      headline: z.string(),
      bio: z.string(),
      websiteUrl: z.string().nullable(),
      location: z.string().nullable(),
      timezone: z.string(),
      interests: z.array(z.string()),
      goal: z.string().nullable(),
      onboarded: z.boolean(),
    }),
  })
  .openapi('Me');

/** Returned instead of the user when the password step passed but a 2FA code is needed. */
export const MfaRequiredSchema = z.object({ mfaRequired: z.literal(true) }).openapi('MfaRequired');

/** Sign-in style responses: the user, or "now enter your 2FA code". */
export const SignInResultSchema = z.union([MeSchema, MfaRequiredSchema]).openapi('SignInResult');

export const SessionSchema = z
  .object({
    handle: z.string(),
    userAgent: z.string().nullable(),
    createdAt: z.string(),
    lastSeenAt: z.string(),
    current: z.boolean(),
  })
  .openapi('Session');
