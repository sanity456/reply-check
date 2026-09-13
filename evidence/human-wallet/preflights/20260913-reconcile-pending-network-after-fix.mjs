/** Read-only reconciliation of the current-build pending-network test. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { abi } from 'genlayer-js';
import { read, verifyDeployment, verifyEffect } from '../../../lib/reply/chain.ts';
import { receiptState, verifyReceiptCall } from '../../../lib/reply/receipt.ts';
import { digest } from '../../../lib/reply/core.ts';

const root = new URL('../../../', import.meta.url);
const local = (path) => readFile(new URL(path, root));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pins = {
  setup: { path: 'evidence/human-wallet/20260913-pending-network-after-fix-unsigned-setup.json', sha256: '5b4d37b949f8577a4b61bbe6cf552ac3f7f30e90dc15115c43073609a68088cd' },
  window: { path: 'evidence/human-wallet/20260913-pending-network-after-fix-window.json', sha256: 'eae7c41bfd96a35ffc6b5fa6d4403a2cb3dc0fd01121086fc2376ad45c14afe2' },
  final: { path: 'evidence/human-wallet/20260913-pending-network-after-fix-final-receipt.json', sha256: '024407d4e14442deb306cd4f5099da7714d21511e279debc269ad6beb4ddcc68' },
};
const records = {};
for (const [key, pin] of Object.entries(pins)) {
  const bytes = await local(pin.path);
  assert.equal(sha(bytes), pin.sha256, pin.path);
  records[key] = JSON.parse(bytes);
}
const { setup, window: pendingProof, final: capture } = records;
const sourcePins = setup.fixed_build.current_source_pins;
for (const [path, hash] of Object.entries(sourcePins)) assert.equal(sha(await local(path)), hash, path);
assert.equal(sha(await local(setup.fixed_build.path)), setup.fixed_build.sha256);
assert.equal(pendingProof.setup.sha256, pins.setup.sha256);
assert.equal(setup.constraints.agent_checked_consent, false);
assert.equal(setup.constraints.agent_clicked_continue, false);
const before = setup.fresh_checkpoint;
const intended = setup.intended;
const window = pendingProof.passing_window;
const { expected, receipt } = capture;
assert.equal(expected.hash, '0x88440d641b31d15c9b66cb81e994bc55d1fb57dd89b2b0dc045ede4b83fcd41a');
assert.equal(intended.prohibited_resubmission_hashes.includes(expected.hash), false);
assert.equal(receiptState(window.capture.receipt, window.capture.expected).state, 'pending');
assert.equal(await verifyReceiptCall(window.capture.receipt, window.capture.expected), true);
assert.equal(window.capture.fixture_verified, true);
assert.equal(window.capture.exact_call_verified, true);
const times = [window.before.snapshotRequestedAt, window.before.snapshotCompletedAt, window.capture.requested_at_utc, window.capture.observed_at_utc, window.after.snapshotRequestedAt, window.after.snapshotCompletedAt].map(Date.parse);
assert.ok(times.every(Number.isFinite));
for (let index = 1; index < times.length; index++) assert.ok(times[index] >= times[index - 1]);
for (const observation of [window.before, window.after]) {
  const snapshot = observation.snapshot;
  const recovery = snapshot.split('  - region "Transaction recovery":')[1]?.split('  - tablist')[0];
  assert.ok(recovery);
  assert.ok(snapshot.split('- main:')[0].includes('button "Switch to Studionet"'));
  assert.ok(recovery.includes('TRANSACTION IN PROGRESS'));
  assert.ok(!recovery.includes('TRANSACTION CHECKED'));
  assert.deepEqual([...new Set(recovery.match(/0x[0-9a-f]{64}/g) ?? [])], [expected.hash]);
  assert.ok(recovery.includes('Wallet 0x7cef5d…8d97d0 · reply-wallet-20260910-105817'));
  assert.ok(snapshot.includes('button "Review draft" [disabled]'));
  assert.ok(snapshot.includes('text: ' + intended.question));
  assert.ok(snapshot.includes('text: ' + intended.draft));
}
assert.deepEqual(capture.expected, window.capture.expected);
assert.deepEqual(capture.app_transaction_export, window.capture.app_transaction_export);
assert.equal(receiptState(receipt, expected).state, 'success');
assert.equal(await verifyReceiptCall(receipt, expected), true);
const plain = (value) => {
  if (value instanceof Map) return Object.fromEntries([...value].map(([key, item]) => [key, plain(item)]));
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'bigint') { assert.ok(Number.isSafeInteger(Number(value))); return Number(value); }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
};
const call = plain(abi.calldata.decode(Buffer.from(receipt.data.calldata, 'base64')));
assert.deepEqual(call, capture.decoded_call);
assert.deepEqual(call, window.capture.decoded_call);
const nonce = call.args[4];
assert.equal(call.method, intended.method);
assert.deepEqual(call.args, [intended.workspace, intended.version, intended.question, intended.draft, nonce, true]);
assert.equal(nonce, '4884421d-4088-483f-b708-371145e540a7');
assert.notEqual(nonce, before.expected.request_id);
assert.equal(expected.account, intended.account);
assert.equal(expected.contract.toLowerCase(), intended.contract.toLowerCase());
assert.equal(expected.chainId, intended.chainId);
assert.equal(await digest([call.method, call.args]), expected.callDigest);
const reviewId = await digest([intended.workspace, intended.account, nonce]);
assert.equal(reviewId, expected.effect.fields.id);
assert.equal(reviewId, 'f9b23a4d50e6b30a16a49670ac17cedf97b993f4f9b5a025868a4c06cca8484e');
const leaders = receipt.consensus_data.leader_receipt.filter((entry) => entry.mode === 'leader');
assert.equal(leaders.length, 1);
assert.equal(leaders[0].node_config.address.toLowerCase(), receipt.last_leader.toLowerCase());
const encoded = Buffer.from(typeof leaders[0].result === 'string' ? leaders[0].result : leaders[0].result.raw, 'base64');
assert.equal(encoded[0], 0);
const returned = plain(abi.calldata.decode(encoded.subarray(1)));

// Final execution, signer, exact calldata and return payload are verified first.
await verifyDeployment();
const sourceVerifiedAt = new Date().toISOString();
const stored = await verifyEffect(expected.effect);
assert.deepEqual(stored, returned);
for (const [key, value] of Object.entries({ id: reviewId, author: intended.account, workspace_id: intended.workspace, question: intended.question, draft: intended.draft, version: intended.version, request_digest: intended.request_digest, reference_digest: intended.reference_digest })) assert.equal(stored[key], value, key);
assert.equal(stored.assessment.verdict, intended.expected_verdict);
assert.equal(stored.assessment.question_status, intended.expected_question_status);
assert.deepEqual(stored.assessment.findings.map((finding) => finding.reason_code), intended.expected_reason_codes);
assert.deepEqual(stored.assessment.findings[0].citations, [{ quote: intended.draft, reference_id: 'faq' }]);
assert.equal(before.observations.length, 10);
assert.equal(before.observations.find((row) => row.key === 'reviews').output.length, 13);
assert.equal(intended.expected_review_count_before, 13);
assert.equal(intended.expected_review_count_after, 14);
const observations = [];
for (const old of before.observations) {
  const requestedAt = new Date().toISOString();
  const output = await read(old.method, old.args);
  observations.push({ key: old.key, method: old.method, args: old.args, requested_at_utc: requestedAt, observed_at_utc: new Date().toISOString(), output });
  if (old.key === 'workspace') assert.deepEqual(output, { ...old.output, review_count: 14 });
  else if (old.key === 'reviews') {
    assert.equal(output.length, 14);
    assert.deepEqual(output.filter((review) => review.id !== reviewId), old.output);
    assert.deepEqual(output.filter((review) => review.id === reviewId), [stored]);
  } else assert.deepEqual(output, old.output, old.key);
}
const proof = {
  format: 'replycheck-pending-network-reconciliation-v1', status: 'PASS_SCOPED_PENDING_NETWORK_RECOVERY',
  observed_at_utc: new Date().toISOString(),
  generator: { path: 'evidence/human-wallet/preflights/20260913-reconcile-pending-network-after-fix.mjs', sha256: sha(await readFile(new URL(import.meta.url))) },
  setup_evidence: pins.setup, pending_window_evidence: pins.window, final_receipt_evidence: pins.final,
  fixed_build: setup.fixed_build, source_pins: sourcePins,
  expected: { ...expected, args: call.args, request_id: nonce, review_id: reviewId },
  receipt, decoded_call: call, decoded_return_payload: returned, stored_review: stored,
  deployment_verification: { source_sha256: sourcePins['contracts/reply_check.py'], matched: true, verified_at_utc: sourceVerifiedAt }, observations,
  verified_checks: [
    'Off-Studionet UI and the same B-bound recovery bracket an independently pending exact-call receipt',
    'The valid draft is disabled before and after that pending receipt sample',
    'Pending and finalized-success receipts bind the same export, sender, contract, zero-value calldata and new UUID',
    'The final-round leader payload equals the full stored review',
    'Stored classification, reason code and literal citation match the public fixture',
    'Exactly one review increases thirteen to fourteen; every previous full review and stored timestamp is unchanged',
    'References, cards, roles, invitations, ownership and settings are unchanged',
    'All 29 recovery-fixed source pins and the deployed contract source match',
  ],
  timing: { pending_receipt_requested_at: window.capture.requested_at_utc, pending_receipt_observed_at: window.capture.observed_at_utc, final_receipt_requested_at: capture.requested_at_utc, final_receipt_observed_at: capture.observed_at_utc, receipt_created_at: receipt.created_at, stored_recorded_at: stored.recorded_at },
  actors: pendingProof.actor_record,
  constraints: { transaction_sent_by_this_script: false, resubmitted: false, application_source_changed: false, wrong_candidate_hash_exercised: false, full_release_pass_claimed: false },
  limitation: 'This proves pending and final recovery while the app was visibly off Studionet. The alternative network ID and native wallet clicks were not independently observed. Hash correction, concurrent-tab scenarios, broader live adversarial cases, native accessibility and public CI remain separate gates.',
};
console.log('REPLYCHECK_RECONCILIATION_RESULT\n' + JSON.stringify(proof, (_, value) => typeof value === 'bigint' ? value.toString() : value) + '\nREPLYCHECK_RECONCILIATION_END');
