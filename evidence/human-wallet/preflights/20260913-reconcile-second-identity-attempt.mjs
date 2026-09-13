/** Read-only reconciliation. A successful review does not prove pending-switch timing. */
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
  before: { path: 'evidence/human-wallet/20260913-first-identity-attempt-reconciled.json', sha256: '7356b68442360206dbc10d187c0e51df9ef2824c7e32c869f29bcf2c1d5fb541' },
  setup: { path: 'evidence/human-wallet/20260913-pending-identity-second-setup.json', sha256: 'db34a05407411ca5ee6af58f70e7eb0dd0802fd00e38c5089c1f0f37a0656a48' },
  capture: { path: 'evidence/human-wallet/20260913-pending-identity-second-receipt.json', sha256: '8cfced51184d423bbedb9cc3d6fcef4d6d22e7c851f0b6ffdd5066fbb101e6a7' },
};
const records = {};
for (const [key, pin] of Object.entries(pins)) {
  const bytes = await local(pin.path);
  assert.equal(sha(bytes), pin.sha256, pin.path);
  records[key] = JSON.parse(bytes);
}
const { before, setup, capture } = records;
for (const [path, hash] of Object.entries(setup.source_pins)) assert.equal(sha(await local(path)), hash, path);
assert.deepEqual(setup.baseline, pins.before);
assert.deepEqual(capture.setup_evidence, pins.setup);
assert.equal(capture.pending_identity_case, 'INCONCLUSIVE_PENDING_SWITCH_NOT_CAPTURED');
assert.equal(capture.fixture_verified, true);
assert.equal(capture.exact_call_verified, true);
const { expected, receipt } = capture;
assert.equal(expected.hash, '0x508dfeec460005432da63ba4742e797ff6f901ff9f68b8af372e511f9753d72e');
assert.notEqual(expected.hash, before.expected.hash);
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
const intended = setup.intended_operation;
const nonce = call.args[4];
assert.match(nonce, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
assert.notEqual(nonce, before.expected.request_id);
assert.equal(call.method, intended.method);
assert.equal(expected.account, intended.account);
assert.deepEqual(call.args, [intended.workspace, intended.version, intended.question, intended.draft, nonce, true]);
assert.deepEqual(call, capture.decoded_call);
assert.equal(await digest([call.method, call.args]), expected.callDigest);
const reviewId = await digest([intended.workspace, intended.account, nonce]);
assert.equal(reviewId, expected.effect.fields.id);
const leaders = receipt.consensus_data.leader_receipt.filter((entry) => entry.mode === 'leader');
assert.equal(leaders.length, 1);
assert.equal(leaders[0].node_config.address.toLowerCase(), receipt.last_leader.toLowerCase());
const encoded = Buffer.from(typeof leaders[0].result === 'string' ? leaders[0].result : leaders[0].result.raw, 'base64');
assert.equal(encoded[0], 0);
const returned = plain(abi.calldata.decode(encoded.subarray(1)));

// Strict successful execution verification above precedes deployment and stored-state reads.
await verifyDeployment();
const sourceVerifiedAt = new Date().toISOString();
const stored = await verifyEffect(expected.effect);
assert.deepEqual(stored, returned);
assert.equal(stored.id, reviewId);
assert.equal(stored.author, intended.account);
assert.equal(stored.question, intended.question);
assert.equal(stored.draft, intended.draft);
assert.equal(stored.version, intended.version);
assert.equal(stored.request_digest, intended.request_digest);
assert.equal(stored.reference_digest, intended.reference_digest);
assert.equal(stored.assessment.verdict, intended.expected_verdict);
assert.equal(stored.assessment.question_status, intended.expected_question_status);
assert.deepEqual(stored.assessment.findings.map((finding) => finding.reason_code), intended.expected_reason_codes);
assert.deepEqual(stored.assessment.findings[0].citations, [{ quote: intended.draft, reference_id: 'faq' }]);
const observations = [];
assert.equal(before.observations.length, 10);
assert.equal(before.observations.find((row) => row.key === 'reviews').output.length, intended.expected_review_count_before);
assert.equal(intended.expected_review_count_after, intended.expected_review_count_before + 1);
for (const old of before.observations) {
  const requestedAt = new Date().toISOString();
  const output = await read(old.method, old.args);
  observations.push({ key: old.key, method: old.method, args: old.args, requested_at_utc: requestedAt, observed_at_utc: new Date().toISOString(), output });
  if (old.key === 'workspace') assert.deepEqual(output, { ...old.output, review_count: intended.expected_review_count_after });
  else if (old.key === 'reviews') {
    assert.equal(output.length, intended.expected_review_count_after);
    assert.deepEqual(output.filter((review) => review.id !== reviewId), old.output);
    assert.deepEqual(output.filter((review) => review.id === reviewId), [stored]);
  } else assert.deepEqual(output, old.output, old.key);
}
const firstUi = capture.browser_observations[0].snapshot;
const switchedUi = capture.browser_observations[1].snapshot;
assert.ok(firstUi.includes('button "0x7cef5d…8d97d0"'));
assert.ok(firstUi.includes('paragraph: committing'));
assert.ok(switchedUi.includes('button "0x29b8b7…509360"'));
assert.ok(switchedUi.includes('· visitor · reference v2'));
assert.ok(switchedUi.includes('Wallet 0x7cef5d…8d97d0 · ' + intended.workspace));
assert.ok(switchedUi.includes('Finalized; execution succeeded.'));
assert.ok(switchedUi.includes('button "Review draft" [disabled]'));
const proof = {
  format: 'replycheck-identity-attempt-reconciliation-v2', status: 'PASS_TRANSACTION_VERIFICATION',
  pending_identity_case: 'INCONCLUSIVE_PENDING_SWITCH_NOT_CAPTURED',
  observed_at_utc: new Date().toISOString(),
  generator: { path: 'evidence/human-wallet/preflights/20260913-reconcile-second-identity-attempt.mjs', sha256: sha(await readFile(new URL(import.meta.url))) },
  before_evidence: pins.before, setup_evidence: pins.setup, receipt_evidence: pins.capture,
  source_pins: setup.source_pins,
  expected: { ...expected, args: call.args, request_id: nonce, review_id: reviewId },
  receipt, decoded_call: call, decoded_return_payload: returned, stored_review: stored,
  deployment_verification: { source_sha256: before.deployment_verification.source_sha256, verified_at_utc: sourceVerifiedAt, matched: true },
  observations,
  verified_checks: [
    'Exact successful receipt identity, zero-value calldata and final-round output',
    'Fresh request UUID and derived review ID match the export and differ from the first attempt',
    'Deployed source/protocol match the pinned app',
    'Complete final leader return equals stored review, expected reason codes and literal reference quote',
    'Exactly one review increases eleven to twelve; every previous full review/timestamp is preserved',
    'Both complete reference bundles and cards, roles/invitations/ownership/settings remain unchanged',
    'Completed recovery stays attributed to B while A is shown as visitor with valid-draft submission disabled',
  ],
  timing: { receipt_request_started_at: capture.requested_at_utc, receipt_observed_at: capture.observed_at_utc, receipt_created_at: receipt.created_at, stored_recorded_at: stored.recorded_at, browser_timestamp_semantics: 'Snapshot request-start times, not wallet-event timestamps' },
  observations_not_proven: ['A connected while the public receipt was still pending', 'Network change during pending execution'],
  constraints: { transaction_sent_by_this_script: false, resubmitted: false, agent_wallet_approval: false, pending_identity_transition_observed: false, pending_network_transition_observed: false },
  limitation: 'B/committing and A/finalized were sampled. No independent pending receipt was observed alongside A; the order of wallet switch versus finalization is not established. This is not a pending-account or pending-network pass.',
};
console.log('REPLYCHECK_RECONCILIATION_RESULT\n' + JSON.stringify(proof, (_, value) => typeof value === 'bigint' ? value.toString() : value) + '\nREPLYCHECK_RECONCILIATION_END');
