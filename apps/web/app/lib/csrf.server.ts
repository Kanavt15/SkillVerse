/**
 * CSRF protection for the website's own form submissions.
 *
 * React Router actions receive normal HTML form POSTs. A malicious site could
 * make a visitor's browser submit a form to us (e.g. forcing a sign-in into the
 * attacker's account, or a sign-out). Browsers always send an `Origin` header
 * on POST, and a web page can't forge it, so we accept state-changing requests
 * only when Origin is exactly our own origin.
 *
 * Layers: this check + SameSite=Lax session cookies + the API's own CSRF check.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isCrossSiteRequest(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return false;
  const origin = request.headers.get('origin');
  return !origin || origin !== new URL(request.url).origin;
}
