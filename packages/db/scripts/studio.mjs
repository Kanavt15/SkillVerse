/**
 * Opens Drizzle Studio (a web UI to browse and edit tables) on the LOCAL D1 database.
 *
 * Wrangler stores the local database as a SQLite file with a hashed name under
 * apps/api/.wrangler/state/v3/d1/. This script finds that file and points
 * drizzle-kit at it, so you don't have to hunt for the path yourself.
 *
 * Usage (from the repo root): npm run db:studio
 */
import { spawn } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const d1Dir = resolve(here, '../../../apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject');

if (!existsSync(d1Dir)) {
  console.error(
    'No local database found. Run `npm run setup` (or `npm run db:migrate:local`) first.',
  );
  process.exit(1);
}

// Pick the most recently modified .sqlite file (there is normally exactly one).
const files = readdirSync(d1Dir)
  .filter((f) => f.endsWith('.sqlite'))
  .map((f) => ({ path: join(d1Dir, f), mtime: statSync(join(d1Dir, f)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

if (files.length === 0) {
  console.error(`No .sqlite file in ${d1Dir}. Run \`npm run db:migrate:local\` first.`);
  process.exit(1);
}

const dbFile = files[0].path;
console.log(`Opening Drizzle Studio on ${dbFile}`);

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['drizzle-kit', 'studio', '--config', 'scripts/studio.config.ts'],
  {
    cwd: resolve(here, '..'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, LOCAL_D1_FILE: dbFile },
  },
);
child.on('exit', (code) => process.exit(code ?? 0));
