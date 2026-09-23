#!/usr/bin/env node
/**
 * Keeps documentation honest. Fails (exit 1) when:
 *   1. A relative link in any Markdown file points to a file that doesn't exist.
 *   2. A secret in apps/api/.dev.vars.example is missing from the README env table.
 *   3. A root npm script is missing from the README scripts table.
 *   4. A database table created by a migration is not described in
 *      docs/architecture/database-schema.md.
 *
 * Run: npm run docs:check (also part of `npm run check` and CI).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const read = (p) => readFileSync(join(root, p), 'utf8');

// ── 1. Relative Markdown links ───────────────────────────────────────────────
const SKIP_DIRS = new Set(['node_modules', '.git', '.wrangler', 'build', 'dist', '.react-router']);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

const LINK = /\[[^\]]*\]\(([^)\s]+)\)/g;
for (const file of walk(root)) {
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, ''); // ignore code blocks
  for (const [, target] of text.matchAll(LINK)) {
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = decodeURIComponent(target.split('#')[0]);
    if (!path) continue;
    if (!existsSync(resolve(dirname(file), path))) {
      problems.push(`${relative(root, file)}: broken link → ${target}`);
    }
  }
}

// ── 2 & 3. README tables ─────────────────────────────────────────────────────
const readme = read('README.md');
const secrets = Object.keys(
  Object.fromEntries(
    read('apps/api/.dev.vars.example')
      .split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.split('=')[0].trim(), true]),
  ),
);
for (const key of secrets) {
  if (!readme.includes(`\`${key}\``))
    problems.push(`README.md: secret \`${key}\` is not documented`);
}

const scripts = Object.keys(JSON.parse(read('package.json')).scripts);
for (const name of scripts) {
  if (!readme.includes(`\`${name}\``))
    problems.push(`README.md: npm script \`${name}\` is not documented`);
}

// ── 4. Tables documented ─────────────────────────────────────────────────────
const schemaDoc = read('docs/architecture/database-schema.md');
const migrationsDir = join(root, 'packages/db/migrations');
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))) {
  const sql = readFileSync(join(migrationsDir, file), 'utf8');
  for (const [, table] of sql.matchAll(/CREATE TABLE `?(\w+)`?/g)) {
    if (!schemaDoc.includes(`\`${table}\``)) {
      problems.push(
        `docs/architecture/database-schema.md: table \`${table}\` (${file}) is not described`,
      );
    }
  }
}

if (problems.length) {
  console.error(`✖ Documentation check found ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nFix the docs (or the link) and run `npm run docs:check` again.');
  process.exit(1);
}
console.log('✔ Documentation check passed.');
