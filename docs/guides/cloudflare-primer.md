# Cloudflare primer

Everything you need to understand how SkillVerse runs on Cloudflare, in plain language.

## Workers: where our code runs

A **Worker** is a small program that Cloudflare runs in its data centres (300+ cities) whenever a request arrives. There's no server for us to start, patch or scale.

- It starts in milliseconds, so there are **no cold starts** (unlike Render or Heroku free tiers).
- Each request gets a fresh, isolated execution. Don't rely on in-memory state surviving between requests (it sometimes does, and we use that for small caches, but never for anything important).
- Workers use **Web-standard APIs** (`fetch`, `Request`, `Response`, `crypto.subtle`), not Node.js's `fs` or `http`. There's no filesystem.

SkillVerse has **two Workers**:

| Worker           | Folder     | Serves                            |
| ---------------- | ---------- | --------------------------------- |
| `skillverse-web` | `apps/web` | Web pages (HTML, CSS, JS, images) |
| `skillverse-api` | `apps/api` | JSON API under `/api/*`           |

## Bindings: how a Worker reaches other things

A **binding** is a named connection to a Cloudflare resource, declared in `wrangler.jsonc` and available in code as `env.<NAME>`:

| Binding (our name)          | Type            | Used for                                    |
| --------------------------- | --------------- | ------------------------------------------- |
| `env.DB`                    | D1 database     | All application data                        |
| `env.RL_API`, `env.RL_AUTH` | Rate limiter    | Slowing down abusive clients                |
| `env.API` (web only)        | Service binding | The website calling the API Worker directly |
| `env.ENVIRONMENT`           | Plain variable  | `development` / `staging` / `production`    |

Bindings are secure by design: there are no passwords or URLs in code, because Cloudflare wires them up.

After changing bindings in `wrangler.jsonc`, regenerate the TypeScript types:

```bash
npm run cf-typegen --workspace @skillverse/api   # or @skillverse/web
```

## Wrangler: the command-line tool

`wrangler` runs Workers locally, manages databases and deploys. You rarely call it directly, because the npm scripts wrap it. Useful direct commands:

```bash
cd apps/api
npx wrangler d1 execute DB --local --command "SELECT count(*) FROM users"   # query local DB
npx wrangler login                                                          # only for deploying
npx wrangler tail --env production                                          # live production logs
```

## Local development = the real runtime

`npm run dev` runs our Workers inside **workerd**, the same open-source runtime Cloudflare uses in production, with local copies of D1 and the other resources. If it works locally, it very likely works in production.

The website runs through Vite (with the Cloudflare plugin) on port 5173, and the API runs through `wrangler dev` on port 8787. The website finds the API automatically through the local "dev registry".

## Secrets vs variables

| Kind      | Examples                 | Where locally           | Where deployed                             |
| --------- | ------------------------ | ----------------------- | ------------------------------------------ |
| Variables | `ENVIRONMENT`            | `wrangler.jsonc` `vars` | `wrangler.jsonc` `vars` (per environment)  |
| Secrets   | `IP_HASH_SALT`, API keys | `apps/api/.dev.vars`    | `npx wrangler secret put NAME --env <env>` |

Secrets are never committed. `.dev.vars` is git-ignored, and deployed secrets are stored encrypted by Cloudflare.

## Environments

`wrangler.jsonc` has a top-level config (used locally) plus `env.staging` and `env.production`. Each environment has its **own** database and bindings, so testing on staging can never touch production data.

## The free plan in one sentence

Each request may use **10 ms of CPU** (waiting for the database or the network doesn't count), and the account gets **100,000 requests per day**. Details: [free-tier-limits.md](../operations/free-tier-limits.md).
