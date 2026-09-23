/**
 * Reusable Zod building blocks. Every API input is validated with a schema
 * built from these, in the browser (for fast feedback) AND on the server
 * (which is the check that actually counts, since clients can be bypassed).
 */
import { z } from 'zod';
import { isId } from '../ids';

/** A UUIDv7 identifier. */
export const idSchema = z.string().refine(isId, { message: 'Invalid id' });

/** Normalised email: trimmed and lower-cased, max 254 chars (RFC 5321). */
export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

/**
 * Password policy (NIST SP 800-63B): long beats complex. 10–128 chars and no
 * forced symbol/number rules. Breached-password screening happens server-side.
 */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters');

/** Public handle: 3–30 chars, lower-case letters, digits and underscores. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, '3–30 characters: letters, numbers and underscores');

/** Cursor pagination query (?cursor=…&limit=…). Limit is capped to protect the database. */
export const paginationQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** URL slug, e.g. "intro-to-python". */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lower-case words separated by hyphens')
  .max(120);
