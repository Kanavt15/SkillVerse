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

export const SessionSchema = z
  .object({
    handle: z.string(),
    userAgent: z.string().nullable(),
    createdAt: z.string(),
    lastSeenAt: z.string(),
    current: z.boolean(),
  })
  .openapi('Session');
