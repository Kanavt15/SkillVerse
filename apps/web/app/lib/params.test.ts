import { describe, expect, it } from 'vitest';
import { newId } from '@skillverse/shared';
import { requireId } from './params';

describe('requireId', () => {
  it('returns a valid id unchanged', () => {
    const id = newId();
    expect(requireId(id)).toBe(id);
  });

  it.each([undefined, '', 'abc', '../admin', `${newId()}/x`])('rejects %s with a 400', (value) => {
    try {
      requireId(value);
      expect.fail('should have thrown');
    } catch (err) {
      expect((err as { init?: ResponseInit }).init?.status).toBe(400);
    }
  });
});
