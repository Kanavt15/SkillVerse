import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gatewayClient } from './bindings.mjs';

test('failed mutating gateway calls are not retried or exposed with provider internals', async () => {
  let calls = 0;
  const client = gatewayClient({
    url: 'https://gateway.test',
    key: 'a'.repeat(32),
    fetcher: async () => {
      calls++;
      return Response.json({ error: 'PRIVATE_PROVIDER_DETAILS' }, { status: 500 });
    },
  });
  await assert.rejects(
    client.DB.prepare('INSERT INTO tags VALUES (?)').bind('id').run(),
    /^Error: D1 gateway failed \(500\)\.$/,
  );
  assert.equal(calls, 1);
});

test('gateway secrets cannot be redirected to an insecure or credential-bearing URL', () => {
  for (const url of [
    'http://remote.test',
    'https://user:password@remote.test',
    'https://remote.test/other',
    'https://remote.test/?key=private',
  ])
    assert.throws(() => gatewayClient({ url, key: 'a'.repeat(32) }));
  assert.throws(() => gatewayClient({ url: 'https://gateway.test', key: 'short' }));
});
