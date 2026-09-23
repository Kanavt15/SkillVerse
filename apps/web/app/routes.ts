/**
 * URL → page mapping. Every page is listed here explicitly so the site map is
 * readable in one place. See docs/guides/add-a-page.md.
 */
import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  // Must stay last: renders the 404 page for any unknown URL (with a real 404 status).
  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
