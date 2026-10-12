/** Run from a trusted operator machine; dry-run by default, never a public API route. */
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { gatewayClient } from '../apps/api/node/bindings.mjs';

export function bootstrapOptions(args, environment) {
  const { values } = parseArgs({
    args,
    options: {
      environment: { type: 'string' },
      user: { type: 'string' },
      reason: { type: 'string' },
      apply: { type: 'boolean', default: false },
    },
    allowPositionals: false,
    strict: true,
  });
  if (!['staging', 'production'].includes(values.environment) || values.environment !== environment)
    throw new Error('--environment must match ENVIRONMENT (staging or production).');
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      values.user ?? '',
    )
  )
    throw new Error('--user must be the verified account UUID.');
  if (!values.reason || values.reason.trim().length < 10 || values.reason.trim().length > 2000)
    throw new Error('--reason must contain 10–2000 characters.');
  return {
    environment: values.environment,
    userId: values.user,
    reason: values.reason.trim(),
    apply: values.apply,
  };
}
async function main() {
  const options = bootstrapOptions(process.argv.slice(2), process.env.ENVIRONMENT);
  const { createDb, bootstrap } = await import('../apps/api/dist/bootstrap.mjs');
  const { DB } = gatewayClient({
    url: process.env.D1_GATEWAY_URL,
    key: process.env.D1_GATEWAY_KEY,
  });
  const eligible = await bootstrap(
    createDb(DB),
    options.userId,
    options.reason,
    `bootstrap-${randomUUID()}`,
    options.apply,
  );
  if (!eligible)
    throw new Error(
      'Provisioning refused: account must be active, verified, password-backed and MFA-enabled, with no existing admin or provisioning marker.',
    );
  console.info(
    options.apply
      ? `Initial super administrator provisioned in ${options.environment}; sign in again with MFA.`
      : `Eligible in ${options.environment}. No changes made. Review the account and gateway environment before repeating with --apply.`,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Provisioning failed.');
    process.exitCode = 1;
  });
