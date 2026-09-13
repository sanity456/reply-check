/** Offline replay only: reads preserved public evidence; never opens a wallet or sends RPCs. */
import assert from 'node:assert/strict';
import { createEvidenceReader } from '../../read-evidence.mjs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { abi } from 'genlayer-js';
import { digest } from '../../../lib/reply/core.ts';
import {
  receiptState,
  verifyReceiptCall,
} from '../../../lib/reply/receipt.ts';

const root = new URL('../../../', import.meta.url);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const read = createEvidenceReader(root);
const historicalUi = process.argv.includes('--historical-ui');
const uiSnapshots = {
  'hooks/use-reply-chain.ts': 'evidence/source-snapshots/20260912-pre-reliability/hooks/use-reply-chain.ts.snapshot',
  'app/reply.css': 'evidence/source-snapshots/20260912-pre-ui-fixes/app/reply.css',
  'components/reply/reply-app.tsx': 'evidence/source-snapshots/20260912-pre-ui-fixes/components/reply/reply-app.tsx.snapshot',
  'components/reply/review-result.tsx': 'evidence/source-snapshots/20260912-pre-focus-wording/components/reply/review-result.tsx.snapshot',
};
const readSource = (path) => read(historicalUi && uiSnapshots[path]
  ? uiSnapshots[path]
  : path);
const plain = (value) => {
  if (value instanceof Map)
    return Object.fromEntries([...value].map(([key, item]) => [key, plain(item)]));
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'bigint') {
    assert.ok(Number.isSafeInteger(Number(value)));
    return Number(value);
  }
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
};
async function evidence(name, expectedSha) {
  assert.match(name, /^[a-zA-Z0-9._-]+\.json$/);
  const bytes = await read('evidence/human-wallet/' + name);
  assert.equal(sha(bytes), expectedSha, name);
  return JSON.parse(bytes);
}
const name = '20260910-105817-after-signing-recovery-wallet-b.json';
const proof = await evidence(
  name,
  '525515c56bcd79b942f61ee7b74d4a617c3581f816f93dd075d30b82b0ea874d',
);
assert.equal(proof.status, 'PASS');
assert.ok(proof.checks.every((check) => check.status === 'PASS'));
const before = await evidence(proof.before_evidence.filename, proof.before_evidence.sha256);
const pending = await evidence(
  proof.pending_receipt_evidence.filename,
  proof.pending_receipt_evidence.sha256,
);
const browser = await evidence(proof.browser_evidence.filename, proof.browser_evidence.sha256);
for (const [file, hash] of Object.entries(proof.source_pins))
  assert.equal(sha(await readSource(file)), hash, file);
assert.equal(sha(await read('contracts/reply_check.py')), proof.source_sha256);
assert.equal(sha(await read('lib/reply/receipt.ts')), proof.receipt_verifier_sha256);
assert.equal(sha(await read('lib/reply/chain.ts')), proof.chain_client_sha256);
const expected = proof.expected;
assert.equal(receiptState(proof.receipt, expected).state, 'success');
assert.equal(await verifyReceiptCall(proof.receipt, expected), true);
assert.equal(pending.receipt.status, 'ACCEPTED');
assert.equal(receiptState(pending.receipt, expected).state, 'pending');
assert.equal(await verifyReceiptCall(pending.receipt, expected), true);
assert.equal(expected.callDigest, await digest([expected.method, expected.args]));
const intent = before.intended_operation;
assert.deepEqual(expected.args, [
  intent.workspace, intent.version, intent.question, intent.draft, expected.request_id, true,
]);
assert.equal(expected.review_id, await digest([
  intent.workspace, intent.account, expected.request_id,
]));
assert.equal(proof.stored_review.request_digest, await digest([
  'replycheck-v1', intent.workspace, intent.version, intent.account, intent.question, intent.draft,
]));
assert.equal(proof.stored_review.id, expected.review_id);
assert.equal(proof.stored_review.author, intent.account);
assert.equal(proof.stored_review.reference_digest, intent.reference_digest);
assert.equal(proof.stored_review.recorded_at, proof.timing.stored_recorded_at);
assert.equal(proof.stored_review.assessment.verdict, intent.expected_verdict);
assert.equal(proof.stored_review.assessment.question_status, intent.expected_question_status);
assert.deepEqual(
  proof.stored_review.assessment.findings.map((finding) => finding.reason_code),
  intent.expected_reason_codes,
);
const leaders = proof.receipt.consensus_data.leader_receipt.filter((item) => item.mode === 'leader');
assert.equal(leaders.length, 1);
assert.equal(leaders[0].node_config.address.toLowerCase(), proof.receipt.last_leader.toLowerCase());
const encoded = Buffer.from(
  typeof leaders[0].result === 'string' ? leaders[0].result : leaders[0].result.raw, 'base64',
);
assert.equal(encoded[0], 0);
assert.deepEqual(plain(abi.calldata.decode(encoded.subarray(1))), proof.stored_review);
assert.deepEqual(proof.decoded_return_payload, proof.stored_review);
for (const observation of proof.observations) {
  const previous = before.observations.find((item) => item.key === observation.key);
  assert.ok(previous, observation.key);
  if (observation.key === 'workspace') {
    assert.deepEqual(observation.output, {
      ...previous.output, review_count: previous.output.review_count + 1,
    });
  } else if (observation.method === 'list_reviews') {
    assert.equal(observation.output.length, previous.output.length + 1);
    assert.deepEqual(
      observation.output.filter((review) => review.id !== expected.review_id),
      previous.output,
    );
    assert.deepEqual(
      observation.output.filter((review) => review.id === expected.review_id),
      [proof.stored_review],
    );
  } else {
    assert.deepEqual(observation.output, previous.output, observation.key);
  }
}
assert.deepEqual(
  proof.app_transaction_export_before.payload,
  proof.app_transaction_export_after.payload,
);
for (const exported of [proof.app_transaction_export_before, proof.app_transaction_export_after])
  assert.equal(sha(JSON.stringify(exported.payload, null, 2)), exported.sha256);
assert.match(browser.immediate_before_reload.recoveryText, /TRANSACTION IN PROGRESS.*accepted/);
assert.ok(Date.parse(pending.observed_at_utc) > Date.parse(browser.initial_after_reload.observedAtUtc));
assert.ok(browser.after_hydration.recoveryText.includes(expected.hash));
assert.match(browser.after_hydration.recoveryText, /TRANSACTION CHECKED.*Finalized; execution succeeded/);
assert.equal(browser.after_hydration.waitingCount, 0);
assert.equal(proof.agent_wallet_approval, false);
assert.equal(proof.resubmitted, false);
console.log(JSON.stringify({
  status: 'PASS',
  source_verification: historicalUi ? 'original UI snapshots; other pins from current source' : 'all pins from current source',
  evidence: fileURLToPath(new URL('evidence/human-wallet/' + name, root)),
  transaction_hash: expected.hash,
  review_id: expected.review_id,
  recorded_at: proof.stored_review.recorded_at,
  exact_checks: proof.checks.length,
  note: 'Offline replay of saved public evidence; no network writes or new model test.',
}, null, 2));
