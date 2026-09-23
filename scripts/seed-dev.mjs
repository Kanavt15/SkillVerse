#!/usr/bin/env node
/**
 * Loads development seed data into the LOCAL database: `npm run db:seed`
 *
 *   1. packages/db/seed/seed.sql: platform settings and feature flags
 *   2. demo accounts (learner, instructor, admin) with a known dev password
 *
 * Safe to re-run (INSERT OR IGNORE). Never runs against staging or production:
 * every wrangler call here uses --local.
 *
 * Passwords are hashed exactly like the API does (PBKDF2-SHA256, 100k iterations,
 * format "pbkdf2$100000$salt$hash"), so demo users sign in through the normal flow.
 */
import { execSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(root, 'apps/api');

export const DEMO_PASSWORD = 'learn-and-grow-2026';

const DEMO_USERS = [
  {
    id: '01890000-0000-7000-8000-000000000001',
    email: 'learner@skillverse.test',
    username: 'demo_learner',
    displayName: 'Demo Learner',
    roles: [],
  },
  {
    id: '01890000-0000-7000-8000-000000000002',
    email: 'teacher@skillverse.test',
    username: 'demo_teacher',
    displayName: 'Demo Teacher',
    roles: ['instructor'],
  },
  {
    id: '01890000-0000-7000-8000-000000000003',
    email: 'admin@skillverse.test',
    username: 'demo_admin',
    displayName: 'Demo Admin',
    roles: ['admin'],
  },
];

const b64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password.normalize('NFKC'), salt, 100_000, 32, 'sha256');
  return `pbkdf2$100000$${b64url(salt)}$${b64url(hash)}`;
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function run(cmd) {
  // CI=true skips wrangler's interactive confirmation prompts.
  execSync(cmd, {
    cwd: apiDir,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, CI: 'true' },
  });
}

run('npx wrangler d1 execute DB --local --file=../../packages/db/seed/seed.sql');

const now = Date.now();
const lines = [];
for (const u of DEMO_USERS) {
  lines.push(
    `INSERT OR IGNORE INTO users (id, email, email_verified_at, username, display_name, password_hash, status, failed_login_count, created_at, updated_at) VALUES (${q(u.id)}, ${q(u.email)}, ${now}, ${q(u.username)}, ${q(u.displayName)}, ${q(hashPassword(DEMO_PASSWORD))}, 'active', 0, ${now}, ${now});`,
    `INSERT OR IGNORE INTO user_profiles (user_id, headline, onboarded_at, updated_at) VALUES (${q(u.id)}, ${q(`${u.displayName} (development account)`)}, ${now}, ${now});`,
    ...u.roles.map(
      (role) =>
        `INSERT OR IGNORE INTO user_roles (user_id, role, created_at) VALUES (${q(u.id)}, ${q(role)}, ${now});`,
    ),
  );
}

const tmpDir = join(apiDir, '.wrangler', 'tmp');
mkdirSync(tmpDir, { recursive: true });
const file = join(tmpDir, 'seed-demo-users.sql');
writeFileSync(file, lines.join('\n'));
run(`npx wrangler d1 execute DB --local --file=${JSON.stringify(file)}`);

console.log(`✔ Seed data loaded. Demo accounts (local only), password "${DEMO_PASSWORD}":`);
for (const u of DEMO_USERS)
  console.log(`    ${u.email.padEnd(26)} ${u.roles.join(', ') || 'learner'}`);
