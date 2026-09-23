/**
 * Validates ids that arrive in URLs and hidden form fields. A malformed id is
 * a bad request (400), not a server error.
 */
import { data } from 'react-router';
import { idSchema } from '@skillverse/shared';

export function requireId(value: unknown): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw data('Invalid id', { status: 400 });
  return parsed.data;
}
