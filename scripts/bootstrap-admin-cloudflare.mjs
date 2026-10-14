/** Trusted Wrangler CLI provisioning; one atomic D1 file, dry-run by default, no public bootstrap route. */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bootstrapOptions } from './bootstrap-admin.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export function provisionCloudflare(options, execute = execFileSync) {
  const environment = options.environment;
  const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
  const id = quote(options.userId),
    receipt = quote(randomUUID()),
    now = Date.now();
  const eligible = `u.id=${id} AND u.status='active' AND u.email_verified_at IS NOT NULL AND u.password_hash IS NOT NULL
 AND EXISTS (SELECT 1 FROM mfa_totp WHERE user_id=u.id AND enabled_at IS NOT NULL)
 AND EXISTS (SELECT 1 FROM account_privacy WHERE user_id=u.id AND birth_date<=printf('%04d',CAST(strftime('%Y','now') AS INTEGER)-18)||strftime('-%m-%d','now') AND terms_version='2026-10-12' AND privacy_version='2026-10-12')
 AND NOT EXISTS (SELECT 1 FROM user_roles WHERE role IN ('admin','super_admin'))
 AND NOT EXISTS (SELECT 1 FROM platform_settings WHERE key='security.bootstrap_completed')`;
  const guard = `EXISTS (SELECT 1 FROM audit_logs WHERE id=${receipt})`;
  const sql = options.apply
    ? `
 INSERT INTO audit_logs SELECT ${receipt},NULL,'security.initial_admin_provisioned','user',${id},${quote(JSON.stringify({ notes: options.reason, summary: 'Initial super administrator provisioned through trusted Cloudflare CLI.' }))},NULL,${quote(`bootstrap-${randomUUID()}`)},${now} FROM users u WHERE ${eligible};
 INSERT INTO user_roles SELECT ${id},'super_admin',NULL,${now} WHERE ${guard};
 UPDATE users SET admin_version=admin_version+1,updated_at=${now} WHERE id=${id} AND ${guard};
 DELETE FROM sessions WHERE user_id=${id} AND ${guard};
 INSERT INTO platform_settings SELECT 'security.bootstrap_completed',${quote(JSON.stringify({ userId: options.userId, completedAt: now }))},'Protected initial administrative provisioning marker.',NULL,${now},0 WHERE ${guard};
 `
    : `SELECT EXISTS (SELECT 1 FROM users u WHERE ${eligible}) AS eligible;`;
  const cli = [
    join(root, 'node_modules/wrangler/bin/wrangler.js'),
    'd1',
    'execute',
    'DB',
    '--remote',
    '--env',
    environment,
  ];
  const run = (input) =>
    execute(process.execPath, [...cli, ...input, '--json'], {
      cwd: join(root, 'apps/api'),
      env: { ...process.env, WRANGLER_LOG_PATH: join(root, 'tmp', 'bootstrap-wrangler.log') },
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
  let verification;
  if (options.apply) {
    mkdirSync(join(root, 'tmp'), { recursive: true });
    const directory = mkdtempSync(join(root, 'tmp', 'bootstrap-')),
      file = join(directory, 'provision.sql');
    try {
      writeFileSync(file, sql, { mode: 0o600 });
      // D1 imports are atomic, but Wrangler returns import statistics rather than SELECT rows.
      run(['--file', file]);
    } finally {
      unlinkSync(file);
      rmdirSync(directory);
    }
    verification = `SELECT EXISTS (SELECT 1 FROM audit_logs a JOIN user_roles r ON r.user_id=a.target_id AND r.role='super_admin' JOIN platform_settings p ON p.key='security.bootstrap_completed' WHERE a.id=${receipt} AND a.action='security.initial_admin_provisioned' AND a.target_id=${id}) AS eligible;`;
  } else verification = sql;
  const results = JSON.parse(run(['--command', verification]));
  if (!results.at(-1)?.results?.[0]?.eligible)
    throw new Error(
      'Provisioning refused. Require an active, verified adult account, current agreements, password and MFA, with no existing admin or provisioning marker.',
    );
  return options.apply
    ? 'Initial super administrator provisioned; sign in again with MFA.'
    : 'Eligible. No changes made. Review the environment and account, then repeat with --apply.';
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const args = process.argv.slice(2),
      environment = process.env.ENVIRONMENT ?? args[args.indexOf('--environment') + 1];
    console.info(provisionCloudflare(bootstrapOptions(args, environment)));
  } catch (error) {
    console.error(
      error instanceof Error && error.message.startsWith('Provisioning refused')
        ? error.message
        : 'Cloudflare provisioning failed. Check Wrangler authentication, arguments and the selected environment.',
    );
    process.exitCode = 1;
  }
}
