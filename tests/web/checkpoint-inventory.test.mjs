import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  verifyCheckpointPins,
  INVENTORY_PATH,
  INVENTORY_SNAPSHOT,
  INVENTORY_SNAPSHOT_SHA256,
} from '../../evidence/verify-checkpoint-pins.mjs';
const root = new URL('../../', import.meta.url);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
test('checkpoint inventory: strict default rejects a changed inventory', async () => {
  await assert.rejects(
    verifyCheckpointPins(root, { [INVENTORY_PATH]: INVENTORY_SNAPSHOT_SHA256 }),
  );
});
test('checkpoint inventory: explicit snapshot preserves original bytes and every registered replay', async () => {
  assert.equal(
    sha(await readFile(new URL(INVENTORY_SNAPSHOT, root))),
    INVENTORY_SNAPSHOT_SHA256,
  );
  const result = await verifyCheckpointPins(
    root,
    { [INVENTORY_PATH]: INVENTORY_SNAPSHOT_SHA256 },
    { historicalInventory: true },
  );
  assert.equal(result.historical_inventory_pins, 1);
  assert.equal(
    result.current_inventory_sha256,
    sha(await readFile(new URL(INVENTORY_PATH, root))),
  );
});
test('checkpoint inventory: opting in cannot substitute application source or arbitrary old inventory hashes', async () => {
  for (const path of [
    'hooks/use-reply-chain.ts',
    'contracts/reply_check.py',
    'package-lock.json',
    INVENTORY_PATH,
  ]) {
    await assert.rejects(
      verifyCheckpointPins(
        root,
        { [path]: '0'.repeat(64) },
        { historicalInventory: true },
      ),
    );
  }
});
test('checkpoint inventory: current pins stay strict and reads cannot escape the project', async () => {
  const path = 'hooks/use-reply-chain.ts';
  const result = await verifyCheckpointPins(
    root,
    { [path]: sha(await readFile(new URL(path, root))) },
    { historicalInventory: true },
  );
  assert.equal(result.current_pins, 1);
  assert.equal(result.historical_inventory_pins, 0);
  await assert.rejects(
    verifyCheckpointPins(
      root,
      { '../outside.json': '0'.repeat(64) },
      { historicalInventory: true },
    ),
    /inside the project/,
  );
});
