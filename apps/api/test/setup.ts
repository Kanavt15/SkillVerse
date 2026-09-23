/**
 * Runs before each test file: brings the isolated test database up to the
 * latest schema by applying every migration in packages/db/migrations.
 */
import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
