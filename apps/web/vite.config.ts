/**
 * Vite build/dev configuration for the website.
 *
 * - `cloudflare()` runs the server-side code inside the real Workers runtime
 *   during `npm run dev`, with the bindings from wrangler.jsonc.
 * - `tailwindcss()` compiles app/styles/app.css.
 * - `reactRouter()` provides file routing, SSR and hydration.
 */
import { reactRouter } from '@react-router/dev/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const vercel = process.env.SKILLVERSE_WEB_TARGET === 'vercel';

export default defineConfig(({ isSsrBuild }) => ({
  environments: vercel
    ? { ssr: { build: { rollupOptions: { input: './server/app.ts' } } } }
    : undefined,
  build: vercel && isSsrBuild ? { rollupOptions: { input: './server/app.ts' } } : undefined,
  plugins: [
    ...(vercel ? [] : [cloudflare({ viteEnvironment: { name: 'ssr' } })]),
    {
      name: 'skillverse-hosting-helper',
      configEnvironment(name) {
        // React Router creates named server bundle environments under Vite's environment API.
        if (vercel && name.startsWith('ssr'))
          return { resolve: { noExternal: ['@vercel/react-router', '@react-router/node'] } };
      },
    },
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: vercel
      ? { 'cloudflare:workers': fileURLToPath(new URL('./server/env.server.ts', import.meta.url)) }
      : undefined,
  },
  server: {
    watch: {
      ignored: ['**/playwright-report/**', '**/test-results/**', '**/tmp/**', '**/.vercel/**'],
    },
  },
  // Pre-bundle lazy UI primitives so their first appearance cannot trigger a
  // development reload during a form submission or a sign-in redirect.
  optimizeDeps: {
    include: [
      '@radix-ui/react-accordion',
      '@radix-ui/react-dropdown-menu',
      'motion',
      'react-markdown',
      'rehype-sanitize',
    ],
  },
}));
