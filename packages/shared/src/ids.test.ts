import { describe, expect, it } from 'vitest';
import { isId, newId } from './ids';
import { idSchema } from './schemas/common';

describe('newId', () => {
  it('produces valid UUIDv7 strings', () => {
    const id = newId();
    expect(isId(id)).toBe(true);
    expect(id[14]).toBe('7');
  });

  it('sorts by creation time', () => {
    const earlier = newId(1_700_000_000_000);
    const later = newId(1_700_000_000_001);
    expect(earlier < later).toBe(true);
  });

  it('is unique across many calls', () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => newId()));
    expect(ids.size).toBe(10_000);
  });
});

describe('idSchema', () => {
  it('rejects non-v7 and injection-looking input', () => {
    expect(idSchema.safeParse(newId()).success).toBe(true);
    expect(idSchema.safeParse('1').success).toBe(false);
    expect(idSchema.safeParse("1' OR '1'='1").success).toBe(false);
    expect(idSchema.safeParse(crypto.randomUUID()).success).toBe(false); // v4
  });
});
