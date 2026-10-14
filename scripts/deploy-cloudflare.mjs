/** Repeatable Cloudflare API release. Provider-free preview is explicit; public launch fails closed. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({
  options: {
    environment: { type: 'string', default: 'production' },
    frontend: { type: 'string', default: 'https://skillverse-kanavt15.vercel.app' },
    preview: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});
if (!['staging', 'production'].includes(values.environment))
  throw new Error('Choose staging or production.');
const origin = new URL(values.frontend);
if (origin.protocol !== 'https:' || origin.origin !== values.frontend)
  throw new Error('--frontend must be an exact HTTPS origin.');
const source = join(root, `apps/api/.env.${values.environment}`),
  entries = Object.fromEntries(
    readFileSync(source, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
      .map((line) => {
        const split = line.indexOf('=');
        return [
          line.slice(0, split).trim(),
          line
            .slice(split + 1)
            .trim()
            .replace(/^['"]|['"]$/g, ''),
        ];
      }),
  );
for (const name of [
  'IP_HASH_SALT',
  'COOKIE_SIGNING_KEY',
  'CERTIFICATE_SIGNING_KEY',
  'WEB_PROXY_KEY',
])
  if ((entries[name] ?? '').length < 32)
    throw new Error(`Configure ${name} in the private environment file.`);
if (!/^[a-f0-9]{64}$/i.test(entries.MFA_ENCRYPTION_KEY ?? ''))
  throw new Error('MFA_ENCRYPTION_KEY must be 64 hex characters.');
if (!values.preview) {
  for (const name of [
    'RESEND_API_KEY',
    'EMAIL_FROM',
    'SETU_CLIENT_ID',
    'SETU_CLIENT_SECRET',
    'SETU_PRODUCT_INSTANCE_ID',
    'LEGAL_OPERATOR_NAME',
    'LEGAL_OPERATOR_COUNTRY',
  ])
    if (!entries[name])
      throw new Error(`Public launch requires ${name}. Use --preview only for a closed preview.`);
  if (/\.test|\.invalid|REPLACE_WITH/i.test(entries.EMAIL_FROM))
    throw new Error('EMAIL_FROM must use your verified sending domain.');
  const email = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${entries.RESEND_API_KEY}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!email.ok)
    throw new Error('Resend rejected the credential. Replace it before public launch.');
  const domains = (await email.json()).data ?? [],
    sender = entries.EMAIL_FROM.match(/@([^>\s]+)>?$/)?.[1];
  if (!domains.some((domain) => domain.name === sender && domain.status === 'verified'))
    throw new Error('EMAIL_FROM must use a verified Resend domain.');
}
const names = [
  'IP_HASH_SALT',
  'MFA_ENCRYPTION_KEY',
  'COOKIE_SIGNING_KEY',
  'CERTIFICATE_SIGNING_KEY',
  'WEB_PROXY_KEY',
  ...(!values.preview
    ? [
        'RESEND_API_KEY',
        'SETU_CLIENT_ID',
        'SETU_CLIENT_SECRET',
        'SETU_PRODUCT_INSTANCE_ID',
        'GOOGLE_CLIENT_SECRET',
        'TURNSTILE_SECRET_KEY',
        'OPS_ALERT_WEBHOOK_URL',
      ]
    : []),
];
const secrets = Object.fromEntries(
  names.filter((name) => entries[name]).map((name) => [name, entries[name]]),
);
mkdirSync(join(root, 'tmp'), { recursive: true });
const file = join(root, 'tmp', `worker-secrets-${values.environment}.json`);
try {
  writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
  const args = [
    join(root, 'node_modules/wrangler/bin/wrangler.js'),
    'deploy',
    '--env',
    values.environment,
    '--secrets-file',
    file,
    '--var',
    `APP_ORIGINS:${values.frontend}`,
    '--var',
    `EMAIL_FROM:${entries.EMAIL_FROM || 'SkillVerse <no-reply@skillverse.invalid>'}`,
    '--var',
    `PUBLIC_LAUNCH_READY:${values.preview ? 'off' : 'on'}`,
  ];
  if (values['dry-run']) args.push('--dry-run', '--outdir', join(root, 'tmp', 'api-release-build'));
  execFileSync(process.execPath, args, {
    cwd: join(root, 'apps/api'),
    env: { ...process.env, WRANGLER_LOG_PATH: join(root, 'tmp', 'deploy-worker.log') },
    stdio: 'inherit',
  });
} finally {
  unlinkSync(file);
}
