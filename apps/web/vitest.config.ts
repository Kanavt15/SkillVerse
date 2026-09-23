/**
 * Unit tests for the website (pure functions and components).
 * Deliberately NOT using vite.config.ts: the Cloudflare and React Router
 * plugins are for building the app, not for testing individual modules.
 * End-to-end tests of whole pages come later with Playwright (e2e/).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    include: ['app/**/*.test.{ts,tsx}'],
  },
});
