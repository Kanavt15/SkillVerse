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
| [Writing tests](guides/writing-tests.md)               | always                                                          |
| [Debugging](guides/debugging.md)                       | something is broken and you don't know why                      |

Guides for payments, file uploads, real-time features and background jobs will be added in the phases that introduce them (see the [roadmap](phases/roadmap.md)).

## Architecture

- [Overview](architecture/overview.md): the big picture, with diagrams
- [Authentication](architecture/authentication.md): sign-up, sign-in, sessions, passwords, email flows
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
- [Information architecture](design/information-architecture.md): every page, grouped by audience

## Operations

- [Deployment](operations/deployment.md): from zero to production on Cloudflare
- [Free-tier limits](operations/free-tier-limits.md): what the free plan allows and how we stay inside it
- [Backups and restore](operations/backups.md)

## Planning

- [Roadmap](phases/roadmap.md): all phases and their status
- [Phase 0: Foundation](phases/phase-0.md): scope and done-checklist

## Reference

- [Glossary](glossary.md): terms used across the project
