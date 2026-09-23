/**
 * Tests run INSIDE the real Workers runtime (workerd) via Cloudflare's Vitest
 * integration, with a real local D1 database, so behaviour matches production.
 * Each test file gets isolated storage; migrations are applied in test/setup.ts.
 */
import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(import.meta.dirname, '../../packages/db/migrations'),
  );

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            IP_HASH_SALT: 'test-salt',
          },
        },
      }),
    ],
    test: {
      setupFiles: ['./test/setup.ts'],
    },
  };
});
