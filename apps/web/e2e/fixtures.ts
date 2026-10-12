/** Distinct local client IPs isolate journeys without relaxing the app's real abuse limits. */
import { randomBytes } from 'node:crypto';
import { test as base } from '@playwright/test';

export { expect, type Page } from '@playwright/test';

/** Distinct role clients within a busy journey, preserving real per-IP limits. */
export function localRoleHeaders(headers: Record<string, string> | undefined, offset: 1 | 2) {
  const address = headers?.['cf-connecting-ip'];
  if (!address?.startsWith('10.')) throw new Error('Role clients require the local IP fixture.');
  const octets = address.split('.');
  octets[3] = String(1 + ((Number(octets[3]) - 1 + offset) % 254));
  return { ...headers, 'cf-connecting-ip': octets.join('.') };
}

export const test = base.extend({
  extraHTTPHeaders: async ({ baseURL }, provide) => {
    if (!['http://localhost:5173', 'http://localhost:5174'].includes(baseURL ?? ''))
      throw new Error('Synthetic client IPs are local-test only.');
    // Refuse fixture registration before it can send through a developer's real provider.
    const response = await fetch(`${baseURL}/api/v1/dev/mailbox`);
    const mailbox = response.ok ? ((await response.json()) as { localMailOnly?: boolean }) : null;
    if (mailbox?.localMailOnly !== true)
      throw new Error(
        'Browser fixtures require development mode with RESEND_API_KEY blank. Start the API with a temporary provider-free --env-file before running tests.',
      );
    const octets = Array.from(randomBytes(3), (byte) => 1 + (byte % 254));
    await provide({ 'cf-connecting-ip': `10.${octets.join('.')}` });
  },
});
