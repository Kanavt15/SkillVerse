import { describe, expect, it } from 'vitest';
import { isCrossSiteRequest } from './csrf.server';

const req = (method: string, origin?: string) =>
  new Request('https://skillverse.in/login', {
    method,
    headers: origin ? { origin } : {},
  });

describe('isCrossSiteRequest', () => {
  it('allows same-origin form posts', () => {
    expect(isCrossSiteRequest(req('POST', 'https://skillverse.in'))).toBe(false);
  });

  it('blocks posts from other sites or with no Origin', () => {
    expect(isCrossSiteRequest(req('POST', 'https://evil.example'))).toBe(true);
    expect(isCrossSiteRequest(req('POST', 'https://skillverse.in.evil.example'))).toBe(true);
    expect(isCrossSiteRequest(req('POST', 'http://skillverse.in'))).toBe(true); // downgraded scheme
    expect(isCrossSiteRequest(req('POST'))).toBe(true);
    expect(isCrossSiteRequest(req('DELETE', 'null'))).toBe(true);
  });

  it('ignores safe methods', () => {
    expect(isCrossSiteRequest(req('GET', 'https://evil.example'))).toBe(false);
    expect(isCrossSiteRequest(req('HEAD'))).toBe(false);
  });
});
