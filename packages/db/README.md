# @skillverse/db

The database layer: table definitions (Drizzle ORM), SQL migrations and seed data for **Cloudflare D1** (Cloudflare's SQLite database).

New to D1? Read [docs/guides/d1-database-primer.md](../../docs/guides/d1-database-primer.md) first.

## Folder layout

```
src/
├─ index.ts           createDb(env.DB) + row types (User, Session …)
└─ schema/            One file per area; every column has a comment explaining it
   ├─ _columns.ts     Shared column helpers (UUIDv7 ids, epoch-ms timestamps)
   ├─ identity.ts     users, user_roles, sessions
   ├─ platform.ts     platform_settings, feature_flags, audit_logs
   └─ index.ts        Re-exports every table (drizzle-kit reads this)
migrations/           Generated SQL, applied in order by Wrangler. Do NOT edit applied files.
seed/seed.sql         Development data (safe to re-run)
scripts/studio.mjs    Opens Drizzle Studio on the local database
drizzle.config.ts     drizzle-kit settings
```

## Changing the schema

1. Edit or add a file in `src/schema/`. If it's a new file, re-export it from `src/schema/index.ts`.
2. Run `npm run db:generate` from the repo root. A new `migrations/000N_*.sql` appears.
3. **Read the generated SQL.** Make sure it does what you expect, especially for anything that drops or renames.
4. Run `npm run db:migrate:local` to apply it to your local database.
5. Update [docs/architecture/database-schema.md](../../docs/architecture/database-schema.md).
6. Commit the schema change and the migration together.

Full walkthrough: [docs/guides/add-a-database-table.md](../../docs/guides/add-a-database-table.md).

## Conventions

- IDs are **UUIDv7 strings**, generated in code (`newId()`).
- Timestamps are **integer milliseconds** since the epoch (UTC).
- Money is **integer paise**, and percentages are **basis points**.
- Tables are `snake_case` plural, and TypeScript fields are `camelCase`.
