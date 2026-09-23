# repositories/

Database access. One file per table or aggregate, named `<name>.repository.ts`, using Drizzle's query builder.

**Belongs here:** `select` / `insert` / `update` / `delete` queries, choosing columns (select only what's needed, never password hashes unless the caller is the auth service), `limit`s and ordering.

**Does NOT belong here:** business decisions, caching or HTTP.

Rules: always bound list queries with `.limit()`; make sure filters and sorts hit an index; never use `sql.raw()` (ESLint blocks it). New to D1? See [docs/guides/d1-database-primer.md](../../../../docs/guides/d1-database-primer.md).
