import { describe, expect, it } from 'vitest';
import { applyHtmlSecurityHeaders, buildCsp, createNonce } from './security.server';

function directive(csp: string, name: string): string[] {
  const found = csp.split('; ').find((d) => d.startsWith(`${name} `));
  return found ? found.split(' ').slice(1) : [];
}

describe('createNonce', () => {
  it('is random and at least 128 bits', () => {
    const a = createNonce();
    expect(a).not.toBe(createNonce());
    expect(atob(a)).toHaveLength(16);
  });
});

describe('buildCsp', () => {
  const csp = buildCsp({ nonce: 'abc123', dev: false });

  it('allows scripts only from our origin or with the nonce', () => {
    expect(directive(csp, 'script-src')).toEqual(["'self'", "'nonce-abc123'"]);
  });

  it('never allows inline or eval scripts', () => {
    expect(directive(csp, 'script-src')).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('forbids framing, plugins and foreign form targets', () => {
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'form-action')).toEqual(["'self'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
  });

  it('allows Cloudflare Turnstile only when it is enabled', () => {
    expect(csp).not.toContain('challenges.cloudflare.com');
    expect(directive(csp, 'frame-src')).toEqual(["'none'"]);
    const withTurnstile = buildCsp({ nonce: 'x', dev: false, turnstile: true });
    expect(directive(withTurnstile, 'script-src')).toContain('https://challenges.cloudflare.com');
    expect(directive(withTurnstile, 'frame-src')).toEqual(['https://challenges.cloudflare.com']);
    expect(directive(withTurnstile, 'script-src')).not.toContain("'unsafe-inline'");
  });

  it('only opens websockets and allows http in development', () => {
    expect(directive(csp, 'connect-src')).toEqual(["'self'"]);
    expect(csp).toContain('upgrade-insecure-requests');
    const devCsp = buildCsp({ nonce: 'x', dev: true });
    expect(directive(devCsp, 'connect-src')).toContain('ws:');
    expect(devCsp).not.toContain('upgrade-insecure-requests');
  });
});

describe('applyHtmlSecurityHeaders', () => {
  it('sets HSTS only in production', () => {
    const prod = new Headers();
    applyHtmlSecurityHeaders(prod, { nonce: 'n', dev: false, production: true });
    expect(prod.get('strict-transport-security')).toContain('max-age=63072000');
    expect(prod.get('x-frame-options')).toBe('DENY');

    const dev = new Headers();
    applyHtmlSecurityHeaders(dev, { nonce: 'n', dev: true, production: false });
    expect(dev.get('strict-transport-security')).toBeNull();
  });
});
