# @skillverse/web

The SkillVerse website. It uses [React Router](https://reactrouter.com) in framework mode with **server-side rendering**, running on **Cloudflare Workers**. Locally it serves `http://localhost:5173`.

## Folder layout

```
app/
├─ root.tsx               HTML shell, root loader (theme, nonce, public config), error page
├─ routes.ts              URL → page mapping (every page is listed here)
├─ routes/                One file per page (loader + meta + component)
├─ entry.server.tsx       Server rendering + security headers (CSP with nonce)
├─ components/
│  ├─ ui/                 Generic building blocks (Button, Badge …), driven by design tokens
│  └─ layout/             Site header, footer, logo, theme toggle
├─ lib/                   Helpers. Files ending in `.server.ts` run ONLY on the server.
│  ├─ api.server.ts       Calls the API Worker through the service binding
│  ├─ security.server.ts  CSP + security headers (add third-party hosts here)
│  ├─ request-context.ts  Per-request values (CSP nonce) shared with loaders
│  └─ theme.ts            Light/dark preference cookie
└─ styles/app.css         Design tokens (colours, fonts, radii) + Tailwind setup
workers/app.ts            Worker entry: forwards /api/* to the API, renders everything else
public/                   Static files served as-is (favicon, robots.txt)
wrangler.jsonc            Cloudflare configuration (API service binding, environments)
```

## How a page gets its data

```
Browser → web Worker → route loader (server) → apiGet('/api/v1/…') → [service binding] → API Worker → D1
```

Loaders run on the server, so secrets and internal URLs never reach the browser. Anything a loader returns **is** sent to the browser, so never return private data you don't want the user to see.

## Common tasks

| Task                                               | Command (from the repo root)                     |
| -------------------------------------------------- | ------------------------------------------------ |
| Start the website (the API should also be running) | `npm run dev` (starts both)                      |
| Run unit tests                                     | `npm run test --workspace @skillverse/web`       |
| Type-check                                         | `npm run typecheck --workspace @skillverse/web`  |
| Production build                                   | `npm run build --workspace @skillverse/web`      |
| Regenerate binding types after editing wrangler    | `npm run cf-typegen --workspace @skillverse/web` |

## Rules

- **Use design tokens** (`bg-surface`, `text-fg-muted`, `bg-brand` …), never raw colours like `bg-purple-600`. See [docs/design/design-system.md](../../docs/design/design-system.md).
- **Never use `dangerouslySetInnerHTML`.** ESLint blocks it; user content will go through a sanitising Markdown component.
- **Adding a third-party script, image host or iframe?** Add its exact host to `lib/security.server.ts` and explain why in a comment.
- **Accessibility:** every interactive element must be reachable by keyboard and have an accessible name, and every icon-only button needs an `aria-label`.

Step-by-step guide: [docs/guides/add-a-page.md](../../docs/guides/add-a-page.md).
