/**
 * Worker entry point. Cloudflare calls `fetch` for every HTTP request.
 * Later phases add `scheduled` (cron jobs) and `queue` (background jobs) here.
 */
import { createApp } from './app';
export { NotificationHub } from './notification-hub';

const app = createApp();

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
