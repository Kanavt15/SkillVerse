/**
 * GET helper for admin loaders. Turns API refusals into route errors that the
 * admin layout's ErrorBoundary understands:
 *   - 2FA not set up (MFA_SETUP_REQUIRED) → { reason: 'mfa' } with a "set up 2FA" screen
 *   - anything else                       → the API's status and message
 */
import { data } from 'react-router';
import { api } from '~/lib/api.server';
import type { AdminErrorData } from './types';

export async function staffGet<T>(request: Request, path: string): Promise<T> {
  const res = await api<T>(request, path);
  if (res.ok) return res.data;
  const reason = res.error.code === 'MFA_SETUP_REQUIRED' ? 'mfa' : 'error';
  throw data<AdminErrorData>({ reason, message: res.error.message }, { status: res.status });
}
