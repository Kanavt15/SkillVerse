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
            COOKIE_SIGNING_KEY: 'test-cookie-signing-key-0123456789abcdef',
            GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
            GOOGLE_CLIENT_SECRET: 'test-client-secret',
            MFA_ENCRYPTION_KEY: '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0',
          },
        },
      }),
    ],
    test: {
      setupFiles: ['./test/setup.ts'],
    },
  };
});
