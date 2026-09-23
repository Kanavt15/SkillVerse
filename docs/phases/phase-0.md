# Phase 0: Foundation

**Goal:** a secure, documented, deployable skeleton that every later feature builds on.
**Status:** ✅ Complete.

## Scope and done-checklist

### Repository and tooling

- [x] Legacy v1 removed from the working tree and preserved under git tag `legacy-v1`
- [x] npm workspaces: `apps/api`, `apps/web`, `packages/db`, `packages/shared`
- [x] Shared strict TypeScript config, ESLint with security rules, Prettier, EditorConfig, LF line endings
- [x] `npm run setup` (versions, install, secrets, local DB, seed) and `npm run dev` (concurrently)
- [x] `npm run check` = lint + typecheck + test + docs check
- [x] CI workflow, PR and issue templates, Dependabot

### Database

- [x] Drizzle schema: `users`, `user_roles`, `sessions`, `platform_settings`, `feature_flags`, `audit_logs`
- [x] First migration, seed data (business defaults and feature flags), Drizzle Studio launcher

### API

- [x] Hono on Workers with OpenAPI-documented routes (`/api/health`, `/api/v1/meta`, `/api/docs`)
- [x] Request IDs, structured logging with redaction, standard error contract
- [x] Security headers, CSRF protection, rate limiting, body-size limit
- [x] Integration tests in workerd against real D1 (17 tests)

### Website

- [x] React Router SSR on Workers, `/api` forwarded via service binding (single origin)
- [x] CSP with per-request nonce plus security headers, hydration-safe
- [x] Design tokens, light/dark theme (cookie, no flash), self-hosted fonts
- [x] Header, footer, landing page, SEO-friendly 404, robots.txt
- [x] Unit tests (10 tests). Client JS ~146 KB gzip (budget 180 KB)
- [x] Verified in a real browser: no console errors, no CSP violations, theme persists, mobile layout without horizontal scroll

### Documentation

- [x] README with the full contributor path, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, CHANGELOG
- [x] Guides: Cloudflare primer, D1 primer, add endpoint/page/table, tests, debugging
- [x] Architecture overview, database schema reference, ADRs 0001–0006
- [x] Security: threat model, ASVS checklist, incident response
- [x] Business: revenue model, compliance. Design: design system, information architecture
- [x] Operations: deployment, free-tier limits, backups

### Deferred to Phase 1 (by decision)

- Staging deploy: needs your Cloudflare login. Follow [deployment.md](../operations/deployment.md) when ready.
- Playwright end-to-end tests: added together with the first user journeys (sign-up, course).
- Lighthouse CI budgets: added when there are real pages to measure.

## Notes and decisions made during the phase

- **React Router 7 (not 8).** v8 requires Node ≥ 22.22. v7.18 supports Node 20+ and the same APIs, and it opts into v8 behaviour through `future` flags, so upgrading later is small.
- **No KV binding yet.** The free plan allows only 1,000 KV writes per day, so caches use Worker memory instead. See [free-tier-limits.md](../operations/free-tier-limits.md).
- **Compatibility date 2026-08-20**, the newest date supported by the Workers runtime bundled with the test pool. Bump it when the tooling updates.
