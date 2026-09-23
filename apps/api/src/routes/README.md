# routes/

The HTTP layer. One file per feature area, named `<feature>.routes.ts`, exporting a router that `app.ts` mounts.

**Belongs here:** `createRoute(...)` definitions (Zod schemas for params/query/body and responses, which double as the OpenAPI docs), and thin handlers that read validated input, call a service, and return `{ ok: true, data }`.

**Does NOT belong here:** SQL (→ `repositories/`) and business rules or permission logic (→ `services/`, later `policies/`).

Reference example: `meta.routes.ts`. Guide: [docs/guides/add-an-api-endpoint.md](../../../../docs/guides/add-an-api-endpoint.md).
