# @skillverse/api

The SkillVerse HTTP API. It's a [Hono](https://hono.dev) app that runs on **Cloudflare Workers**. In production it serves `https://<domain>/api/*`, and locally it serves `http://localhost:8787/api/*`.

## Folder layout

```
src/
├─ index.ts          Worker entry point (Cloudflare calls `fetch` here)
├─ app.ts            Builds the app: middleware order + route mounting (read this first)
├─ env.ts            Types for bindings (env.DB, env.CACHE …), secrets and per-request variables
├─ routes/           HTTP layer: Zod schemas + OpenAPI docs + a thin handler. No SQL here.
├─ services/         Business rules. Called by routes. Testable without HTTP.
├─ repositories/     Database queries (Drizzle). No business rules here.
├─ middleware/       Cross-cutting concerns: request context, security headers, CSRF, rate limits, errors
└─ lib/              Small helpers: AppError, logger, crypto, router factory
test/                Integration tests that run inside the real Workers runtime
wrangler.jsonc       Cloudflare configuration: bindings, environments, rate limits
.dev.vars.example    Template for local secrets (`npm run setup` creates .dev.vars from it)
```

A request flows **route → service → repository → D1**. Each layer only calls the one below it.

## Common tasks

| Task                                                    | Command (run from the repo root)                       |
| ------------------------------------------------------- | ------------------------------------------------------ |
| Start only the API                                      | `npm run dev:api`                                      |
| Run tests                                               | `npm run test --workspace @skillverse/api`             |
| Apply migrations to the local DB                        | `npm run db:migrate:local`                             |
| Load seed data                                          | `npm run db:seed`                                      |
| Regenerate binding types after editing `wrangler.jsonc` | `npm run cf-typegen --workspace @skillverse/api`       |
| Browse API docs                                         | open http://localhost:8787/api/docs while the API runs |

## Rules

- **Validate every input** with a Zod schema in `createRoute` (see `routes/meta.routes.ts`).
- **Throw `AppError`** for expected failures (`throw new AppError('NOT_FOUND', '…')`). Never return ad-hoc error JSON.
- **Never log secrets or whole request bodies.** The logger redacts common secret keys, but don't rely on that alone.
- **New secret?** Add it to `.dev.vars.example` (with a comment), to the `Secrets` interface in `src/env.ts`, to `vitest.config.ts` bindings and to the environment table in the root README.

Step-by-step guide: [docs/guides/add-an-api-endpoint.md](../../docs/guides/add-an-api-endpoint.md).
