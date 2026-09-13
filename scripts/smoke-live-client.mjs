/** Read-only checks through the exact application client; never opens a wallet. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { verifyEvidence } from './verify-live-evidence.mjs';
import {
  configured,
  contractAddress,
  deployment,
  verifyDeployment,
  read,
  getReceipt,
  verifyEffect,
} from '../lib/reply/chain.ts';
import { digest } from '../lib/reply/core.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const summary = await verifyEvidence(process.argv[2]);
const evidence = JSON.parse(
  await readFile(path.resolve(root, process.argv[2]), 'utf8'),
);
assert.equal(configured, true, 'Enable only a fully verified deployment first');
assert.equal(contractAddress, evidence.contract);
assert.equal(deployment.sourceSha256, evidence.source_sha256);
await verifyDeployment();

for (const check of evidence.cases) {
  const stored = await read('get_review', [
    evidence.workspace,
    check.output.id,
  ]);
  assert.deepEqual(
    stored,
    check.output,
    check.expected.name + ': immutable live record',
  );
}
const workspace = await read('get_workspace', [evidence.workspace]);
assert.equal(workspace.version, 2);
assert.equal(workspace.review_count, 6);
assert.equal(workspace.owner, evidence.reviewer.toLowerCase());
assert.equal(workspace.archived, false);
assert.equal(
  await read('get_role', [evidence.workspace, evidence.owner]),
  'visitor',
);
assert.equal(
  (await read('get_answer_card', [evidence.workspace, 'refund-card'])).status,
  'RETIRED',
);

const receipts = [];
for (const expected of ['success', 'failed']) {
  const event = evidence.transactions.find(
    (t) =>
      t.method !== 'deploy' &&
      t.phase ===
        (expected === 'success' ? 'FINALIZED_SUCCESS' : 'EXPECTED_REJECTION'),
  );
  assert.ok(event);
  const result = await getReceipt({
    hash: event.hash,
    account: event.sender,
    contract: evidence.contract,
    chainId: 61999,
    method: event.method,
    callDigest: await digest([event.method, event.inputs]),
  });
  assert.equal(result.state, expected);
  receipts.push({
    method: event.method,
    hash: event.hash,
    state: result.state,
  });
}
const good = evidence.cases.find(
  (check) => check.expected.name === 'good',
).output;
await verifyEffect({
  method: 'get_review',
  args: [evidence.workspace, good.id],
  equals: good,
});

console.log(
  JSON.stringify(
    {
      status: 'PASS',
      contract: contractAddress,
      source_sha256: deployment.sourceSha256,
      evidence_sha256: summary.evidence_sha256,
      immutable_reviews_rechecked: evidence.cases.length,
      workspace_state: {
        version: workspace.version,
        reviews: workspace.review_count,
        archived: workspace.archived,
      },
      receipts,
      note: 'Fresh read-only RPC checks through the app client. No wallet, signing or new transaction.',
    },
    null,
    2,
  ),
);
