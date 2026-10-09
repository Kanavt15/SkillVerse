# scripts/

Developer tools written as plain Node.js (`.mjs`), so they run anywhere Node runs, with no build step. Each one is wired to a root npm script:

| File                     | npm script                | What it does                                                                                  |
| ------------------------ | ------------------------- | --------------------------------------------------------------------------------------------- |
| `setup.mjs`              | `npm run setup`           | Checks versions, installs deps, creates `.dev.vars` secrets, migrates and seeds the local DB. |
| `seed-dev.mjs`           | `npm run db:seed`         | Loads settings, demo accounts and three free courses locally, preserving existing rows.       |
| `seed-courses.mjs`       | helper for `seed-dev.mjs` | Original article content and deterministic IDs for three demo courses.                        |
| `db-reset.mjs`           | `npm run db:reset`        | Deletes the local database and rebuilds it (asks for confirmation; `-- --yes` skips).         |
| `clean-dev-registry.mjs` | `predev` (automatic)      | Removes stale Wrangler dev-registry entries for our Workers before `npm run dev`.             |
| `docs-check.mjs`         | `npm run docs:check`      | Fails on broken Markdown links or undocumented secrets, scripts or tables.                    |

Rules for scripts here:

- **Never touch remote (staging/production) resources.** Those commands are explicit npm scripts (`db:migrate:prod`, `deploy:*`) so nobody runs them by accident.
- Ask before destroying local data, and print what you did.
- Must work on Windows, macOS and Linux (use `node:path`, never hard-coded `/`).
