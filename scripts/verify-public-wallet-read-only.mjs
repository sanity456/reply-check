/** Reconcile one human-approved public-origin review. Never sends or resubmits. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createClient, abi } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { read, verifyDeployment } from '../lib/reply/chain.ts';
import { digest } from '../lib/reply/core.ts';
import { receiptState, verifyReceiptCall } from '../lib/reply/receipt.ts';
import { publicReceipt } from './live-studionet.mjs';

const root = new URL('../', import.meta.url);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hash = process.argv[2];
assert.match(hash, /^0x[a-fA-F0-9]{64}$/);
const baselinePath = 'evidence/release/20260913-public-wallet-baseline.json';
const baselineBytes = await readFile(new URL(baselinePath, root));
const baseline = JSON.parse(baselineBytes);
const before = baseline.observations.find(
  (row) => row.key === 'workspace',
).output;
const oldReviews = baseline.observations.find(
  (row) => row.key === 'reviews',
).output;
assert.equal(before.review_count, 16);
const deployment = JSON.parse(
  await readFile(new URL('lib/reply/deployment.json', root), 'utf8'),
);
const client = createClient({ chain: studionet, endpoint: deployment.rpc });
const requestedAt = new Date().toISOString();
const receipt = publicReceipt(
  await client.request({ method: 'eth_getTransactionByHash', params: [hash] }),
);
const plain = (value) => {
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
};
const call = plain(
  abi.calldata.decode(Buffer.from(receipt.data.calldata, 'base64')),
);
assert.equal(call.method, 'submit_review');
assert.equal(typeof call.args[4], 'string');
assert.match(call.args[4], /^[a-f0-9-]{36}$/);
const args = [
  before.id,
  2,
  'How long do I have to request a refund?',
  'Refund requests must be submitted within 14 days of purchase.',
  call.args[4],
  true,
];
assert.deepEqual(call.args, args);
const id = await digest([before.id, before.owner, call.args[4]]);
assert.ok(
  !oldReviews.some((row) => row.id === id),
  'Not a previously completed review',
);
const expected = {
  hash,
  account: before.owner,
  contract: deployment.address,
  chainId: deployment.chainId,
  method: 'submit_review',
  workspace: before.id,
  args,
  callDigest: await digest(['submit_review', args]),
  request_id: args[4],
  review_id: id,
  effect: {
    method: 'get_review',
    args: [before.id, id],
    fields: { id, author: before.owner, version: 2 },
  },
};
assert.equal(receiptState(receipt, expected).state, 'success');
assert.equal(await verifyReceiptCall(receipt, expected), true);
await verifyDeployment();
const stored = await read('get_review', [before.id, id]);
const leaders = receipt.consensus_data.leader_receipt.filter(
  (row) => row.mode === 'leader',
);
assert.equal(leaders.length, 1);
const encoded = Buffer.from(
  typeof leaders[0].result === 'string'
    ? leaders[0].result
    : leaders[0].result.raw,
  'base64',
);
assert.equal(encoded[0], 0);
const returned = plain(abi.calldata.decode(encoded.subarray(1)));
assert.deepEqual(returned, stored);
assert.equal(stored.assessment.verdict, 'MATCHES_REFERENCES');
assert.equal(stored.assessment.question_status, 'ANSWERED');
assert.deepEqual(
  stored.assessment.findings.map((row) => row.reason_code),
  ['CLAIM_SUPPORTED'],
);
const workspace = await read('get_workspace', [before.id]);
const reviews = await read('list_reviews', [before.id, 0, 50]);
assert.deepEqual(workspace, { ...before, review_count: 17 });
assert.equal(reviews.length, 17);
assert.deepEqual(
  reviews.filter((row) => row.id !== id),
  oldReviews,
);
assert.deepEqual(
  reviews.filter((row) => row.id === id),
  [stored],
);
console.log(
  JSON.stringify(
    {
      format: 'replycheck-public-wallet-reconciliation-v1',
      status: 'PASS_SINGLE_PUBLIC_ORIGIN_REVIEW',
      origin: baseline.origin,
      requested_at_utc: requestedAt,
      observed_at_utc: new Date().toISOString(),
      baseline: { path: baselinePath, sha256: sha(baselineBytes) },
      expected,
      receipt,
      decoded_call: call,
      decoded_return_payload: returned,
      stored_review: stored,
      deployment_verification: {
        matched: true,
        source_sha256: deployment.sourceSha256,
      },
      observations: [
        { key: 'workspace', output: workspace },
        { key: 'reviews', output: reviews },
      ],
      timing: { stored_recorded_at: stored.recorded_at },
      constraints: {
        transaction_sent_by_this_script: false,
        resubmitted: false,
        agent_approved_wallet: false,
        application_source_changed: false,
        whole_release_pass_claimed: false,
      },
      actor_scope:
        'Human reported approving consent and MetaMask. The public app displayed this hash; independent receipt/calldata/state reads establish the outcome. No native wallet-click video was captured.',
      limitations: [
        'This is one public-origin owner review, not a new full two-wallet or failure matrix.',
      ],
    },
    null,
    2,
  ),
);
