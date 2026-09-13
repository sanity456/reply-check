/** Offline saved-observation/hash consistency; no browser, RPC or wallet calls. */
import assert from 'node:assert/strict';
import { createEvidenceReader } from '../../read-evidence.mjs';
import { createHash } from 'node:crypto';

const root = new URL('../../../', import.meta.url);
const read = createEvidenceReader(root);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytes = await read('evidence/human-wallet/20260913-checked-consent-network-switch.json');
assert.equal(sha(bytes), '4f8f5e0727ac69f90d4f920029ee30b4915b15bfe65ae4a19e9ed1ce9d62c232');
const proof = JSON.parse(bytes);
assert.equal(proof.status, 'PASS_SCOPED_CHECKED_CONSENT_NETWORK_GATE');
for (const [path, expected] of Object.entries({...proof.source_pins, ...proof.baseline_pins}))
  assert.equal(sha(await read(path)), expected, path);
const prior = JSON.parse(await read('evidence/human-wallet/20260913-checked-consent-owner-return.json'));
const staged = prior.observations.find((r) => r.label === 'network_test_staged_with_checked_consent').snapshot;
assert.ok(staged.includes('definition: 0x7cef5d…8d97d0'));
assert.ok(staged.includes('dialog "Publish approved answer card"'));
assert.ok(staged.includes('checkbox "I checked the content and agree to publish it." [checked]'));
assert.ok(staged.includes('button "Continue to wallet"'));
assert.ok(!staged.includes('button "Continue to wallet" [disabled]'));
assert.equal(proof.observations.length, 5);
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
for (const {snapshot: value} of proof.observations) {
  assert.ok(value.includes('button "Switch to Studionet"'));
  assert.ok(value.includes('· owner · reference v2'));
  for (const marker of ['- dialog ', 'button "Approve answer card"', 'Continue to wallet', 'Waiting for wallet', 'WALLET OUTCOME UNKNOWN', 'region "Transaction recovery"'])
    assert.ok(!value.includes(marker), marker);
}
const valid = snapshot('off_network_valid_draft_denied');
assert.ok(valid.includes('text: How long do I have to request a refund?'));
assert.ok(valid.includes('text: Refund requests must be submitted within 14 days of purchase.'));
assert.ok(valid.includes('39 / 1,500 bytes'));
assert.ok(valid.includes('61 / 3,000 bytes'));
assert.ok(valid.includes('button "Review draft" [disabled]'));
assert.ok(valid.includes(proof.output_payload.ui_reason));
const history = (value) => value.split('\n').filter((line) => line.trimStart().startsWith('- button "How long do I have to request a refund?'));
const oldHistory = prior.observations.find((r) => r.label === 'after_human_return_to_owner_b').snapshot;
for (const label of ['after_human_reported_network_switch', 'off_network_closing_history']) {
  const value = snapshot(label);
  assert.equal(history(value).length, 10);
  assert.deepEqual(history(value), history(oldHistory));
  assert.ok(value.includes(proof.inputs.review_id));
  assert.ok(value.includes('heading "Matches the references"'));
  assert.ok(value.includes(proof.output_payload.displayed_review_timestamp));
}
for (const label of ['off_network_empty_draft', 'off_network_test_draft_cleared']) {
  const value = snapshot(label);
  assert.ok(value.includes('0 / 1,500 bytes'));
  assert.ok(value.includes('0 / 3,000 bytes'));
}
for (const [key, value] of Object.entries(proof.constraints))
  assert.ok(value === false || value === 0, key);
assert.equal(proof.output_payload.transaction_hash, null);
assert.equal(proof.output_payload.contract_return_payload, null);
assert.deepEqual(proof.output_payload.expected_contract_reason_codes, []);
assert.equal(proof.network_observation.exact_alternative_network_independently_observed, false);
assert.equal(proof.network_observation.exact_alternative_chain_id, null);
assert.equal(proof.next_step.status, 'AWAITING_HUMAN_RETURN_TO_STUDIONET');
assert.equal(proof.next_step.transaction_or_signature_required, false);
assert.equal(proof.limitations.length, 4);
console.log(JSON.stringify({saved_evidence_consistency:'PASS',source_pins:Object.keys(proof.source_pins).length,scoped_checks:4,observations:5,exact_alternative_network_verified:false,return_to_studionet:'NOT_COMPLETED',note:'Offline replay only; no new browser, wallet or chain execution.'},null,2));
