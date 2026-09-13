import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { abi } from 'genlayer-js';
import { digest } from '../../lib/reply/core.ts';
import { receiptState, verifyReceiptCall } from '../../lib/reply/receipt.ts';

// This suite runs offline under the existing complete npm test / Ubuntu CI job.
// Old evidence remains old evidence: these checks do not recreate wallet actions.
const root = new URL('../../', import.meta.url);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const local = async (path) => {
  const url = new URL(path, root);
  assert.ok(
    url.href.startsWith(root.href),
    'Evidence must remain inside this project',
  );
  return readFile(url);
};
const json = async (path) => JSON.parse(await local(path));
const manifest = await json('tests/fixtures/release-evidence-manifest.json');
const proof = async (path) => {
  assert.ok(
    Object.hasOwn(manifest.proof_pins, path),
    'Explicit evidence registration',
  );
  const bytes = await local(path);
  assert.equal(sha(bytes), manifest.proof_pins[path], path);
  return JSON.parse(bytes);
};
const ledgerPaths = [
  'evidence/human-wallet/20260913-two-tab-hash-reconciled.json',
  'evidence/human-wallet/20260913-native-hash-recovery-reconciled.json',
];
const archives = (
  await Promise.all([
    proof(
      'evidence/source-snapshots/20260913-before-draft-errors/source-bytes.json',
    ),
    proof(
      'evidence/source-snapshots/20260913-before-screen-reader-closure/document-bytes.json',
    ),
    proof(
      'evidence/source-snapshots/20260913-before-release-clarification/document-bytes.json',
    ),
  ])
).flat();

async function recordedPins(pins) {
  for (const [path, expected] of Object.entries(pins)) {
    if (sha(await local(path)) === expected) continue;
    // Only explicit, byte-pinned historical records may resolve old form/report bytes.
    const original = archives.filter(
      (entry) => entry.path === path && entry.sha256 === expected,
    );
    assert.equal(original.length, 1, path + ': no exact archived scope');
    assert.equal(original[0].encoding, 'base64');
    assert.equal(sha(Buffer.from(original[0].data, 'base64')), expected);
  }
}
function plain(value) {
  if (value instanceof Map)
    return Object.fromEntries([...value].map(([k, v]) => [k, plain(v)]));
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'bigint') {
    assert.ok(Number.isSafeInteger(Number(value)));
    return Number(value);
  }
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, plain(v)]),
    );
  return value;
}
async function recordedReview(record) {
  const { expected, receipt, stored_review: stored } = record;
  assert.equal(receiptState(receipt, expected).state, 'success');
  assert.equal(await verifyReceiptCall(receipt, expected), true);
  const call = plain(
    abi.calldata.decode(Buffer.from(receipt.data.calldata, 'base64')),
  );
  assert.deepEqual(call, record.decoded_call);
  assert.equal(call.method, 'submit_review');
  assert.deepEqual(call.args, expected.args);
  assert.equal(await digest([call.method, call.args]), expected.callDigest);
  assert.equal(
    await digest([expected.workspace, expected.account, call.args[4]]),
    stored.id,
  );
  assert.equal(stored.id, expected.effect.fields.id);
  assert.equal(stored.author, expected.account);
  assert.equal(stored.question, call.args[2]);
  assert.equal(stored.draft, call.args[3]);
  assert.equal(stored.version, call.args[1]);
  const leaders = receipt.consensus_data.leader_receipt.filter(
    (entry) => entry.mode === 'leader',
  );
  assert.equal(leaders.length, 1);
  assert.equal(
    leaders[0].node_config.address.toLowerCase(),
    receipt.last_leader.toLowerCase(),
  );
  const encoded = Buffer.from(
    typeof leaders[0].result === 'string'
      ? leaders[0].result
      : leaders[0].result.raw,
    'base64',
  );
  assert.equal(encoded[0], 0);
  assert.deepEqual(plain(abi.calldata.decode(encoded.subarray(1))), stored);
  assert.deepEqual(record.decoded_return_payload, stored);
  assert.equal(stored.assessment.verdict, 'MATCHES_REFERENCES');
  assert.equal(stored.assessment.question_status, 'ANSWERED');
  assert.deepEqual(
    stored.assessment.findings.map((item) => item.reason_code),
    ['CLAIM_SUPPORTED'],
  );
  assert.deepEqual(stored.assessment.findings[0].citations, [
    { reference_id: 'faq', quote: stored.draft },
  ]);
  assert.ok(Number.isFinite(Date.parse(stored.recorded_at)));
  assert.equal(
    Date.parse(stored.recorded_at),
    Date.parse(record.timing.stored_recorded_at),
  );
  assert.equal(record.deployment_verification.matched, true);
  assert.ok(
    Object.values(record.constraints).every((value) => value === false),
  );
}

test('release evidence: all current source pins and explicitly registered proof bytes match', async () => {
  assert.equal(Object.keys(manifest.current_pins).length, 59);
  assert.match(manifest.deployment_source_commit, /^[a-f0-9]{40}$/);
  for (const [path, expected] of Object.entries(
    manifest.deployment_source_pins,
  ))
    assert.equal(
      sha(await local(path)),
      expected,
      'Deployed runtime source: ' + path,
    );
  for (const [path, expected] of Object.entries(manifest.current_pins))
    assert.equal(sha(await local(path)), expected, path);
  for (const path of Object.keys(manifest.proof_pins)) await proof(path);
  await assert.rejects(local('../outside.json'), /inside this project/);
  await assert.rejects(proof('unregistered.json'), /Explicit evidence/);
});

test('release evidence: current release reports preserve exact historical document bytes without relaxing runtime pins', async () => {
  const documents = await proof(
    'evidence/source-snapshots/20260913-before-release-clarification/document-bytes.json',
  );
  assert.deepEqual(
    documents.map((entry) => entry.path),
    ['UI-AUDIT.md', 'TESTING.md', 'RELEASE-CHECKLIST.md'],
  );
  const historical = await proof(
    'evidence/browser/20260913-native-screen-reader-closure.json',
  );
  for (const entry of documents) {
    assert.equal(entry.encoding, 'base64');
    assert.equal(entry.sha256, historical.current_source_pins[entry.path]);
    assert.equal(sha(Buffer.from(entry.data, 'base64')), entry.sha256);
    assert.notEqual(sha(await local(entry.path)), entry.sha256);
    assert.equal(
      sha(await local(entry.path)),
      manifest.current_pins[entry.path],
    );
    assert.ok(!Object.hasOwn(manifest.deployment_source_pins, entry.path));
  }
  await recordedPins(historical.current_source_pins);
  await assert.rejects(
    recordedPins({ 'RELEASE-CHECKLIST.md': '0'.repeat(64) }),
    /no exact archived scope/,
  );
});

test('release evidence: current documentation distinguishes owner submission from historical test checkpoints', async () => {
  for (const path of [
    'RELEASE-CHECKLIST.md',
    'TESTING.md',
    'UI-AUDIT.md',
    'LIVE-VALIDATION.md',
    'DEVICE-RELEASE-PREFLIGHT.md',
  ]) {
    const document = (await local(path)).toString('utf8');
    const [current, ...history] = document.split(/\n## Historical[^\n]*\n/);
    assert.ok(history.length > 0, path + ': explicit historical boundary');
    assert.match(current, /owner review and portal submission remain/i);
    assert.ok(current.includes('(STEWARD-RESPONSE.md)'), path);
    assert.doesNotMatch(
      current,
      /website is still local|not submission-ready|public release verification remains open/,
    );
    assert.match(current, /not claimed|not full|not guarantee|not presented/i);
  }
  const checklist = (await local('RELEASE-CHECKLIST.md'))
    .toString('utf8')
    .split('\n## Historical')[0];
  assert.equal((checklist.match(/^- \[ \]/gm) ?? []).length, 1);
  assert.match(checklist, /CAPTCHA.*explicitly approves/);
  assert.match(checklist, /already-persisted incorrect legacy hash/);
  assert.match(checklist, /team-attested/);
});

for (const [index, path] of ledgerPaths.entries()) {
  test(`release evidence: decoded call, successful receipt, returned/stored payload and chain timestamp ${index + 1}`, async () => {
    const record = await proof(path);
    await recordedPins(record.source_pins);
    await recordedReview(record);
    for (const pin of Object.values(record.evidence_pins))
      assert.equal(sha(await local(pin.path)), pin.sha256);
    const reviews = record.observations.find(
      (row) => row.key === 'reviews',
    ).output;
    assert.equal(reviews.length, 15 + index);
    assert.deepEqual(
      reviews.filter((row) => row.id === record.stored_review.id),
      [record.stored_review],
    );
    assert.equal(
      record.observations.find((row) => row.key === 'workspace').output
        .review_count,
      reviews.length,
    );
    if (index === 1) {
      const before = await proof(ledgerPaths[0]);
      assert.deepEqual(
        reviews.filter((row) => row.id !== record.stored_review.id),
        before.observations.find((row) => row.key === 'reviews').output,
      );
    }
  });
}

test('release evidence: tampered receipt, call and stored payload cannot pass reconciliation', async () => {
  const original = await proof(ledgerPaths[1]);
  for (const mutate of [
    (copy) => {
      copy.expected.callDigest = '0'.repeat(64);
    },
    (copy) => {
      copy.stored_review.draft = 'Changed output';
    },
    (copy) => {
      copy.receipt.value = 1;
    },
    (copy) => {
      copy.timing.stored_recorded_at = '2000-01-01T00:00:00Z';
    },
  ]) {
    const copy = structuredClone(original);
    mutate(copy);
    await assert.rejects(recordedReview(copy));
  }
});

test('release evidence: two-tab rejected-hash exports retain exact bytes', async () => {
  const record = await proof(ledgerPaths[0]);
  const exp = record.exact_recovery_exports;
  assert.equal(exp.byte_identical, true);
  assert.equal(exp.before_sha256, exp.after_sha256);
  assert.equal(sha(Buffer.from(exp.raw_json_utf8)), exp.before_sha256);
  assert.deepEqual(JSON.parse(exp.raw_json_utf8), exp.record);
});

test('release evidence: native missing/unrelated hashes stay unattached; correct hash is verified', async () => {
  const record = await proof(ledgerPaths[1]);
  const negative = await json(record.evidence_pins.negative.path);
  const positive = await json(record.evidence_pins.positive.path);
  for (const item of [
    negative.missing_hash_case,
    negative.unrelated_hash_case,
  ]) {
    assert.equal(item.wait_error, null);
    assert.equal(item.after.primary.visible.hash, null);
    assert.equal(item.after.primary.visible.uncertain, true);
    assert.equal(item.after.primary.visible.valid_draft_denied, true);
  }
  assert.equal(positive.user_supplied_hash, record.expected.hash);
  assert.equal(positive.attachment.after.visible.hash, record.expected.hash);
  assert.equal(positive.attachment.after.visible.uncertain, false);
  assert.equal(
    sha(Buffer.from(record.exact_recovered_export.raw_json_utf8)),
    record.exact_recovered_export.sha256,
  );
});

test('release evidence: original wording finding and field-feedback closure retain their measured scope', async () => {
  const wording = await proof(
    'evidence/local/20260913-missing-hash-wording-fix.json',
  );
  await recordedPins(wording.source_pins);
  assert.equal(wording.total_tests, 267);
  assert.equal(wording.saved_replays, 20);
  const fixed = await proof(
    'evidence/local/20260913-draft-field-feedback-fix.json',
  );
  await recordedPins(fixed.current_source_pins);
  assert.equal(fixed.verification.total_tests, 280);
  assert.equal(fixed.verification.web.failed, 0);
  assert.equal(fixed.verification.contracts.passed, 97);
  assert.equal(fixed.browser.checks.length, 16);
  assert.ok(fixed.browser.checks.every((row) => row.result === 'PASS'));
});

test('release evidence: zoom recommendation is preserved, while motion/contrast/restoration and human listening are scoped passes', async () => {
  const zoom = await proof(
    'evidence/browser/20260913-native-accessibility-reliability.json',
  );
  assert.equal(zoom.checks.filter((row) => row.status === 'PASS').length, 15);
  assert.equal(
    zoom.checks.find((row) => row.id === 'field_specific_error_association')
      .status,
    'IMPROVEMENT_RECOMMENDED',
  );
  for (const [path, count] of [
    ['evidence/browser/20260913-native-reduced-motion.json', 12],
    ['evidence/browser/20260913-native-contrast-restoration.json', 11],
  ]) {
    const record = await proof(path);
    assert.equal(record.checks.length, count);
    assert.ok(record.checks.every((row) => row.status === 'PASS'));
  }
  const sr = await proof(
    'evidence/browser/20260913-native-screen-reader-closure.json',
  );
  assert.equal(sr.checks.length, 7);
  assert.ok(sr.checks.every((row) => row.result === 'PASS_SCOPED'));
  assert.equal(sr.restoration.narrator_running, false);
  assert.equal(sr.restoration.dialog_count, 0);
  assert.equal(sr.restoration.review_rows, 16);
  assert.ok(
    sr.human_responses.some(
      (row) =>
        row.reply_verbatim === 'it read the site' &&
        row.conclusion.startsWith('Inconclusive'),
    ),
  );
});

test('release evidence: responsive and public-access records are not promoted to physical-device or wallet-transaction coverage', async () => {
  const responsive = await proof(
    'evidence/browser/20260913-in-app-responsive-release-preflight.json',
  );
  assert.equal(responsive.responsive_matrix.length, 25);
  assert.ok(responsive.responsive_matrix.every((row) => row.result === 'PASS'));
  assert.equal(responsive.safeguards.chain_transaction_submitted, false);
  const hosted = await proof(
    'evidence/hosting/20260913-vercel-public-access.json',
  );
  assert.equal(hosted.http_checks.home_status, 200);
  assert.ok(hosted.http_checks.assets.every((row) => row.status === 200));
  assert.ok(
    hosted.http_checks.excluded_paths.every((row) => row.status === 404),
  );
  assert.equal(hosted.http_checks.no_request_credentials, true);
  assert.equal(hosted.browser_checks.transaction_submitted, false);
  assert.equal(hosted.ci.conclusion, 'success');
  assert.equal(hosted.ci.head_sha, hosted.source.deployment_commit);
});

test('release evidence: fresh source check binds actual source bytes and stored-chain example', async () => {
  const record = await proof(
    'evidence/release/20260913-deployed-source-read-only.json',
  );
  assert.equal(record.transaction_submitted, false);
  assert.equal(record.source.exact_match, true);
  assert.equal(
    record.source.repository_sha256,
    sha(await local('contracts/reply_check.py')),
  );
  assert.equal(record.source.deployed_sha256, record.source.repository_sha256);
  assert.equal(record.deployment.sourceSha256, record.source.repository_sha256);
  assert.equal(
    record.example.stored_chain_timestamp,
    record.example.output_payload.recorded_at,
  );
  assert.deepEqual(record.example.expected_reason_codes, ['CLAIM_SUPPORTED']);
  assert.deepEqual(
    record.example.output_payload,
    (await proof(ledgerPaths[1])).stored_review,
  );
});

test('release evidence: the public-origin wallet smoke adds exactly one verified review and closes recovery', async () => {
  const baseline = await proof(
    'evidence/release/20260913-public-wallet-baseline.json',
  );
  const record = await proof(
    'evidence/release/20260913-public-wallet-reconciled.json',
  );
  const close = await proof(
    'evidence/release/20260913-public-wallet-browser-close.json',
  );
  await recordedReview(record);
  assert.equal(record.origin, 'https://reply-check-sanity3.vercel.app');
  assert.equal(sha(await local(record.baseline.path)), record.baseline.sha256);
  const before = baseline.observations.find(
    (row) => row.key === 'workspace',
  ).output;
  assert.equal(before.review_count, 16);
  assert.deepEqual(
    record.observations.find((row) => row.key === 'workspace').output,
    { ...before, review_count: 17 },
  );
  const reviews = record.observations.find(
    (row) => row.key === 'reviews',
  ).output;
  assert.equal(reviews.length, 17);
  assert.deepEqual(
    reviews.filter((row) => row.id !== record.stored_review.id),
    baseline.observations.find((row) => row.key === 'reviews').output,
  );
  assert.equal(close.hash, record.expected.hash);
  assert.ok(close.before.includes('TRANSACTION CHECKED'));
  assert.ok(close.before.includes(record.expected.hash));
  assert.ok(!close.after.includes('region "Transaction recovery"'));
  assert.ok(!close.after.includes('dialog "Check this reply"'));
  assert.ok(close.after.includes('heading "Matches the references"'));
  // Extension-origin warnings are retained, not relabelled as a clean console.
  assert.ok(
    close.logs.every(
      (row) =>
        row.level === 'warn' && row.url.startsWith('chrome-extension://'),
    ),
  );
});
