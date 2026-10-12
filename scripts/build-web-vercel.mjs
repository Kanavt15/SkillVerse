import { spawnSync } from 'node:child_process';
const result = spawnSync(
  process.execPath,
  [process.env.npm_execpath, 'exec', '--', 'react-router', 'build'],
  {
    cwd: 'apps/web',
    env: { ...process.env, SKILLVERSE_WEB_TARGET: 'vercel', VITE_SKILLVERSE_WEB_TARGET: 'vercel' },
    stdio: 'inherit',
  },
);
process.exit(result.status ?? 1);
