import { build } from 'esbuild';
await build({
  entryPoints: ['apps/api/src/app.ts'],
  outfile: 'apps/api/dist/node-app.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
});
