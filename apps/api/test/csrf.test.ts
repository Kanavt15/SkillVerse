/**
 * CSRF middleware: state-changing requests need an allowed Origin AND the client header.
 * No POST routes exist yet, so a request that passes CSRF reaches the 404 handler.
 * 404 therefore means "allowed through", 403 means "blocked".
 */
import { describe, expect, it } from 'vitest';
import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@skillverse/shared';
import { ORIGIN, call, callAsWebApp } from './helpers';

describe('CSRF protection', () => {
  it('blocks POST without an Origin header', async () => {
    const res = await call('/api/v1/anything', {
      method: 'POST',
      headers: { [CSRF_HEADER]: CSRF_HEADER_VALUE },
    });
    expect(res.status).toBe(403);
  });

  it('blocks POST from a foreign origin', async () => {
    const res = await call('/api/v1/anything', {
      method: 'POST',
      headers: { origin: 'https://evil.example', [CSRF_HEADER]: CSRF_HEADER_VALUE },
    });
    expect(res.status).toBe(403);
  });

  it('blocks POST without the client header (e.g. a plain HTML form)', async () => {
    const res = await call('/api/v1/anything', { method: 'POST', headers: { origin: ORIGIN } });
    expect(res.status).toBe(403);
  });

  it('allows POST from the web app', async () => {
    const res = await callAsWebApp('/api/v1/anything', { method: 'POST', body: '{}' });
    expect(res.status).toBe(404);
  });

  it('does not check safe methods', async () => {
    const res = await call('/api/health');
    expect(res.status).toBe(200);
  });

  it('exempts webhooks (they authenticate with signatures instead)', async () => {
    const res = await call('/api/v1/webhooks/razorpay', { method: 'POST', body: '{}' });
    expect(res.status).toBe(404);
  });

  it('rejects oversized bodies with 413', async () => {
    const res = await callAsWebApp('/api/v1/anything', {
      method: 'POST',
      body: JSON.stringify({ x: 'a'.repeat(70 * 1024) }),
    });
    expect(res.status).toBe(413);
  });
});
