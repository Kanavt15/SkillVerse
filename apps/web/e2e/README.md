# Browser regression tests

Run `npm run setup`, `npx playwright install chromium`, then `npm run test:e2e` from the repository root. Playwright starts the local app or reuses a running dev server. Tests require development mode, use the local demo courses and create a unique learner account via the dev-only email mailbox. They never call staging or production.

Coverage: public search/previews, sign-in, enrollment, note persistence, resume, completion, review, certificate issuance and signed-out verification. Axe scans check catalog light/dark desktop/mobile layouts and the enrolled player. Screenshots and failure traces live in ignored `test-results/` and `playwright-report/` folders.
