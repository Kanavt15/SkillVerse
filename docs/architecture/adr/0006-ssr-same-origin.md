# ADR 0006: SSR on one origin with a CSP nonce

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

v1 was a client-only React app on one domain calling an API on another, which needed CORS, cross-site cookies and had weak SEO. A marketplace lives on search traffic (course pages must rank), and Google AdSense approval requires crawlable content.

## Decision

- The website is rendered on the server with **React Router (framework mode)** in a Worker, then hydrated in the browser.
- The website and API share **one origin**. Production uses Workers Routes (`/api/*` goes to the API Worker). Dev and staging forward `/api/*` inside the web Worker. Loaders call the API through a **service binding**.
- Every HTML response gets a **Content-Security-Policy with a per-request nonce**. The nonce is created in `workers/app.ts`, shared through React Router's request context, applied by `entry.server.tsx`, and sent to the client in root loader data so hydration matches.
- The theme preference is a cookie read on the server, so there's no inline "flash-prevention" script.

## Consequences

- ✅ Good SEO and fast first paint, with no CORS surface. CSRF defence is Origin check + custom header + SameSite cookies.
- ✅ `script-src 'self' 'nonce-…'` blocks injected scripts even if an XSS bug slips through.
- ⚠️ Every third-party script (Razorpay, AdSense, Turnstile) must be explicitly allowlisted in `apps/web/app/lib/security.server.ts`. That's intended friction.
- ⚠️ `style-src` allows `'unsafe-inline'` (React style attributes, Vite dev CSS). Accepted: style injection can't execute code.
