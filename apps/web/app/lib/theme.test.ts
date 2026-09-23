import { describe, expect, it } from 'vitest';
import { parseThemeCookie } from './theme';

describe('parseThemeCookie', () => {
  it('reads a valid theme among other cookies', () => {
    expect(parseThemeCookie('a=1; sv_theme=dark; b=2')).toBe('dark');
    expect(parseThemeCookie('sv_theme=light')).toBe('light');
  });

  it('falls back to system for missing or unknown values', () => {
    expect(parseThemeCookie(null)).toBe('system');
    expect(parseThemeCookie('sv_theme=hacker')).toBe('system');
    expect(parseThemeCookie('xsv_theme=dark')).toBe('system');
  });
});
