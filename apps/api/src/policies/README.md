# policies/

Resource-level authorization: "may **this** user do **this** to **that** course/lesson/order?". Every such decision lives here, so it can be reviewed and tested in one place.

- **Middleware** (`middleware/auth.ts`) answers coarse questions: is the visitor signed in, verified, holding a role, using 2FA?
- **Policies** answer questions that depend on the specific resource: ownership, its status, relationships.
- **Services** load the resource and call a policy before doing anything. A policy denial becomes `NOT_FOUND` when the user isn't allowed to know the resource exists, otherwise `FORBIDDEN`.

Rules: deny by default; policies are pure functions (no database access); every policy has allow and deny tests (`apps/api/test/*`).
