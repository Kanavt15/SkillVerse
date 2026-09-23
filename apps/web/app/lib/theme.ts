/**
 * Light/dark theme preference, stored in a cookie so the SERVER can render the
 * right theme on first paint. That avoids a flash of the wrong theme and needs
 * no inline script (which would complicate the CSP).
 *
 * 'system' (the default) follows the operating system via a CSS media query.
 */

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = 'sv_theme';

/** Reads the theme from a Cookie header. Unknown or missing values fall back to 'system'. */
export function parseThemeCookie(cookieHeader: string | null): Theme {
  const match = cookieHeader?.match(/(?:^|;\s*)sv_theme=([a-z]+)/);
  const value = match?.[1];
  return (THEMES as readonly string[]).includes(value ?? '') ? (value as Theme) : 'system';
}

/** Browser only: persists the choice for a year and applies it immediately. */
export function setTheme(theme: Theme): void {
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}
