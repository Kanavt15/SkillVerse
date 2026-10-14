import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { APIRequestContext } from '@playwright/test';
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

export const adultConsent = {
  birthDate: '1990-01-01',
  termsVersion: '2026-10-12',
  privacyVersion: '2026-10-12',
  acceptTerms: true,
  acceptPrivacy: true,
};

/** Explicit local identity fixture; real provider integration is covered with server mocks. */
export async function fixtureTeachingIdentity(
  request: APIRequestContext,
  headers: Record<string, string>,
) {
  const mailbox = await (await request.get('/api/v1/dev/mailbox')).json();
  if (mailbox.localMailOnly !== true)
    throw new Error('Identity fixtures require the provider-free local mailbox.');
  const result = await request.post('/api/v1/me/privacy/instructor-terms', {
    headers,
    data: { version: '2026-10-12', accepted: true },
  });
  if (!result.ok()) throw new Error('Fixture teaching agreements failed.');
  const { data } = await (await request.get('/api/v1/me')).json();
  if (!/^[a-f0-9-]{36}$/.test(data.id)) throw new Error('Invalid fixture user.');
  const root = fileURLToPath(new URL('../../../', import.meta.url)),
    now = Date.now();
  execFileSync(
    process.execPath,
    [
      resolve(root, 'node_modules/wrangler/bin/wrangler.js'),
      'd1',
      'execute',
      'DB',
      '--local',
      '--command',
      `INSERT INTO teacher_verifications(user_id,provider_id,session_hash,state_hash,expires_at,verified_at,valid_until,revoked_at,created_at) VALUES ('${data.id}','local-fixture-${data.id}','fixture','fixture',0,${now},${now + 86400000},${now},${now}) ON CONFLICT(user_id) DO NOTHING`,
    ],
    { cwd: resolve(root, 'apps/api'), stdio: 'pipe' },
  );
}
