import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './button';

afterEach(cleanup);

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button');
  });

  it('merges custom classes with variant classes', () => {
    render(
      <Button variant="secondary" className="w-full">
        Go
      </Button>,
    );
    const el = screen.getByRole('button', { name: 'Go' });
    expect(el.className).toContain('w-full');
    expect(el.className).toContain('border');
  });
});
