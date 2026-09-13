/** Read-only Studionet preflight. Never requests a wallet, signs, or sends a transaction. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { abi } from 'genlayer-js';
import { getReceipt, read, verifyDeployment, deployment } from '../../../lib/reply/chain.ts';
import { digest } from '../../../lib/reply/core.ts';
import { verifyReceiptCall } from '../../../lib/reply/receipt.ts';

const root = new URL('../../../', import.meta.url);
const local = (path) => readFile(new URL(path, root));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const lastPath = 'evidence/human-wallet/20260910-105817-after-signing-recovery-wallet-b.json';
const uiPath = 'evidence/human-wallet/20260913-checked-consent-studionet-return.json';
const lastBytes = await local(lastPath), uiBytes = await local(uiPath);
assert.equal(sha(lastBytes), '525515c56bcd79b942f61ee7b74d4a617c3581f816f93dd075d30b82b0ea874d');
assert.equal(sha(uiBytes), 'c1576a982af6104aa3a43b16175f3df079ac297ecd7056ee35a3cdd094625dc4');
const before = JSON.parse(lastBytes), ui = JSON.parse(uiBytes);
for (const [path, hash] of Object.entries(ui.source_pins))
  assert.equal(sha(await local(path)), hash, path);
assert.equal(before.source_sha256, deployment.sourceSha256);

// Strictly verify prior execution before code/protocol or stored-state reads.
const receiptObservedAt = new Date().toISOString();
const receiptResult = await getReceipt(before.expected);
assert.equal(receiptResult.state, 'success', 'Previous execution is not verified successful');
assert.equal(await verifyReceiptCall(receiptResult.receipt, before.expected), true);
const plain = (value) => {
  if (value instanceof Map) return Object.fromEntries([...value].map(([k, v]) => [k, plain(v)]));
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'bigint') {
    assert.ok(Number.isSafeInteger(Number(value)));
    return Number(value);
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
};
const leaders = receiptResult.receipt.consensus_data.leader_receipt.filter((r) => r.mode === 'leader');
assert.equal(leaders.length, 1);
assert.equal(leaders[0].node_config.address.toLowerCase(), receiptResult.receipt.last_leader.toLowerCase());
const encoded = Buffer.from(typeof leaders[0].result === 'string' ? leaders[0].result : leaders[0].result.raw, 'base64');
assert.equal(encoded[0], 0);
const decodedReturn = plain(abi.calldata.decode(encoded.subarray(1)));
assert.deepEqual(decodedReturn, before.stored_review);

await verifyDeployment();
const sourceVerifiedAt = new Date().toISOString();
const observations = [];
for (const old of before.observations) {
  const output = await read(old.method, old.args);
  observations.push({key:old.key,method:old.method,args:old.args,observed_at_utc:new Date().toISOString(),output});
}
const checks = [
  {id:'PI-01',status:'PASS',claim:'Previous transaction execution, exact calldata, zero value and final leader return are verified before state reads.'},
  {id:'PI-02',status:'PASS',claim:'The app client verifies the deployed protocol and exact source SHA-256 against the pinned configuration.'},
];
for (const observation of observations) {
  const old = before.observations.find((r) => r.key === observation.key);
  let status = 'PASS';
  try { assert.deepEqual(observation.output, old.output); } catch { status = 'FAIL'; }
  checks.push({id:`PI-${String(checks.length+1).padStart(2,'0')}`,status,claim:`Complete ${observation.key} output matches the preceding executed-review checkpoint.`,observation:observation.key});
}
const current = Object.fromEntries(observations.map((r) => [r.key,r.output]));
const workspace = current.workspace;
const account = before.expected.account;
const question = 'How long do I have to request a refund?';
const draft = 'Refund requests must be submitted within 14 days of purchase.';
assert.equal(workspace.id, 'reply-wallet-20260910-105817');
assert.equal(workspace.owner, account);
assert.equal(current.role_b, 'owner');
assert.equal(current.role_a, 'visitor');
assert.equal(workspace.archived, false);
assert.equal(workspace.version, 2);
assert.equal(workspace.review_count, 10);
assert.equal(workspace.card_count, 2);
assert.equal(current.reviews.length, 10);
const proof = {
  format:'replycheck-pending-identity-preflight-v1',
  status:checks.every((c) => c.status === 'PASS') ? 'PASS_READ_ONLY_PREFLIGHT' : 'FAIL_READ_ONLY_PREFLIGHT',
  observed_at_utc:new Date().toISOString(),
  generator:{path:'evidence/human-wallet/preflights/20260913-pending-identity-network.mjs',sha256:sha(await readFile(new URL(import.meta.url)))},
  before_evidence:{path:lastPath,sha256:sha(lastBytes)},
  browser_baseline:{path:uiPath,sha256:sha(uiBytes)},
  source_pins:ui.source_pins,
  prior_transaction:{expected:before.expected,observed_at_utc:receiptObservedAt,execution:{state:receiptResult.state,label:receiptResult.label},receipt:receiptResult.receipt,decoded_return_payload:decodedReturn},
  deployment_verification:{method:'application verifyDeployment()',observed_at_utc:sourceVerifiedAt,contract:deployment.address,chain_id:deployment.chainId,source_sha256:deployment.sourceSha256,matched:true},
  observations,
  checks,
  intended_operation:{method:'submit_review',account,workspace:workspace.id,version:2,question,draft,public_consent_required:true,attached_value_wei:'0',request_id:null,review_id:null,call_digest:null,request_id_note:'A fresh UUID is generated by the app when staging. It is not visible in the unsigned dialog; bind it later from the public transaction export and exact calldata. Never reuse or resend the previous request.',request_digest:await digest(['replycheck-v1',workspace.id,2,account,question,draft]),reference_digest:current.references_v2.digest,expected_verdict:'MATCHES_REFERENCES',expected_question_status:'ANSWERED',expected_reason_codes:['CLAIM_SUPPORTED'],expected_review_count_before:10,expected_review_count_after:11,expected_preservation:'Exactly one new B-authored review; all prior full reviews/timestamps, both references/cards, workspace settings, roles, invitations and owner proposal unchanged.'},
  pending_test:{status:'NOT_STARTED',first_transition:'After a fresh human-approved request has a saved hash and independently observed pending receipt, switch the site-connected account from B to A without resending.',network_transition:'Only claim a network change during pending execution if a pending receipt is independently observed in that interval. Otherwise record it as not exercised.',success_rules:['Keep the original B-signed hash and exact calldata across identity/network changes.','Do not infer execution success from ACCEPTED or FINALIZED lifecycle alone.','Verify final execution, decoded output, stored review and exactly one review-count delta before acknowledging completion.','Never dismiss or resend an unknown/unresolved operation.']},
  constraints:{read_only:true,wallet_requested:false,signed:false,transaction_sent:false,public_ci_run:false,github_push:false},
  timing_note:'Observation times are wall-clock check times. Raw chain timestamps remain in the original receipt and full stored records; no deadline uses local clock assumptions.'
};
// SDK diagnostics can precede stdout. Explicit delimiters keep the public
// evidence machine-readable without suppressing or mistaking those warnings.
console.log('REPLYCHECK_PUBLIC_PREFLIGHT_RESULT\n' + JSON.stringify(proof,(_,v)=>typeof v==='bigint'?v.toString():v) + '\nREPLYCHECK_PUBLIC_PREFLIGHT_END');
if (proof.status !== 'PASS_READ_ONLY_PREFLIGHT') process.exitCode = 1;
