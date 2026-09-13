/** Read-only reconciliation of the captured pending-account window and its final outcome. */
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
  before: { path: 'evidence/human-wallet/20260913-second-identity-attempt-reconciled.json', sha256: 'efd4ac6140ec885d3bf47817973220b7a7417b62bb2732dadfc326ac86a0c45c' },
  setup: { path: 'evidence/human-wallet/20260913-fourth-identity-unsigned-setup.json', sha256: '9539ac89b3b4e605586bf255581458af463a69676eb216d70eaba82b2aea6ff1' },
  window: { path: 'evidence/human-wallet/20260913-fourth-pending-account-window.json', sha256: '7774bd735cf76ff54e8b3eb30840a2e38daddadd6d7006ca172da69943aaa60f' },
  final: { path: 'evidence/human-wallet/20260913-fourth-identity-final-receipt.json', sha256: 'c346b11bbb2adf11bf376ff7582f29b8e49ec19126b002f7c31384455135ac19' },
};
const records = {};
for (const [key, pin] of Object.entries(pins)) { const bytes = await local(pin.path); assert.equal(sha(bytes), pin.sha256, pin.path); records[key] = JSON.parse(bytes); }
const { before, setup, window: pendingProof, final: capture } = records;
for (const [path, hash] of Object.entries(setup.source_pins)) assert.equal(sha(await local(path)), hash, path);
const window = pendingProof.passing_window;
assert.equal(receiptState(window.capture.receipt, window.capture.expected).state, 'pending');
assert.equal(await verifyReceiptCall(window.capture.receipt, window.capture.expected), true);
assert.equal(window.capture.receipt.status, 'COMMITTING');
assert.equal(window.capture.fixture_verified, true);
const observedTimes = [window.before.snapshotRequestedAt, window.before.snapshotCompletedAt, window.capture.requested_at_utc, window.capture.observed_at_utc, window.after.snapshotRequestedAt, window.after.snapshotCompletedAt].map(Date.parse);
assert.ok(observedTimes.every(Number.isFinite));
for (let index = 1; index < observedTimes.length; index++) assert.ok(observedTimes[index] >= observedTimes[index - 1]);
for (const observation of [window.before, window.after]) {
  assert.ok(observation.snapshot.split('- main:')[0].includes('button "0x29b8b7…509360"'));
  assert.ok(observation.snapshot.includes('· visitor · reference v2'));
  assert.ok(observation.snapshot.includes('TRANSACTION IN PROGRESS'));
  assert.ok(!observation.snapshot.includes('TRANSACTION CHECKED'));
  assert.ok(observation.snapshot.includes(window.capture.expected.hash));
  assert.ok(observation.snapshot.includes('Wallet 0x7cef5d…8d97d0 · reply-wallet-20260910-105817'));
  assert.ok(observation.snapshot.includes('button "Review draft" [disabled]'));
  assert.ok(observation.snapshot.includes('text: How long do I have to request a refund?'));
  assert.ok(observation.snapshot.includes('text: Refund requests must be submitted within 14 days of purchase.'));
}
assert.deepEqual(capture.expected, window.capture.expected);
assert.deepEqual(capture.app_transaction_export, window.capture.app_transaction_export);
const { expected, receipt } = capture;
assert.equal(expected.hash, '0x6f8bccb77b08ca2ace92e78a858e84fae002c16e11e0324fa7b619dc187cdfec');
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
assert.deepEqual(call, window.capture.decoded_call);
assert.deepEqual(call, capture.decoded_call);
const intended = setup.intended_operation, nonce = call.args[4];
assert.equal(call.method, intended.method);
assert.deepEqual(call.args, [intended.workspace, intended.version, intended.question, intended.draft, nonce, true]);
assert.match(nonce, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
assert.notEqual(nonce, before.expected.request_id);
assert.equal(expected.account, intended.account);
assert.equal(await digest([call.method, call.args]), expected.callDigest);
const reviewId = await digest([intended.workspace, intended.account, nonce]);
assert.equal(reviewId, expected.effect.fields.id);
const leaders = receipt.consensus_data.leader_receipt.filter((entry) => entry.mode === 'leader');
assert.equal(leaders.length, 1);
assert.equal(leaders[0].node_config.address.toLowerCase(), receipt.last_leader.toLowerCase());
const encoded = Buffer.from(typeof leaders[0].result === 'string' ? leaders[0].result : leaders[0].result.raw, 'base64');
assert.equal(encoded[0], 0);
const returned = plain(abi.calldata.decode(encoded.subarray(1)));
// Strict final execution and exact-call verification precede every deployment/state read.
await verifyDeployment();
const sourceVerifiedAt = new Date().toISOString();
const stored = await verifyEffect(expected.effect);
assert.deepEqual(stored, returned);
for (const [key, value] of Object.entries({ id: reviewId, author: intended.account, workspace_id: intended.workspace, question: intended.question, draft: intended.draft, version: intended.version, request_digest: intended.request_digest, reference_digest: intended.reference_digest })) assert.equal(stored[key], value, key);
assert.equal(stored.assessment.verdict, intended.expected_verdict);
assert.equal(stored.assessment.question_status, intended.expected_question_status);
assert.deepEqual(stored.assessment.findings.map((finding) => finding.reason_code), intended.expected_reason_codes);
assert.deepEqual(stored.assessment.findings[0].citations, [{ quote: intended.draft, reference_id: 'faq' }]);
const observations = [];
assert.equal(before.observations.length, 10);
assert.equal(before.observations.find((row) => row.key === 'reviews').output.length, 12);
assert.equal(intended.expected_review_count_before, 12);
assert.equal(intended.expected_review_count_after, 13);
for (const old of before.observations) {
  const requestedAt = new Date().toISOString(), output = await read(old.method, old.args);
  observations.push({ key: old.key, method: old.method, args: old.args, requested_at_utc: requestedAt, observed_at_utc: new Date().toISOString(), output });
  if (old.key === 'workspace') assert.deepEqual(output, { ...old.output, review_count: 13 });
  else if (old.key === 'reviews') { assert.equal(output.length, 13); assert.deepEqual(output.filter((review) => review.id !== reviewId), old.output); assert.deepEqual(output.filter((review) => review.id === reviewId), [stored]); }
  else assert.deepEqual(output, old.output, old.key);
}
const proof = {
  format: 'replycheck-pending-account-reconciliation-v1', status: 'PASS_SCOPED_PENDING_ACCOUNT_RECOVERY',
  observed_at_utc: new Date().toISOString(),
  generator: { path: 'evidence/human-wallet/preflights/20260913-reconcile-fourth-identity-attempt.mjs', sha256: sha(await readFile(new URL(import.meta.url))) },
  before_evidence: pins.before, setup_evidence: pins.setup, pending_window_evidence: pins.window, final_receipt_evidence: pins.final,
  source_pins: setup.source_pins,
  expected: { ...expected, args: call.args, request_id: nonce, review_id: reviewId }, receipt, decoded_call: call, decoded_return_payload: returned, stored_review: stored,
  deployment_verification: { source_sha256: setup.source_pins['contracts/reply_check.py'], matched: true, verified_at_utc: sourceVerifiedAt }, observations,
  verified_checks: ['A/visitor and B-bound recovery bracket an independent COMMITTING receipt', 'The valid draft is disabled throughout both pending A observations', 'Pending and final receipts bind the identical export, sender, contract, zero-value call and fresh UUID', 'Final execution succeeds and the final-round leader payload equals the stored review', 'Stored classification, reason code and literal reference quote match the predeclared public fixture', 'Deployed source/protocol match all unchanged source pins', 'Exactly one review increases twelve to thirteen; all earlier full reviews and raw chain timestamps are preserved', 'Both reference bundles/cards, roles/invitations/ownership/settings remain unchanged'],
  timing: { pending_receipt_requested_at: window.capture.requested_at_utc, pending_receipt_observed_at: window.capture.observed_at_utc, final_receipt_requested_at: capture.requested_at_utc, final_receipt_observed_at: capture.observed_at_utc, receipt_created_at: receipt.created_at, stored_recorded_at: stored.recorded_at },
  actors: { agent_checked_app_consent: pendingProof.wallet_request_actor_record.agent_checked_app_consent, agent_clicked_continue_to_wallet: true, agent_approved_metamask: false, agent_signed_transaction: false, native_signature_click_independently_observed: false },
  constraints: { transaction_sent_by_this_script: false, resubmitted: false, application_source_changed: false, pending_network_switch_exercised: false, full_browser_or_release_pass_claimed: false },
  limitation: 'This proves recovery under A while B\'s exact transaction was pending and its final single-review outcome. It does not timestamp the native accountsChanged event or test pending network changes, concurrent sends, every browser, public CI or release readiness. Earlier inconclusive and cancelled attempts remain unchanged.',
};
console.log('REPLYCHECK_RECONCILIATION_RESULT\n' + JSON.stringify(proof, (_, value) => typeof value === 'bigint' ? value.toString() : value) + '\nREPLYCHECK_RECONCILIATION_END');
