# ADR 0014: Render API and Vercel SSR with D1

Status: accepted, 2026-10-12.

The user requested Render for the backend and Vercel for the frontend, and
explicitly selected retaining Cloudflare D1.

Bundle the existing Hono application for Node. Use a protected Worker gateway
for D1 and Cloudflare rate limits, preserving one atomic RPC per application
batch. Avoid using Cloudflare's administrative REST API in the request path.
Keep the normal Cloudflare target available for development and existing
deployments.

Use the official Vercel React Router preset with a custom server entry. Proxy
API requests through the website origin using a separate server secret; retain
nonce-based CSP, CSRF, cookie relay and trusted request IPs. Request-scoped
async context gives public SSR API reads the same visitor IP as private reads.

Durable Object WebSockets are specific to the Cloudflare deployment. The
Render/Vercel target uses persistent inbox reads and visible-page polling.
The extra HTTPS hops require staging latency/cost measurement. Existing
Cloudflare Access settings do not automatically protect Vercel staff pages.
See the [deployment guide](../../operations/render-vercel.md).
