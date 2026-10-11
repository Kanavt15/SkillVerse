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
    if (baseURL !== 'http://localhost:5173')
      throw new Error('Synthetic client IPs are local-test only.');
    const octets = Array.from(randomBytes(3), (byte) => 1 + (byte % 254));
    await provide({ 'cf-connecting-ip': `10.${octets.join('.')}` });
  },
});
