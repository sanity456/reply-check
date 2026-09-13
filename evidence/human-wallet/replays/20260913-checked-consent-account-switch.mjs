/** Offline saved-observation consistency only; no RPC, browser or wallet calls. */
import assert from 'node:assert/strict';
import { createEvidenceReader } from '../../read-evidence.mjs';
import { createHash } from 'node:crypto';

const root = new URL('../../../', import.meta.url);
const read = createEvidenceReader(root);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytes = await read('evidence/human-wallet/20260913-checked-consent-account-switch.json');
assert.equal(sha(bytes), '6b7e87cf0ee9fd56a687089d1b853a8b839018fbb7c2e88f2fc72072fbf787bb');
const proof = JSON.parse(bytes);
assert.equal(proof.status, 'PASS_SCOPED_CHECKED_CONSENT_ACCOUNT_SWITCH');
for (const [path, expected] of Object.entries(proof.source_pins))
  assert.equal(sha(await read(path)), expected, path);
for (const [path, expected] of Object.entries(proof.baseline_pins))
  assert.equal(sha(await read(path)), expected, path);

assert.equal(proof.observations.length, 12);
assert.equal(proof.checks.length, 8);
const snapshot = (label) => {
  const found = proof.observations.filter((r) => r.label === label);
  assert.equal(found.length, 1, label);
  assert.ok(Number.isFinite(Date.parse(found[0].observedAt)), label);
  return found[0].snapshot;
};
for (const check of proof.checks) {
  assert.equal(check.status, 'PASS');
  for (const label of check.evidence) snapshot(label);
}
const b = '0x7cef5d…8d97d0';
const a = '0x29b8b7…509360';
const reviewId = '7cff937e5e8619921e427c4505d23151bd6d77de73b7257ee7bdea333dd596de';
const noOperation = (value) => {
  for (const marker of ['- dialog ', 'Continue to wallet', 'Waiting for wallet', 'WALLET OUTCOME UNKNOWN', 'region "Transaction recovery"'])
    assert.ok(!value.includes(marker), marker);
};
const before = snapshot('before_staging');
assert.ok(before.includes(`button "${b}"`));
assert.ok(before.includes('· owner · reference v2'));
assert.ok(before.includes('button "Approve answer card"'));
const unchecked = snapshot('confirmation_unchecked');
assert.ok(unchecked.includes('dialog "Publish approved answer card"'));
assert.ok(unchecked.includes(`definition: ${b}`));
assert.ok(unchecked.includes('button "Continue to wallet" [disabled]'));
assert.ok(!unchecked.includes('checkbox "I checked the content and agree to publish it." [checked]'));
for (const label of ['consent_checked_awaiting_human_account_switch', 'after_human_reported_account_switch', 'account_switch_not_yet_observed']) {
  const value = snapshot(label);
  assert.ok(value.includes(`definition: ${b}`));
  assert.ok(value.includes('dialog "Publish approved answer card"'));
  assert.ok(value.includes('checkbox "I checked the content and agree to publish it." [checked]'));
  assert.ok(value.includes('button "Continue to wallet"'));
  assert.ok(!value.includes('button "Continue to wallet" [disabled]'));
}
for (const label of ['after_second_human_reported_account_switch', 'closing_history_as_visitor']) {
  const value = snapshot(label);
  assert.ok(value.includes(`button "${a}"`));
  assert.ok(value.includes('· visitor · reference v2'));
  assert.ok(!value.includes('button "Approve answer card"'));
  assert.ok(value.includes(reviewId));
  assert.ok(value.includes('heading "Matches the references"'));
  assert.ok(value.includes('2026-09-12 15:03:29 UTC'));
  noOperation(value);
}
const history = (value) => value.split('\n').filter((line) => line.trimStart().startsWith('- button "How long do I have to request a refund?'));
assert.equal(history(before).length, 10);
assert.deepEqual(history(snapshot('closing_history_as_visitor')), history(before));
const draft = snapshot('visitor_valid_draft_still_denied');
assert.ok(draft.includes('text: How long do I have to request a refund?'));
assert.ok(draft.includes('text: Refund requests must be submitted within 14 days of purchase.'));
assert.ok(draft.includes('button "Review draft" [disabled]'));
assert.ok(draft.includes(proof.output_payload.visitor_ui_reason));
noOperation(draft);
const team = snapshot('visitor_team_after_checked_consent_switch');
assert.ok(team.includes('status: You are a visitor. Read public references and reviews.'));
assert.ok(team.includes('0x7cef5dbbd598ba74ef9c665c9853e573448d97d0'));
for (const label of ['Invite', 'Accept invitation', 'Transfer ownership', 'Archive workspace', 'Restore workspace'])
  assert.ok(!team.includes(`button "${label}`));
const references = snapshot('visitor_references_read_only');
assert.ok(references.includes('generic: Version 2'));
assert.ok(references.includes('Refund requests must be submitted within 14 days of purchase.'));
assert.ok(!references.includes('button "Edit references"'));
const cards = snapshot('visitor_cards_no_retirement');
assert.ok(cards.includes('Answer cards · 2'));
assert.ok(cards.includes('heading "Refund request window (v2)"'));
assert.ok(cards.includes('generic: approved'));
assert.ok(cards.includes('generic: retired'));
assert.ok(!cards.includes('button "Retire'));
const cleared = snapshot('temporary_draft_cleared');
assert.ok(cleared.includes('0 / 1,500 bytes'));
assert.ok(cleared.includes('0 / 3,000 bytes'));
noOperation(cleared);
for (const [key, value] of Object.entries(proof.constraints))
  assert.ok(value === false || value === 0, key);
assert.equal(proof.output_payload.transaction_hash, null);
assert.equal(proof.output_payload.contract_return_payload, null);
assert.deepEqual(proof.output_payload.expected_contract_reason_codes, []);
assert.equal(proof.limitations.length, 4);
assert.ok(proof.limitations.some((s) => s.includes('No fresh deployed-source RPC')));
assert.ok(proof.limitations.some((s) => s.includes('Return-to-B consent reset')));
console.log(JSON.stringify({
  saved_evidence_consistency: 'PASS',
  current_source_pins: Object.keys(proof.source_pins).length,
  preserved_baselines: Object.keys(proof.baseline_pins).length,
  scoped_browser_checks: proof.checks.length,
  observations: proof.observations.length,
  wallet_or_chain_action: false,
  note: 'Offline replay of recorded UI observations; does not rerun Chrome, a wallet or chain verification.',
}, null, 2));
