/** Saved UI observation/hash consistency only. No browser, RPC or wallet calls. */
import assert from 'node:assert/strict';
import { createEvidenceReader } from '../../read-evidence.mjs';
import { createHash } from 'node:crypto';

const root = new URL('../../../', import.meta.url);
const read = createEvidenceReader(root);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytes = await read('evidence/human-wallet/20260913-checked-consent-owner-return.json');
assert.equal(sha(bytes), 'b8599024bd44984509469471cfe9ede548a05b1b5e249a9c422fe808f0982b80');
const proof = JSON.parse(bytes);
assert.equal(proof.status, 'PASS_SCOPED_OWNER_RETURN');
for (const [path, expected] of Object.entries({...proof.source_pins, ...proof.baseline_pins}))
  assert.equal(sha(await read(path)), expected, path);
assert.equal(proof.observations.length, 3);
assert.equal(proof.checks.length, 3);
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
const returned = snapshot('after_human_return_to_owner_b');
assert.ok(returned.includes('button "0x7cef5d…8d97d0"'));
assert.ok(returned.includes('· owner · reference v2'));
assert.ok(returned.includes('button "Approve answer card"'));
for (const marker of ['- dialog ', 'WALLET OUTCOME UNKNOWN', 'Waiting for wallet', 'region "Transaction recovery"'])
  assert.ok(!returned.includes(marker), marker);
const history = (value) => value.split('\n').filter((line) => line.trimStart().startsWith('- button "How long do I have to request a refund?'));
const prior = JSON.parse(await read('evidence/human-wallet/20260913-checked-consent-account-switch.json'));
assert.equal(history(returned).length, 10);
assert.deepEqual(history(returned), history(prior.observations.find((r) => r.label === 'closing_history_as_visitor').snapshot));
for (const [label, checked] of [['fresh_confirmation_consent_reset', false], ['network_test_staged_with_checked_consent', true]]) {
  const value = snapshot(label);
  assert.ok(value.includes('dialog "Publish approved answer card"'));
  assert.ok(value.includes('definition: 0x7cef5d…8d97d0'));
  assert.ok(value.includes(proof.inputs.review_id));
  assert.equal(value.includes('checkbox "I checked the content and agree to publish it." [checked]'), checked);
  assert.equal(value.includes('button "Continue to wallet" [disabled]'), !checked);
}
for (const [key, value] of Object.entries(proof.constraints))
  assert.ok(value === false || value === 0, key);
assert.equal(proof.next_test.status, 'AWAITING_HUMAN_NETWORK_SWITCH');
assert.equal(proof.next_test.network_change_observed, false);
assert.equal(proof.next_test.transaction_or_signature_required, false);
assert.equal(proof.limitations.length, 3);
console.log(JSON.stringify({saved_evidence_consistency:'PASS',source_pins:Object.keys(proof.source_pins).length,scoped_checks:3,observations:3,next_test:'NOT_COMPLETED',note:'Offline replay only; does not rerun the browser, wallet or chain.'},null,2));
