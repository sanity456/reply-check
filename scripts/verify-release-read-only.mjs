/** Release source/state inspection only. No wallet, signing key or write calls. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { read, verifyDeployment } from '../lib/reply/chain.ts';

const root = new URL('../', import.meta.url);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const deployment = JSON.parse(
  await readFile(new URL('lib/reply/deployment.json', root), 'utf8'),
);
const source = await readFile(new URL('contracts/reply_check.py', root));
const checkpoint = JSON.parse(
  await readFile(
    new URL(
      'evidence/human-wallet/20260913-native-hash-recovery-reconciled.json',
      root,
    ),
    'utf8',
  ),
);
const client = createClient({ chain: studionet, endpoint: deployment.rpc });
const requestedAt = new Date().toISOString();
const deployedSource = await client.getContractCode(deployment.address);
assert.equal(sha(Buffer.from(deployedSource)), sha(source));
assert.equal(sha(source), deployment.sourceSha256);
await verifyDeployment();
const workspace = await read('get_workspace', [checkpoint.expected.workspace]);
const review = await read('get_review', [
  checkpoint.expected.workspace,
  checkpoint.stored_review.id,
]);
assert.deepEqual(
  review,
  checkpoint.stored_review,
  'Stored public example remains byte-for-byte equivalent after decoding',
);
assert.ok(
  workspace.review_count >= 16,
  'Previously completed history remains present',
);
console.log(
  JSON.stringify(
    {
      format: 'replycheck-release-read-only-source-v1',
      status: 'PASS_CURRENT_DEPLOYED_SOURCE_AND_SAVED_EXAMPLE',
      requested_at_utc: requestedAt,
      observed_at_utc: new Date().toISOString(),
      repository_commit_at_observation: execFileSync(
        'git',
        ['rev-parse', 'HEAD'],
        { cwd: root, encoding: 'utf8' },
      ).trim(),
      deployment,
      source: {
        repository_sha256: sha(source),
        deployed_sha256: sha(Buffer.from(deployedSource)),
        exact_match: true,
        runner: source.toString('utf8').split('\n')[0].trim(),
      },
      protocol_verified: true,
      workspace,
      example: {
        input: checkpoint.decoded_call,
        transaction_hash: checkpoint.expected.hash,
        stored_chain_timestamp: review.recorded_at,
        output_payload: review,
        expected_reason_codes: checkpoint.stored_review.assessment.findings.map(
          (finding) => finding.reason_code,
        ),
        unchanged_from_saved_human_receipt: true,
      },
      provenance: {
        checkpoint:
          'evidence/human-wallet/20260913-native-hash-recovery-reconciled.json',
        checkpoint_sha256: sha(
          await readFile(
            new URL(
              'evidence/human-wallet/20260913-native-hash-recovery-reconciled.json',
              root,
            ),
          ),
        ),
      },
      transaction_submitted: false,
      time_scope:
        'requested/observed timestamps describe this inspection only; stored_chain_timestamp is read from the contract, not inferred from the local clock.',
    },
    null,
    2,
  ),
);
