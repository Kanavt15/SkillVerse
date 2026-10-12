# Provisioning, staff authority and operational alerts

Migrations `0016_staff_operational_controls.sql` and `0017_audit_usage_threshold.sql` add versioned controls, short-lived
security proofs, aggregate observations and alert delivery leases. Apply it before
deploying this version. Production uses ordinary registered accounts, never demo seeds.

## Provision the first super administrator

1. Deploy a separate staging database and API/gateway, configure transactional
   email and apply all migrations. Register the intended owner account through
   the website, verify its email, set a password and enable MFA. Save the recovery
   codes privately. Confirm the account UUID from its own `/api/v1/me` response.
2. On a trusted operator machine, install with `npm ci`. Load `ENVIRONMENT`,
   `D1_GATEWAY_URL` and `D1_GATEWAY_KEY` through your private shell secret store.
   Verify the gateway host and its D1 binding correspond to the intended
   environment. The environment flag is an operator guard; it cannot prove that
   the gateway is attached to the correct database. Gateway credentials grant
   database access and must never reach browser builds, Git, screenshots or logs.
3. Run the dry-run, replacing the UUID and reason with the reviewed values:

   ```sh
   npm run admin:bootstrap -- --environment staging --user ACCOUNT_UUID --reason "Owner reviewed initial administrator identity and MFA."
   ```

4. Review the dry-run result and destination. Repeat the same command with
   `--apply` to provision. For production, use production gateway secrets and
   `--environment production` after repeating the account and MFA checks there.
5. Sign in again with MFA. Check `/admin/audit` for
   `security.initial_admin_provisioned`. The provisioned account receives
   `super_admin`; its account version increments and all previous sessions end.
   No email address is hard-coded into the command and no HTTP bootstrap route exists.
6. Enroll a separate trusted operator account with verified email and MFA.
   Through `/admin/users/:userId`, grant it `super_admin` with a reason and fresh
   password/factor. Confirm that the second operator can sign in independently.
   Store both operators' recovery material separately from application secrets.

Dry-run makes no writes. Apply atomically records the audit event, grants the
role, revokes sessions and creates the protected `security.bootstrap_completed`
marker. It refuses deleted/suspended/unverified/passwordless/MFA-disabled accounts,
any existing admin or super-admin role, or an existing marker. Concurrent applies
can succeed only once. A failed batch leaves no partial grant. The marker is not
editable through platform controls. This command is initial provisioning, not
an unattended account-recovery backdoor. Recovery of all operators requires a
separately reviewed infrastructure incident procedure and retained audit evidence.

## Change privileged access

Only a super administrator may grant/revoke `moderator`, `admin` or `super_admin`.
Learner/instructor roles follow their domain workflows. A grant requires an active,
verified target with enabled MFA. Self and deleted targets are protected. Revocation
must leave a usable administrator and, when revoking `super_admin`, another active,
verified, MFA-enabled super administrator. Simultaneous cross-revocations cannot
remove both operators: each atomic batch rechecks current authority.

Every change requires a 10–2000-character reason, the displayed account version,
the actor's current password when one exists, and a fresh authenticator or unused
recovery code. OAuth-only operators prove their second factor; the initial owner
must have a password. A code is consumed on validation, including when the subsequent
decision loses a race. Five failed security checks revoke that session. Writes
require MFA even with the local demo bypass enabled. The per-actor limiter also
applies across client-IP changes.

The proof is a session-bound, one-use nonce valid for 60 seconds, kept only on
the server. The batch rechecks role, active/verified account, enabled MFA, verified
and unexpired session, nonce, target eligibility and version. Success records a
safe summary, increments the target version, changes the role and revokes all
target sessions together. The target signs in again with current privileges and
MFA. Suspension/deletion controls cannot manage staff; revoke roles independently
before deciding ordinary account access. Staff cannot disable MFA while holding
a staff role, including through a request racing with a role grant.

Password changes already revoke other sessions; password reset revokes all
sessions, and MFA sign-in rotates the token. MFA enablement, recovery regeneration
and non-staff disabling now atomically audit the operation and revoke other
sessions while preserving the current device. Setup/recovery generation also
commit recovery hashes with the factor/session state. No credentials are echoed
in admin form-error data, audit responses or operational payloads.

## Inspect decisions and manage controls

Admins and super admins can read `/admin/audit`, `/admin/controls` and
`/admin/operations` with the normal staff MFA gate. Moderators cannot access
these pages/APIs. Audit returns at most 50 entries and a timestamp/UUID keyset
cursor. Filters match exact action, target ID and actor ID. Only decision notes,
safe admin summaries and request IDs are returned; raw metadata, IP hashes,
tokens, passwords and MFA secrets are excluded. Concurrent newer entries do not
shift an existing cursor. The global and target audit indexes support these reads.

Super admins may change only six integer operational settings within their
displayed bounds, and the `auth.google` flag at 0%/100%. Google activation requires
configured client ID and secret; provider configuration alone no longer activates
it. Migration defaults the flag to off. Configure the provider using the
[Google sign-in guide](../guides/google-sign-in.md), then enable it in controls.
Commerce/ads, provisioning, secrets and arbitrary settings remain protected.
Setting/flag changes require a reason, current row version and fresh proof; audit
and version changes commit together. Cached values converge within 60 seconds
across processes and invalidate immediately in the writing process.

## Enable observations and alert delivery

Set `OPERATIONS_TELEMETRY=on` on the API, and set the private
`OPS_ALERT_WEBHOOK_URL` secret to a compatible HTTPS receiver accepting
`{ text, alert: { id, environment, kind, count, bucket } }`. Do not use an email
address or expose this URL in public support pages. Configure a receiver that
deduplicates the `idempotency-key` header/alert ID and accepts the complete JSON
contract. Secret URLs cannot contain credentials or fragments, use plaintext HTTP,
redirect, or target localhost, numeric IPs or internal hostnames. This is a trusted
operator configuration, not a user-supplied webhook destination.

Five-minute UTC buckets count requests, 5xx errors, 429 responses, slow requests
and capped total duration across six coarse groups. Health checks are excluded.
Counters contain no account IDs, IPs, request paths, bodies or provider error text.
One alert of each kind is created per bucket when its threshold is crossed:

| Setting                           | Default |    Bounds |
| --------------------------------- | ------: | --------: |
| Requests / 5 minutes              |    5000 | 1–1000000 |
| Server errors / 5 minutes         |       5 |   1–10000 |
| Slow duration (ms)                |    2000 | 500–30000 |
| Slow requests / 5 minutes         |      20 |   1–10000 |
| Rate-limited requests / 5 minutes |      50 |   1–10000 |
| Retention (days)                  |       7 |      1–30 |

Alerts record the aggregate count when first created, not a final bucket total.
`/admin/operations` displays a 1–24-hour window including the first partial bucket,
at most six groups and 30 recent alerts. Counts are best effort: background writes
can lag/fail and processes can exit. They are operational indicators, not billing,
product analytics or a precise usage quota. Recording incurs one counter write
plus bounded threshold reads per request; monitor D1 consumption before launch.

Render's running Node service attempts maintenance every minute, with an unref'd
timer cleared on shutdown. Requests also flush due alerts. Multiple instances
share D1 leases, so one sender claims an alert for 60 seconds. Up to three sends
are attempted, with a 5-second timeout and increasing minute retry delays.
Redirects/non-2xx responses fail. Crashed leases can be retried. Delivery is
at least once; receiver deduplication handles a send succeeding just before a crash.
Missing hooks show `not_configured`; exhausted sends show `delivery_failed` and
are not silently treated as delivered. A dormant Render service cannot run its
timer; use a continuously running service for this deployment.

For the Cloudflare API deployment, the staging/production Wrangler environments
include `*/5 * * * *` Cron Triggers invoking the same maintenance handler.
Cron configuration is environment-specific and runs in UTC; see
[Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
The Render gateway itself does not need the API cron. Do not deploy both API
runtimes against the same environment accidentally. Maintenance removes at most
500 expired counter rows and 500 expired alert rows per run, clears expired proofs
and retries due sends. Retention is eventual when there is a backlog or downtime.

## Verify deployment and respond

In staging, configure the receiver first, enable observations, and make ordinary
API requests. Temporarily lower the request-volume threshold to a small number
through the audited controls, make enough requests and confirm one alert arrives
with the correct environment and private-safe payload. Check delivered state and
receiver deduplication, then restore the threshold with a fresh reason/factor.
Use a test receiver that returns 503 to verify retry and exhausted state. Capture
sanitized evidence privately; these provider checks have not been run from this
checkout. Never force production errors to test delivery.

Application alerts cannot report a total outage of the API, gateway or D1.
Configure an independent uptime check against `/api/health`, and Render's
[health checks](https://render.com/docs/health-checks) and
[failure notifications](https://render.com/docs/notifications). Review Render
[service metrics](https://render.com/docs/service-metrics), Cloudflare/D1 usage,
Vercel usage and transactional-email provider limits separately. Set provider
budget/usage notifications according to the actual account plan. Application
request counts cannot substitute for provider cost alerts.

For error alerts, correlate sanitized API logs using request IDs; inspect gateway
and email health before changing thresholds. For slow requests, check D1/network
latency and coarse group counts. For traffic/rate spikes, inspect abuse controls
and host usage. For failed delivery, verify receiver configuration and logs without
printing the URL. After recovery, repeat the staging smoke check and document the
incident. Audit deletion and financial decisions are outside these controls.
