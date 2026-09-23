# Incident response

What to do when something goes wrong: a vulnerability report, a leaked secret, suspicious payments or an outage. Keep calm, write things down, and act in this order.

## 1. Triage (first 30 minutes)

- **What happened, and since when?** Collect `requestId`s, timestamps and affected user IDs.
- **Severity:**

| Level    | Examples                                             | Response          |
| -------- | ---------------------------------------------------- | ----------------- |
| Critical | Data breach, money being stolen, admin takeover      | Immediately, 24/7 |
| High     | Auth bypass for some users, leaked production secret | Same day          |
| Medium   | XSS on a low-traffic page, partial outage            | Within 3 days     |
| Low      | Missing header, minor information leak               | Next release      |

## 2. Contain

| Situation            | Action                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Leaked secret        | **Rotate it now:** `npx wrangler secret put NAME --env production`, and revoke the old key at the provider (Razorpay, Resend…). |
| Compromised accounts | Delete their rows from `sessions` (forces sign-out) and set `users.status = 'suspended'`.                                       |
| Feature being abused | Turn it off with its feature flag (`feature_flags.enabled = 0`), effective within 60 s.                                         |
| Payment fraud        | Disable `commerce.checkout`, pause payouts in the Razorpay dashboard.                                                           |
| Bad deploy           | Roll back: Cloudflare dashboard → Workers → Deployments → previous version → "Rollback".                                        |
| Attack traffic       | Cloudflare dashboard → Security → WAF: block the IPs, countries or paths; enable "Under Attack" mode.                           |
| Bad data change      | Restore with D1 Time Travel (see [backups.md](../operations/backups.md)).                                                       |

## 3. Investigate

- Logs: `npx wrangler tail --env production`, or the Workers Logs view in the dashboard (search by `requestId`, path, status).
- `audit_logs` table: who did what and when.
- Keep a timeline document for every step taken.

## 4. Fix and verify

- Write a failing test that reproduces the issue, fix it, and deploy.
- Check that nothing else uses the same vulnerable pattern (`grep` the codebase).

## 5. Notify

- **Personal data breach:** India's DPDP Act 2023 requires notifying the Data Protection Board and affected users. GDPR (EU users) requires notifying the authority within 72 hours. Take legal advice.
- Payment incidents: inform Razorpay.
- Reporter of a vulnerability: thank them and tell them when it's fixed.

## 6. Learn

Within a week, write a short blameless post-mortem (what happened, impact, root cause, what we changed) in `docs/security/postmortems/`, and update the threat model.
