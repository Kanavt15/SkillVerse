# Changelog

All notable changes to SkillVerse are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org).

## [Unreleased]

### Phase 1: Core learning platform (in progress)

#### Added

- **Accounts and authentication (API):**
  - registration with email verification;
  - sign-in and sign-out with server-side sessions (HttpOnly `__Host-` cookie, token stored hashed, 7-day idle and 30-day absolute expiry);
  - password reset and change, which sign out other devices;
  - device list with per-device revoke;
  - profile editing and onboarding answers.
- **Security:**
  - PBKDF2 password hashing and a breached-password check (Have I Been Pwned, k-anonymity);
  - no account enumeration;
  - account lockout after 10 failures, plus per-IP auth rate limits;
  - single-use hashed email tokens;
  - audit log entries for auth events;
  - a deny-by-default test covering every API route.
- **Website auth pages:**
  - sign up, check email (with resend), confirm email, sign in, sign out (POST only), forgot and reset password;
  - onboarding (goal, interests, timezone), dashboard;
  - settings for profile, password and devices;
  - account menu in the header;
  - dev mailbox page.
- **Website security:**
  - Origin check on every form submission (CSRF);
  - open-redirect protection for `?redirectTo=`;
  - the visitor's IP and user agent are forwarded to the API, so per-IP rate limits and the device list are accurate;
  - secret form fields are never echoed back.
- UI components: Field (accessible labels and errors), Input, PasswordInput (show/hide), Alert, Card, SubmitButton (pending state), LocalTime (hydration-safe dates).
- **Two-factor authentication (TOTP):**
  - authenticator-app setup with a QR code rendered on the server;
  - 10 hashed single-use recovery codes;
  - pending sessions after the password step (10-minute expiry, 5 attempts);
  - replay protection and session-token rotation;
  - password reset and email verification can't bypass it;
  - settings UI to set up, regenerate and turn off;
  - `/login/2fa` step;
  - `requireMfa` middleware for admin and payout areas.
- **Continue with Google:**
  - OpenID Connect code flow with PKCE, `state` and `nonce`, with HMAC-signed short-lived state cookies;
  - server-side code exchange and ID token claim validation;
  - accounts matched by Google id, with pre-hijacking protection for unverified accounts;
  - 2FA still applies;
  - off unless configured and flagged on;
  - setup guide.
- **Bot protection (Cloudflare Turnstile):**
  - widget on sign-up, sign-in, forgot password and resend verification;
  - tokens verified by the API;
  - CSP allowance only when enabled;
  - off until keys are set;
  - guide with Cloudflare test keys.
- **Teaching (API):**
  - apply to teach; staff approve (grants the instructor role) or reject with feedback, and the applicant is emailed;
  - Studio course builder: create, edit details, price, outcomes, tags; sections and lessons (video by YouTube/Vimeo link, or article) with reorder, move and delete;
  - submit for review with a completeness checklist, withdraw, archive;
  - admin course review queue with curriculum inspection, history, approve (publish) or reject with notes;
  - one policy module for course access; separation of duties (no reviewing your own course or application);
  - staff areas require 2FA (`ENFORCE_ADMIN_MFA`, relaxed only in local dev).
- **Teaching (website):**
  - `/teach` page: why teach, how it works, apply (topics, experience, sample link) and application status with reviewer feedback;
  - Instructor Studio: my courses, create a course, course editor (details, price in rupees, outcomes, tags, category, level, language), curriculum builder (sections and lessons, rename, reorder with up/down, delete), live review checklist, submit, withdraw and archive;
  - lesson editor with YouTube/Vimeo preview, article text, duration, free-preview flag and moving between sections;
  - admin area: overview, instructor applications (approve, or reject with feedback), course review queue and inspection page (curriculum, automatic checks, history, publish or request changes), and a "turn on 2FA" screen for staff without it;
  - account menu links to the Studio or "Teach on SkillVerse", and Admin for staff; the dashboard links to `/teach`.
- CSP now allows frames only from the YouTube-nocookie and Vimeo players (plus Turnstile when enabled).
- Catalog tables (courses, sections, lessons, tags, instructor applications, review events) and 12 seeded categories.
- `predev` step that clears stale local dev-registry entries (fixes "Network connection lost" after a crashed dev session).
- Demo accounts for local development (`npm run db:seed`).
- Email service: Resend in production; a dev mailbox (terminal + `/api/v1/dev/mailbox`) locally.
- Database: `user_profiles` and `email_tokens` tables, a public session `handle`, and lockout columns on `users`.
- Docs: authentication architecture, D1 duplicate-column-name gotcha, updated schema reference, ASVS checklist and threat model.

### Phase 0: Foundation

#### Added

- npm-workspaces monorepo (`apps/api`, `apps/web`, `packages/db`, `packages/shared`) with shared TypeScript, ESLint (including security rules) and Prettier configuration.
- `npm run setup` for one-command setup (dependencies, local secrets, local database, seed data) and `npm run dev` to start the API and website together.
- **API** (Hono on Cloudflare Workers):
  - request IDs, structured logging with secret redaction, strict security headers, CSRF origin checks, rate limiting, 64 KB body limit;
  - the standard JSON error contract;
  - `/api/health` and `/api/v1/meta` endpoints;
  - OpenAPI docs at `/api/docs`.
- **Database** (D1 + Drizzle): users, roles, sessions, platform settings, feature flags and audit log tables; first migration; seed data; Drizzle Studio launcher.
- **Website** (React Router SSR on Workers):
  - per-request CSP nonce and security headers;
  - same-origin `/api` forwarding through a service binding;
  - design token system with light/dark theme (cookie-backed, no flash);
  - self-hosted fonts, landing page, SEO-friendly 404.
- Documentation: README contributor path, beginner guides (Cloudflare, D1), architecture overview and ADRs, database schema reference, security docs, business model, design system, deployment and free-tier guides, and an automated docs check.
- CI workflow, pull request and issue templates.

#### Removed

- The legacy Express/MongoDB/Redis application. It is preserved under the git tag `legacy-v1`.
