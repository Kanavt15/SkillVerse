import { describe, expect, it } from 'vitest';
import { redact } from '../src/lib/logger';

describe('redact', () => {
  it('hides secret-looking keys at any depth', () => {
    expect(
      redact({
        email: 'a@b.c',
        password: 'hunter2',
        nested: { accessToken: 'x', razorpay_signature: 'y', ok: 1 },
        list: [{ Authorization: 'Bearer z' }],
      }),
    ).toEqual({
      email: 'a@b.c',
      password: '[REDACTED]',
      nested: { accessToken: '[REDACTED]', razorpay_signature: '[REDACTED]', ok: 1 },
      list: [{ Authorization: '[REDACTED]' }],
    });
  });
});
