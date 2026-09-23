/**
 * drizzle-kit configuration.
 *
 * `npm run db:generate` compares src/schema/*.ts with the last snapshot in
 * migrations/meta and writes a NEW numbered .sql file describing the difference.
 * Wrangler then applies those .sql files to D1 (see apps/api/wrangler.jsonc →
 * `migrations_dir`). Never edit a migration that has already been applied anywhere;
 * create a new one instead.
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema/index.ts',
  out: './migrations',
  strict: true,
  verbose: true,
});
