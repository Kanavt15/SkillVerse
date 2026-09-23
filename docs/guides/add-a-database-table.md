# Guide: add a database table

We'll add a `categories` table. Read the [D1 primer](d1-database-primer.md) first if D1 is new to you.

## 1. Define the table

Create (or extend) a file in `packages/db/src/schema/`, grouped by feature area:

```ts
// packages/db/src/schema/catalog.ts
/** Catalog tables: categories, tags, courses and their structure. */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { id, timestamps } from './_columns';

export const categories = sqliteTable(
  'categories',
  {
    id: id(),
    /** Display name, e.g. "Web Development". */
    name: text('name').notNull(),
    /** URL-safe unique key used in /categories/:slug. */
    slug: text('slug').notNull().unique(),
    /** Optional parent for sub-categories (NULL = top level). */
    parentId: text('parent_id'),
    /** Manual ordering in menus; lower comes first. */
    position: integer('position').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('categories_parent_idx').on(t.parentId)],
);
```

Rules:

- **Every column gets a `/** comment */`**: what it holds, its units, and what NULL means.
- Use the helpers: `id()` for the primary key, `...timestamps()` for `created_at`/`updated_at`.
- Money columns end in `_paise` or `amount` and are `integer`. Never use `real` for money.
- Add an **index** for every column you'll filter or sort by in a list query.
- Foreign keys: `.references(() => users.id, { onDelete: 'cascade' })`. Choose `cascade`, `set null` or `restrict` deliberately.

## 2. Export it

Add to `packages/db/src/schema/index.ts`:

```ts
export * from './catalog';
```

## 3. Generate the migration

```bash
npm run db:generate
```

A new file appears in `packages/db/migrations/`, e.g. `0001_brave_hulk.sql`. You can rename the descriptive part **before** it's applied anywhere (keep the number).

## 4. Review the SQL

Open the file and read it. Check that:

- the columns, defaults and `NOT NULL`s are what you meant;
- nothing is dropped unexpectedly (renaming a column in TypeScript can look like "drop + add" and **lose data**).

## 5. Apply locally

```bash
npm run db:migrate:local
```

Look at the result with `npm run db:studio`.

## 6. Seed data (optional)

There are two kinds, and they live in different places:

| Kind                                       | Example                    | Where                                                                                                                                                    | Reaches production?        |
| ------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Reference data** every environment needs | course categories          | a **data migration**: `npm run db:generate -- --custom --name seed_x` creates an empty numbered `.sql` file; write `INSERT OR IGNORE …` statements in it | ✅ yes, like any migration |
| **Demo data** for developers               | demo users, sample courses | `packages/db/seed/seed.sql` or `scripts/seed-dev.mjs`, run by `npm run db:seed`                                                                          | ❌ never                   |

For reference data, use fixed ids (so other seeds can refer to them) and `INSERT OR IGNORE` (so re-running is harmless). See `migrations/0004_seed_categories.sql`.

## 7. Document it

Add the table to [database-schema.md](../architecture/database-schema.md): its purpose, its columns and how it relates to other tables. `npm run docs:check` fails until you do.

## 8. Commit

Commit the schema file, the migration (including `migrations/meta/`), the seed change and the docs **together**.

## Deploying schema changes

Migrations are applied to staging and production explicitly, **before** deploying the code that uses them:

```bash
npm run db:migrate:staging
npm run db:migrate:prod
```

Design changes to be **backwards compatible** (add a column, deploy code that uses it, and only later remove old columns), so the running code never breaks while a migration is in progress.
