/** Read-only reconciliation of a native hashless recovery. Never sends. */
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
  baseline: { path: 'evidence/human-wallet/20260913-native-missing-hash-baseline.json', sha256: '400b7f4e83597a44d991acd2f78288ed9a070aa58b64480dd7abdfede2f2603a' },
  negative: { path: 'evidence/human-wallet/20260913-native-missing-hash-negative-checks.json', sha256: 'b50bdc29796dadbac2fb811f1c4c8c4a4834cbbe09cf6b68cee88ba0b94b0103' },
  positive: { path: 'evidence/human-wallet/20260913-native-missing-hash-positive-attachment.json', sha256: 'be96e2956a653ac69092cbf90efe7a04cd1e06e6fa3e1f1abb29b73687397a69' },
  receipt: { path: 'evidence/human-wallet/20260913-native-missing-hash-final-receipt.json', sha256: '10fdd216b28c9905c58296d1ad9f9b15b66bc369097dc819bec5fdef5788f888' },
};
const records = {};
for (const [key, pin] of Object.entries(pins)) {
  const bytes = await local(pin.path);
  assert.equal(sha(bytes), pin.sha256, pin.path);
  records[key] = JSON.parse(bytes);
}
const { baseline, negative, positive, receipt: capture } = records;
for (const [path, hash] of Object.entries(baseline.source_pins)) assert.equal(sha(await local(path)), hash, path);
const { expected, receipt } = capture, intended = negative.intended;
assert.equal(expected.hash, '0xd066a1ac1d9f6192b69e81235751efd8b68a7d32ec9e17d16b1d137fffdb5c84');
assert.equal(intended.prohibited_resubmission_hashes.includes(expected.hash), false);
assert.equal(receiptState(receipt, expected).state, 'success');
assert.equal(await verifyReceiptCall(receipt, expected), true);
assert.ok(capture.exact_call_verified && capture.fixture_verified);
assert.equal(positive.user_supplied_hash, expected.hash);
assert.equal(positive.before.primary.visible.uncertain, true);
assert.equal(positive.attachment.wait_error, null);
assert.equal(positive.attachment.after.visible.hash, expected.hash);
assert.equal(positive.attachment.after.visible.uncertain, false);
assert.equal(positive.attachment.after.visible.valid_draft_denied, true);
assert.ok(positive.attachment.after.snapshot.includes('Hash verified. Checking execution and stored state.'));
assert.ok(negative.durable_before_reload.primary.visible.waiting_wallet);
assert.ok(negative.durable_before_reload.witness.visible.uncertain);
for (const test of [negative.missing_hash_case, negative.unrelated_hash_case]) {
  assert.equal(test.wait_error, null);
  assert.ok(test.after.primary.visible.uncertain);
  assert.ok(test.after.primary.visible.valid_draft_denied);
  assert.equal(test.after.primary.visible.hash, null);
  assert.equal(test.after.primary.visible.checking_hash, false);
}
assert.ok(negative.missing_hash_case.after.primary.snapshot.includes('Transaction not found on Studionet. Check the hash in wallet Activity and try the lookup again. Keep your recovery record; do not resend.'));
assert.ok(negative.unrelated_hash_case.after.primary.snapshot.includes('This hash could not be verified for the original action. Check wallet Activity and try again.'));
assert.equal(expected.startedAt, '2026-09-13T10:29:28.734Z');
assert.ok(Date.parse(expected.startedAt) >= Date.parse(negative.dispatch.snapshotRequestedAt));
assert.ok(Date.parse(expected.startedAt) <= Date.parse(negative.dispatch.snapshotCompletedAt));
const exportBytes = await readFile(capture.app_transaction_export.path);
assert.equal(sha(exportBytes), capture.app_transaction_export.sha256);
assert.deepEqual(JSON.parse(exportBytes), expected);
const plain = (value) => {
  if (value instanceof Map) return Object.fromEntries([...value].map(([k, v]) => [k, plain(v)]));
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'bigint') { assert.ok(Number.isSafeInteger(Number(value))); return Number(value); }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
};
const call = plain(abi.calldata.decode(Buffer.from(receipt.data.calldata, 'base64')));
assert.deepEqual(call, capture.decoded_call);
const nonce = call.args[4];
assert.equal(nonce, '27273873-7883-49fc-916d-44b7db1ab801');
assert.notEqual(nonce, baseline.expected.request_id);
assert.equal(call.method, intended.method);
assert.deepEqual(call.args, [intended.workspace, intended.version, intended.question, intended.draft, nonce, true]);
assert.equal(expected.account, intended.account);
assert.equal(expected.contract.toLowerCase(), intended.contract.toLowerCase());
assert.equal(expected.chainId, intended.chainId);
assert.equal(await digest([call.method, call.args]), expected.callDigest);
const reviewId = await digest([intended.workspace, intended.account, nonce]);
assert.equal(reviewId, expected.effect.fields.id);
const leaders = receipt.consensus_data.leader_receipt.filter((entry) => entry.mode === 'leader');
assert.equal(leaders.length, 1);
assert.equal(leaders[0].node_config.address.toLowerCase(), receipt.last_leader.toLowerCase());
const encoded = Buffer.from(typeof leaders[0].result === 'string' ? leaders[0].result : leaders[0].result.raw, 'base64');
assert.equal(encoded[0], 0);
const returned = plain(abi.calldata.decode(encoded.subarray(1)));
await verifyDeployment();
const sourceVerifiedAt = new Date().toISOString();
const stored = await verifyEffect(expected.effect);
assert.deepEqual(stored, returned);
for (const [key, value] of Object.entries({ id: reviewId, author: intended.account, workspace_id: intended.workspace, question: intended.question, draft: intended.draft, version: intended.version, request_digest: intended.request_digest, reference_digest: intended.reference_digest })) assert.equal(stored[key], value, key);
assert.equal(stored.assessment.verdict, intended.expected_verdict);
assert.equal(stored.assessment.question_status, intended.expected_question_status);
assert.deepEqual(stored.assessment.findings.map((finding) => finding.reason_code), intended.expected_reason_codes);
assert.deepEqual(stored.assessment.findings[0].citations, [{ quote: intended.draft, reference_id: 'faq' }]);
assert.equal(intended.expected_review_count_before, 15);
assert.equal(intended.expected_review_count_after, 16);
assert.equal(baseline.observations.length, 10);
const observations = [];
for (const old of baseline.observations) {
  await new Promise(resolve => setTimeout(resolve, 1200));
  const requested = new Date().toISOString();
  const output = await read(old.method, old.args);
  observations.push({ key: old.key, method: old.method, args: old.args, requested_at_utc: requested, observed_at_utc: new Date().toISOString(), output });
  if (old.key === 'workspace') assert.deepEqual(output, { ...old.output, review_count: 16 });
  else if (old.key === 'reviews') {
    assert.equal(old.output.length, 15); assert.equal(output.length, 16);
    assert.deepEqual(output.filter((review) => review.id !== reviewId), old.output);
    assert.deepEqual(output.filter((review) => review.id === reviewId), [stored]);
  } else assert.deepEqual(output, old.output, old.key);
}
const proof = {
  format: 'replycheck-native-hash-reconciliation-v1', status: 'PASS_SCOPED_NATIVE_NEGATIVE_AND_POSITIVE_HASH_RECOVERY', recorded_at_utc: new Date().toISOString(),
  generator: { path: 'evidence/human-wallet/preflights/20260913-reconcile-native-hash-recovery.mjs', sha256: sha(await readFile(new URL(import.meta.url))) },
  evidence_pins: pins, source_pins: baseline.source_pins,
  expected: { ...expected, args: call.args, request_id: nonce, review_id: reviewId }, receipt, decoded_call: call, decoded_return_payload: returned, stored_review: stored,
  exact_recovered_export: { sha256: sha(exportBytes), record: expected, raw_json_utf8: exportBytes.toString('utf8') },
  deployment_verification: { matched: true, source_sha256: baseline.source_pins['contracts/reply_check.py'], verified_at_utc: sourceVerifiedAt }, observations,
  verified_checks: ['Original request survived app reload as hashless recovery', 'Actual missing-hash lookup displayed the specific safe message and kept recovery active', 'An unrelated completed transaction was rejected without attaching its hash', 'The human-supplied correct hash attached through the actual recovery form', 'Exact call, sender, contract, zero value, successful final execution, returned payload and stored review agree', 'Exactly one review increased fifteen to sixteen; all earlier complete state and timestamps remained unchanged', 'The deployed source and 39 recorded source/evidence pins match'],
  timing: { final_receipt_requested_at: capture.requested_at_utc, final_receipt_observed_at: capture.observed_at_utc, stored_recorded_at: stored.recorded_at, request_ui_started_at: expected.startedAt },
  limitations: { raw_hashless_journal_byte_comparison: 'NOT_AVAILABLE_NO_EXPORT_UI', legacy_persisted_wrong_hash_replacement: 'NOT_EXERCISED', native_wallet_click_independently_observed: false, broad_live_matrix: 'NOT_COMPLETE', public_ci: 'NOT_RUN' },
  constraints: { transaction_sent_by_this_script: false, resubmitted: false, application_source_changed: false, agent_approved_wallet: false, whole_release_pass_claimed: false },
};
console.log('REPLYCHECK_RECONCILIATION_RESULT\n' + JSON.stringify(proof, (_, value) => typeof value === 'bigint' ? value.toString() : value) + '\nREPLYCHECK_RECONCILIATION_END');
