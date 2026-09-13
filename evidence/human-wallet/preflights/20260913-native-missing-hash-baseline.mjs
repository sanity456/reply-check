/** Read-only baseline for native missing-hash recovery testing; sends nothing. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { abi } from 'genlayer-js';
import { getReceipt, read, verifyDeployment } from '../../../lib/reply/chain.ts';
import { verifyReceiptCall } from '../../../lib/reply/receipt.ts';
const root = new URL('../../../', import.meta.url);
const local = (path) => readFile(new URL(path, root));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const path = 'evidence/human-wallet/20260913-two-tab-hash-reconciled.json';
const bytes = await local(path);
assert.equal(sha(bytes), '533364ca5f9bda89a9353bbf4f8ce08929f34b4b04dc833824cdbdbf80e3a8c4');
const baseline = JSON.parse(bytes);
const fixBytes = await local('evidence/local/20260913-missing-hash-wording-fix.json');
assert.equal(sha(fixBytes), 'a4fc5ebff120c7bd42af25810bd7cb20e27572c255608edb7da42d5f8791c5fe');
const fix = JSON.parse(fixBytes);
for (const [source, hash] of Object.entries(fix.source_pins)) assert.equal(sha(await local(source)), hash, source);
for (const [source, hash] of Object.entries(baseline.source_pins)) assert.equal(sha(await local(source)), hash, source);
const requested = new Date().toISOString();
const result = await getReceipt(baseline.expected);
const observed = new Date().toISOString();
assert.equal(result.state, 'success');
assert.equal(await verifyReceiptCall(result.receipt, baseline.expected), true);
const plain = (value) => {
  if (value instanceof Map) return Object.fromEntries([...value].map(([key, item]) => [key, plain(item)]));
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'bigint') { assert.ok(Number.isSafeInteger(Number(value))); return Number(value); }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
};
const leaders = result.receipt.consensus_data.leader_receipt.filter((entry) => entry.mode === 'leader');
assert.equal(leaders.length, 1);
assert.equal(leaders[0].node_config.address.toLowerCase(), result.receipt.last_leader.toLowerCase());
const encoded = Buffer.from(typeof leaders[0].result === 'string' ? leaders[0].result : leaders[0].result.raw, 'base64');
assert.equal(encoded[0], 0);
const returned = plain(abi.calldata.decode(encoded.subarray(1)));
assert.deepEqual(returned, baseline.stored_review);
await verifyDeployment();
const sourceVerified = new Date().toISOString();
const observations = [];
for (const previous of baseline.observations) {
  await new Promise(resolve => setTimeout(resolve, 1200));
  const started = new Date().toISOString();
  const output = await read(previous.method, previous.args);
  observations.push({ key: previous.key, method: previous.method, args: previous.args, requested_at_utc: started, observed_at_utc: new Date().toISOString(), output });
  assert.deepEqual(output, previous.output, previous.key);
}
assert.equal(observations.find((row) => row.key === 'workspace').output.review_count, 15);
const proof = {
  status: 'PASS_SCOPED_UNCHANGED_FIFTEEN_REVIEW_BASELINE',
  baseline: { path, sha256: sha(bytes) }, source_pins: fix.source_pins,
  generator: { path: 'evidence/human-wallet/preflights/20260913-native-missing-hash-baseline.mjs', sha256: sha(await readFile(new URL(import.meta.url))) },
  expected: baseline.expected, receipt: result.receipt,
  receipt_observation: { requested_at_utc: requested, observed_at_utc: observed },
  decoded_return_payload: returned,
  deployed_source: { matched: true, sha256: sha(await local('contracts/reply_check.py')), verified_at_utc: sourceVerified },
  observations,
  constraints: { transaction_sent: false, wallet_requested: false, new_model_run: false, hash_recovery_test_exercised: false, concurrent_send_test_exercised: false },
};
console.log('REPLYCHECK_BASELINE_RESULT\n' + JSON.stringify(proof, (_, value) => typeof value === 'bigint' ? value.toString() : value) + '\nREPLYCHECK_BASELINE_END');
