/** Read-only final reconciliation; no wallet requests or transaction submission. */
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
  setup: { path: 'evidence/human-wallet/20260913-two-tab-hash-recovery-setup.json', sha256: 'ddac195719b896cbd266c0293a688d31e9ed9575e75b7b7f16199c9babbf51fe' },
  held: { path: 'evidence/human-wallet/20260913-two-tab-held-request-guards.json', sha256: '56f768e62c748fbf50b7cb1c2c1df77d3b8d4b2af38053eb65a4810429d18690' },
  negative: { path: 'evidence/human-wallet/20260913-two-tab-negative-hash-checks.json', sha256: '749532d44c084d0bf97f6f8bffee9f673904f2a255072b48bb2ac09df3a036d8' },
  final: { path: 'evidence/human-wallet/20260913-two-tab-final-receipt.json', sha256: 'd9691ae3b5c0fa4d8e17662968fd44b6fdd584b26a6ff47171072e80fb119c6c' },
};
const records = {};
for (const [key, pin] of Object.entries(pins)) { const bytes = await local(pin.path); assert.equal(sha(bytes), pin.sha256, pin.path); records[key] = JSON.parse(bytes); }
const { setup, held, negative, final: capture } = records;
for (const [path, hash] of Object.entries(setup.source_pins)) assert.equal(sha(await local(path)), hash, path);
assert.equal(Object.keys(setup.source_pins).length, 33);
const before = setup.baseline, intended = setup.intended, { expected, receipt } = capture;
assert.equal(expected.hash, '0xf311de10a7afbf3ba0dc72d9736abfb007cc6ca91dd9d420c6e8b02ae144c3a7');
assert.equal(intended.prohibited_resubmission_hashes.includes(expected.hash), false);
assert.equal(receiptState(receipt, expected).state, 'success');
assert.equal(await verifyReceiptCall(receipt, expected), true);
assert.equal(capture.fixture_verified, true);
assert.equal(capture.exact_call_verified, true);
assert.equal(held.dispatch.dispatch.length, 2);
assert.ok(held.dispatch.dispatch.every((attempt) => attempt.result === 'CLICK_COMPLETED'));
assert.ok(held.dispatch.secondary.snapshot.includes('Another tab is using the wallet. Finish that action first.'));
assert.ok(held.held.primary.visible.waiting_wallet);
assert.ok(held.held.secondary.visible.valid_draft_denied);
assert.ok(held.recovery_checks.invalid.snapshot.includes('Enter the complete transaction hash from wallet Activity.'));
assert.ok(held.settled.secondary.snapshot.includes('Another tab is using this recovery record. Finish that check first.'));
assert.equal(held.settled.secondary.visible.hash, null);
assert.equal(held.settled.secondary.visible.uncertain, true);
assert.equal(negative.hash, expected.hash);
assert.equal(negative.unrelated.status, 'REJECTED_ORIGINAL_HASH_RETAINED');
for (const o of negative.unrelated.observations) {
  const recovery = o.snapshot.split('  - region "Transaction recovery":')[1]?.split('  - tablist')[0];
  assert.ok(recovery?.includes('- paragraph: "' + expected.hash + '"'));
  assert.equal(o.visible.hash, expected.hash);
}
assert.ok(negative.unrelated.observations.at(-1).snapshot.includes('This hash could not be verified for the original action. Check wallet Activity and try again.'));
assert.equal(negative.missing_case_disposition.status, 'NOT_PROVEN_MISSING_RECEIPT');
assert.ok(negative.missing_attempt.observations.at(-1).snapshot.includes('The request could not be verified. Check your connection; keep any transaction hash before retrying.'));
assert.equal(negative.missing_attempt.observations.at(-1).visible.hash, expected.hash);
assert.ok(negative.independent_receipt_fetch_interruption.output.includes('EAI_AGAIN'));

// Parse raw exported JSON directly: PowerShell's earlier diagnostic projection
// normalized a local startedAt date string. The two raw files never changed.
const downloadBase = 'C:/Users/user/Downloads/replycheck-transaction-' + expected.hash;
assert.equal(negative.exports.before_path, downloadBase + '.json');
assert.equal(negative.exports.after_path, downloadBase + ' (1).json');
const exportBefore = await readFile(negative.exports.before_path), exportAfter = await readFile(negative.exports.after_path);
assert.equal(sha(exportBefore), negative.exports.before_sha256);
assert.equal(sha(exportAfter), negative.exports.after_sha256);
assert.deepEqual(exportBefore, exportAfter);
const exactExport = JSON.parse(exportBefore);
assert.deepEqual(exactExport, expected);
const plain = (value) => {
  if (value instanceof Map) return Object.fromEntries([...value].map(([key, item]) => [key, plain(item)]));
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'bigint') { assert.ok(Number.isSafeInteger(Number(value))); return Number(value); }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
};
const call = plain(abi.calldata.decode(Buffer.from(receipt.data.calldata, 'base64')));
assert.deepEqual(call, capture.decoded_call);
const nonce = call.args[4];
assert.equal(call.method, intended.method);
assert.deepEqual(call.args, [intended.workspace, intended.version, intended.question, intended.draft, nonce, true]);
assert.equal(nonce, 'baf5c17d-16fd-4e71-99c9-9431a9b9158e');
assert.notEqual(nonce, before.expected.request_id);
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
assert.equal(intended.expected_review_count_before, 14);
assert.equal(intended.expected_review_count_after, 15);
assert.equal(before.observations.length, 10);
const observations = [];
for (const old of before.observations) {
  const requested = new Date().toISOString();
  const output = await read(old.method, old.args);
  observations.push({ key: old.key, method: old.method, args: old.args, requested_at_utc: requested, observed_at_utc: new Date().toISOString(), output });
  if (old.key === 'workspace') assert.deepEqual(output, { ...old.output, review_count: 15 });
  else if (old.key === 'reviews') { assert.equal(old.output.length, 14); assert.equal(output.length, 15); assert.deepEqual(output.filter((review) => review.id !== reviewId), old.output); assert.deepEqual(output.filter((review) => review.id === reviewId), [stored]); }
  else assert.deepEqual(output, old.output, old.key);
}
const proof = {
  format: 'replycheck-two-tab-hash-reconciliation-v1', status: 'PASS_SCOPED_TWO_TAB_GUARDS_AND_UNRELATED_HASH_REJECTION', recorded_at_utc: new Date().toISOString(),
  generator: { path: 'evidence/human-wallet/preflights/20260913-reconcile-two-tab-hash-checks.mjs', sha256: sha(await readFile(new URL(import.meta.url))) },
  evidence_pins: pins, source_pins: setup.source_pins,
  expected: { ...expected, args: call.args, request_id: nonce, review_id: reviewId }, receipt, decoded_call: call, decoded_return_payload: returned, stored_review: stored,
  exact_recovery_exports: { before_sha256: sha(exportBefore), after_sha256: sha(exportAfter), byte_identical: true, record: exactExport, raw_json_utf8: exportBefore.toString('utf8'), note: 'This exact JSON parse supersedes only the date-normalized PowerShell diagnostic projection in the earlier negative-case record; both raw export hashes and all original evidence files are unchanged.' },
  deployment_verification: { matched: true, source_sha256: setup.source_pins['contracts/reply_check.py'], verified_at_utc: sourceVerifiedAt }, observations,
  verified_checks: ['The competing prepared tab hit the origin wallet lock while the primary held the request', 'Malformed hash input and competing recovery changes were denied without clearing the shared intent', 'A real unrelated receipt hash was rejected after approval while the original recovery hash remained', 'A connection-verification failure retained the original recovery record', 'Before/after recovery exports are byte-identical and bind the final receipt', 'Exact final execution/calldata and the final-round returned payload match the complete stored review', 'Only one review increases fourteen to fifteen; every earlier review/timestamp, reference bundle, card and permission is preserved', 'All 33 current source/tooling pins and deployed contract source match'],
  timing: { final_receipt_requested_at: capture.requested_at_utc, final_receipt_observed_at: capture.observed_at_utc, stored_recorded_at: stored.recorded_at, request_ui_started_at: expected.startedAt },
  limitations: { missing_receipt_response: 'NOT_PROVEN_RPC_CONNECTION_FAILED', legacy_persisted_wrong_hash_correction: 'NOT_EXERCISED', correct_replacement_submission: 'NOT_EXERCISED', native_wallet_prompt_count: 'NOT_INDEPENDENTLY_OBSERVED', broad_live_concurrency_matrix: 'NOT_COMPLETE', public_ci: 'NOT_RUN' },
  actors: { agent_clicked_local_fixture_consent: true, agent_clicked_two_prepared_continue_buttons: true, agent_approved_metamask: false, agent_signed: false, agent_cleared_unknown_journal: false },
  constraints: { transaction_sent_by_this_script: false, resubmitted: false, application_source_changed: false, whole_release_pass_claimed: false },
};
console.log('REPLYCHECK_RECONCILIATION_RESULT\n' + JSON.stringify(proof, (_, value) => typeof value === 'bigint' ? value.toString() : value) + '\nREPLYCHECK_RECONCILIATION_END');
