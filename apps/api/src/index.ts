/**
 * Worker entry point. Cloudflare calls `fetch` for every HTTP request.
 * Scheduled maintenance retains observations and delivers durable alerts. Later phases add queues.
 */
import { createApp } from './app';
import { runOperationalMaintenance } from './services/operational.service';
export { NotificationHub } from './notification-hub';

const app = createApp();

export default {
  fetch: app.fetch,
  scheduled(_event, env, context) {
    context.waitUntil(runOperationalMaintenance(env));
  },
} satisfies ExportedHandler<Env>;
