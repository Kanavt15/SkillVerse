/** Render Node entry: retain the Hono app, session cookies and CSRF policies. */
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { timingSafeEqual } from 'node:crypto';
import { createApp, runOperationalMaintenance } from '../dist/node-app.mjs';
import { gatewayClient } from './bindings.mjs';

for (const name of [
  'D1_GATEWAY_URL',
  'D1_GATEWAY_KEY',
  'WEB_PROXY_KEY',
  'APP_ORIGINS',
  'EMAIL_FROM',
  'RESEND_API_KEY',
  'IP_HASH_SALT',
  'MFA_ENCRYPTION_KEY',
  'COOKIE_SIGNING_KEY',
  'CERTIFICATE_SIGNING_KEY',
])
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
if (process.env.WEB_PROXY_KEY.length < 32)
  throw new Error('WEB_PROXY_KEY must contain at least 32 characters.');
if (!/^[a-f0-9]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY))
  throw new Error('MFA_ENCRYPTION_KEY must contain exactly 64 hex characters.');
for (const name of ['IP_HASH_SALT', 'COOKIE_SIGNING_KEY', 'CERTIFICATE_SIGNING_KEY'])
  if (process.env[name].length < 32)
    throw new Error(`${name} must contain at least 32 characters.`);
for (const origin of process.env.APP_ORIGINS.split(',').map((s) => s.trim()))
  if (!origin || new URL(origin).protocol !== 'https:' || new URL(origin).origin !== origin)
    throw new Error('APP_ORIGINS must contain exact HTTPS website origins.');
if (!['staging', 'production'].includes(process.env.ENVIRONMENT))
  throw new Error('ENVIRONMENT must be staging or production.');
if (process.env.ENFORCE_ADMIN_MFA !== 'on' || process.env.PASSWORD_BREACH_CHECK !== 'on')
  throw new Error('Render requires ENFORCE_ADMIN_MFA and PASSWORD_BREACH_CHECK to be on.');
const bindings = {
  ...process.env,
  ...gatewayClient({ url: process.env.D1_GATEWAY_URL, key: process.env.D1_GATEWAY_KEY }),
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
};
const app = createApp();
const pending = new Set();
const execution = {
  waitUntil(promise) {
    pending.add(promise);
    promise
      .catch(() => console.error('Background operation failed.'))
      .finally(() => pending.delete(promise));
  },
  passThroughOnException() {},
};
const proxyKey = Buffer.from(process.env.WEB_PROXY_KEY);
// The durable lease in D1 prevents duplicate delivery when multiple instances run.
const maintenance =
  process.env.OPERATIONS_TELEMETRY === 'on'
    ? setInterval(() => execution.waitUntil(runOperationalMaintenance(bindings)), 60000).unref()
    : null;
function trusted(value) {
  const candidate = Buffer.from(value ?? '');
  return candidate.length === proxyKey.length && timingSafeEqual(candidate, proxyKey);
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, 'https://render.internal');
    if (url.pathname !== '/api/health' && !trusted(incoming.headers['x-sv-proxy-key'])) {
      outgoing.writeHead(403);
      outgoing.end('Forbidden');
      return;
    }
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (
        typeof value === 'string' &&
        !['host', 'connection', 'transfer-encoding', 'x-sv-proxy-key', 'cf-connecting-ip'].includes(
          name,
        )
      )
        headers.set(name, value);
    }
    // Only the authenticated Vercel proxy may supply visitor IPs.
    headers.set(
      'cf-connecting-ip',
      trusted(incoming.headers['x-sv-proxy-key'])
        ? (incoming.headers['x-sv-client-ip'] ?? '127.0.0.1')
        : (incoming.socket.remoteAddress ?? '127.0.0.1'),
    );
    const request = new Request(url, {
      method: incoming.method,
      headers,
      ...(incoming.method !== 'GET' && incoming.method !== 'HEAD'
        ? { body: Readable.toWeb(incoming), duplex: 'half' }
        : {}),
    });
    const response = await app.fetch(request, bindings, execution);
    for (const [name, value] of response.headers)
      if (name !== 'set-cookie') outgoing.setHeader(name, value);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) outgoing.setHeader('set-cookie', cookies);
    outgoing.writeHead(response.status);
    if (response.body) Readable.fromWeb(response.body).pipe(outgoing);
    else outgoing.end();
  } catch {
    console.error('HTTP request failed.');
    if (!outgoing.headersSent) outgoing.writeHead(503);
    outgoing.end('Service unavailable');
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.listen(Number(process.env.PORT ?? 10000), '0.0.0.0', () =>
  console.info('SkillVerse API is listening.'),
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.once(signal, () => {
    if (maintenance) clearInterval(maintenance);
    server.close(async () => {
      await Promise.allSettled([...pending]);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 25000).unref();
  });
