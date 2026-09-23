/**
 * drizzle-kit config used ONLY by `npm run db:studio` (see studio.mjs), which
 * sets LOCAL_D1_FILE to the path of the local D1 SQLite file.
 */
import { defineConfig } from 'drizzle-kit';

const file = process.env.LOCAL_D1_FILE;
if (!file) throw new Error('LOCAL_D1_FILE is not set. Run `npm run db:studio` from the repo root.');

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema/index.ts',
  dbCredentials: { url: `file:${file.replace(/\\/g, '/')}` },
});
