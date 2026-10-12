# Commit checkpoint 1 verification

Date: **2026-10-12**. Branch: **v2**. All results are local; no production
deployment or external provider activation was performed.

Scope: P1-01 reviewed course lifecycle, restoration and emergency takedown;
Render API/D1 gateway and Vercel SSR adapters; deployment/rollback documentation.

| Check                                       | Result                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                             | Passed: lint, strict workspace types, 35 shared + 182 API + 38 web tests, 3 Node tests, docs consistency                      |
| `npm run format:check` / `git diff --check` | Passed                                                                                                                        |
| `npm run test:e2e`                          | All 15 Chromium journeys passed; new revision/review and restore/takedown coverage included                                   |
| `npm run build`                             | Cloudflare target production build passed                                                                                     |
| `npm run test:node`                         | Render bundle built; adapter and actual Node HTTP boundaries passed                                                           |
| `npm run test:vercel`                       | Vercel SSR target built; real custom entry passed isolated SSR, nonce, trusted-IP, CSRF, proxy/cookie and notification checks |
| `npm audit --omit=dev --audit-level=high`   | Zero production vulnerabilities after separating build-only tooling                                                           |
| Local migrations                            | `0014` and `0015` applied successfully                                                                                        |
| Visual inspection                           | Staff restoration page inspected at 320 and 1440 px; controls and text fit the layout                                         |

Real D1 tests cover private copies, new/moved/removed curriculum, stable notes
and lesson progress, quiz revision changes, immutable signed certificates,
versioned races, stale authority and forced rollback. Browser journeys also
exercise native forms, JavaScript-disabled archival, both themes, narrow
layouts and axe checks. Browser email fixtures used a temporary private env
file with Resend, Google and Turnstile credentials blanked. The original local
secret file was preserved.

The first browser run identified duplicated validation alerts in the expanded
staff controls; the UI was corrected. A subsequent restoration test used a
history label before navigation had completed; it now waits for the current
state and fresh form version. The full final run passed.

Not verified here: remote provider credentials, DNS, hosted latency/usage,
production Google/MFA/Turnstile/email journeys, staff perimeter configuration,
backup restoration and certificate-key recovery, broader manual screen-reader
acceptance or the later phases. Build dependencies still need the P1-06 review;
the [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) has no
upstream patch in the checked advisory. The bundled production SSR helper
does not import Vercel's build tooling at runtime.

Continue with **P1-02** after the user commits this checkpoint. Learning 10+,
teaching 16+ and a private support workflow without a public email are accepted
product decisions for P1-03; enforcement/consent remains open.
