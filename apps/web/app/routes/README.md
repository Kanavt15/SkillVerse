# routes/

One file per page. A file does nothing until it's registered in `../routes.ts`.

A route module can export:

| Export          | Runs on | Purpose                                                          |
| --------------- | ------- | ---------------------------------------------------------------- |
| `meta`          | both    | `<title>`, description, Open Graph tags (SEO)                    |
| `loader`        | server  | Fetch data before rendering (via `~/lib/api.server`)             |
| `action`        | server  | Handle form submissions (Phase 1+)                               |
| `default`       | both    | The page component                                               |
| `ErrorBoundary` | both    | Optional page-specific error UI (otherwise the root one is used) |

Guide: [docs/guides/add-a-page.md](../../../../docs/guides/add-a-page.md).
