/**
 * Open-redirect protection.
 *
 * Pages like /login?redirectTo=… send the user somewhere after success. If we
 * redirected to any value, an attacker could send people a real SkillVerse
 * link that ends on their phishing site ("/login?redirectTo=https://evil.example").
 * `safeRedirect` only allows paths on THIS site.
 */

const DEFAULT_TARGET = '/dashboard';

/** Backslash or any control character (tab, newline, NUL, DEL…). */
function hasUnsafeChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

export function safeRedirect(
  to: FormDataEntryValue | string | null | undefined,
  fallback = DEFAULT_TARGET,
): string {
  if (typeof to !== 'string' || to.length === 0 || to.length > 500) return fallback;
  // Must be a path on this origin: starts with "/" but not "//" or "/\" (protocol-relative URLs),
  // and has no control characters or backslashes that browsers may normalise into "//".
  if (!to.startsWith('/') || to.startsWith('//') || hasUnsafeChars(to)) return fallback;
  try {
    // Parse against a dummy origin; if the result escapes it, reject.
    const url = new URL(to, 'https://skillverse.invalid');
    if (url.origin !== 'https://skillverse.invalid') return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
