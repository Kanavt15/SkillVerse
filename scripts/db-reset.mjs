#!/usr/bin/env node
/**
 * Wipes the LOCAL development database and rebuilds it from migrations + seed.
 *
 *   npm run db:reset          (asks for confirmation)
 *   npm run db:reset -- --yes (no question, for scripts)
 *
 * Only touches apps/api/.wrangler/state/v3/d1 on your machine. Staging and
 * production databases are never affected by this script.
 */
import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const d1State = join(root, 'apps/api/.wrangler/state/v3/d1');

if (!process.argv.includes('--yes')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    'This deletes ALL data in your local development database. Continue? (y/N) ',
  );
  rl.close();
  if (answer.trim().toLowerCase() !== 'y') {
    console.log('Cancelled. Nothing was changed.');
    process.exit(0);
  }
}

if (existsSync(d1State)) {
  rmSync(d1State, { recursive: true, force: true });
  console.log('Deleted local database files.');
}

const env = { ...process.env, CI: 'true' }; // skip wrangler's confirmation prompt
execSync('npm run db:migrate:local', { cwd: root, stdio: 'inherit', env });
execSync('npm run db:seed', { cwd: root, stdio: 'inherit', env });
console.log('\n✔ Local database rebuilt from migrations and seed data.');
