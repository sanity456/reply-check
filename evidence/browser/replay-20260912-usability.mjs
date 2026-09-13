/**
 * Offline evidence-consistency replay only: no browser, network, wallet or writes.
 * The audit's four open UI failures are expected; this is not a release pass.
 */
import assert from 'node:assert/strict';
import { createEvidenceReader } from '../read-evidence.mjs';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const read = createEvidenceReader(root);
const historicalUi = process.argv.includes('--historical-ui');
const uiSnapshots = {
  'hooks/use-reply-chain.ts': 'evidence/source-snapshots/20260912-pre-reliability/hooks/use-reply-chain.ts.snapshot',
  'app/reply.css': 'evidence/source-snapshots/20260912-pre-ui-fixes/app/reply.css',
  'components/reply/reply-app.tsx': 'evidence/source-snapshots/20260912-pre-ui-fixes/components/reply/reply-app.tsx.snapshot',
  'components/reply/review-result.tsx': 'evidence/source-snapshots/20260912-pre-focus-wording/components/reply/review-result.tsx.snapshot',
};
const readSource = (path) => read(historicalUi && uiSnapshots[path]
  ? uiSnapshots[path]
  : path);
const bytes = await read('evidence/browser/20260912-usability-audit.json');
assert.equal(sha(bytes), 'a4832aa075a342802f83b821498e7025a5800ad82a46ce4168f23ceabfdaed1f');
const audit = JSON.parse(bytes);
assert.equal(audit.status, 'FINDINGS_OPEN');
assert.equal(audit.summary.checks, 53);
assert.equal(audit.checks.length, 53);
assert.equal(audit.checks.filter((check) => check.status === 'PASS').length, 49);
assert.equal(audit.checks.filter((check) => check.status === 'FAIL').length, 4);
assert.deepEqual(audit.findings.map((finding) => finding.id), ['UI-01', 'UI-02', 'UI-03', 'UI-04']);
assert.ok(audit.findings.every((finding) => finding.status === 'OPEN'));
for (const [path, expected] of Object.entries(audit.source_check.source_pins))
  assert.equal(sha(await readSource(path)), expected, path);
const baselineBytes = await readFile(new URL(audit.baseline.evidence, new URL('evidence/browser/', root)));
assert.equal(sha(baselineBytes), audit.baseline.sha256);
const baseline = JSON.parse(baselineBytes);
assert.deepEqual(audit.assessment_export.payload, {
  review: baseline.stored_review,
  reference_bundle: baseline.stored_bundle,
});
assert.equal(sha(JSON.stringify(audit.assessment_export.payload, null, 2)), audit.assessment_export.sha256);
assert.equal(audit.assessment_export.sha256, 'b5ba20ea87c15d35ec95b885d66f113fc4bb2942cba42e79b93264b3403b5e54');

const record = (label) => {
  const result = audit.observations.find((entry) => entry.label === label);
  assert.ok(result, label);
  return result;
};
const observation = (label) => {
  const result = audit.supplemental_observations.find((entry) => entry.label === label);
  assert.ok(result, label);
  return result;
};
assert.equal(audit.observations.length, 55);
const responsive = audit.observations.filter((entry) => entry.label.startsWith('responsive_'));
assert.equal(responsive.length, 20);
for (const entry of responsive) {
  const width = Number(entry.label.split('_')[1]);
  assert.equal(entry.dom.viewport.width, width);
  assert.ok(entry.dom.document.width <= width);
  assert.deepEqual(entry.dom.horizontal_overflow, []);
}
assert.equal(record('workspace_dialog_reverse_focus_wrap').dom.focused.name, 'Close');
assert.equal(record('workspace_dialog_reverse_focus_wrap').dom.focused.inside_dialog, true);
assert.equal(record('workspace_dialog_forward_focus_wrap').dom.focused.id, 'workspace-lookup');
assert.deepEqual(record('workspace_dialog_escape_focus_return').dom.dialogs, []);
assert.equal(record('workspace_dialog_escape_focus_return').dom.focused.name, 'ReplyCheck human wallet test');
for (const [label, name] of [
  ['keyboard_enter_activates_library', 'Library'],
  ['keyboard_enter_activates_check', 'Check a reply'],
  ['keyboard_enter_activates_team', 'Team'],
]) {
  assert.ok(record(label).snapshot.split('\n').some((line) =>
    line.includes('tab "' + name + '"') && line.includes('[selected]')));
}
assert.equal(observation('fresh_tab_skip_link_next_tab').focus.mainContains, true);
assert.equal(observation('fresh_tab_skip_link_next_tab').focus.name, 'Refresh');
assert.equal(observation('copied_reply_pasted').value, baseline.stored_review.draft);
assert.equal(observation('copied_review_link_pasted').value,
  audit.environment.url + '&review=' + baseline.stored_review.id);
assert.ok(observation('direct_link_settled').snapshot.includes(baseline.stored_review.id));
assert.equal(observation('invalid_review_id_disabled').openEnabled, false);
assert.equal(observation('empty_question_settled').reviewEnabled, false);
assert.equal(observation('empty_question_settled').value, '');
assert.equal(observation('empty_title_values').value, '');
assert.equal(observation('empty_title_values').enabled, false);
assert.equal(observation('reference_version_zero_validation').field.rangeUnderflow, true);
assert.ok(record('historical_reference_v1_loaded').snapshot.includes('within 7 days'));
assert.ok(record('reference_return_to_current_v2').snapshot.includes('within 14 days'));
assert.ok(!record('reference_return_to_current_v2').snapshot.includes(' · Historical'));
assert.ok(observation('unsigned_consent_dom').controls.some((control) =>
  control.role === 'checkbox' && control.ariaChecked === 'false'));
assert.ok(observation('unsigned_review_dialog_opened').snapshot.includes('button "Continue to wallet" [disabled]'));
assert.deepEqual(record('unsigned_confirmation_escape').dom.dialogs, []);

// Replay the actual failures, rather than silently converting them to passes.
const clipped = record('answer_card_dialog_short_landscape_740x320');
assert.equal(clipped.dom.viewport.height, 320);
assert.ok(clipped.dom.dialogs[0].rect.y < 0);
assert.ok(clipped.dom.dialogs[0].rect.bottom > 320);
assert.equal(clipped.dom.dialogs[0].overflow, 'visible');
const priorNavigation = record('navigation_race_team_selected_while_review_loading');
assert.ok(priorNavigation.snapshot.split('\n').some((line) =>
  line.includes('tab "Team"') && line.includes('[selected]')));
const lateNavigation = record('navigation_race_after_lookup_completion');
assert.ok(lateNavigation.snapshot.includes('tab "History" [selected]'));
assert.equal(lateNavigation.dom.focused.name.trim(), 'Team');
assert.ok(record('missing_review_error_and_old_assessment_state').dom.live_regions.some((region) =>
  region.role === 'alert' && region.text.includes('transaction hash')));
assert.ok(observation('after_async_review_load').snapshot.includes('- alert:'));
assert.ok(observation('after_async_review_load').snapshot.includes('heading "Review history"'));
const longTitle = observation('long_title_values');
assert.equal(longTitle.field.value.length, 101);
assert.equal(longTitle.enabled, false);
assert.equal(longTitle.field.description, null);
assert.equal(longTitle.field.invalid, null);

const closing = observation('audit_closing_values').dom;
assert.equal(record('keyboard_followup_closing_history').dom.history_count, 10);
assert.equal(closing.dialogs, 0);
assert.equal(closing.recovery, 0);
assert.equal(closing.unknown, false);
assert.equal(closing.waiting, false);
assert.deepEqual(closing.alerts, []);
assert.ok(closing.draft.every((field) => field.value === ''));
assert.equal(closing.historyFilter, '');
assert.equal(audit.environment.viewport_reset_to_default, true);
assert.equal(audit.environment.temporary_test_tab_closed, true);
assert.equal(audit.agent_wallet_approval, false);
assert.equal(audit.wallet_request_initiated_by_agent, false);
assert.equal(audit.contract_transactions_sent, 0);
assert.equal(audit.source_files_changed, false);
assert.equal(audit.full_matrix_complete, false);
for (const finding of audit.findings) await access(new URL(finding.source.path, root));
for (const check of audit.checks) {
  for (const label of check.evidence) {
    if (label === 'assessment_export') continue;
    assert.ok(audit.observations.some((entry) => entry.label === label) ||
      audit.supplemental_observations.some((entry) => entry.label === label), label);
  }
}
console.log(JSON.stringify({
  evidence_consistency: 'PASS',
  source_verification: historicalUi ? 'original UI snapshots; other pins from current source' : 'all pins from current source',
  audit_status: audit.status,
  observed_checks: audit.checks.length,
  passed_browser_checks: 49,
  open_ui_failures: audit.findings.length,
  note: 'Offline validation of preserved observations; not a fresh browser run or release approval.',
}, null, 2));
