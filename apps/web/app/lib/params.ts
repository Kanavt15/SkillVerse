/**
 * Validates ids that arrive in URLs and hidden form fields. A malformed id is
 * a bad request (400), not a server error.
 */
import { data } from 'react-router';
import { idSchema, slugSchema } from '@skillverse/shared';

export function requireId(value: unknown): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw data('Invalid id', { status: 400 });
  return parsed.data;
}

/** Lowercase course/category slugs are validated before they become an API path. */
export function requireSlug(value: unknown): string {
  const parsed = slugSchema.safeParse(value);
  if (!parsed.success) throw data('Invalid course slug', { status: 400 });
  return parsed.data;
}
