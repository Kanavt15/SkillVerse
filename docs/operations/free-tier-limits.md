# Cloudflare free-tier limits (and how we stay inside them)

> Limits as understood in September 2026. Cloudflare changes them occasionally: check https://developers.cloudflare.com/workers/platform/pricing/ and each product's "Limits" page before making capacity decisions.

## The limits

| Product                   | Free allowance (per account)                                               | Resets      | Used by SkillVerse for                      |
| ------------------------- | -------------------------------------------------------------------------- | ----------- | ------------------------------------------- |
| **Workers**               | 100,000 requests/day; **10 ms CPU per request**                            | daily (UTC) | web + API (each page view ≈ 2 requests)     |
| **D1**                    | 5 M rows read/day; 100 k rows written/day; 5 GB total, 500 MB per database | daily       | all application data                        |
| **KV**                    | 100 k reads/day; **1,000 writes/day**; 1 GB                                | daily       | not used (see below)                        |
| **R2**                    | 10 GB storage; 1 M write ops + 10 M read ops/month; **free egress**        | monthly     | files and video (Phase 1+)                  |
| **Durable Objects**       | Free on SQLite storage, with daily request/duration caps                   | daily       | notifications, chat, live boards (Phase 1+) |
| **Queues**                | 10,000 operations/day                                                      | daily       | email, webhooks (Phase 2)                   |
| **Cron Triggers**         | 5 per account                                                              | —           | scheduled jobs (Phase 2+)                   |
| **Workers Logs**          | 200,000 log events/day, 3-day retention                                    | daily       | request logs                                |
| **Rate Limiting binding** | Included                                                                   | —           | `RL_API`, `RL_AUTH`                         |
| **Turnstile**             | Free, unlimited                                                            | —           | bot checks on forms (Phase 1)               |
| **Cloudflare Access**     | Free for up to 50 users                                                    | —           | protects `/admin` (Phase 1)                 |
| **Image Transformations** | 5,000 unique transformations/month                                         | monthly     | thumbnails (Phase 1)                        |
| **Workers AI**            | 10,000 "neurons"/day                                                       | daily       | AI features (Phase 6)                       |

## What 10 ms of CPU means

CPU time is time spent **computing**. Waiting for D1, fetch or other I/O doesn't count. A typical API request here uses 1–3 ms. What can blow the budget:

- password hashing (we use native WebCrypto PBKDF2 and measure it in Phase 1);
- generating PDFs or images (done in the browser, or deferred to the paid plan);
- big JSON transformations (paginate instead).

Exceeding it returns error **1102** to the user. If that happens regularly, it's the signal to move to Workers Paid.

## Design rules that keep us free

1. **Never write to KV per request.** 1,000 writes/day is the scarcest resource on the plan. Caches live in Worker memory (e.g. feature flags, 60 s) and sessions live in D1.
2. **Always paginate and index.** Every list query has a `LIMIT` and an index on its filter/sort columns, so rows read stay low.
3. **Batch or aggregate writes** that would otherwise happen on every view (counters, analytics).
4. **Big files never touch D1 or pass through a Worker.** Browsers upload directly to R2 with presigned URLs.
5. **Cache public pages** at the edge where possible (Phase 1: `Cache-Control` on catalog pages).
6. **Static assets** (JS, CSS, fonts, images in `public/`) are served by Workers Static Assets, which doesn't count against the request limit.

## Rough capacity on the free plan

| Daily active users | Est. requests/day (≈50–100 per user) | Fits free plan?                       |
| ------------------ | ------------------------------------ | ------------------------------------- |
| 500                | 25–50 k                              | ✅ comfortably                        |
| 1,500              | 75–150 k                             | ⚠️ near the limit                     |
| 5,000+             | 250 k+                               | ❌ upgrade to Workers Paid ($5/month) |

## Monitoring usage

Dashboard → Workers & Pages → Overview shows requests and errors per Worker. D1 usage is under Storage & Databases → D1 → your database → Metrics.
