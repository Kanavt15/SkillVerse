# ADR 0001: Run everything on Cloudflare Workers

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

SkillVerse v1 was Express + MongoDB + Redis + Socket.io, which needs an always-on server. Requirements for v2:

- deploy **for free**, with a clear upgrade path when the business grows;
- **no cold starts** (free tiers like Render sleep after inactivity and take tens of seconds to wake, which hurts first impressions);
- fast for users across India and abroad;
- little operational work (no servers to patch).

## Decision

Run the website and the API as two **Cloudflare Workers**, and use Cloudflare's managed services for state: D1 (SQL), R2 (files), Durable Objects (real-time), Queues (jobs), Cron Triggers (schedules).

## Consequences

- ✅ $0 to start, with zero cold starts and a global edge.
- ✅ One vendor, one dashboard, one CLI (Wrangler), and local development that uses the real runtime.
- ⚠️ **10 ms CPU per request on the free plan.** CPU-heavy work (PDF generation, image processing) must move to the browser, to queues, or to the $5/month paid plan (30 s CPU). Password hashing uses native WebCrypto PBKDF2.
- ⚠️ No filesystem, no long-lived processes, no arbitrary TCP. Code runners (Judge0) and email (Resend) are external HTTP services.
- ⚠️ Some vendor lock-in. Mitigated by keeping business logic in plain TypeScript services, using Web-standard APIs and using Drizzle (which also supports Postgres).
