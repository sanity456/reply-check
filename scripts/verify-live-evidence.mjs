/** Read-only replay of saved public evidence through the current app verifier. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { digest, isAddress, isHash } from '../lib/reply/core.ts';
import { receiptState, verifyReceiptCall } from '../lib/reply/receipt.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (v) => createHash('sha256').update(v).digest('hex');

export async function verifyEvidence(relativePath) {
  const file = path.resolve(root, relativePath);
  assert.ok(file.startsWith(path.join(root, 'evidence/studionet') + path.sep));
  const bytes = await readFile(file);
  const evidence = JSON.parse(bytes);
  assert.equal(
    evidence.status,
    'PASS',
    'Incomplete runs are not passing evidence',
  );
  assert.equal(evidence.network, 'studionet');
  assert.equal(evidence.chain_id, 61999);
  assert.equal(evidence.leader_only, false);
  assert.ok(isAddress(evidence.contract));
  assert.equal(evidence.source_verified, true);
  assert.equal(
    evidence.source_sha256,
    sha(await readFile(path.join(root, 'contracts/reply_check.py'))),
  );
  assert.equal(evidence.deployed_source_sha256, evidence.source_sha256);
  assert.equal(
    evidence.package_lock_sha256,
    sha(await readFile(path.join(root, 'package-lock.json'))),
  );
  assert.match(evidence.harness_sha256, /^[a-f0-9]{64}$/);
  assert.equal(
    sha(
      await readFile(
        path.join(
          root,
          'evidence/studionet/harnesses',
          evidence.harness_sha256 + '.mjs.txt',
        ),
      ),
    ),
    evidence.harness_sha256,
  );
  assert.equal(
    sha(
      await readFile(
        path.join(
          root,
          'evidence/studionet/sources',
          evidence.source_sha256 + '.py.txt',
        ),
      ),
    ),
    evidence.source_sha256,
  );
  assert.ok(evidence.transactions.length > 0);
  let rejected = 0;
  for (const event of evidence.transactions) {
    assert.ok(isHash(event.hash));
    const expectedRejection = typeof event.expected_error === 'string';
    assert.equal(
      event.phase,
      expectedRejection ? 'EXPECTED_REJECTION' : 'FINALIZED_SUCCESS',
    );
    assert.equal(
      receiptState(event.receipt, {
        hash: event.hash,
        account: event.sender,
        contract: evidence.contract,
      }).state,
      expectedRejection ? 'failed' : 'success',
      event.method,
    );
    if (event.method !== 'deploy')
      assert.equal(
        await verifyReceiptCall(event.receipt, {
          method: event.method,
          callDigest: await digest([event.method, event.inputs]),
        }),
        true,
        event.method + ': exact calldata/zero-value check',
      );
    if (expectedRejection) {
      const leader = event.receipt.consensus_data.leader_receipt.find(
        (r) => r.mode === 'leader',
      );
      const encoded = Buffer.from(
        typeof leader.result === 'string' ? leader.result : leader.result.raw,
        'base64',
      );
      assert.ok([1, 2].includes(encoded[0]));
      assert.equal(
        encoded.subarray(1).toString('utf8'),
        '[EXPECTED] ' + event.expected_error,
      );
      assert.equal(event.error_payload, '[EXPECTED] ' + event.expected_error);
      rejected += 1;
    }
  }
  const references = evidence.observations.find(
    (o) => o.method === 'get_references' && o.inputs[1] === 1,
  )?.output;
  assert.ok(references);
  assert.equal(references.digest, await digest(references.documents));
  assert.equal(evidence.cases.length, 6);
  const cases = [];
  for (const check of evidence.cases) {
    assert.equal(check.status, 'PASS');
    const { expected, output } = check;
    assert.equal(output.question, expected.question);
    assert.equal(output.draft, expected.draft);
    assert.equal(output.assessment.verdict, expected.verdict);
    assert.equal(output.assessment.question_status, expected.question_status);
    assert.deepEqual(
      output.assessment.findings.map((f) => f.reason_code),
      expected.reason_codes,
    );
    assert.equal(output.reference_digest, references.digest);
    assert.match(output.recorded_at, /(?:Z|[+-]\d{2}:\d{2})$/);
    assert.ok(Number.isFinite(Date.parse(output.recorded_at)));
    for (const finding of output.assessment.findings)
      for (const citation of finding.citations) {
        const document = references.documents.find(
          (d) => d.id === citation.reference_id,
        );
        assert.ok(document && document.body.includes(citation.quote));
      }
    cases.push({
      name: expected.name,
      verdict: output.assessment.verdict,
      reason_codes: expected.reason_codes,
      question_status: output.assessment.question_status,
      recorded_at: output.recorded_at,
      review_id: output.id,
    });
  }
  return {
    status: 'PASS',
    evidence_sha256: sha(bytes),
    contract: evidence.contract,
    source_sha256: evidence.source_sha256,
    receipt_verifier_sha256: sha(
      await readFile(path.join(root, 'lib/reply/receipt.ts')),
    ),
    total_transactions: evidence.transactions.length,
    expected_rejections: rejected,
    successful_transactions: evidence.transactions.length - rejected,
    cases,
    verification:
      'Saved network payloads replayed through current application checks; no new transactions sent.',
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  verifyEvidence(process.argv[2])
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
