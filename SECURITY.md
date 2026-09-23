# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Email the maintainer at **security@REPLACE_WITH_DOMAIN** (until the domain is live, contact the repository owner directly) with:

- a description of the issue and its impact,
- steps to reproduce (URLs, requests, payloads),
- your name/handle if you'd like credit.

We aim to:

| Step                        | Target time    |
| --------------------------- | -------------- |
| Acknowledge your report     | 3 working days |
| Confirm and assess severity | 7 working days |
| Fix critical/high issues    | 14 days        |
| Tell you when it's fixed    | on release     |

Please give us reasonable time to fix the issue before disclosing it publicly. We won't take action against good-faith research that avoids privacy violations, data destruction and service disruption.

## Scope

In scope: the SkillVerse website and API (`https://<domain>/`, `https://<domain>/api/`).

Out of scope: denial-of-service, social engineering, physical attacks, reports from automated scanners without a demonstrated impact, and missing security headers on pages that don't need them.

## How SkillVerse is protected

A summary of the design is in [docs/security/threat-model.md](docs/security/threat-model.md), the checklist we verify against (OWASP ASVS Level 2) is in [docs/security/asvs-checklist.md](docs/security/asvs-checklist.md), and what we do when something goes wrong is in [docs/security/incident-response.md](docs/security/incident-response.md).
