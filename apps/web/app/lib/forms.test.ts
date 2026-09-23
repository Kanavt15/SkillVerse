import { describe, expect, it } from 'vitest';
import { loginSchema } from '@skillverse/shared';
import { formError, formValues, validate } from './forms';

describe('formValues', () => {
  it('reads only the listed text fields', () => {
    const fd = new FormData();
    fd.set('email', 'a@b.co');
    fd.set('role', 'admin'); // not listed → ignored (mass-assignment guard)
    fd.set('file', new Blob(['x']));
    expect(formValues(fd, ['email', 'password', 'file'] as const)).toEqual({
      email: 'a@b.co',
      password: '',
      file: '',
    });
  });
});

describe('validate', () => {
  it('returns field errors keyed by field name', () => {
    const res = validate(loginSchema, { email: 'nope', password: '' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.fieldErrors.email).toBeDefined();
      expect(res.fieldErrors.password).toBeDefined();
    }
  });
});

describe('formError', () => {
  it('never echoes secret fields back to the browser', () => {
    const response = formError({
      formError: 'x',
      values: { email: 'a@b.co', password: 'hunter2hunter2', token: 'abc', newPassword: 'n' },
    });
    expect(response.init?.status).toBe(400);
    expect(response.data.values).toEqual({ email: 'a@b.co' });
  });
});
