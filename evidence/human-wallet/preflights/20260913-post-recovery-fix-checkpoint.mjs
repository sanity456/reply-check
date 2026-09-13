/** Fresh read-only chain check after a frontend-only recovery fix. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { abi } from 'genlayer-js';
import { getReceipt, read, verifyDeployment } from '../../../lib/reply/chain.ts';
import { verifyReceiptCall } from '../../../lib/reply/receipt.ts';
const root = new URL('../../../', import.meta.url);
const path = 'evidence/human-wallet/20260913-fourth-identity-reconciled.json';
const bytes = await readFile(new URL(path, root));
const sha = (value) => createHash('sha256').update(value).digest('hex');
assert.equal(sha(bytes), '6954427beeb52d2b1e4ad0e9b0d04ec55d81634b2e69affbbbbae56edade3128');
const before = JSON.parse(bytes);
const requested = new Date().toISOString();
const result = await getReceipt(before.expected);
const observed = new Date().toISOString();
assert.equal(result.state, 'success');
assert.equal(await verifyReceiptCall(result.receipt, before.expected), true);
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
assert.deepEqual(returned, before.stored_review);
await verifyDeployment();
const sourceVerified = new Date().toISOString();
const observations = [];
for (const previous of before.observations) {
  const started = new Date().toISOString();
  const output = await read(previous.method, previous.args);
  observations.push({ key: previous.key, method: previous.method, args: previous.args, requested_at_utc: started, observed_at_utc: new Date().toISOString(), output });
  assert.deepEqual(output, previous.output, previous.key);
}
const proof = {
  status: 'PASS_SCOPED_UNCHANGED_CHAIN_AFTER_FRONTEND_FIX',
  baseline: { path, sha256: sha(bytes) },
  generator: { path: 'evidence/human-wallet/preflights/20260913-post-recovery-fix-checkpoint.mjs', sha256: sha(await readFile(new URL(import.meta.url))) },
  expected: before.expected, receipt: result.receipt,
  receipt_observation: { requested_at_utc: requested, observed_at_utc: observed },
  decoded_return_payload: returned,
  deployed_source: { matched: true, sha256: sha(await readFile(new URL('contracts/reply_check.py', root))), verified_at_utc: sourceVerified },
  observations,
  constraints: { transaction_sent: false, wallet_requested: false, new_model_run: false, pending_network_test_exercised: false },
};
console.log('REPLYCHECK_POSTFIX_RESULT\n' + JSON.stringify(proof, (_, value) => typeof value === 'bigint' ? value.toString() : value) + '\nREPLYCHECK_POSTFIX_END');
