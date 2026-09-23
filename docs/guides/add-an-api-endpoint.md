# Guide: add an API endpoint

We'll add `GET /api/v1/categories`, which lists course categories. The same steps apply to any endpoint. The reference implementation to copy is [`apps/api/src/routes/meta.routes.ts`](../../apps/api/src/routes/meta.routes.ts).

```
request → routes/ (validate + document) → services/ (rules) → repositories/ (SQL) → D1
```

## 1. Shared schema (if the browser needs it too)

Input schemas that the website also uses for form validation go in `packages/shared/src/schemas/<feature>.ts`, exported from `packages/shared/src/index.ts`:

```ts
// packages/shared/src/schemas/categories.ts
import { z } from 'zod';
import { slugSchema } from './common';

export const categoryQuerySchema = z.object({
  parent: slugSchema.optional(),
});
```

## 2. Repository: the query

```ts
// apps/api/src/repositories/categories.repository.ts
/** Data access for the `categories` table. */
import { asc } from 'drizzle-orm';
import { schema, type Db } from '@skillverse/db';

export function listCategories(db: Db) {
  return db
    .select({
      id: schema.categories.id,
      name: schema.categories.name,
      slug: schema.categories.slug,
    })
    .from(schema.categories)
    .orderBy(asc(schema.categories.name))
    .limit(200); // always bound result sizes
}
```

## 3. Service: the business rules

```ts
// apps/api/src/services/categories.service.ts
/** Category rules: e.g. hide empty categories from the public list. */
import type { Db } from '@skillverse/db';
import { listCategories } from '../repositories/categories.repository';

export async function getPublicCategories(db: Db) {
  const rows = await listCategories(db);
  return rows; // filtering, mapping, permission-dependent fields go here
}
```

## 4. Route: validation, docs and the handler

```ts
// apps/api/src/routes/categories.routes.ts
/** GET /api/v1/categories: public list of course categories. */
import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, ErrorBodySchema, success } from '../lib/openapi';
import { getPublicCategories } from '../services/categories.service';

const CategorySchema = z
  .object({ id: z.string(), name: z.string(), slug: z.string() })
  .openapi('Category');

const route = createRoute({
  method: 'get',
  path: '/categories',
  tags: ['Catalog'],
  summary: 'List categories',
  responses: {
    200: {
      description: 'OK',
      content: { 'application/json': { schema: success(z.array(CategorySchema)) } },
    },
    429: {
      description: 'Rate limited',
      content: { 'application/json': { schema: ErrorBodySchema } },
    },
  },
});

export const categoryRoutes = createRouter().openapi(route, async (c) => {
  const data = await getPublicCategories(c.get('db'));
  return c.json({ ok: true as const, data }, 200);
});
```

For inputs, add `request: { query: …, params: …, body: { content: { 'application/json': { schema } } } }` to `createRoute` and read them with `c.req.valid('query')` / `c.req.valid('json')`. Invalid input automatically becomes a `400 VALIDATION_FAILED` with per-field messages.

## 5. Mount it

In [`apps/api/src/app.ts`](../../apps/api/src/app.ts):

```ts
app.route('/api/v1', categoryRoutes);
```

## 6. Security checklist for every endpoint

- [ ] **Who may call it?** Public, any signed-in user, the owner only, or admins? Enforce it with a policy check (auth arrives in Phase 1) and test the **deny** case.
- [ ] **Input validated** by Zod: types, lengths, ranges, unknown keys rejected.
- [ ] **Output minimal:** return only what the caller needs. Never return hashes, tokens or other users' private fields.
- [ ] **Bounded:** list endpoints paginate (`paginationQuerySchema`) and cap `limit`.
- [ ] **Stricter rate limit** for sensitive actions (login, payments, messaging): add `rateLimit('RL_AUTH', '<scope>')`.
- [ ] **Audit log** for admin and money actions (insert into `audit_logs`).
- [ ] **Money** in integer paise, and multi-row writes in one `db.batch()`.

## 7. Test it

Add `apps/api/test/categories.test.ts` (see [writing-tests.md](writing-tests.md)). Cover the success case, a validation failure and a permission failure.

## 8. Check the docs

Run the API and open http://localhost:8787/api/docs. Your endpoint appears automatically with its schema. Then add a CHANGELOG entry.
