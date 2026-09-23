/**
 * Security headers for HTML pages, including a Content-Security-Policy (CSP)
 * with a fresh random nonce per response.
 *
 * What the CSP does: the browser refuses to run any <script> that isn't
 * served from our own origin or doesn't carry this response's nonce. Even if
 * an attacker manages to inject HTML (XSS), their script won't execute.
 *
 * When a third party is added (Razorpay, AdSense, Turnstile, YouTube…), extend
 * the matching directive HERE, list the exact hosts, and note why in a comment.
 */

/** 128 random bits, base64. Unguessable, and new for every response. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export interface CspOptions {
  nonce: string;
  /** Vite dev server needs a websocket for hot reload. */
  dev: boolean;
}

export function buildCsp({ nonce, dev }: CspOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`],
    // 'unsafe-inline' for styles only: React style={{}} attributes and Vite's dev CSS need it.
    // Style injection can't execute code, so this is a far smaller risk than inline scripts.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'"],
    'connect-src': dev ? ["'self'", 'ws:', 'wss:'] : ["'self'"],
    'media-src': ["'self'", 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'frame-src': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`);
  if (!dev) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}

/** Sets every security header an HTML response should carry. */
export function applyHtmlSecurityHeaders(
  headers: Headers,
  opts: CspOptions & { production: boolean },
): void {
  headers.set('Content-Security-Policy', buildCsp(opts));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (opts.production) {
    headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
}
