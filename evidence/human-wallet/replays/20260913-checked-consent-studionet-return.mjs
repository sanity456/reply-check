/** Offline saved-observation/hash consistency; no browser, RPC or wallet calls. */
import assert from 'node:assert/strict';
import { createEvidenceReader } from '../../read-evidence.mjs';
import { createHash } from 'node:crypto';

const root = new URL('../../../', import.meta.url);
const read = createEvidenceReader(root);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytes = await read('evidence/human-wallet/20260913-checked-consent-studionet-return.json');
assert.equal(sha(bytes), 'c1576a982af6104aa3a43b16175f3df079ac297ecd7056ee35a3cdd094625dc4');
const proof = JSON.parse(bytes);
assert.equal(proof.status, 'PASS_SCOPED_STUDIONET_RETURN');
for (const [path, expected] of Object.entries({...proof.source_pins, ...proof.baseline_pins}))
  assert.equal(sha(await read(path)), expected, path);
const prior = JSON.parse(await read('evidence/human-wallet/20260913-checked-consent-network-switch.json'));
const offNetwork = prior.observations.find((r) => r.label === 'off_network_closing_history').snapshot;
assert.ok(offNetwork.includes('button "Switch to Studionet"'));
assert.equal(proof.observations.length, 7);
assert.equal(proof.checks.length, 4);
const snapshot = (label) => {
  const found = proof.observations.filter((r) => r.label === label);
  assert.equal(found.length, 1, label);
  assert.ok(Number.isFinite(Date.parse(found[0].observedAt)));
  return found[0].snapshot;
};
for (const check of proof.checks) {
  assert.equal(check.status, 'PASS');
  for (const label of check.evidence) snapshot(label);
}
const history = (value) => value.split('\n').filter((line) => line.trimStart().startsWith('- button "How long do I have to request a refund?'));
for (const label of ['after_human_return_to_studionet', 'settled_history_no_staged_operation']) {
  const value = snapshot(label);
  assert.ok(value.includes('button "0x7cef5d…8d97d0"'));
  assert.ok(value.includes('· owner · reference v2'));
  assert.ok(value.includes('button "Approve answer card"'));
  assert.ok(!value.includes('button "Approve answer card" [disabled]'));
  for (const marker of ['- dialog', 'Switch to Studionet', 'Continue to wallet', 'Waiting for wallet', 'WALLET OUTCOME UNKNOWN', 'region "Transaction recovery"'])
    assert.ok(!value.includes(marker), marker);
  assert.equal(history(value).length, 10);
  assert.deepEqual(history(value), history(offNetwork));
  assert.ok(value.includes(proof.inputs.review_id));
  assert.ok(value.includes('heading "Matches the references"'));
  assert.ok(value.includes(proof.output_payload.displayed_review_timestamp));
}
for (const label of ['restored_empty_draft', 'restored_test_draft_cleared']) {
  const value = snapshot(label);
  assert.ok(value.includes('0 / 1,500 bytes'));
  assert.ok(value.includes('0 / 3,000 bytes'));
  assert.ok(value.includes('button "Review draft" [disabled]'));
  assert.ok(value.includes('Add a question of up to 1,500 UTF-8 bytes.'));
}
const valid = snapshot('restored_valid_draft_enabled');
assert.ok(valid.includes('text: How long do I have to request a refund?'));
assert.ok(valid.includes('text: Refund requests must be submitted within 14 days of purchase.'));
assert.ok(valid.includes('button "Review draft"'));
assert.ok(!valid.includes('button "Review draft" [disabled]'));
assert.ok(valid.includes('Confirm the public submission before signing.'));
const fresh = snapshot('fresh_confirmation_after_network_return_unchecked');
assert.ok(fresh.includes('dialog "Publish approved answer card"'));
assert.ok(fresh.includes('definition: 0x7cef5d…8d97d0'));
assert.ok(fresh.includes(proof.inputs.review_id));
assert.ok(fresh.includes('checkbox "I checked the content and agree to publish it."'));
assert.ok(!fresh.includes('checkbox "I checked the content and agree to publish it." [checked]'));
assert.ok(fresh.includes('button "Continue to wallet" [disabled]'));
assert.ok(snapshot('after_cancel_transient_dialog_shell').includes('- dialog:'));
for (const [key, value] of Object.entries(proof.constraints))
  assert.ok(value === false || value === 0, key);
assert.deepEqual(proof.cleanup, {temporary_test_inputs_cleared:true,fresh_unsigned_dialog_cancelled:true,waited_for_dialog_detachment:true,history_restored:true,staged_operation_remaining:false});
assert.equal(proof.output_payload.transaction_hash, null);
assert.equal(proof.output_payload.contract_return_payload, null);
assert.deepEqual(proof.output_payload.expected_contract_reason_codes, []);
assert.equal(proof.limitations.length, 3);
console.log(JSON.stringify({saved_evidence_consistency:'PASS',source_pins:Object.keys(proof.source_pins).length,scoped_checks:4,observations:7,staged_operation:false,note:'Offline replay only; no new browser, wallet or chain execution.'},null,2));
