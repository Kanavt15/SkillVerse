# Guide: writing tests

The instructor workflow suite (`apps/api/test/instructor-workflow.test.ts`) tests real D1 concurrent submission/decision guards, owner privacy, current authority/session/MFA and forced-write rollback. `npm run test:e2e --workspace @skillverse/web -- e2e/teaching.spec.ts` exercises native applicant forms, feedback/reapplication, approval and course withdrawal/rejection/resubmission, plus mobile light/dark axe checks. Browser fixtures must use isolated local email/Turnstile settings; never send fixture emails through a production provider.

We use **Vitest** everywhere. There are three kinds of tests:

| Where                           | Runs in                     | Good for                                               |
| ------------------------------- | --------------------------- | ------------------------------------------------------ |
| `packages/shared/src/*.test.ts` | Node                        | Pure functions: money math, IDs, schemas               |
| `apps/api/test/*.test.ts`       | **workerd** + real local D1 | Endpoints end to end: validation, security, DB effects |
| `apps/web/app/**/*.test.ts(x)`  | jsdom (simulated browser)   | Components and helpers                                 |

## API integration tests

API tests call the Worker exactly like a browser would, and the database is real (fresh for each test file, with all migrations applied by `test/setup.ts`).

```ts
// apps/api/test/example.test.ts
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { call, callAsWebApp } from './helpers';

describe('GET /api/v1/meta', () => {
  it('returns features', async () => {
    await env.DB.prepare(
      "INSERT INTO feature_flags (key, enabled, rollout_percent, updated_at) VALUES ('x', 1, 100, 0)",
    ).run(); // arrange: put data in the DB directly

    const res = await call('/api/v1/meta'); // act
    expect(res.status).toBe(200); // assert
    const body = await res.json<{ data: { features: Record<string, boolean> } }>();
    expect(body.data.features.x).toBe(true);
  });
});
```

- `call(path, init)` sends a plain request.
- `callAsWebApp(path, init)` adds the `Origin` and client header our website sends, which you need for POST/PUT/DELETE (CSRF protection).
- Seed exactly the rows each test needs. Don't depend on other test files.
- API test bindings explicitly blank the default Resend and Turnstile secrets so developer credentials cannot send real mail or introduce an external bot check. Provider-specific tests supply their own mocked credentials.

Browser account/auth fixtures need the development mailbox. If your `.dev.vars` enables Resend, start the API with an ignored temporary environment file containing your local keys and blank `RESEND_API_KEY`/`TURNSTILE_SECRET_KEY`: `npm run dev --workspace @skillverse/api -- --env-file ../../tmp/e2e.env`, then `npm run dev:web`. Stop existing project servers before restarting the pair and remove the temporary file afterwards. An explicit environment file avoids editing developer credentials; see [Wrangler local variables](https://developers.cloudflare.com/workers/local-development/environment-variables/). Run Worker integration tests and browser journeys sequentially when sharing the local dev registry, and confirm `/api/health` through the web origin before browser tests.

## What must be tested

- **Happy path**, the thing works.
- **Validation:** bad input returns `400 VALIDATION_FAILED` with the right `fields`.
- **Authorization:** unauthenticated returns 401, someone else's resource returns 403 or 404. Always test the deny cases.
- **Edge cases:** empty lists, limits, duplicates (409), concurrency for money (only one of two racing requests wins).
- **Bugs:** every bug fix adds a test that fails without the fix.

## Web tests

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Button } from './button';

afterEach(cleanup);

it('renders a button', () => {
  render(<Button>Save</Button>);
  expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
});
```

Query by **role and accessible name** (`getByRole('button', { name: 'Save' })`). If you can't find an element that way, a screen-reader user can't either.

## Running tests

```bash
npm test                                   # everything
npm run test --workspace @skillverse/api   # one workspace
cd apps/api && npx vitest run test/csrf.test.ts   # one file
cd apps/api && npx vitest                  # watch mode
```

Phase 1 browser tests include authentication, learning, authoring, community, account administration and publication moderation. Run `npm run test:e2e`; target one file with `npm run test:e2e --workspace @skillverse/web -- e2e/course-moderation.spec.ts`. Publication moderation includes JavaScript-disabled search/archival, instructor feedback, retained learning, both themes, responsive layouts and axe checks. Use isolated local mail/Turnstile configuration for browser fixtures; never send fixture messages through a production provider.
