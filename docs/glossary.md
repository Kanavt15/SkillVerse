# Glossary

| Term                    | Meaning in SkillVerse                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **ADR**                 | Architecture Decision Record: a short document explaining one important technical decision. See `docs/architecture/adr/`.             |
| **Basis points (bp)**   | 1/100th of a percent. 3000 bp = 30%. Used for all commission rates so the maths stays in integers.                                    |
| **Binding**             | A named connection from a Worker to a Cloudflare resource, available as `env.NAME` (e.g. `env.DB`).                                   |
| **Batch (D1)**          | A list of SQL statements D1 runs all-or-nothing. Our replacement for transactions.                                                    |
| **CSP**                 | Content-Security-Policy: a response header telling the browser which scripts, styles and images it may load. Blocks injected scripts. |
| **CSRF**                | Cross-Site Request Forgery: a malicious site making your browser send requests to us. Blocked by Origin + header checks.              |
| **D1**                  | Cloudflare's managed SQLite database.                                                                                                 |
| **Double-entry ledger** | Accounting method where every money movement is recorded as a debit and a matching credit, so balances can't silently drift.          |
| **Drizzle**             | The ORM (typed query builder) we use for D1.                                                                                          |
| **Durable Object**      | A Cloudflare primitive giving one instance of code a consistent state. Used for chat, live leaderboards and notification fan-out.     |
| **Escrow**              | Holding a learner's payment until a mentoring session is completed, then releasing it to the mentor.                                  |
| **Feature flag**        | A switch in the `feature_flags` table that turns a feature on/off without deploying.                                                  |
| **Hydration**           | The browser attaching React to server-rendered HTML so it becomes interactive.                                                        |
| **Idempotency key**     | A unique ID that makes repeating an operation safe: the second attempt is ignored.                                                    |
| **Loader**              | A function in a page's route file that fetches its data on the server before rendering.                                               |
| **Migration**           | A numbered SQL file that changes the database structure. Applied in order, once.                                                      |
| **Nonce**               | A random value created per response. Only scripts carrying it may run (see CSP).                                                      |
| **Paise**               | 1/100th of a rupee. All money is stored as integer paise.                                                                             |
| **Plus**                | The SkillVerse subscription (Phase 6).                                                                                                |
| **Pod (Study Pod)**     | A small auto-matched accountability group of learners (Phase 3).                                                                      |
| **Route (Razorpay)**    | Razorpay's product for splitting payments and paying out to sellers (instructors).                                                    |
| **Service binding**     | A direct Worker-to-Worker call without going over the public internet (web → API).                                                    |
| **Skill Passport**      | A learner's public, verifiable profile of certificates, projects and endorsements (Phase 4).                                          |
| **SSR**                 | Server-Side Rendering: HTML is produced by our Worker, not assembled in the browser.                                                  |
| **UUIDv7**              | Our ID format: random, unguessable, but sortable by creation time.                                                                    |
| **Worker**              | A program running on Cloudflare's network per request. SkillVerse has two: web and api.                                               |
| **Wrangler**            | Cloudflare's CLI: runs Workers locally, manages D1, deploys.                                                                          |
| **XP**                  | Experience points earned by learning activity (Phase 3).                                                                              |
