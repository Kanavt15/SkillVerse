#!/usr/bin/env node
/**
 * Runs automatically before `npm run dev` (the "predev" npm hook).
 *
 * In local development the website finds the API through Wrangler's "dev
 * registry": small files named after each Worker in the user's Wrangler config
 * folder. If a previous dev session was killed abruptly (closed terminal, crash),
 * a stale entry can remain and the website then fails every API call with
 * "Network connection lost". The entries are re-created by the processes that
 * start next, so removing OUR entries first is always safe.
 *
 * Only files for this project's Workers are touched.
 */
import { existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const WORKERS = ['skillverse-api', 'skillverse-web'];

const candidates = [
  process.env.WRANGLER_REGISTRY_PATH,
  join(homedir(), '.wrangler', 'registry'),
  process.env.APPDATA && join(process.env.APPDATA, 'xdg.config', '.wrangler', 'registry'),
  join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), '.wrangler', 'registry'),
  join(homedir(), 'Library', 'Preferences', '.wrangler', 'registry'),
].filter(Boolean);

let removed = 0;
for (const dir of new Set(candidates)) {
  for (const name of WORKERS) {
    const file = join(dir, name);
    if (existsSync(file)) {
      rmSync(file, { force: true });
      removed++;
    }
  }
}
if (removed)
  console.info(`Cleared ${removed} old dev-registry entr${removed === 1 ? 'y' : 'ies'}.`);
