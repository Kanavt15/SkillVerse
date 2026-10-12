/** Execute the real built custom server entry with isolated HTTP provider fixtures. */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const bundles = await readdir('apps/web/build/server');
const bundle = bundles.find((name) => name.startsWith('nodejs_'));
assert.ok(bundle, 'Build the Vercel SSR target first.');
const assetDir = resolve('apps/web/build/server', bundle, 'assets');
for (const file of (await readdir(assetDir)).filter((file) => file.endsWith('.js'))) {
  const code = await readFile(resolve(assetDir, file), 'utf8');
  assert.doesNotMatch(
    code,
    /from\s+['"]@(?:vercel\/react-router|react-router\/node)/,
    'SSR helpers must be bundled so hosting build tools stay out of runtime dependencies.',
  );
}
const { default: handle } = await import(
  pathToFileURL(resolve('apps/web/build/server', bundle, 'index.js')).href
);
assert.equal(
  typeof handle,
  'function',
  'The server bundle must export the custom request handler.',
);
process.env.API_BASE_URL = 'https://backend.test';
process.env.WEB_PROXY_KEY = 'isolated-vercel-proxy-key-0123456789abcdef';
process.env.ENVIRONMENT = 'production';
const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (request) => {
  assert.equal(new URL(request.url).origin, 'https://backend.test');
  assert.equal(request.headers.get('x-sv-proxy-key'), process.env.WEB_PROXY_KEY);
  calls.push({ path: new URL(request.url).pathname, ip: request.headers.get('x-sv-client-ip') });
  const path = new URL(request.url).pathname;
  if (path === '/api/v1/meta')
    return Response.json({
      ok: true,
      data: { appName: 'SkillVerse', environment: 'production', features: {} },
    });
  if (path === '/api/v1/categories') return Response.json({ ok: true, data: [] });
  if (path === '/api/v1/courses')
    return Response.json({
      ok: true,
      data: { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
    });
  if (path === '/api/v1/auth/login')
    return Response.json(
      { ok: true, data: { message: 'Fixture response' } },
      {
        headers: {
          'set-cookie': '__Host-sv_session=fixture; Secure; HttpOnly; SameSite=Lax; Path=/',
        },
      },
    );
  return Response.json(
    { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } },
    { status: 401 },
  );
};
try {
  const response = await handle(
    new Request('https://website.test/', {
      headers: { 'x-forwarded-for': '192.0.2.5', 'cf-connecting-ip': 'spoofed' },
    }),
  );
  assert.equal(response.status, 200);
  const html = await response.text(),
    csp = response.headers.get('content-security-policy');
  assert.match(html, /SkillVerse/);
  const nonce = csp?.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce, 'SSR must emit a CSP nonce.');
  assert.ok(html.includes(`nonce="${nonce}"`), 'The HTML and CSP must use the same nonce.');
  assert.ok(
    calls.length > 0 && calls.every((call) => call.ip === '192.0.2.5'),
    'SSR public and private API reads must use the trusted visitor IP.',
  );
  const count = calls.length;
  assert.equal(
    (
      await handle(
        new Request('https://website.test/login', {
          method: 'POST',
          headers: { origin: 'https://attacker.test' },
          body: 'email=example',
        }),
      )
    ).status,
    403,
  );
  assert.equal(calls.length, count, 'A rejected cross-site form must not reach the backend.');
  const proxy = await handle(
    new Request('https://website.test/api/v1/auth/login', {
      method: 'POST',
      headers: {
        origin: 'https://website.test',
        'content-type': 'application/json',
        'x-forwarded-for': '192.0.2.8',
      },
      body: '{}',
    }),
  );
  assert.equal(proxy.status, 200);
  assert.match(proxy.headers.get('set-cookie'), /__Host-sv_session=fixture; Secure; HttpOnly/);
  assert.equal(calls.at(-1).ip, '192.0.2.8');
  assert.equal(
    (await handle(new Request('https://website.test/api/v1/me/notifications/live'))).status,
    426,
  );
  console.info(
    'Vercel built runtime passed: SSR, matching CSP nonce, trusted visitor IP, CSRF, API proxy, cookie relay and notification fallback.',
  );
} finally {
  globalThis.fetch = originalFetch;
}
