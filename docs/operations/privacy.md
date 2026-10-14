# Privacy, eligibility and identity operations

Learning begins at 10; teaching at 16. Accounts under 18 require a verified
adult guardian's current scoped permission before creation. Dates are private,
validated calendar dates and immutable in normal account requests. No public
support email is published. Policy versions currently use `2026-10-12`; update
the matching SQL policy guards whenever a version changes.

## Guardian and teacher verification

An adult guardian first registers/verifies their own account and accepts current
agreements. `/settings/guardians` records scoped learning or learning+teaching
consent. Fresh owner proof starts a DigiLocker attempt bound to the account's
session and a hashed one-use state. Finish requires another fresh proof and
authenticated Setu status/identity reads, signature result, exact normalized legal
name, matching private birth date and adulthood. Staff cannot approve manual
references or document uploads. An independent super administrator may reject a
pending request through `/admin/guardians` with fresh password/MFA and a reason.

Approved guardians create up to five 14-day invitations per day, tied to exact
child email hash/birth date. Only the raw code is displayed once. Registration
consumes the invitation atomically; races cannot create two child accounts.
Withdrawal or guardian deletion invalidates unused invitations and revokes
linked minor sessions. Database predicates/triggers also block in-flight writes.
At adulthood, a user can independently accept current agreements.

Teachers accept Instructor Terms and verify their own identity via
`/settings/teacher-verification`. Provider checks require age 16+ and current
teaching permission, including the guardian teaching scope under 18. Identity
receipts expire after 180 days. Staff teaching-quality approval is separate;
provider verification alone grants no instructor role. Applications, instructor
role grants, Studio access, publication and public discovery check eligibility
and identity. Existing learners retain course access if an author loses discovery
eligibility. India DigiLocker availability and provider onboarding must be
confirmed before advertising broader instructor/guardian availability.

No Aadhaar number, XML, document URL, photo, address or legal name is persisted.
Verification rows contain provider request IDs/session/state hashes, times and
minimal receipts. Never log upstream responses or collect documents in Contact.
Provider access is revoked after reads; cron retries failed revocations in bounded
batches and treats an expired/unknown provider request as inaccessible. A stale
lease marker without a provider ID is cleaned locally.

## Exports

Owner password plus enabled MFA (or MFA for passwordless accounts) is required.
Five failed checks revoke the session. A ten-minute privacy access window unlocks
downloading; destructive mutations also require a separate 60-second single-use
nonce/current credential state. `/me/privacy/exports` lists only owner jobs.

Jobs process ten rows per keyset page into NDJSON parts, with a 20 MB total limit,
durable leases and 24-hour expiry. A static SQL resource/column allowlist excludes
passwords, tokens, factor secrets, provider subjects, other users' private records
and staff/report metadata. Each streamed part rechecks session, ownership, job
state and expiry. Captures occur while the job runs, not as a falsely advertised
global point-in-time snapshot. Status reads schedule additional bounded work;
cron also progresses jobs. Use verified private Contact for larger exports.

## Erasure

Owner confirmation `DELETE`, fresh security proof, current privacy version and
absence of staff roles produce one atomic deletion/audit receipt. A concurrent
role grant/security change causes refusal or rolls the whole batch back. Staff
must have every staff role independently revoked first.

The batch anonymizes identity, clears credentials/profiles/provider links,
revokes sessions, removes private learning records/certificates and recalculates
affected course counters. It erases authored Q&A text, removes solution pointers
to erased replies, withdraws authored publications, revokes owned guardian
permissions, cancels/wipes exports and erases the owner's private support text.
Teacher/guardian provider cleanup continues against retained minimal attempts.

The tombstone stays because authored courses have restrictive foreign keys and
existing learners retain licensed material and their own records. Other learners'
signed certificates keep their immutable stored snapshot for signature validation;
rendering/export masks a deleted instructor as `Former member`. The deleted
owner's own certificates become unavailable. Do not edit an immutable signature
snapshot to achieve display redaction. Audit/review receipts remain pseudonymous
operational records; legal retention and backup policies require operator review.

## Private Contact and corrections

Guests explicitly acknowledge privacy/adult-or-guardian submission, pass configured
bot/IP brakes and verify email using a hashed 72-hour one-use token redeemed only
on POST. Honeypot, per-email cooldown and five-per-day cap reduce spam. Only
verified tickets enter the administrator inbox. Signed-in owners use their own
verified address; owner history can include verified guest tickets at that address.
Moderators cannot read private support. Staff replies are versioned/audited and
durably delivered with leases, three bounded attempts and stable provider
idempotency keys. Delivery failures are visible in the queue. Do not silently
claim that a failed reply was emailed. Resolved threads are deleted after 90 days;
unverified tickets after expiry. A thread contains at most 20 staff replies.

For correction/deletion/guardian grievances, verify account ownership and legal
authority independently before acting. Do not accept sensitive documents,
passwords or codes through the message form. Birth-date corrections are an
operator-assisted exceptional workflow: use the provider's secured verification
process, document the evidence reference, assess changed age/guardian scope, and
have an authorized operator perform an audited database correction and session/
identity revocation. Ordinary profile editing cannot override age. No automatic
support-reply action changes birth dates or deletes another account.

## Operations and acceptance

`runOperationalMaintenance` calls privacy maintenance regardless of the telemetry
flag. Worker cron is every five minutes. Export cleanup, invitation expiry,
support delivery/retention and provider revocation are bounded independently.
Monitor failed maintenance/revocation events and queue delivery states; investigate
repeated failures without adding raw identity data to logs.

Local server/provider mocks exercise boundaries but do not prove live identity
provider availability, a guardian relationship, legal compliance, email delivery
or backup erasure. Complete live acceptance in the
[Cloudflare/Vercel guide](cloudflare-vercel.md). The public policy pages describe
the free service; payments/bookings/subscriptions remain planned.
