/** Offline evidence consistency only: no browser, network or wallet requests. */
import assert from 'node:assert/strict';
import { createEvidenceReader } from '../read-evidence.mjs';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = new URL('../../', import.meta.url);
const read = createEvidenceReader(root);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytes = await read('evidence/browser/20260912-reliability-accessibility.json');
assert.equal(sha(bytes), '7a2c61285b3de570544a0c796a3a0dbb658a8a9e20e703ed4b2b80b1a3a5b0e3');
const proof = JSON.parse(bytes);
assert.equal(proof.status, 'PASS_SCOPED_LOCAL_RELIABILITY_ACCESSIBILITY');
for (const [path, expected] of Object.entries(proof.source_pins))
  assert.equal(sha(await read(path)), expected, path);
for (const [path, expected] of Object.entries(proof.baseline_pins))
  assert.equal(sha(await read(path)), expected, path);
const oldHook = await read('evidence/source-snapshots/20260912-pre-reliability/hooks/use-reply-chain.ts.snapshot');
assert.equal(sha(oldHook), 'db4601aa0c32d48e147e4d287e9882c6a9a8d8a5fddcbad3e5e312bf6a7883b9');
assert.equal(sha(await read('evidence/source-snapshots/20260912-pre-reliability/app/reply.css.snapshot')), 'f1b5e306217866749e1198a66d09ac896369f99f9a731ff7dc56d3ce682f80a0');
const parse = (bytes) => ts.createSourceFile('hook.ts', bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
const before = parse(oldHook), after = parse(await read('hooks/use-reply-chain.ts'));
const initializer = (tree, name) => {
  let value;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name)
      value = node.initializer.getText(tree);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(value, name);
  return value;
};
for (const name of ['send', 'check', 'persist', 'connect', 'attachHash', 'confirmNotSent', 'dismiss'])
  assert.equal(initializer(after, name), initializer(before, name), name);

assert.equal(proof.regression_sequence.before_fix.tests, 20);
assert.equal(proof.regression_sequence.before_fix.failed, 2);
assert.equal(proof.regression_sequence.after_fix.passed, 20);
assert.equal(proof.regression_sequence.after_fix.failed, 0);
assert.equal(proof.automated.frontend_tests, 140);
assert.equal(proof.automated.contract_tooling_tests, 97);
assert.equal(proof.automated.total_tests, 237);
assert.ok(proof.automated.commands.every((r) => r.exit_code === 0));
assert.equal(proof.browser_checks.length, 12);
assert.equal(proof.observations.length, 16);
assert.ok(proof.browser_checks.every((check) => check.status === 'PASS'));
const record = (label) => {
  const found = proof.observations.find((r) => r.label === label);
  assert.ok(found, label);
  return found;
};
for (const check of proof.browser_checks)
  for (const label of check.evidence) record(label);
const mobile = ['mobile_check', 'mobile_library', 'mobile_history', 'mobile_reply_gym', 'mobile_team'];
const headings = ['Check a reply', 'Knowledge library', 'Review history', 'Reply Gym', 'Your team'];
for (const [index, label] of mobile.entries()) {
  const { dom } = record(label);
  assert.equal(dom.viewport.width, 320);
  assert.ok(dom.documentWidth <= 320);
  assert.deepEqual(dom.unlabeledControls, []);
  assert.equal(dom.heading, headings[index]);
  if (index) {
    assert.ok(dom.focus.rect.top >= 0 && dom.focus.rect.bottom <= 640);
    assert.match(dom.focus.outline, /solid/);
  }
}
for (const [label, checked] of [
  ['unsigned_confirmation_initial', false],
  ['unsigned_keyboard_consent_checked', true],
  ['unsigned_reopened_consent_reset', false],
]) {
  const { dom } = record(label);
  assert.equal(dom.dialogs.length, 1);
  const dialog = dom.dialogs[0];
  assert.equal(dialog.title, 'Publish approved answer card');
  assert.ok(dialog.rect.top >= 0 && dialog.rect.bottom <= dom.viewport.height);
  assert.equal(dialog.checks[0].name, 'I checked the content and agree to publish it.');
  assert.equal(dialog.checks[0].checked, String(checked));
  assert.equal(dialog.buttons.find((b) => b.name === 'Continue to wallet').disabled, !checked);
}
const cancel = record('unsigned_keyboard_cancel_visible').dom;
assert.equal(cancel.focus.name, 'Cancel');
assert.ok(cancel.focus.rect.top >= 0 && cancel.focus.rect.bottom <= cancel.viewport.height);
assert.match(cancel.focus.outline, /solid/);
assert.deepEqual(record('unsigned_cancelled').dom.dialogs, []);
assert.ok(!record('unsigned_cancelled').snapshot.includes('WALLET OUTCOME UNKNOWN'));
const error = record('lookup_error_announced').dom;
assert.deepEqual(error.alerts, ['Could not load this review. Check the ID and your connection, then try again.']);
assert.ok(error.liveRegions.some((region) => region.role === 'alert'));
const retry = record('lookup_retry_announcement');
assert.deepEqual(retry.dom.alerts, []);
// output has an implicit status role, so use the preserved accessibility
// snapshot instead of requiring an explicit [role=status] attribute.
assert.ok(retry.snapshot.includes('status: Loading review…'));
const closing = record('final_clean_state');
assert.equal(closing.dom.reviewCount, 10);
assert.deepEqual(closing.dom.dialogs, []);
assert.deepEqual(closing.dom.alerts, []);
for (const id of ['question', 'reply'])
  assert.equal(closing.dom.fields.find((field) => field.id === id).value, '');
assert.equal(closing.dom.fields.find((field) => field.id === 'review-lookup').value, '7cff937e5e8619921e427c4505d23151bd6d77de73b7257ee7bdea333dd596de');
assert.ok(closing.snapshot.includes('heading "Matches the references"'));
assert.ok(closing.snapshot.includes('2026-09-12 15:03:29 UTC'));
assert.ok(!closing.snapshot.includes('WALLET OUTCOME UNKNOWN'));
assert.ok(!closing.snapshot.includes('region "Transaction recovery"'));
assert.deepEqual(closing.dom.viewport, record('rebuilt_baseline').dom.viewport);
assert.deepEqual(record('zoom_not_observed').dom.viewport, record('rebuilt_baseline').dom.viewport);
for (const key of ['signed_out', 'native_zoom_change_observed', 'reduced_motion_emulation', 'forced_colors_emulation', 'live_screen_reader'])
  assert.equal(proof.environment[key], false, key);
assert.equal(proof.environment.viewport_reset, true);
assert.equal(proof.constraints.real_wallet_requests, 0);
assert.equal(proof.constraints.contract_transactions, 0);
for (const [key, value] of Object.entries(proof.constraints))
  if (!['real_wallet_requests', 'contract_transactions'].includes(key)) assert.equal(value, false, key);
assert.equal(proof.ci_preparation.public_run, false);
assert.equal(proof.ci_preparation.pushed, false);
console.log(JSON.stringify({
  evidence_consistency: 'PASS',
  current_source_pins: Object.keys(proof.source_pins).length,
  preserved_baselines: Object.keys(proof.baseline_pins).length,
  recorded_local_tests: proof.automated.total_tests,
  recorded_scoped_browser_checks: proof.browser_checks.length,
  observations: proof.observations.length,
  signing_and_recovery_callbacks_unchanged: true,
  limits_preserved: ['native zoom', 'preference emulation', 'live assistive technology', 'live concurrency', 'public Ubuntu CI', 'submission approval'],
  note: 'Offline consistency replay; does not rerun tests, Chrome, a model or a wallet.',
}, null, 2));
