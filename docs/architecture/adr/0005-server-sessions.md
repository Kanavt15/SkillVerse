# ADR 0005: Server-side sessions instead of JWTs

- **Status:** Accepted (implemented in Phase 1; the `sessions` table exists since Phase 0)
- **Date:** 2026-09-23

## Context

v1 used short-lived JWT access tokens plus rotating refresh tokens. JWTs can't be revoked before they expire, which is a problem when an account is suspended, a password changes, or a user clicks "sign out everywhere". Being same-origin ([ADR 0006](0006-ssr-same-origin.md)) means we don't need a token that works across domains.

## Decision

- On sign-in, generate a **256-bit random token**, set it in a cookie `__Host-sv_session` (HttpOnly, Secure, SameSite=Lax, Path=/; plain `sv_session` on http://localhost), and store **only its SHA-256** in `sessions.id`.
- Each request hashes the cookie and looks up the session: first in the Worker's memory for a few seconds, then in D1.
- Expiry: 7 days idle (sliding) and 30 days absolute. Rotate the token on privilege changes (sign-in, 2FA, role grant).
- Users can list and revoke sessions, and a password change revokes all others.

## Consequences

- ✅ Instant revocation, a simple mental model, and nothing sensitive readable by JavaScript (HttpOnly).
- ✅ A database leak doesn't expose usable tokens (only hashes are stored).
- ⚠️ One D1 read per authenticated request (cheap, and mitigated by the short in-memory cache). We deliberately do **not** cache sessions in KV, because the free plan allows only 1,000 KV writes per day.
