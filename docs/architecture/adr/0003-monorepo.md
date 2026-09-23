# ADR 0003: npm-workspaces monorepo

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

The API and website must share validation rules, error formats, money helpers and the database schema. Contributors should be able to install and run everything with one command, on Windows too.

## Decision

A single repository using **npm workspaces**: `apps/api`, `apps/web`, `packages/db` and `packages/shared`. Shared configs (TypeScript, ESLint, Prettier) live at the root. Shared packages ship TypeScript source with no build step, and Wrangler and Vite compile them with the app. `concurrently` runs both apps from `npm run dev`.

## Consequences

- ✅ One `npm install`, one lockfile, one `npm run check`. A change to a shared schema is type-checked against both apps immediately.
- ✅ No extra tooling to learn (no Turborepo/Nx/pnpm). npm ships with Node.
- ⚠️ No build cache. Acceptable at this size; revisit if CI becomes slow.
- ⚠️ npm 10 has a resolver bug with some peer dependencies ("edgesOut") when installing new packages without a lockfile. Workaround: `npx npm@11 install` (documented in the README troubleshooting table).
