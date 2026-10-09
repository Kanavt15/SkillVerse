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

export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: 'ssr' } }), tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
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
});
