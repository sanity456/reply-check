/** Read-only fresh verification of one explicitly hash-pinned saved checkpoint. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { abi } from 'genlayer-js';
import { read, getReceipt, verifyDeployment } from '../../../lib/reply/chain.ts';
import { receiptState, verifyReceiptCall } from '../../../lib/reply/receipt.ts';

const root = new URL('../../../', import.meta.url);
const [baselinePath, baselineHash] = process.argv.slice(2);
assert.match(baselinePath ?? '', /^evidence\/human-wallet\/[a-z0-9-]+\.json$/);
assert.match(baselineHash ?? '', /^[0-9a-f]{64}$/);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const baselineBytes = await readFile(new URL(baselinePath, root));
assert.equal(sha(baselineBytes), baselineHash, 'Explicit saved checkpoint hash');
const baseline = JSON.parse(baselineBytes);
assert.ok(baseline.status.startsWith('PASS_'));
for (const [path, hash] of Object.entries(baseline.source_pins)) {
  const url = new URL(path, root);
  assert.ok(url.href.startsWith(root.href), 'Source pin stays inside project');
  assert.equal(sha(await readFile(url)), hash, path);
}

const requestedAt = new Date().toISOString();
const result = await getReceipt(baseline.expected);
const receiptObservedAt = new Date().toISOString();
assert.equal(result.state, 'success');
assert.equal(receiptState(result.receipt, baseline.expected).state, 'success');
assert.equal(await verifyReceiptCall(result.receipt, baseline.expected), true);
const plain = (value) => {
  if (value instanceof Map) return Object.fromEntries([...value].map(([key, item]) => [key, plain(item)]));
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'bigint') { assert.ok(Number.isSafeInteger(Number(value))); return Number(value); }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
};
const call = plain(abi.calldata.decode(Buffer.from(result.receipt.data.calldata, 'base64')));
assert.deepEqual(call, baseline.decoded_call);
const leaders = result.receipt.consensus_data.leader_receipt.filter((entry) => entry.mode === 'leader');
assert.equal(leaders.length, 1);
assert.equal(leaders[0].node_config.address.toLowerCase(), result.receipt.last_leader.toLowerCase());
const encoded = Buffer.from(typeof leaders[0].result === 'string' ? leaders[0].result : leaders[0].result.raw, 'base64');
assert.equal(encoded[0], 0);
const returned = plain(abi.calldata.decode(encoded.subarray(1)));
assert.deepEqual(returned, baseline.decoded_return_payload);
assert.deepEqual(returned, baseline.stored_review);

// Never read source/state until strict final execution and exact calldata pass.
await verifyDeployment();
const sourceVerifiedAt = new Date().toISOString();
assert.equal(baseline.observations.length, 10);
const observations = [];
for (const previous of baseline.observations) {
  const requested = new Date().toISOString();
  const output = await read(previous.method, previous.args);
  const observed = new Date().toISOString();
  assert.deepEqual(output, previous.output, previous.key + ' must be completely unchanged');
  observations.push({ key: previous.key, method: previous.method, args: previous.args, requested_at_utc: requested, observed_at_utc: observed, output });
}
const workspace = observations.find((row) => row.key === 'workspace').output;
const reviews = observations.find((row) => row.key === 'reviews').output;
assert.equal(workspace.review_count, reviews.length);
assert.deepEqual(reviews.find((review) => review.id === baseline.stored_review.id), returned);
const proof = {
  format: 'replycheck-fresh-saved-checkpoint-v1',
  status: 'PASS_SCOPED_UNCHANGED_CHECKPOINT',
  observed_at_utc: new Date().toISOString(),
  baseline: { path: baselinePath, sha256: baselineHash },
  generator: { path: 'evidence/human-wallet/preflights/verify-saved-checkpoint.mjs', sha256: sha(await readFile(new URL(import.meta.url))) },
  source_pins: baseline.source_pins,
  expected: baseline.expected,
  receipt: result.receipt,
  receipt_observation: { requested_at_utc: requestedAt, observed_at_utc: receiptObservedAt },
  decoded_call: call,
  decoded_return_payload: returned,
  stored_review: baseline.stored_review,
  deployment_verification: { matched: true, source_sha256: baseline.source_pins['contracts/reply_check.py'], verified_at_utc: sourceVerifiedAt },
  observations,
  verified_checks: [
    'Every original current-source pin matches exactly',
    'The previous transaction still has verified successful execution and the exact original calldata',
    'The final leader return equals the original full stored review',
    'Deployed source and protocol match before state reads',
    'All ten complete public-state outputs and every original stored timestamp remain unchanged',
  ],
  constraints: { transaction_sent: false, wallet_requested: false, state_changed: false, pending_network_switch_tested: false },
};
console.log('REPLYCHECK_CHECKPOINT_RESULT\n' + JSON.stringify(proof, (_, value) => typeof value === 'bigint' ? value.toString() : value) + '\nREPLYCHECK_CHECKPOINT_END');
