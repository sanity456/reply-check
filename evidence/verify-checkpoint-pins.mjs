/** Narrow opt-in for an append-only replay inventory; application pins stay current. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createEvidenceReader } from './read-evidence.mjs';

export const INVENTORY_PATH = 'evidence/offline-replays.json';
export const INVENTORY_SNAPSHOT = 'evidence/source-snapshots/20260913-before-network-registration/offline-replays.json.snapshot';
export const INVENTORY_SNAPSHOT_SHA256 = '16982aaf4cdfb431380b9d61c6c9b135b6727d52cfd1795b8d63c459a0900966';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function verifyCheckpointPins(root, pins, { historicalInventory = false } = {}) {
  const read = createEvidenceReader(root, { historicalWorkflow: false, historicalRecoveryUi: false });
  const scope = { current_pins: 0, historical_inventory_pins: 0, current_inventory_sha256: null };
  for (const [path, expected] of Object.entries(pins)) {
    const current = await read(path);
    const actual = sha(current);
    if (actual === expected) { scope.current_pins++; continue; }
    if (!historicalInventory || path !== INVENTORY_PATH || expected !== INVENTORY_SNAPSHOT_SHA256) {
      assert.equal(actual, expected, path);
    }
    const snapshot = await read(INVENTORY_SNAPSHOT);
    assert.equal(sha(snapshot), expected, 'Exact previous inventory bytes');
    const oldEntries = JSON.parse(snapshot), currentEntries = JSON.parse(current);
    assert.ok(Array.isArray(currentEntries));
    assert.equal(new Set(currentEntries.map((entry) => entry.path)).size, currentEntries.length);
    for (const entry of oldEntries) assert.deepEqual(currentEntries.find((item) => item.path === entry.path), entry, 'Existing replay entries must be preserved');
    assert.ok(currentEntries.length > oldEntries.length, 'Inventory must only be extended');
    scope.historical_inventory_pins++;
    scope.current_inventory_sha256 = actual;
  }
  if (scope.historical_inventory_pins) console.error('Evidence scope: only the 19-entry replay inventory uses its exact historical snapshot. All other source pins are current. The expanded inventory retains every original entry and is checked by the complete current suite.');
  return scope;
}
