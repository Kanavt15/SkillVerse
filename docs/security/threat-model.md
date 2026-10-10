# Threat model

What we protect, who might attack it, and what stops them. Updated whenever a phase adds a new surface (auth, payments, uploads…). Method: **STRIDE** per component.

## Assets (what's valuable)

| Asset                             | Why it matters                                              |
| --------------------------------- | ----------------------------------------------------------- |
| User accounts and sessions        | Takeover means impersonation, stolen purchases, fraud       |
| Money: payments, wallet, payouts  | Direct financial loss for users, instructors, the business  |
| Personal data (email, names, IPs) | Legal duty under India's DPDP Act 2023 and GDPR; user trust |
| Paid content (videos, exams)      | Instructor income; exam integrity gives certificates value  |
| Certificates/credentials          | Worthless if they can be forged                             |
| Admin capabilities                | Full control of the platform                                |

## Attackers

- **Anonymous internet attackers:** scanners, credential stuffing, scraping, XSS/CSRF/injection attempts.
- **Malicious users:** access other users' data (IDOR), get paid content for free, cheat exams, abuse refunds or referrals, post harmful content.
- **Compromised dependencies:** a malicious npm package.
- **Insider mistakes:** a leaked secret, a bad migration, an over-privileged admin action.

## Trust boundaries

```
Internet ──▶ Cloudflare edge ──▶ web Worker ──(service binding)──▶ api Worker ──▶ D1
                                                         ▲
             Payment provider webhooks ──────────────────┘ (HMAC-signed)
```

Everything from the browser or from webhooks is untrusted until validated in the **API**. The web Worker is a client of the API like any other. It never talks to D1 directly.

## STRIDE analysis

| Threat                       | Example                                                 | Mitigation (status)                                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S**poofing identity        | Stolen session cookie, credential stuffing              | HttpOnly `__Host-` cookies (✅), hashed session ids (✅), per-IP auth rate limits + account lockout after 10 failures (✅), breached-password check (✅), Turnstile bot check on sign-up/sign-in/reset (✅), TOTP 2FA with replay protection and session rotation (✅), required for admins and payees (enforced as those routes ship) |
| **S**poofing requests        | CSRF: evil site submits a form to our API               | Origin allowlist + required client header on non-GET (✅), SameSite=Lax (P1)                                                                                                                                                                                                                                                           |
| **S**poofing webhooks        | Fake "payment captured" call                            | HMAC over the raw body, constant-time compare, event-id idempotency (P2)                                                                                                                                                                                                                                                               |
| **T**ampering: input         | SQL injection, mass assignment                          | Drizzle parameter binding, `sql.raw` lint-banned (✅); Zod schemas reject unknown keys (✅)                                                                                                                                                                                                                                            |
| **T**ampering: price         | Client sends a lower price                              | Prices always computed server-side from the DB (P2)                                                                                                                                                                                                                                                                                    |
| **T**ampering: stored XSS    | Script in a course description                          | React escaping, `dangerouslySetInnerHTML` lint-banned (✅), sanitised Markdown (P1), instructor text shown as plain text in review pages (✅), video embeds rebuilt from validated ids (✅), strict CSP with nonce (✅)                                                                                                                |
| **R**epudiation              | "I never issued that refund"                            | Append-only `audit_logs` with actor, request ID, IP hash (✅; auth events written)                                                                                                                                                                                                                                                     |
| **I**nformation disclosure   | Stack traces, other users' data (IDOR), secrets in logs | Generic 500s with request ID (✅), policy checks per resource (P1), log redaction (✅), `no-store` on API responses (✅), no docs in prod (✅)                                                                                                                                                                                         |
| **I**nformation disclosure   | Paid video downloaded by non-buyers                     | Short-lived signed URLs bound to user and lesson, watermark (P1/P2)                                                                                                                                                                                                                                                                    |
| **D**enial of service        | Flooding endpoints, huge bodies                         | Cloudflare edge DDoS protection, per-IP rate limits (✅), 64 KB body limit (✅), bounded list queries (✅ pattern)                                                                                                                                                                                                                     |
| **E**levation of privilege   | Learner calls admin endpoint, forges role               | Roles only from DB (✅), deny-by-default test over every route (✅), resource policies (P1), Cloudflare Access in front of `/admin` (P1)                                                                                                                                                                                               |
| **E**levation: exam cheating | Reading answers from the page                           | Answers never sent to the client, server-side timers (P4)                                                                                                                                                                                                                                                                              |

Legend: ✅ implemented, P*n* = planned in phase _n_.

## Implemented controls (Phase 0)

- HTML: CSP with per-request nonce (`script-src 'self' 'nonce-…'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-src` limited to the YouTube-nocookie and Vimeo players plus Turnstile when enabled), `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, COOP, Permissions-Policy, HSTS in production.
- API: `default-src 'none'` CSP, `no-store`, request IDs, structured logs with secret redaction, per-IP rate limiting, CSRF check, body-size limit, uniform error contract that never leaks internals.
- Code: ESLint bans `eval`, `new Function`, `sql.raw`, `dangerouslySetInnerHTML`. Strict TypeScript.
- Data: IPs only stored as salted hashes, and secrets never committed (`.dev.vars` ignored, generated locally).
- Tests: CSRF, rate-limit, header, error-contract and log-redaction behaviour are covered.

## Implemented learner controls (Phase 1)

- Course curriculum responses expose metadata; only the player endpoint returns lesson Markdown/video references after checking preview or enrollment permissions.
- Enrollment, progress and notes verify caller ownership plus course/lesson membership. Private notes never appear in public responses. Archived courses preserve existing learner access.
- User-authored Markdown skips raw HTML and embedded media and sanitizes links. Security component tests exercise scripts, tracking images and scriptable URLs.
- Free enrollment checks the current server price and status in its SQL insert. Unique enrollment/progress/review/certificate constraints and atomic counter updates cover retries and concurrency.
- Completion certificates sign immutable public claims with a dedicated HMAC key. Tampering returns 404. Key loss/rotation and public display-name disclosure are documented in [learning architecture](../architecture/learning.md).

The catalog, teaching and learner resource policies and sanitized Markdown marked as Phase 1 in the analysis table above are now implemented. R2 signed delivery, reporting/moderation and the remaining phase surfaces are still planned.

## Accepted risks

Video timelines use the same authorized read path as video references and lesson bodies; public metadata never includes transcript or checkpoint text. Studio ownership/review locks apply to all timeline writes. Strict timestamp ordering, per-field/list bounds and a 48 KB UTF-8 cap constrain payloads. React renders timeline content as escaped text; script-like strings are covered by browser tests. Checkpoint reflections remain enrollment-scoped private notes, and timeline navigation has no completion effect. Provider playback is external; timestamp jumps do not add SDK scripts or expand the parent-page CSP. See [video learning](../architecture/video-learning.md).

| Risk                                                 | Why accepted / follow-up                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `style-src 'unsafe-inline'`                          | Needed for React style attributes. Style injection can't run code. |
| Rate-limit counters are per location and approximate | They are a brake, not a quota. Auth adds per-account limits in P1. |
| Screen recording of paid video                       | Can't be prevented on the web. We deter it with watermarks.        |
