/** Explicit historical UI scope for old saved observations; all other pins stay strict. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { verifyCheckpointPins } from './verify-checkpoint-pins.mjs';

export const DRAFT_UI_PATH = 'components/reply/reply-app.tsx';
export const DRAFT_UI_SHA256 = '3ae7e2932a1fc284f05ecd052d06d13eb50b9cafe6393d994cccda6faf1545a7';
export const DRAFT_UI_SNAPSHOT = 'evidence/source-snapshots/20260913-before-draft-errors/source-bytes.json';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function readPreDraftUi(root) {
  const entries = JSON.parse(await readFile(new URL(DRAFT_UI_SNAPSHOT, root), 'utf8'));
  const matches = entries.filter((entry) => entry.path === DRAFT_UI_PATH);
  assert.equal(matches.length, 1, 'Exactly one original UI snapshot');
  const entry = matches[0];
  assert.equal(entry.encoding, 'base64');
  assert.equal(entry.sha256, DRAFT_UI_SHA256);
  const bytes = Buffer.from(entry.data, 'base64');
  assert.equal(sha(bytes), DRAFT_UI_SHA256, 'Exact original UI bytes, including line endings');
  return bytes;
}

export async function verifyDraftUiPins(root, pins, { historicalDraftUi = false, historicalInventory = false } = {}) {
  if (!historicalDraftUi || !Object.hasOwn(pins, DRAFT_UI_PATH))
    return verifyCheckpointPins(root, pins, { historicalInventory });
  assert.equal(pins[DRAFT_UI_PATH], DRAFT_UI_SHA256, 'Only the exact pre-draft-feedback UI may use this scope');
  await readPreDraftUi(root);
  const remaining = { ...pins };
  delete remaining[DRAFT_UI_PATH];
  const scope = await verifyCheckpointPins(root, remaining, { historicalInventory });
  console.error('Evidence scope: reply-app.tsx uses its exact pre-draft-feedback bytes. This is a historical UI observation, not a fresh test of the changed form. Other pins retain their explicitly reported scope.');
  return { ...scope, historical_ui_pins: 1, historical_ui_sha256: DRAFT_UI_SHA256 };
}
