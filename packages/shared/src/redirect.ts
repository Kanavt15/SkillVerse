/** Same-origin redirect policy shared by email templates, OAuth and web actions. */
export function safeRedirect(to: unknown, fallback = '/dashboard'): string {
  if (typeof to !== 'string' || !to || to.length > 500) return fallback;
  if (!to.startsWith('/') || to.startsWith('//')) return fallback;
  for (const character of to) {
    const code = character.charCodeAt(0);
    if (code < 0x20 || code === 0x7f || code === 0x5c) return fallback;
  }
  try {
    const url = new URL(to, 'https://skillverse.invalid');
    if (url.origin !== 'https://skillverse.invalid') return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
