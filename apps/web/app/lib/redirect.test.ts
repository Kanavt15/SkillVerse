import { describe, expect, it } from 'vitest';
import { safeRedirect } from './redirect';

describe('safeRedirect (open-redirect protection)', () => {
  it('keeps same-site paths, including query and hash', () => {
    expect(safeRedirect('/settings')).toBe('/settings');
    expect(safeRedirect('/courses?page=2#top')).toBe('/courses?page=2#top');
  });

  it('rejects anything that could leave the site', () => {
    for (const evil of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      '/\t/evil.example',
      'evil.example/path',
      ' /settings',
    ]) {
      expect(safeRedirect(evil), evil).toBe('/dashboard');
    }
  });

  it('falls back for missing or oversized values', () => {
    expect(safeRedirect(null)).toBe('/dashboard');
    expect(safeRedirect('')).toBe('/dashboard');
    expect(safeRedirect(`/${'a'.repeat(600)}`)).toBe('/dashboard');
    expect(safeRedirect(undefined, '/')).toBe('/');
  });
});
