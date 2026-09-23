# services/

Business logic. One file per feature, named `<feature>.service.ts`. Services are plain async functions that take the `db` (and any other dependencies) as arguments, so they can be tested without HTTP.

**Belongs here:** rules ("a refund is allowed within 7 days if under 30% consumed"), orchestration of several repository calls, caching decisions, building `db.batch([...])` for atomic writes, and throwing `AppError` for rule violations.

**Does NOT belong here:** request or response objects and HTTP status codes (→ `routes/`), or raw query construction (→ `repositories/`).
