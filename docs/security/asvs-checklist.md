# OWASP ASVS Level 2 checklist

We verify SkillVerse against the [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/) **Level 2**, the recommended level for apps handling personal and financial data. This is a condensed list of the requirements most relevant to us, with their status. Each phase updates it.

Status: ✅ done · 🟡 partial · ⏳ planned (phase) · n/a

## V1: Architecture

| Requirement                                                   | Status | Where                                            |
| ------------------------------------------------------------- | ------ | ------------------------------------------------ |
| Threat model maintained                                       | ✅     | [threat-model.md](threat-model.md)               |
| All access control enforced server-side at a trusted boundary | 🟡     | API is the only DB client; policies arrive in P1 |
| Security decisions documented                                 | ✅     | [ADRs](../architecture/adr/)                     |

## V2 and V3: Authentication and sessions (Phase 1)

| Requirement                                                         | Status                                                               |
| ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Passwords ≥ 10 chars, no composition rules, breached-password check | ✅ `passwordSchema`, `breached-password.service.ts`                  |
| Passwords hashed with a slow, salted KDF, versioned format          | ✅ PBKDF2-SHA256 100k, `lib/password.ts`                             |
| Anti-automation on login/registration (rate limit + Turnstile)      | ✅ per-IP limits, account lockout, Turnstile (`requireHuman`)        |
| Generic auth errors (no user enumeration)                           | ✅ tested in `auth.test.ts`                                          |
| MFA available, mandatory for admins and payees                      | ✅ TOTP + recovery codes; `requireMfa` ready for admin/payout routes |
| Session tokens ≥ 128 bits random, stored hashed                     | ✅ 256-bit, SHA-256 stored                                           |
| Cookies: HttpOnly, Secure, SameSite, `__Host-` prefix               | ✅ (Secure/`__Host-` on HTTPS environments)                          |
| Idle and absolute session timeouts; revoke on password change       | ✅ 7 d idle / 30 d absolute; tested                                  |

## V4: Access control

| Requirement                                      | Status                                         |
| ------------------------------------------------ | ---------------------------------------------- |
| Deny by default                                  | ✅ `access-control.test.ts` checks every route |
| Object-level checks (no IDOR)                    | ⏳ P1                                          |
| Admin interface protected by additional controls | ⏳ P1 (Cloudflare Access + MFA)                |
| CSRF protection for state-changing requests      | ✅ `middleware/csrf.ts`                        |

## V5: Validation, sanitisation, encoding

| Requirement                                | Status                                                 |
| ------------------------------------------ | ------------------------------------------------------ |
| All input validated with allowlist schemas | ✅ pattern (`createRoute` + Zod), applied per endpoint |
| Parameterised queries only                 | ✅ Drizzle, `sql.raw` lint-banned                      |
| Output encoding / no raw HTML              | ✅ React + lint ban                                    |
| Request size limits                        | ✅ 64 KB                                               |

## V7: Errors and logging

| Requirement                                        | Status                                  |
| -------------------------------------------------- | --------------------------------------- |
| Generic error messages, no stack traces to clients | ✅ `middleware/error-handler.ts`        |
| Security events logged with correlation ID         | ✅ request ID; 🟡 audit entries from P1 |
| No secrets or sensitive data in logs               | ✅ redaction + policy                   |

## V8: Data protection

| Requirement                          | Status                               |
| ------------------------------------ | ------------------------------------ |
| Sensitive responses not cached       | ✅ `Cache-Control: no-store` default |
| Personal data minimised (IP hashing) | ✅ design / ⏳ usage in P1           |
| Data export and deletion (DPDP/GDPR) | ⏳ P1/P2                             |

## V9: Communications

| Requirement          | Status                                 |
| -------------------- | -------------------------------------- |
| TLS everywhere, HSTS | ✅ Cloudflare TLS + HSTS in production |

## V10: Malicious code and supply chain

| Requirement                                | Status                                    |
| ------------------------------------------ | ----------------------------------------- |
| Lockfile committed, dependency audit in CI | ✅ `package-lock.json`, `npm audit` in CI |
| No `eval` or dynamic code                  | ✅ lint-banned                            |

## V12 and V13: Files and API

| Requirement                                             | Status     |
| ------------------------------------------------------- | ---------- |
| Upload type/size validation, served with safe headers   | ⏳ P1 (R2) |
| API responses have correct content types and strict CSP | ✅         |
| Webhook signatures verified over the raw body           | ⏳ P2      |

## V14: Configuration

| Requirement                                                    | Status               |
| -------------------------------------------------------------- | -------------------- |
| Security headers (CSP, XFO, nosniff, Referrer, Permissions)    | ✅ web + API, tested |
| Debug features (API docs, stack traces) disabled in production | ✅                   |
| Secrets outside the repository                                 | ✅                   |
