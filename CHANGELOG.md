# Changelog

All notable changes to SkillVerse are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org).

## [Unreleased]

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
