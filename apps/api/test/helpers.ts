/**
 * Test helpers: send requests to the Worker exactly as a browser would.
 */
import { exports } from 'cloudflare:workers';
import { CSRF_HEADER, CSRF_HEADER_VALUE, SESSION_COOKIE_DEV } from '@skillverse/shared';

export const ORIGIN = 'http://localhost:5173';

/**
 * A different client IP for every request. The auth endpoints allow only 10
 * requests per minute per IP, and tests make far more; rate limiting itself is
 * tested separately (rate-limit.test.ts).
 */
function randomIp(): string {
  const n = () => Math.floor(Math.random() * 254) + 1;
  return `10.${n()}.${n()}.${n()}`;
}

/** Calls the Worker's fetch handler with a path like "/api/health". */
export function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('cf-connecting-ip')) headers.set('cf-connecting-ip', randomIp());
  return exports.default.fetch(new Request(`http://localhost:8787${path}`, { ...init, headers }));
}

/** Like `call`, but with the headers our web app sends on state-changing requests. */
export function callAsWebApp(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('origin', ORIGIN);
  headers.set(CSRF_HEADER, CSRF_HEADER_VALUE);
  headers.set('content-type', 'application/json');
  return call(path, { ...init, headers });
}

/** POST JSON as the web app, optionally with a session cookie. */
export function postJson(path: string, body: unknown, cookie?: string, method = 'POST') {
  return callAsWebApp(path, {
    method,
    body: JSON.stringify(body),
    headers: cookie ? { cookie } : {},
  });
}

/** Extracts "sv_session=<token>" from a response's Set-Cookie header, for use as a Cookie header. */
export function sessionCookieFrom(res: Response): string | undefined {
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(new RegExp(`${SESSION_COOKIE_DEV}=([^;]*)`));
  return match && match[1] ? `${SESSION_COOKIE_DEV}=${match[1]}` : undefined;
}

interface MailboxEntry {
  to: string;
  subject: string;
  text: string;
}

/** Newest email sent to `to` in the dev mailbox. */
export async function lastEmailTo(to: string): Promise<MailboxEntry | undefined> {
  const res = await call('/api/v1/dev/mailbox');
  const body = await res.json<{ data: MailboxEntry[] }>();
  return body.data.find((m) => m.to === to);
}

/** Pulls the `token=...` value out of an email's link. */
export function tokenFrom(mail: MailboxEntry | undefined): string {
  const match = mail?.text.match(/token=([A-Za-z0-9_-]+)/);
  if (!match?.[1]) throw new Error(`No token link in email: ${mail?.subject ?? '(none)'}`);
  return match[1];
}

let counter = 0;
/** Unique, valid sign-up data for one test. */
export function newUser(
  overrides: Partial<Record<'email' | 'username' | 'displayName' | 'password', string>> = {},
) {
  counter += 1;
  const tag = `${Date.now().toString(36)}${counter}`;
  return {
    email: `user_${tag}@example.com`,
    username: `user_${tag}`,
    displayName: 'Test User',
    password: 'correct horse battery staple',
    ...overrides,
  };
}

/** Registers, verifies and returns a signed-in user with their session cookie. */
export async function signedInUser(overrides: Parameters<typeof newUser>[0] = {}) {
  const user = newUser(overrides);
  await postJson('/api/v1/auth/register', user);
  const token = tokenFrom(await lastEmailTo(user.email));
  const res = await postJson('/api/v1/auth/verify-email', { token });
  const cookie = sessionCookieFrom(res);
  if (!cookie) throw new Error('verify-email did not set a session cookie');
  return { ...user, cookie };
}
