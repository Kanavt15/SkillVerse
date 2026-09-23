# Authentication

How accounts, sign-in and sessions work, and why each step is designed the way it is. Code lives in `apps/api/src/services/auth.service.ts`, `session.service.ts`, `account.service.ts` and `middleware/auth.ts`. Tests are in `apps/api/test/auth.test.ts`, `account.test.ts` and `access-control.test.ts`.

## Endpoints

| Method and path                          | Auth    | What it does                                                           |
| ---------------------------------------- | ------- | ---------------------------------------------------------------------- |
| `POST /api/v1/auth/register`             | public  | Create account and email a verification link (does not sign in)        |
| `POST /api/v1/auth/verify-email`         | public  | Redeem the link token, mark the email verified, **sign in**            |
| `POST /api/v1/auth/resend-verification`  | public  | Email a fresh verification link                                        |
| `POST /api/v1/auth/login`                | public  | Email + password → session cookie                                      |
| `POST /api/v1/auth/logout`               | public  | Delete the current session and clear the cookie                        |
| `POST /api/v1/auth/forgot-password`      | public  | Email a reset link (30 min)                                            |
| `POST /api/v1/auth/reset-password`       | public  | Redeem the reset token, set the password, sign out everywhere, sign in |
| `GET /api/v1/me`                         | session | The signed-in user and profile                                         |
| `PATCH /api/v1/me/profile`               | session | Edit profile / finish onboarding                                       |
| `GET /api/v1/me/sessions`                | session | List signed-in devices                                                 |
| `DELETE /api/v1/me/sessions/{handle}`    | session | Sign out one device                                                    |
| `POST /api/v1/me/sessions/revoke-others` | session | Sign out all other devices                                             |
| `POST /api/v1/me/password`               | session | Change password (needs the current one; signs out other devices)       |

All `/auth/*` endpoints share a strict per-IP limit (10/min), and `/me/password` has its own.

## Sign-up and verification

```mermaid
sequenceDiagram
  participant U as User
  participant A as API
  participant D as D1
  participant M as Email
  U->>A: POST /auth/register {email, username, name, password}
  A->>A: validate · breached-password check
  alt email already registered
    A->>M: "You already have an account" (to the real owner)
  else new email
    A->>D: batch: insert user + profile + verify token (hash) + audit
    A->>M: "Confirm your email" link (token)
  end
  A-->>U: 202 "check your email"  (identical in both cases)
  U->>A: POST /auth/verify-email {token}
  A->>D: UPDATE email_tokens SET used_at … WHERE unused AND unexpired RETURNING user_id
  A->>D: set email_verified_at · insert session (hash)
  A-->>U: 200 + Set-Cookie sv_session (HttpOnly, SameSite=Lax)
```

**Why sign in only after verification?** The response to "register" must look identical whether or not the email exists (otherwise anyone could test which emails have accounts). If new accounts were signed in immediately, the presence of a cookie would give the answer away.

**Why a button on the verify page instead of verifying on page load?** Corporate email scanners open every link. A link that verified on `GET` would be "used" by the scanner, and could verify an address the owner never looked at.

## Sign-in

1. Look up the user by email. If there's none, still run a password hash against a dummy value, so the response time doesn't reveal that the account is missing. Return the generic "Incorrect email or password."
2. If the account is locked (10 failures → 15 minutes), return 429.
3. Verify the password (PBKDF2, constant-time compare). On failure, count it and write an audit entry.
4. Only after a correct password, reveal account problems ("suspended").
5. Reset the failure counter, upgrade the hash if it uses old settings, create the session, and write an audit entry.

## Sessions

See [ADR 0005](adr/0005-server-sessions.md). In short: a 256-bit random token in an HttpOnly cookie; the database stores only its SHA-256; there's a 7-day sliding idle expiry and a 30-day absolute expiry.

| Environment  | Cookie name         | Flags                                                 |
| ------------ | ------------------- | ----------------------------------------------------- |
| development  | `sv_session`        | HttpOnly, SameSite=Lax, Path=/                        |
| staging/prod | `__Host-sv_session` | HttpOnly, **Secure**, SameSite=Lax, Path=/, no Domain |

Every `/api/v1/*` request runs `loadSession`. It reads the cookie, loads the session, user and roles in one D1 batch, and rejects expired sessions or inactive accounts. It sets `c.var.auth` to the result or `null`, and deletes stale cookies. Routers then use `requireAuth`, `requireVerified` or `requireRole(...)`.

**Deny by default:** `test/access-control.test.ts` reads the OpenAPI document and calls every endpoint anonymously. Anything not on its short `PUBLIC` list must answer 401.

## Passwords

- Policy: 10–128 characters with no composition rules, plus a **breached-password check** ([Have I Been Pwned](https://haveibeenpwned.com/Passwords), k-anonymity: only 5 characters of the SHA-1 prefix leave the server). It's on in staging and production and off locally.
- Hash: PBKDF2-HMAC-SHA256 with 100,000 iterations (the Workers maximum) and a 16-byte random salt. Input is normalised to NFKC so Unicode look-alikes behave consistently. The stored format is versioned: `pbkdf2$100000$salt$hash`.
- Reset or change signs out other devices and sends a "your password was changed" email.

> **CPU note:** PBKDF2 is native code in Workers, but 100k iterations is the most CPU-intensive thing we do. Measure it on staging (Workers dashboard → CPU time). If sign-in exceeds the free plan's 10 ms, that's the signal for Workers Paid (see [free-tier-limits.md](../operations/free-tier-limits.md)).

## Email

`services/email.service.ts` sends through Resend when `RESEND_API_KEY` is set. Otherwise it uses the **dev mailbox**: emails are printed in the terminal and listed at `/dev/mailbox`. Templates (`lib/email-templates.ts`) escape every inserted value.

## Known limitations (tracked)

- **Account pre-hijacking:** someone could register a victim's email with their own password. It stays unverified, and the victim is told "you already have an account", with a reset link, if they try to sign up. When Google sign-in arrives, linking to an **unverified** existing account will clear its password first.
- 2FA (TOTP) and Google sign-in come in the next part of Phase 1.
