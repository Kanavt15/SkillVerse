# SkillVerse documentation

Start with the root [README](../README.md) to install and run the project. This folder holds everything else.

## Guides

Step-by-step how-tos. Read the two primers first if Cloudflare or D1 is new to you.

| Guide                                                  | Read it when…                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| [Cloudflare primer](guides/cloudflare-primer.md)       | you've never used Workers, Wrangler or bindings                 |
| [D1 database primer](guides/d1-database-primer.md)     | you've never used D1/SQLite, or you're used to MySQL or MongoDB |
| [Add an API endpoint](guides/add-an-api-endpoint.md)   | you need a new `/api/v1/...` route                              |
| [Add a page](guides/add-a-page.md)                     | you need a new page on the website                              |
| [Add a database table](guides/add-a-database-table.md) | you need to store new data                                      |
| [Set up Google sign-in](guides/google-sign-in.md)      | you want "Continue with Google" locally or in production        |
| [Bot protection (Turnstile)](guides/bot-protection.md) | you want the bot check on sign-up/sign-in forms                 |
| [Writing tests](guides/writing-tests.md)               | always                                                          |
| [Debugging](guides/debugging.md)                       | something is broken and you don't know why                      |

Guides for payments, file uploads, real-time features and background jobs will be added in the phases that introduce them (see the [roadmap](phases/roadmap.md)).

## Architecture

- [Overview](architecture/overview.md): the big picture, with diagrams
- [Authentication](architecture/authentication.md): sign-up, sign-in, sessions, passwords, email flows
- [Course revisions](architecture/course-revisions.md): private review copies, stable learner records, restoration and takedown
- [Teaching](architecture/teaching.md): instructor applications, the course builder, the course review queue
- [Learning](architecture/learning.md): catalog search, enrollment, progress, private notes, reviews and signed certificates
- [Video learning](architecture/video-learning.md): authored chapters, searchable transcripts and private reflection checkpoints
- [Community](architecture/community.md): course/lesson Q&A, accepted answers, private reports and staff moderation
- [Notifications](architecture/notifications.md): persisted inbox, discussion preferences and per-user live alerts
- [Verified legacy source](architecture/legacy-archive.md): exact cached history reference for later domain ports
- [Staff operations](architecture/admin-operations.md): protected account controls, audited decisions and current operational totals
- [Database schema](architecture/database-schema.md): every table and column explained
- [Decision records (ADRs)](architecture/adr/): why we chose what we chose

## Security

- [Threat model](security/threat-model.md): what we protect, from whom, and how
- [ASVS checklist](security/asvs-checklist.md): the OWASP standard we verify against, with status
- [Incident response](security/incident-response.md): what to do when something goes wrong

## Business

- [Revenue model](business/revenue-model.md): how SkillVerse makes money and shares it
- [Compliance](business/compliance.md): GST, TDS, DPDP Act, payment-gateway and AdSense requirements

## Design

- [Design system](design/design-system.md): tokens, typography, components, accessibility
- [Website redesign](design/redesign.md): direction, layout plan and verification scope
- [Information architecture](design/information-architecture.md): every page, grouped by audience

## Operations

- [Cloudflare backend / Vercel frontend](operations/cloudflare-vercel.md): selected deployment target and owner handoff
- [Privacy, support and identity verification](operations/privacy.md): guardian/teacher consent, private rights and retention
- [Checkpoint 3 verification](operations/checkpoint-3-verification.md): local evidence and owner launch prerequisites

- [Staff authority and alerts](operations/staff-controls.md): initial provisioning, privileged decisions, bounded audit and telemetry
- [Render backend / Vercel frontend](operations/render-vercel.md): D1 gateway, environment variables, deployment and rollback
- [Deployment](operations/deployment.md): from zero to production on Cloudflare
- [Free-tier limits](operations/free-tier-limits.md): what the free plan allows and how we stay inside it
- [Backups and restore](operations/backups.md)

## Planning

- [Master plan](../plan.txt): current product direction, architecture, release gates and local-only working agreements
- [Implementation checklist](../TODO.md): completed features, ordered remaining Phase 1 tasks and Phases 2–7 backlog
- [Roadmap](phases/roadmap.md): all phases and their status
- [Phase 0: Foundation](phases/phase-0.md): scope and done-checklist
- [Phase 1: Core learning platform](phases/phase-1.md): implemented features and remaining work

## Reference

- [Glossary](glossary.md): terms used across the project
