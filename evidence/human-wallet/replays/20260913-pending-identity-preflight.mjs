/** Offline preflight consistency only. No RPC, wallet requests or transactions. */
import assert from 'node:assert/strict';
import { createEvidenceReader } from '../../read-evidence.mjs';
import { createHash } from 'node:crypto';
import { abi } from 'genlayer-js';
import { digest } from '../../../lib/reply/core.ts';
import { receiptState, verifyReceiptCall } from '../../../lib/reply/receipt.ts';

const root = new URL('../../../', import.meta.url);
const read = createEvidenceReader(root);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytes = await read('evidence/human-wallet/20260913-pending-identity-preflight.json');
assert.equal(sha(bytes), 'c6daddbc41f2fefb333e1b53e495622876518e3469bd2fc421095a1449697c93');
const proof = JSON.parse(bytes);
assert.equal(proof.status, 'PASS_READ_ONLY_PREFLIGHT');
assert.equal(proof.checks.length, 12);
assert.ok(proof.checks.every((c) => c.status === 'PASS'));
for (const [path, hash] of Object.entries(proof.source_pins))
  assert.equal(sha(await read(path)), hash, path);
for (const pin of [proof.generator, proof.before_evidence, proof.browser_baseline])
  assert.equal(sha(await read(pin.path)), pin.sha256, pin.path);
const before = JSON.parse(await read(proof.before_evidence.path));
const prior = proof.prior_transaction;
assert.deepEqual(prior.expected, before.expected);
assert.equal(receiptState(prior.receipt, prior.expected).state, 'success');
assert.equal(await verifyReceiptCall(prior.receipt, prior.expected), true);
const plain = (value) => {
  if (value instanceof Map) return Object.fromEntries([...value].map(([k,v]) => [k,plain(v)]));
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'bigint') { assert.ok(Number.isSafeInteger(Number(value))); return Number(value); }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,plain(v)]));
  return value;
};
const leaders = prior.receipt.consensus_data.leader_receipt.filter((r) => r.mode === 'leader');
assert.equal(leaders.length, 1);
assert.equal(leaders[0].node_config.address.toLowerCase(), prior.receipt.last_leader.toLowerCase());
const encoded = Buffer.from(typeof leaders[0].result === 'string' ? leaders[0].result : leaders[0].result.raw, 'base64');
assert.equal(encoded[0], 0);
assert.deepEqual(plain(abi.calldata.decode(encoded.subarray(1))), before.stored_review);
assert.deepEqual(prior.decoded_return_payload, before.stored_review);
assert.equal(proof.deployment_verification.matched, true);
assert.equal(proof.deployment_verification.source_sha256, sha(await read('contracts/reply_check.py')));
assert.equal(proof.observations.length, 10);
for (const observation of proof.observations)
  assert.deepEqual(observation.output, before.observations.find((r) => r.key === observation.key).output, observation.key);
const current = Object.fromEntries(proof.observations.map((r) => [r.key,r.output]));
assert.equal(current.workspace.review_count, 10);
assert.equal(current.reviews.length, 10);
assert.equal(current.workspace.card_count, 2);
assert.equal(current.role_a, 'visitor');
assert.equal(current.role_b, 'owner');
const intended = proof.intended_operation;
assert.equal(intended.method, 'submit_review');
assert.equal(intended.account, current.workspace.owner);
assert.equal(intended.version, 2);
assert.equal(intended.attached_value_wei, '0');
assert.equal(intended.request_digest, await digest(['replycheck-v1',intended.workspace,2,intended.account,intended.question,intended.draft]));
assert.equal(intended.reference_digest, current.references_v2.digest);
for (const field of ['request_id','review_id','call_digest']) assert.equal(intended[field], null);
assert.equal(intended.expected_review_count_before, 10);
assert.equal(intended.expected_review_count_after, 11);
assert.equal(intended.expected_verdict, 'MATCHES_REFERENCES');
assert.equal(intended.expected_question_status, 'ANSWERED');
assert.deepEqual(intended.expected_reason_codes, ['CLAIM_SUPPORTED']);
assert.equal(proof.pending_test.status, 'NOT_STARTED');
assert.equal(proof.browser_setup.status, 'AWAITING_HUMAN_APPROVAL');
assert.equal(proof.browser_setup.observations.length, 4);
const staged = proof.browser_setup.observations.find((r) => r.label === 'pending_identity_unsigned_review_ready').snapshot;
assert.ok(staged.includes('dialog "Check this reply"'));
assert.ok(staged.includes('definition: 0x7cef5d…8d97d0'));
assert.ok(staged.includes('0 GEN · network fees may apply'));
assert.ok(staged.includes('Question: ' + intended.question));
assert.ok(staged.includes('Draft: ' + intended.draft));
assert.ok(staged.includes('button "Continue to wallet" [disabled]'));
assert.ok(!staged.includes('checkbox "I checked the content and agree to publish it." [checked]'));
for (const marker of ['WALLET OUTCOME UNKNOWN','Waiting for wallet','region "Transaction recovery"'])
  assert.ok(!staged.includes(marker), marker);
for (const key of ['agent_checked_consent','agent_clicked_continue_to_wallet','agent_approved_wallet'])
  assert.equal(proof.browser_setup[key], false, key);
assert.deepEqual(proof.execution_attempts.map((r) => r.status), ['FAILED_BEFORE_STATE_READS','COMMAND_EXIT_ZERO_OUTPUT_PARSE_FAILED','PASS_READ_ONLY_PREFLIGHT']);
assert.equal(proof.constraints.read_only, true);
for (const key of ['wallet_requested','signed','transaction_sent','public_ci_run','github_push']) assert.equal(proof.constraints[key], false, key);
assert.ok(proof.timing_clarification.includes('request-start time'));
console.log(JSON.stringify({saved_preflight_consistency:'PASS',live_preflight_checks:12,public_state_outputs:10,current_source_pins:Object.keys(proof.source_pins).length,browser_observations:4,new_transaction:'NOT_SENT',pending_identity_case:'NOT_STARTED',note:'Offline replay of saved preflight; not a new live run.'},null,2));
