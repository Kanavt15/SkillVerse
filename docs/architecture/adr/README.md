# Architecture Decision Records

An ADR records **one significant decision**: the context, what we chose, and the consequences. ADRs are never edited after acceptance. If a decision changes, write a new ADR that supersedes the old one.

To add one, copy the structure of an existing file, give it the next number, and link it from [../overview.md](../overview.md).

| #                                  | Title                                | Status   |
| ---------------------------------- | ------------------------------------ | -------- |
| [0001](0001-cloudflare-workers.md) | Run everything on Cloudflare Workers | Accepted |
| [0002](0002-d1-drizzle.md)         | D1 + Drizzle as the database         | Accepted |
| [0003](0003-monorepo.md)           | npm-workspaces monorepo              | Accepted |
| [0004](0004-d1-atomicity.md)       | Atomic writes with D1 `batch()`      | Accepted |
| [0005](0005-server-sessions.md)    | Server-side sessions instead of JWTs | Accepted |
| [0006](0006-ssr-same-origin.md)    | SSR on one origin with a CSP nonce   | Accepted |
