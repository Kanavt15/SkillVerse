import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { bootstrapOptions } from '../../../scripts/bootstrap-admin.mjs';
const args = [
  '--environment',
  'staging',
  '--user',
  '928c7133-004b-4e68-824c-95ea16247552',
  '--reason',
  'Initial administrator reviewed by the owner.',
];
test('provisioning is explicit, environment-bound and defaults to dry-run', () => {
  assert.equal(bootstrapOptions(args, 'staging').apply, false);
  assert.equal(bootstrapOptions([...args, '--apply'], 'staging').apply, true);
  assert.throws(() => bootstrapOptions(args, 'production'), /must match/);
  assert.throws(() => bootstrapOptions([...args, '--unknown'], 'staging'));
  assert.throws(
    () =>
      bootstrapOptions(
        args.map((value) => (value.startsWith('928c') ? 'bad-id' : value)),
        'staging',
      ),
    /UUID/,
  );
  assert.throws(
    () =>
      bootstrapOptions(
        args.map((value) => (value.startsWith('Initial') ? 'short' : value)),
        'staging',
      ),
    /10/,
  );
});
