/** Offline consistency replay of saved Chrome observations, not a fresh browser run. */
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
  'components/reply/reply-app.tsx': 'evidence/source-snapshots/20260912-pre-focus-wording/components/reply/reply-app.tsx.snapshot',
};
const readSource = (path) => read(historicalUi && uiSnapshots[path] ? uiSnapshots[path] : path);
const bytes = await read('evidence/browser/20260912-ui-fix-browser-retest.json');
assert.equal(sha(bytes), 'a463a516722b6cf95cb90bd13950f1d5f4140664a526dca2baf81ce3ccd4a6cf');
const evidence = JSON.parse(bytes);
assert.equal(evidence.status, 'PASS_SCOPED_UI_RETEST');
assert.equal(evidence.observations.length, 35);
assert.equal(evidence.checks.length, 20);
assert.ok(evidence.checks.every((check) => check.status === 'PASS'));
assert.deepEqual(evidence.summary.ui_findings_closed, ['UI-01', 'UI-02', 'UI-03', 'UI-04']);
for (const [path, expected] of Object.entries(evidence.source_pins))
  assert.equal(sha(await readSource(path)), expected, path);
const automatedBytes = await read(evidence.baseline.automated_record);
assert.equal(sha(automatedBytes), evidence.baseline.automated_sha256);
assert.equal(JSON.parse(automatedBytes).status, 'AUTOMATED_PASS_BROWSER_RETEST_PENDING');
const originalBytes = await read(evidence.baseline.original_audit);
assert.equal(sha(originalBytes), evidence.baseline.original_audit_sha256);
assert.equal(JSON.parse(originalBytes).status, 'FINDINGS_OPEN');

const record = (label) => {
  const found = evidence.observations.find((entry) => entry.label === label);
  assert.ok(found, label);
  return found;
};
for (const check of evidence.checks)
  for (const label of check.evidence) record(label);
for (const label of ['answer_dialog_740x320', 'answer_dialog_320x640', 'title_101_ascii_bytes']) {
  const { dom } = record(label);
  assert.equal(dom.dialogs.length, 1);
  const dialog = dom.dialogs[0];
  assert.ok(dialog.rect.y >= 0 && dialog.rect.bottom <= dom.viewport.height);
  assert.ok(dialog.rect.x >= 0 && dialog.rect.right <= dom.viewport.width);
  assert.ok(dom.documentWidth <= dom.viewport.width);
  assert.equal(dialog.overflow, 'auto');
}
const landscape = record('answer_dialog_740x320').dom;
assert.deepEqual(landscape.viewport, { height: 320, width: 740 });
assert.ok(landscape.dialogs[0].scrollHeight > landscape.dialogs[0].clientHeight);
const scrolled = record('landscape_tab_scrolls_publication_into_view').dom;
assert.ok(scrolled.dialogs[0].scrollTop > 0);
assert.equal(scrolled.focus.name, 'Review publication');
assert.ok(scrolled.focus.rect.y >= 0 && scrolled.focus.rect.bottom <= 320);
assert.equal(record('landscape_forward_focus_wrap').dom.focus.id, 'card-title');
assert.equal(record('landscape_reverse_focus_wrap').dom.focus.name, 'Close');
for (const label of ['landscape_tab_reaches_close', 'landscape_forward_focus_wrap', 'landscape_reverse_focus_wrap'])
  assert.equal(record(label).dom.focus.insideDialog, true);
for (const label of ['landscape_target_size_escape_focus', 'portrait_escape_returns_focus']) {
  const { dom } = record(label);
  assert.deepEqual(dom.dialogs, []);
  assert.equal(dom.focus.name, 'Approve answer card');
  assert.ok(dom.focus.rect.y >= 0 && dom.focus.rect.bottom <= dom.viewport.height);
}
// Preserve the resize-while-open caveat; do not mislabel it a visibility pass.
const resized = record('landscape_escape_settled').dom;
assert.equal(resized.focus.name, 'Approve answer card');
assert.ok(resized.focus.rect.bottom > resized.viewport.height);

assert.equal(record('team_selected_while_lookup_loading').dom.lookupLoading, true);
assert.equal(record('team_preserved_after_lookup_completion').dom.lookupLoading, false);
assert.equal(record('direct_link_team_before_reads_finish').dom.assessmentPresent, false);
assert.equal(record('direct_link_team_after_reads_finish').dom.assessmentPresent, true);
for (const label of ['team_selected_while_lookup_loading', 'team_preserved_after_lookup_completion', 'direct_link_team_before_reads_finish', 'direct_link_team_after_reads_finish']) {
  assert.deepEqual(record(label).dom.selectedTabs, ['Team']);
  assert.equal(record(label).dom.focus.name, 'Team');
}
for (const label of ['missing_review_safe_feedback', 'missing_direct_link_safe_feedback']) {
  const entry = record(label);
  assert.deepEqual(entry.dom.alerts, ['Could not load this review. Check the ID and your connection, then try again.']);
  assert.ok(!entry.snapshot.includes('region "Recorded assessment"'));
}
for (const label of ['valid_retry_clears_error_immediately', 'direct_link_retry_clears_error']) {
  assert.deepEqual(record(label).dom.alerts, []);
  assert.equal(record(label).dom.lookupLoading, true);
}
for (const label of ['valid_retry_assessment_restored', 'direct_link_retry_succeeds', 'direct_link_correct_assessment', 'final_review_loaded_clean']) {
  const entry = record(label);
  assert.deepEqual(entry.dom.alerts, []);
  assert.equal(entry.dom.lookupLoading, false);
  assert.ok(entry.snapshot.includes('region "Recorded assessment"'));
  assert.ok(entry.snapshot.includes('Refund requests must be submitted within 14 days of purchase.'));
}
for (const [label, expectedBytes] of [
  ['title_100_ascii_bytes', 100], ['title_101_ascii_bytes', 101],
  ['title_100_accented_bytes', 100], ['title_102_accented_bytes', 102],
  ['title_100_emoji_bytes', 100], ['title_101_emoji_bytes', 101],
  ['title_trimmed_100_bytes', 100], ['title_empty', 0],
]) {
  const { dom } = record(label);
  const length = Buffer.byteLength(dom.title.value.trim(), 'utf8');
  assert.equal(length, expectedBytes);
  assert.equal(dom.publishEnabled, length > 0 && length <= 100);
  assert.equal(dom.title.invalid, String(length > 100));
  assert.equal(dom.title.description, 'card-title-help');
  assert.ok(dom.title.help.includes(`${length} / 100 bytes`));
  if (length > 100) assert.ok(dom.title.help.includes('Shorten it to continue.'));
}
assert.equal(evidence.supplemental.title_help_aria_live.value, 'polite');
const closing = record('final_review_loaded_clean');
assert.deepEqual(closing.dom.dialogs, []);
assert.equal(closing.dom.historyCount, 10);
assert.ok(closing.dom.fields.filter((field) => field.id !== 'review-lookup').every((field) => field.value === ''));
assert.doesNotMatch(closing.snapshot, /Waiting for wallet|Continue to wallet|WALLET OUTCOME UNKNOWN|TRANSACTION IN PROGRESS/);
assert.deepEqual(closing.dom.viewport, record('reloaded_current_build').dom.viewport);
assert.deepEqual(closing.dom.viewport, record('default_viewport_restored').dom.viewport);
const id = '7cff937e5e8619921e427c4505d23151bd6d77de73b7257ee7bdea333dd596de';
assert.equal(closing.dom.fields.find((field) => field.id === 'review-lookup').value, id);
assert.ok(closing.snapshot.includes('2026-09-12 15:03:29 UTC'));
assert.equal(evidence.supplemental.copied_review_url, `http://127.0.0.1:4201/?workspace=reply-wallet-20260910-105817&review=${id}`);
assert.equal(evidence.supplemental.final_url, evidence.supplemental.copied_review_url);
assert.equal(evidence.environment.viewport_reset, true);
assert.equal(evidence.environment.signed_out, false);
assert.equal(evidence.wallet_prompt_initiated_by_agent, false);
assert.equal(evidence.publication_submitted, false);
assert.equal(evidence.contract_transactions_sent, 0);
assert.equal(evidence.source_files_changed_during_retest, false);
assert.equal(evidence.github_push, false);
assert.equal(evidence.published, false);
console.log(JSON.stringify({
  evidence_consistency: 'PASS',
  source_check: historicalUi ? 'explicit historical UI snapshots; other pins current' : 'all pins current',
  recorded_browser_status: evidence.status,
  observations: evidence.observations.length,
  passed_scoped_checks: evidence.checks.length,
  closed_ui_findings: evidence.summary.ui_findings_closed,
  resize_focus_caveat_preserved: true,
  note: 'Offline validation of saved Chrome evidence; no fresh browser, wallet, network or submission test.',
}, null, 2));
