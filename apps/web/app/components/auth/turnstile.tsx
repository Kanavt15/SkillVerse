/**
 * Cloudflare Turnstile widget (bot check) for sign-up, sign-in and similar forms.
 *
 * Renders nothing unless TURNSTILE_SITE_KEY is configured (root loader).
 * The widget puts its one-time token in a hidden input named
 * "cf-turnstile-response" inside the form; the route's action forwards it to
 * the API (`api(…, { turnstileToken })`), which verifies it with Cloudflare.
 *
 * Tokens are single-use, so pass `resetKey={actionData}`: after every
 * submission the widget is re-created and issues a fresh token.
 */
import { useEffect, useRef } from 'react';
import { useRouteLoaderData } from 'react-router';

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<void> | null = null;

/** Loads Cloudflare's script once per page (the CSP allows this host only when Turnstile is on). */
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Turnstile failed to load'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function Turnstile({
  action,
  resetKey,
  error,
}: {
  /** Label shown in Cloudflare's analytics, e.g. "login". */
  action: string;
  resetKey?: unknown;
  error?: string;
}) {
  const root = useRouteLoaderData('root') as { turnstileSiteKey?: string | null } | undefined;
  const siteKey = root?.turnstileSiteKey;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let widgetId: string | undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          action,
          theme: 'auto',
          'response-field-name': 'cf-turnstile-response',
        });
      })
      .catch(() => {
        /* The API reports a missing token if this happens; nothing more to do here. */
      });
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, action, resetKey]);

  if (!siteKey) return null;
  return (
    <div>
      <div ref={ref} className="min-h-[65px]" />
      {error && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Reads the widget's token from a submitted form (server side, in actions). */
export function turnstileToken(formData: FormData): string | undefined {
  const value = formData.get('cf-turnstile-response');
  return typeof value === 'string' && value ? value : undefined;
}
