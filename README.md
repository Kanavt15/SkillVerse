<div align="center">

<img src="apps/web/public/favicon.svg" alt="SkillVerse logo" width="72" />

# SkillVerse

**Learn a skill. Teach a skill. Prove it.**

A skill-sharing and learning marketplace with courses, live mentors, skill swaps and verifiable certifications, built to run on Cloudflare's global network.

</div>

---

## Contents

1. [What SkillVerse is](#1-what-skillverse-is)
2. [Tech stack at a glance](#2-tech-stack-at-a-glance)
3. [Prerequisites](#3-prerequisites)
4. [Quick start](#4-quick-start)
5. [What `npm run setup` did](#5-what-npm-run-setup-did)
6. [Open the app](#6-open-the-app)
7. [Demo accounts](#7-demo-accounts)
8. [Every npm script explained](#8-every-npm-script-explained)
9. [Project structure](#9-project-structure)
10. [Environment variables and secrets](#10-environment-variables-and-secrets)
11. [Your first contribution](#11-your-first-contribution)
12. [Coding conventions](#12-coding-conventions)
13. [Testing](#13-testing)
14. [Troubleshooting](#14-troubleshooting)
15. [Deployment](#15-deployment)
16. [Security](#16-security)
17. [License](#17-license)

---

## 1. What SkillVerse is

SkillVerse is a platform where anyone can **learn** from courses and mentors, **teach** and earn money, **swap** skills with other learners, and **prove** what they know with verifiable certifications.

It is built as a real business. Revenue comes from course sales (revenue shared with instructors), a Plus subscription, paid certification exams, mentoring fees, and ads on free pages. See [docs/business/revenue-model.md](docs/business/revenue-model.md).

**Current status:** Phase 0 (foundation) is complete. The roadmap and progress of every phase are in [docs/phases/roadmap.md](docs/phases/roadmap.md).

## 2. Tech stack at a glance

Everything runs on Cloudflare's **free plan**. There are no servers to manage and no cold starts.

| Piece                                                            | What it is                                                                                           | Why we use it                                                                 |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [Cloudflare Workers](https://developers.cloudflare.com/workers/) | Runs our code in 300+ cities, starting in milliseconds                                               | Free, fast worldwide, nothing to maintain                                     |
| [Hono](https://hono.dev)                                         | A small web framework, similar to Express                                                            | Our API (`apps/api`)                                                          |
| [React Router](https://reactrouter.com)                          | React with server-side rendering                                                                     | Our website (`apps/web`). Pages are rendered on the server for SEO and speed. |
| [Cloudflare D1](https://developers.cloudflare.com/d1/)           | A SQL database (SQLite) managed by Cloudflare                                                        | All our data                                                                  |
| [Drizzle ORM](https://orm.drizzle.team)                          | Typed database queries and migrations                                                                | Safe queries, no hand-written SQL strings                                     |
| [Zod](https://zod.dev)                                           | Data validation                                                                                      | The same rules check input in the browser and on the server                   |
| [Tailwind CSS](https://tailwindcss.com)                          | Utility CSS                                                                                          | Styling via design tokens                                                     |
| [Vitest](https://vitest.dev)                                     | Test runner                                                                                          | API tests run inside the real Workers runtime                                 |
| Later phases                                                     | R2 (files and video), Durable Objects (live features), Queues (background jobs), Razorpay (payments) | Added when each feature needs them                                            |

New to Cloudflare? Read [docs/guides/cloudflare-primer.md](docs/guides/cloudflare-primer.md). New to D1 and SQL? Read [docs/guides/d1-database-primer.md](docs/guides/d1-database-primer.md).

## 3. Prerequisites

Install these first, then check them with the commands shown:

| Tool                  | Version                             | Check with      | Get it                            |
| --------------------- | ----------------------------------- | --------------- | --------------------------------- |
| Node.js               | 20.19 or newer (22 LTS recommended) | `node -v`       | https://nodejs.org (choose "LTS") |
| npm                   | 10 or newer (ships with Node)       | `npm -v`        | comes with Node                   |
| Git                   | any recent version                  | `git --version` | https://git-scm.com               |
| VS Code (recommended) | any                                 |                 | https://code.visualstudio.com     |

When you open the folder in VS Code, it suggests the recommended extensions (ESLint, Prettier, Tailwind, SQLite Viewer…) from `.vscode/extensions.json`. Click **Install All**.

> **You do NOT need to install a database.** Cloudflare's tooling (Wrangler) runs a real D1 database on your machine automatically, stored in `apps/api/.wrangler/`.
>
> **You do NOT need a Cloudflare account** to develop locally. You only need one to deploy.

## 4. Quick start

```bash
git clone <repository-url> skillverse
cd skillverse
npm run setup
npm run dev
```

Then open **http://localhost:5173**. Press `Ctrl+C` in the terminal to stop.

## 5. What `npm run setup` did

`scripts/setup.mjs` is safe to run again at any time. It:

1. **Checked your versions** of Node.js and npm.
2. **Installed dependencies** for every workspace (`npm install`).
3. **Created `apps/api/.dev.vars`**, your local secrets file, from `apps/api/.dev.vars.example`, filling each placeholder with a random value. Existing values are never overwritten. This file is git-ignored.
4. **Created the local database** and applied every migration in `packages/db/migrations/`.
5. **Loaded seed data** from `packages/db/seed/seed.sql` (default platform settings and feature flags).

## 6. Open the app

`npm run dev` starts two processes side by side (via `concurrently`). Their log lines are prefixed `[api]` and `[web]`.

| What                    | URL                                                             |
| ----------------------- | --------------------------------------------------------------- |
| Website                 | http://localhost:5173                                           |
| API through the website | http://localhost:5173/api/health (same origin, like production) |
| API directly            | http://localhost:8787/api/health                                |
| Interactive API docs    | http://localhost:8787/api/docs                                  |
| Database browser        | run `npm run db:studio`, then open the URL it prints            |

## 7. Demo accounts

Sign-in arrives in Phase 1. From then on, `npm run setup` seeds these **development-only** accounts:

| Role       | Email                     | Password                 |
| ---------- | ------------------------- | ------------------------ |
| Learner    | `learner@skillverse.test` | shown by `npm run setup` |
| Instructor | `teacher@skillverse.test` | shown by `npm run setup` |
| Admin      | `admin@skillverse.test`   | shown by `npm run setup` |

These accounts only ever exist in your local database. Seed data is never applied to staging or production.

## 8. Every npm script explained

Run these from the **repository root**.

| Script               | What it does                                                                      |
| -------------------- | --------------------------------------------------------------------------------- |
| `setup`              | One-time setup (see section 5). Safe to re-run.                                   |
| `dev`                | Starts the API (:8787) and the website (:5173) together.                          |
| `dev:api`            | Starts only the API.                                                              |
| `dev:web`            | Starts only the website (it needs the API running for data).                      |
| `build`              | Production build of every workspace.                                              |
| `test`               | Runs all unit and integration tests.                                              |
| `lint`               | Checks code for bugs and banned patterns (ESLint).                                |
| `lint:fix`           | Same, auto-fixing what it can.                                                    |
| `format`             | Formats every file with Prettier.                                                 |
| `format:check`       | Reports files that aren't formatted.                                              |
| `typecheck`          | Checks TypeScript types in every workspace.                                       |
| `check`              | **Run before every commit:** lint + typecheck + test + docs check.                |
| `docs:check`         | Verifies docs: no broken links, and every secret, script and table is documented. |
| `db:generate`        | Creates a new SQL migration from changes in `packages/db/src/schema/`.            |
| `db:migrate:local`   | Applies pending migrations to your local database.                                |
| `db:seed`            | Loads development seed data into the local database.                              |
| `db:reset`           | **Deletes** your local database and rebuilds it (asks first).                     |
| `db:studio`          | Opens Drizzle Studio, a web UI to browse and edit local data.                     |
| `db:migrate:staging` | Applies migrations to the **staging** database on Cloudflare.                     |
| `db:migrate:prod`    | Applies migrations to the **production** database on Cloudflare. Be careful.      |
| `deploy:api`         | Deploys the API Worker to production.                                             |
| `deploy:web`         | Builds and deploys the website Worker to production.                              |
| `deploy:staging`     | Deploys both Workers to staging.                                                  |

## 9. Project structure

```
skillverse/
├─ apps/
│  ├─ api/            The HTTP API (Hono on Workers)              → apps/api/README.md
│  └─ web/            The website (React Router SSR on Workers)   → apps/web/README.md
├─ packages/
│  ├─ db/             Database schema, migrations, seed data      → packages/db/README.md
│  └─ shared/         Code used by both apps (validation, money)  → packages/shared/README.md
├─ docs/              All documentation                           → docs/README.md
├─ scripts/           Setup, database reset, docs check           → scripts/README.md
├─ .github/           CI workflow, PR and issue templates
├─ package.json       Workspaces + the scripts listed above
├─ tsconfig.base.json Shared TypeScript settings
└─ eslint.config.js   Lint rules (including security rules)
```

How a request flows: **Browser → web Worker (page) → API Worker → D1 database.** See [docs/architecture/overview.md](docs/architecture/overview.md) for diagrams.

## 10. Environment variables and secrets

**Secrets** (passwords, keys, salts) live in `apps/api/.dev.vars` locally. The setup script creates it, and git ignores it. In deployed environments they are set with `npx wrangler secret put NAME --env production` and are never stored in the repository.

| Secret         | Purpose                                                                       | Required in | How to get it                                                     |
| -------------- | ----------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------- |
| `IP_HASH_SALT` | Salt mixed into client IPs before hashing, so stored hashes can't be reversed | dev + prod  | `npm run setup` generates it; for prod use any 64-char random hex |

**Non-secret settings** are `vars` in each app's `wrangler.jsonc`:

| Variable      | App      | Purpose                                                        | Example (dev)           |
| ------------- | -------- | -------------------------------------------------------------- | ----------------------- |
| `ENVIRONMENT` | api, web | `development`, `staging` or `production`                       | `development`           |
| `APP_ORIGINS` | api      | Comma-separated origins allowed to send POST/PUT/DELETE (CSRF) | `http://localhost:5173` |

Adding a new secret? Follow the checklist in [apps/api/README.md](apps/api/README.md#rules). `npm run docs:check` fails if it's missing from this table.

## 11. Your first contribution

1. **Create a branch** from the latest main branch: `git switch -c feat/<short-name>` (or `fix/…`, `docs/…`).
2. **Find the guide** for what you're doing in [docs/guides/](docs/README.md#guides), for example "add an API endpoint", "add a page" or "add a database table".
3. **Make the change.** Keep it focused on one thing.
4. **Write or update tests** next to the code you changed. See [docs/guides/writing-tests.md](docs/guides/writing-tests.md).
5. **Run the checks:** `npm run check`. Everything must pass.
6. **Run the app** (`npm run dev`) and try your change in the browser, including light and dark theme and a phone-sized window.
7. **Update the docs**: the relevant `docs/` page, folder README or code comments, plus an entry under "Unreleased" in [CHANGELOG.md](CHANGELOG.md).
8. **Commit** with a [conventional message](CONTRIBUTING.md#commit-messages), e.g. `feat(courses): add course search`.
9. **Open a pull request** and complete the checklist in the PR template.

## 12. Coding conventions

The short version is below. Full details are in [CONTRIBUTING.md](CONTRIBUTING.md).

- **TypeScript everywhere**, in strict mode. No `any` without a comment explaining why.
- **Files:** `kebab-case.ts`. **Components:** `PascalCase`. **DB tables:** `snake_case`.
- **API layering:** route → service → repository. Business rules live only in services.
- **Validate all input** with Zod. **Throw `AppError`** for expected failures.
- **Money** is an integer number of paise. Never use floats for money.
- **Never commit secrets.** Never log passwords, tokens or full request bodies.
- **UI:** use design tokens (`bg-surface`, `text-fg-muted`), keep it accessible (keyboard, labels, contrast).

## 13. Testing

| Command                                            | What runs                                                   |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `npm test`                                         | Every test in every workspace                               |
| `npm run test --workspace @skillverse/api`         | API integration tests (inside the Workers runtime, real D1) |
| `npm run test --workspace @skillverse/web`         | Website unit tests (components, helpers)                    |
| `npx vitest run test/csrf.test.ts` (in `apps/api`) | A single test file                                          |
| `npx vitest` (in any workspace)                    | Watch mode: re-runs tests as you save                       |

Tests live next to what they test: `apps/api/test/`, `apps/web/app/**/*.test.ts(x)` and `packages/shared/src/*.test.ts`.

## 14. Troubleshooting

| Problem                                                                        | Fix                                                                                                         |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `Port 5173/8787 is already in use`                                             | A previous dev server is still running. Close other terminals, or on Windows run `npx kill-port 5173 8787`. |
| `npm install` fails with `Cannot read properties of null (reading 'edgesOut')` | A known npm 10 bug. Run `npx npm@11 install` instead.                                                       |
| The website loads but shows `env: …` missing / data errors                     | The API isn't running. Use `npm run dev` (starts both), not only `dev:web`.                                 |
| `no such table: …` or strange database errors                                  | Run `npm run db:migrate:local`. If it's still broken, `npm run db:reset` (deletes local data).              |
| `IP_HASH_SALT` / secret missing errors                                         | Run `npm run setup` again. It adds missing secrets to `apps/api/.dev.vars`.                                 |
| First page load shows `504 (Outdated Optimize Dep)` in the console             | Vite is pre-bundling dependencies. Reload the page once.                                                    |
| Strange diffs in every line on Windows                                         | Line endings. The repo enforces LF via `.gitattributes`: run `git add --renormalize .`.                     |
| `wrangler` asks you to log in                                                  | Only needed for deploys: `npx wrangler login`. Local development never needs it.                            |

Still stuck? Look at the terminal output of `npm run dev`. Each error line carries a `requestId` that you can search for.

## 15. Deployment

Production runs on two Workers on your own domain: the website on `https://<domain>/*` and the API on `https://<domain>/api/*`, plus a D1 database. The step-by-step guide covers creating the Cloudflare resources, setting secrets, migrating and deploying: [docs/operations/deployment.md](docs/operations/deployment.md). Free-plan limits are in [docs/operations/free-tier-limits.md](docs/operations/free-tier-limits.md).

## 16. Security

Security is a core requirement. Key protections include a strict Content-Security-Policy, CSRF checks, rate limits, input validation on every endpoint, no raw SQL or raw HTML, and hashed IPs. See [docs/security/](docs/security/threat-model.md).

**Found a vulnerability?** Please report it privately as described in [SECURITY.md](SECURITY.md). Don't open a public issue.

## 17. License

Proprietary. All rights reserved. See [LICENSE](LICENSE).
