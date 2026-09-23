# @skillverse/shared

Code that **both** the API (`apps/api`) and the web app (`apps/web`) use. If something is only needed on one side, it doesn't belong here.

| File               | What it contains                                                           |
| ------------------ | -------------------------------------------------------------------------- |
| `src/constants.ts` | App name, user roles, cookie and header names.                             |
| `src/errors.ts`    | The API error contract (`ApiErrorBody`) and the list of error codes.       |
| `src/ids.ts`       | `newId()` (UUIDv7) and `isId()`.                                           |
| `src/money.ts`     | Integer-only money helpers: `rupeesToPaise`, `formatMoney`, `splitAmount`. |
| `src/schemas/`     | Zod validation schemas, grouped by feature.                                |

## Rules

- **No runtime-specific APIs.** This code runs in Cloudflare Workers, in browsers and in Node (tests), so only use Web-standard APIs (`crypto.getRandomValues`, `Intl`, `fetch`).
- **Money is an integer** of the smallest unit (paise). See the header of `money.ts`.
- **Export everything through `src/index.ts`** and import it as `import { … } from '@skillverse/shared'`.
- There is no build step: the package ships TypeScript source, and Wrangler/Vite compile it together with the app that imports it.

## Commands

```bash
npm run test --workspace @skillverse/shared       # unit tests
npm run typecheck --workspace @skillverse/shared  # type errors
```
