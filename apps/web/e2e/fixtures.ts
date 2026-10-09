/** Distinct local client IPs isolate journeys without relaxing the app's real abuse limits. */
import { randomBytes } from 'node:crypto';
import { test as base } from '@playwright/test';

export { expect, type Page } from '@playwright/test';
export const test = base.extend({
  extraHTTPHeaders: async ({ baseURL }, provide) => {
    if (baseURL !== 'http://localhost:5173')
      throw new Error('Synthetic client IPs are local-test only.');
    const octets = Array.from(randomBytes(3), (byte) => 1 + (byte % 254));
    await provide({ 'cf-connecting-ip': `10.${octets.join('.')}` });
  },
});
