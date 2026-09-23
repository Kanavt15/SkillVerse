# D1 database primer (from zero)

This guide assumes you know a little SQL (MySQL) or MongoDB and have **never used D1**. By the end you'll know what D1 is, where your data lives, how to look at it, how to change the schema, and the one rule that is different from MySQL.

---

## 1. What is D1?

**D1 is Cloudflare's managed SQL database. Under the hood it is SQLite.**

- It's SQL: tables, rows, columns, `SELECT`, `JOIN`, indexes and foreign keys work as you'd expect.
- You don't run a database server. Cloudflare runs it, and our Worker talks to it through a **binding** called `env.DB`. There's no connection string or password in our code.
- Locally, Wrangler runs the exact same engine on your machine, using a file on disk.

### If you know MySQL

| MySQL                         | D1 / SQLite                                                    |
| ----------------------------- | -------------------------------------------------------------- |
| `mysql -u root -p` + server   | No server. `npm run dev` starts a local one automatically.     |
| Connection string / pool      | A binding: `env.DB` (configured in `apps/api/wrangler.jsonc`)  |
| `INT AUTO_INCREMENT` ids      | We use text UUIDv7 ids generated in code (`newId()`)           |
| `DATETIME`                    | We store `INTEGER` milliseconds since 1970 (UTC)               |
| `DECIMAL(10,2)` for money     | `INTEGER` paise (₹499.00 → `49900`)                            |
| `BOOLEAN`                     | `INTEGER` 0/1 (Drizzle converts to `true`/`false` for you)     |
| `ENUM('a','b')`               | `TEXT`, with the allowed values enforced in the Drizzle schema |
| `BEGIN … COMMIT` transactions | **`db.batch([...])`**, see section 6 ⚠️                        |
| `ALTER TABLE` by hand         | Generated migration files (section 5)                          |

### If you know MongoDB

| MongoDB                       | D1                                                                          |
| ----------------------------- | --------------------------------------------------------------------------- |
| Collection                    | Table                                                                       |
| Document                      | Row                                                                         |
| Field                         | Column (every row has the same columns)                                     |
| Embedded sub-document / array | A separate table linked by an id (e.g. `user_roles` for a user's roles)     |
| `ObjectId`                    | UUIDv7 string                                                               |
| `populate()`                  | `JOIN`, or Drizzle's `with:` relations                                      |
| Schema-less                   | Schema defined in `packages/db/src/schema/*.ts`, changed through migrations |

---

## 2. Where does the local database live?

After `npm run setup`, the database is a normal SQLite file here:

```
apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<long-hash>.sqlite
```

- It's git-ignored, so each developer has their own.
- Deleting it (or running `npm run db:reset`) gives you a fresh, empty database.
- Staging and production databases live on Cloudflare. Local commands never touch them.

## 3. How do I look at the data?

**Option A: Drizzle Studio (recommended).**

```bash
npm run db:studio
```

Then open the `https://local.drizzle.studio` URL it prints. You can browse tables, filter and edit rows.

**Option B: VS Code.** Install the recommended "SQLite Viewer" extension and open the `.sqlite` file from section 2.

**Option C: Run SQL from the terminal.**

```bash
cd apps/api
npx wrangler d1 execute DB --local --command "SELECT key, enabled FROM feature_flags"
```

## 4. How the code talks to D1

We never write SQL strings by hand. We use **Drizzle ORM**, which builds parameterised SQL (so it's safe from SQL injection) and gives us TypeScript types.

```ts
import { eq } from 'drizzle-orm';
import { schema } from '@skillverse/db';

const db = c.get('db'); // in a route handler; created per request by middleware

// SELECT id, email FROM users WHERE username = ?
const user = await db
  .select({ id: schema.users.id, email: schema.users.email })
  .from(schema.users)
  .where(eq(schema.users.username, 'kartik'))
  .get(); // .get() = first row or undefined; await without it = all rows

// INSERT INTO feature_flags (key, enabled, …) VALUES (?, ?, …)
await db.insert(schema.featureFlags).values({ key: 'courses.search', enabled: true });

// UPDATE users SET display_name = ? WHERE id = ?
await db.update(schema.users).set({ displayName: 'Kartik' }).where(eq(schema.users.id, id));

// DELETE FROM sessions WHERE id = ?
await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
```

Where each piece of code goes: queries live in `apps/api/src/repositories/`, rules in `services/`, HTTP in `routes/`. See [add-an-api-endpoint.md](add-an-api-endpoint.md).

## 5. Changing the schema: migrations

A **migration** is a numbered SQL file that changes the database structure (create a table, add a column…). Every database (yours, staging, production) applies the same files in the same order, so they all end up identical.

```
 edit schema (.ts)  ──npm run db:generate──▶  new migrations/000N_name.sql  ──npm run db:migrate:local──▶  your local DB
                                                         │
                                                         ├──npm run db:migrate:staging──▶  staging DB
                                                         └──npm run db:migrate:prod─────▶  production DB
```

1. Edit `packages/db/src/schema/*.ts`.
2. `npm run db:generate` compares the schema with the last snapshot and writes the SQL for the difference.
3. **Read the generated SQL.** SQLite can't alter some column types in place, so drizzle may generate a "create new table, copy data, drop old table" sequence. Make sure it keeps your data.
4. `npm run db:migrate:local` applies it to your database. Wrangler records applied migrations in a `d1_migrations` table, so each file runs only once.
5. Commit the schema change **and** the migration file together.

**Never edit a migration that has already been applied** (merged or deployed). Write a new one instead.

Full walkthrough: [add-a-database-table.md](add-a-database-table.md).

## 6. ⚠️ The one big difference: no `BEGIN … COMMIT`

In MySQL you can open a transaction, run some queries, look at the results, decide, and then commit. **D1 doesn't support that** (no "interactive transactions").

Instead, D1 has **`batch()`**: you hand it a list of statements, and they run **all-or-nothing** in one go.

```ts
// ✅ Atomic: both succeed or neither does.
await db.batch([
  db.insert(schema.ledgerEntries).values({ ... debit ... }),
  db.insert(schema.ledgerEntries).values({ ... credit ... }),
]);
```

Because you can't read in the middle of a batch, put the **conditions inside the SQL** instead of checking in JavaScript first:

```ts
// ❌ Race condition: two requests can both pass the check before either updates.
const order = await getOrder(id);
if (order.status === 'pending') await markPaid(id);

// ✅ The condition is part of the UPDATE; only one request can win.
const result = await db
  .update(schema.orders)
  .set({ status: 'paid' })
  .where(and(eq(schema.orders.id, id), eq(schema.orders.status, 'pending')))
  .returning({ id: schema.orders.id });
if (result.length === 0) {
  /* someone else already handled it */
}
```

This matters most for money. See [ADR 0004](../architecture/adr/0004-d1-atomicity.md).

## 7. Limits worth knowing

| Limit (free plan)      | Value               | What it means for us                                              |
| ---------------------- | ------------------- | ----------------------------------------------------------------- |
| Database size          | 500 MB per database | Plenty for text data. Files and videos go to R2, never D1.        |
| Rows read per day      | 5 million           | Always use indexes and `LIMIT`. Never `SELECT *` over big tables. |
| Rows written per day   | 100,000             | Don't write on every page view (e.g. batch view counters).        |
| Max SQL statement size | 100 KB              | Insert big data in chunks.                                        |

The full list and how we stay inside it: [free-tier-limits.md](../operations/free-tier-limits.md).

## 8. Conventions in this project

- IDs: `TEXT` UUIDv7. Timestamps: `INTEGER` epoch-ms. Money: `INTEGER` paise. Percentages: basis points.
- Table names are `snake_case` plural, and TypeScript field names are `camelCase` (Drizzle maps them).
- Every column has a comment in the schema file explaining it.
- The meaning of every table is in [database-schema.md](../architecture/database-schema.md).
