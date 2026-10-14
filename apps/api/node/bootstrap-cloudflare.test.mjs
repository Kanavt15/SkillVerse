import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { provisionCloudflare } from '../../../scripts/bootstrap-admin-cloudflare.mjs';

const options = {
  environment: 'staging',
  userId: '928c7133-004b-4e68-824c-95ea16247552',
  reason: "Owner's initial administrator review.",
  apply: false,
};
const result = (eligible) => JSON.stringify([{ results: [{ eligible }], success: true }]);

test('Cloudflare bootstrap dry-run uses a read-only command and refuses an ineligible account', () => {
  let calls = 0;
  const message = provisionCloudflare(options, (_executable, args) => {
    calls++;
    assert.ok(args.includes('--remote'));
    assert.equal(args[args.indexOf('--env') + 1], 'staging');
    assert.ok(!args.includes('--file'));
    assert.match(args[args.indexOf('--command') + 1], /^SELECT EXISTS/);
    return result(1);
  });
  assert.equal(calls, 1);
  assert.match(message, /No changes made/);
  assert.throws(() => provisionCloudflare(options, () => result(0)), /Provisioning refused/);
});

test('Cloudflare import statistics cannot substitute for the provisioning receipt', () => {
  let calls = 0,
    file,
    receipt;
  const run = (eligible) =>
    provisionCloudflare({ ...options, apply: true }, (_executable, args) => {
      calls++;
      if (args.includes('--file')) {
        file = args[args.indexOf('--file') + 1];
        const sql = readFileSync(file, 'utf8');
        receipt = sql.match(/INSERT INTO audit_logs SELECT '([^']+)'/)[1];
        assert.match(sql, /Owner''s initial administrator review/);
        assert.match(sql, /DELETE FROM sessions/);
        assert.match(sql, /security.bootstrap_completed/);
        // This is the actual Wrangler import response shape, which contains no SELECT rows.
        return JSON.stringify([{ results: [{ 'Total queries executed': 5 }], success: true }]);
      }
      const query = args[args.indexOf('--command') + 1];
      assert.ok(query.includes(receipt));
      assert.ok(query.includes(options.userId));
      assert.match(query, /r.role='super_admin'/);
      assert.equal(existsSync(file), false);
      return result(eligible);
    });
  assert.match(run(1), /provisioned/);
  assert.equal(calls, 2);
  assert.throws(() => run(0), /Provisioning refused/);
  assert.equal(calls, 4);
  assert.equal(existsSync(file), false);
});
