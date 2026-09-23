/**
 * Public catalog endpoints.
 */
import { describe, expect, it } from 'vitest';
import { INTEREST_OPTIONS } from '@skillverse/shared';
import { call } from './helpers';

describe('GET /api/v1/categories', () => {
  it('lists the seeded categories in menu order, matching onboarding interests', async () => {
    const res = await call('/api/v1/categories');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    const body = await res.json<{ data: { slug: string; name: string }[] }>();
    expect(body.data.map((c) => c.slug)).toEqual(INTEREST_OPTIONS.map((i) => i.slug));
  });
});
