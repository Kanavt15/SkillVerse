# Guide: debugging

## 1. Read the terminal

`npm run dev` prints both apps' logs, prefixed `[api]` and `[web]`. The API writes **one JSON line per request**:

```json
{
  "level": "info",
  "msg": "request",
  "requestId": "01a0ccee-…",
  "method": "GET",
  "path": "/api/v1/meta",
  "status": 200,
  "ms": 4
}
```

Errors are JSON lines with `"level":"error"` and include the `stack` (server-side only; clients never see it).

## 2. Follow the request ID

Every API response has an `x-request-id` header, and every error body includes `requestId`. Search the terminal (or production logs) for that ID to find exactly what happened for that request.

## 3. Common failures

| Symptom                                                      | Likely cause and fix                                                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `403 FORBIDDEN "Request origin not allowed."`                | A POST without the right `Origin`. In tests use `callAsWebApp`, in the browser make sure the page is on `http://localhost:5173`. |
| `400 VALIDATION_FAILED`                                      | Look at `error.fields` in the response. It names each invalid field.                                                             |
| `429 RATE_LIMITED`                                           | Too many requests in a minute. Wait, or restart `npm run dev` to reset local counters.                                           |
| `500 INTERNAL` with no detail                                | By design. Find the `requestId` in the terminal for the stack trace.                                                             |
| Page shows the error screen with a stack trace               | Development only. The stack shows which loader or component threw.                                                               |
| `no such table` / `no such column`                           | Migrations not applied: `npm run db:migrate:local`.                                                                              |
| Browser console: `Refused to load … Content Security Policy` | A new third-party script/image/frame. Add its host in `apps/web/app/lib/security.server.ts`.                                     |

## 4. Inspect the database

```bash
npm run db:studio                                                   # browse visually
cd apps/api && npx wrangler d1 execute DB --local --command "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20"
```

## 5. Breakpoints

- **Website server code** (loaders, entry.server): add `debugger;` and open `chrome://inspect` while `npm run dev` runs. Vite's Cloudflare plugin exposes the Worker to the inspector.
- **API**: `wrangler dev` prints a line like `[b] open DevTools`. Press `b` in its terminal, or run `npm run dev:api` on its own to get the interactive key menu.
- **Browser code**: the browser's DevTools as usual.

## 6. Production

```bash
cd apps/api && npx wrangler tail --env production     # live logs, filterable
```

Logs are also searchable in the Cloudflare dashboard → Workers → your Worker → Logs.
