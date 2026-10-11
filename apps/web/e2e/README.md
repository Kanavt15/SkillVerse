# Browser regression tests

`teaching.spec.ts` covers native applicant validation, withdrawal, staff feedback, reapplication and approval with private history, plus course withdrawal/rejection/resubmission/publication. Applicant and staff history pages receive light/dark axe and overflow checks at 320, 390 and 1440 px. Only fixtures created by the journey are withdrawn/archived during cleanup. Run with a temporary `--env-file` that blanks email-provider and Turnstile credentials; never send fixture emails through a production provider.

Run `npm run setup`, `npx playwright install chromium`, then `npm run test:e2e` from the repository root. Playwright starts the local app or reuses a running dev server. Tests require development mode, use the local demo courses and create a unique learner account via the dev-only email mailbox. They never call staging or production.

Coverage: public search/previews, password and email-link sign-in (scanner/replay checks), enrollment, note persistence, resume, completion, review, certificate issuance, signed-out verification, course discussion and live moderation notifications. Axe scans check catalog light/dark desktop/mobile layouts, email confirmation and the enrolled player. Screenshots and failure traces live in ignored `test-results/` and `playwright-report/` folders.

The quiz journey creates a course as the demo instructor, authors questions in Studio (including validation recovery), publishes through a separate staff session, then checks learner feedback/retry/completion and certificate issuance. Quiz authoring and light/dark mobile feedback pages receive axe and overflow checks. Each run uses a fresh course and learner.

`fixtures.ts` assigns each journey a distinct synthetic private `cf-connecting-ip`, only on localhost. Explicit role contexts share that journey's header by default; the busy publication-moderation journey uses `localRoleHeaders` for distinct instructor and staff clients. This avoids aggregate loopback/role quotas as the suite grows, while keeping real rate limiting enabled for every client.

The redesign journey compares homepage cards to the actual API catalog, checks light/dark desktop/mobile pages with axe, and covers reduced motion, no-JavaScript search and disclosures. Existing local instructor/staff accounts exercise responsive workspaces, keyboard menu focus and POST sign-out; no new production data is seeded by the redesign.
