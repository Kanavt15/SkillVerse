/**
 * React Router framework settings.
 *
 * `ssr: true` renders pages on the server (inside the Worker) so search engines
 * and AdSense reviewers see real content, and first paint is fast.
 *
 * Future flags opt in to React Router v8 behaviour now, so upgrading later is painless:
 *   - v8_viteEnvironmentApi: required by the Cloudflare Vite plugin.
 *   - v8_middleware:         route middleware (used for auth in Phase 1).
 *   - v8_splitRouteModules:  smaller JS chunks per route → faster page loads.
 */
import type { Config } from '@react-router/dev/config';

export default {
  ssr: true,
  future: {
    v8_viteEnvironmentApi: true,
    v8_middleware: true,
    v8_splitRouteModules: true,
  },
} satisfies Config;
