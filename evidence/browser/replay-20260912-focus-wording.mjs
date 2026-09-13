/** Offline consistency replay only; does not rerun Chrome, a model or a wallet. */
import assert from 'node:assert/strict';
import { createEvidenceReader } from '../read-evidence.mjs';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);
const read = createEvidenceReader(root);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const historicalUi = process.argv.includes('--historical-ui');
const uiSnapshots = {
  'app/reply.css': 'evidence/source-snapshots/20260912-pre-reliability/app/reply.css.snapshot',
  'hooks/use-reply-chain.ts': 'evidence/source-snapshots/20260912-pre-reliability/hooks/use-reply-chain.ts.snapshot',
};
const readSource = (path) => read(historicalUi && uiSnapshots[path] ? uiSnapshots[path] : path);
const bytes = await read('evidence/browser/20260912-focus-wording-verification.json');
assert.equal(sha(bytes), '3966c1ae5ce0c5e19b9a4c341ac0dd962e25b5974e7b30e265dafc7fb420b7b7');
const evidence = JSON.parse(bytes);
assert.equal(evidence.status, 'PASS_SCOPED_FOCUS_AND_WORDING');
assert.equal(evidence.checks.length, 12);
assert.equal(evidence.observations.length, 19);
assert.ok(evidence.checks.every((check) => check.status === 'PASS'));
for (const [path, expected] of Object.entries(evidence.source_pins))
  assert.equal(sha(await readSource(path)), expected, path);
for (const [path, expected] of Object.entries(evidence.baseline_pins))
  assert.equal(sha(await read(path)), expected, path);
assert.equal(sha(await read('evidence/source-snapshots/20260912-pre-focus-wording/components/reply/reply-app.tsx.snapshot')), '0528ca0736ed6f9a83bf86f63bf9fd50ac0d4fac33467e28ab918d6f851d037d');
assert.equal(sha(await read('evidence/source-snapshots/20260912-pre-focus-wording/components/reply/review-result.tsx.snapshot')), '4f47ab39f49dcc26362a84198975b786a517c36147212b4df9778b92cb28b461');

const record = (label) => {
  const found = evidence.observations.find((entry) => entry.label === label);
  assert.ok(found, label);
  return found;
};
for (const check of evidence.checks)
  for (const label of check.evidence) record(label);
const visible = (entry) => {
  const { focus, viewport } = entry.dom;
  assert.ok(focus, entry.label);
  assert.ok(focus.rect.top >= 0 && focus.rect.bottom <= viewport.height, entry.label);
  assert.ok(focus.rect.left >= 0 && focus.rect.right <= viewport.width, entry.label);
};
for (const label of ['resized_while_open', 'portrait_to_landscape_open', 'fixed_landscape_open', 'fixed_portrait_open']) {
  const { dom } = record(label);
  assert.equal(dom.dialogs.length, 1);
  assert.ok(dom.dialogs[0].rect.top >= 0 && dom.dialogs[0].rect.bottom <= dom.viewport.height);
  assert.ok(dom.dialogs[0].rect.left >= 0 && dom.dialogs[0].rect.right <= dom.viewport.width);
  assert.equal(dom.dialogs[0].overflow, 'auto');
}
const scrolled = record('resized_tab_publication');
assert.ok(scrolled.dom.dialogs[0].scrollTop > 0);
assert.equal(scrolled.dom.focus.name, 'Review publication');
visible(scrolled);
for (const label of ['resized_tab_close', 'resized_forward_wrap', 'resized_reverse_wrap']) {
  const entry = record(label);
  assert.equal(entry.dom.focus.insideDialog, true);
  visible(entry);
}
assert.equal(record('resized_forward_wrap').dom.focus.id, 'card-title');
assert.equal(record('resized_tab_close').dom.focus.name, 'Close');
assert.equal(record('resized_reverse_wrap').dom.focus.name, 'Close');
for (const label of ['resized_escape_settled', 'fixed_landscape_close_settled', 'fixed_portrait_escape_settled', 'portrait_to_landscape_close_settled']) {
  const entry = record(label);
  assert.deepEqual(entry.dom.dialogs, []);
  assert.equal(entry.dom.focus.name, 'Approve answer card');
  assert.equal(entry.dom.focus.insideDialog, false);
  visible(entry);
}
// Keep the prior failure intact; the new observations, not edits to the old
// record, establish the improvement.
const previous = JSON.parse(await read('evidence/browser/20260912-ui-fix-browser-retest.json'));
const oldFocus = previous.observations.find((r) => r.label === 'landscape_escape_settled');
assert.ok(oldFocus.dom.focus.rect.bottom > oldFocus.dom.viewport.height);

const mixed = JSON.parse(await read('evidence/human-wallet/20260910-105817-mixed-reply.json')).stored_review;
const finding = mixed.assessment.findings[1];
assert.equal(finding.verdict, 'UNSUPPORTED');
assert.equal(finding.reason_code, 'NOT_IN_REFERENCES');
assert.equal(finding.suggestion, 'Refund processing time may vary.');
const limitation = `The references do not confirm this claim: “${finding.text}”`;
for (const label of ['mixed_review_local_rewrite', 'mixed_original_suggestion_expanded', 'mixed_mobile_wording']) {
  const entry = record(label);
  assert.equal(entry.dom.suggestions.length, 1);
  assert.equal(entry.dom.suggestions[0].label, 'LOCAL REWRITE · RECHECK BEFORE USE');
  assert.equal(entry.dom.suggestions[0].draft, limitation);
  assert.equal(entry.dom.suggestions[0].original, finding.suggestion);
  assert.ok(entry.snapshot.includes('heading "Changes needed"'));
  assert.ok(entry.snapshot.includes('generic: Older reference version'));
  assert.ok(entry.snapshot.includes('generic: unsupported'));
  assert.ok(entry.snapshot.includes(mixed.assessment.summary));
  for (const item of mixed.assessment.findings) assert.ok(entry.snapshot.includes(`paragraph: “${item.text}”`));
  assert.ok(entry.snapshot.includes('blockquote: ' + mixed.assessment.findings[0].citations[0].quote));
}
assert.equal(record('mixed_review_local_rewrite').dom.suggestions[0].originalOpen, false);
assert.equal(record('mixed_original_suggestion_expanded').dom.suggestions[0].originalOpen, true);
assert.ok(record('mixed_original_suggestion_expanded').snapshot.includes('paragraph: Refund processing time may vary.'));
const mobile = record('mixed_mobile_wording').dom;
assert.equal(mobile.viewport.width, 320);
assert.ok(mobile.documentWidth <= mobile.viewport.width);

const closing = record('final_matching_review_clean');
assert.deepEqual(closing.dom.dialogs, []);
assert.deepEqual(closing.dom.alerts, []);
assert.equal(closing.dom.reviewButtons, 10);
assert.equal(closing.dom.fields.find((f) => f.id === 'question').value, '');
assert.equal(closing.dom.fields.find((f) => f.id === 'reply').value, '');
assert.equal(closing.dom.fields.find((f) => f.id === 'review-lookup').value, '7cff937e5e8619921e427c4505d23151bd6d77de73b7257ee7bdea333dd596de');
assert.ok(closing.snapshot.includes('2026-09-12 15:03:29 UTC'));
assert.ok(closing.snapshot.includes('heading "Matches the references"'));
assert.deepEqual(closing.dom.viewport, record('rebuilt_default_ready').dom.viewport);
assert.deepEqual(closing.dom.viewport, record('default_viewport_restored').dom.viewport);
assert.equal(evidence.environment.viewport_reset, true);
assert.equal(evidence.environment.signed_out, false);
assert.equal(evidence.automated.total_tests, 217);
assert.equal(evidence.automated.frontend_tests, 120);
assert.equal(evidence.automated.contract_tooling_tests, 97);
assert.equal(evidence.automated.new_regressions, 13);
assert.ok(evidence.automated.commands.every((command) => command.exit_code === 0));
assert.equal(evidence.constraints.wallet_requests_initiated, 0);
assert.equal(evidence.constraints.contract_transactions_sent, 0);
for (const key of ['recorded_assessments_modified', 'deployed_contract_changed', 'signing_code_changed', 'dependency_locks_changed', 'github_push', 'published', 'submission_ready'])
  assert.equal(evidence.constraints[key], false, key);
console.log(JSON.stringify({
  evidence_consistency: 'PASS',
  source_check: historicalUi ? 'explicit historical frontend snapshots; other pins current' : 'all pins current',
  verified_source_pins: Object.keys(evidence.source_pins).length,
  preserved_baselines: Object.keys(evidence.baseline_pins).length,
  recorded_scoped_browser_checks: evidence.checks.length,
  observations: evidence.observations.length,
  recorded_local_tests: evidence.automated.total_tests,
  original_focus_failure_and_model_output_preserved: true,
  note: 'Offline consistency check only; no fresh browser, model, wallet, Ubuntu CI or submission test.',
}, null, 2));
