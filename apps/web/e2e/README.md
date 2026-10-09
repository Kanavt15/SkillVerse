# Browser regression tests

Run `npm run setup`, `npx playwright install chromium`, then `npm run test:e2e` from the repository root. Playwright starts the local app or reuses a running dev server. Tests require development mode, use the local demo courses and create a unique learner account via the dev-only email mailbox. They never call staging or production.

Coverage: public search/previews, password and email-link sign-in (scanner/replay checks), enrollment, note persistence, resume, completion, review, certificate issuance, signed-out verification, course discussion and live moderation notifications. Axe scans check catalog light/dark desktop/mobile layouts, email confirmation and the enrolled player. Screenshots and failure traces live in ignored `test-results/` and `playwright-report/` folders.

The quiz journey creates a course as the demo instructor, authors questions in Studio (including validation recovery), publishes through a separate staff session, then checks learner feedback/retry/completion and certificate issuance. Quiz authoring and light/dark mobile feedback pages receive axe and overflow checks. Each run uses a fresh course and learner.

`fixtures.ts` assigns each journey a distinct synthetic private `cf-connecting-ip`, only on localhost. Explicit role contexts share that journey's header. This avoids aggregate loopback auth/API quotas as the suite grows, while keeping real rate limiting enabled and preserving the per-journey limits.
