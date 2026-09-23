# Guide: bot protection (Cloudflare Turnstile)

[Turnstile](https://developers.cloudflare.com/turnstile/) is Cloudflare's free, privacy-friendly replacement for CAPTCHAs. Most people never see a puzzle: it checks the browser silently. SkillVerse uses it on the forms bots attack most:

| Form                      | API endpoint checked                    |
| ------------------------- | --------------------------------------- |
| Sign up                   | `POST /api/v1/auth/register`            |
| Sign in                   | `POST /api/v1/auth/login`               |
| Forgot password           | `POST /api/v1/auth/forgot-password`     |
| Resend verification email | `POST /api/v1/auth/resend-verification` |

It works together with the per-IP rate limits and the account lockout. It doesn't replace them.

## How it works

1. The page renders the widget (`apps/web/app/components/auth/turnstile.tsx`) using the **site key**.
2. The widget puts a one-time token into a hidden field `cf-turnstile-response`.
3. The page's action forwards it to the API in the `x-turnstile-token` header.
4. The API's `requireHuman` middleware (`apps/api/src/middleware/turnstile.ts`) sends it with the **secret key** to Cloudflare's `siteverify` endpoint, and rejects the request (400, field `turnstile`) if it isn't valid.

When Turnstile is enabled, the website's Content-Security-Policy allows `https://challenges.cloudflare.com` for scripts and frames. When it's off, it doesn't. If Cloudflare's verify endpoint is unreachable, the API **fails open** and logs `turnstile.unavailable`, so an outage there doesn't lock users out.

## Turn it on

It's **off** by default: no keys, no widget, and local development works offline.

### Try it locally with Cloudflare's test keys

Cloudflare publishes keys that always pass (or always fail) for testing:

| Purpose       | Site key (web)             | Secret key (API)                      |
| ------------- | -------------------------- | ------------------------------------- |
| Always passes | `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` |
| Always fails  | `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` |

1. In `apps/api/.dev.vars` set `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`.
2. Create `apps/web/.dev.vars` (git-ignored) containing `TURNSTILE_SITE_KEY=1x00000000000000000000AA`.
3. Restart `npm run dev`. The widget appears on the sign-in and sign-up pages.

### Production

1. Cloudflare dashboard → **Turnstile** → **Add widget**. Hostnames: your domain (and the staging `workers.dev` host for staging). Mode: **Managed**.
2. Put the **site key** (public) in `apps/web/wrangler.jsonc` → `env.production.vars.TURNSTILE_SITE_KEY`.
3. `npx wrangler secret put TURNSTILE_SECRET_KEY --env production` (run inside `apps/api`).
4. Deploy both Workers.

Both keys must be set. With only the secret, every form submission would fail (no widget, so no token). With only the site key, the widget shows but nothing is verified.
