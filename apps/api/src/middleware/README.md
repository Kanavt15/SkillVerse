# middleware/

Code that runs for many routes. The order is defined and explained at the top of `../app.ts`.

| File                  | Responsibility                                                                    |
| --------------------- | --------------------------------------------------------------------------------- |
| `request-context.ts`  | Request ID, per-request logger and DB client, one access-log line per request     |
| `security-headers.ts` | Strict headers on every response (CSP, nosniff, frame denial, no-store, HSTS)     |
| `rate-limit.ts`       | `rateLimit(binding, scope)` using Cloudflare's Rate Limiting binding              |
| `csrf.ts`             | Origin allowlist + client-header check on POST/PUT/PATCH/DELETE (webhooks exempt) |
| `error-handler.ts`    | Turns thrown errors into the standard error JSON, and handles 404s                |

Every middleware here must have tests in `apps/api/test/`, because they are security controls.
