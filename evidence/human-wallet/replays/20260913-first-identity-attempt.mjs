/** Offline verification only; intentionally does NOT mark the pending-switch test passed. */
import assert from 'node:assert/strict';
import { createEvidenceReader } from '../../read-evidence.mjs';
import { createHash } from 'node:crypto';
import { abi } from 'genlayer-js';
import { digest } from '../../../lib/reply/core.ts';
import { receiptState,verifyReceiptCall } from '../../../lib/reply/receipt.ts';
const root=new URL('../../../',import.meta.url);
const read=createEvidenceReader(root);
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=await read('evidence/human-wallet/20260913-first-identity-attempt-reconciled.json');
assert.equal(sha(bytes),'7356b68442360206dbc10d187c0e51df9ef2824c7e32c869f29bcf2c1d5fb541');
const proof=JSON.parse(bytes);
assert.equal(proof.status,'PASS_TRANSACTION_VERIFICATION');
assert.equal(proof.pending_identity_case,'NOT_EXERCISED_FINALIZED_BEFORE_SWITCH');
for(const [p,h] of Object.entries(proof.source_pins))assert.equal(sha(await read(p)),h,p);
for(const pin of [proof.generator,proof.before_evidence,proof.receipt_evidence])assert.equal(sha(await read(pin.path)),pin.sha256,pin.path);
const before=JSON.parse(await read(proof.before_evidence.path));
const capture=JSON.parse(await read(proof.receipt_evidence.path));
assert.deepEqual(proof.receipt,capture.receipt);
assert.equal(receiptState(proof.receipt,proof.expected).state,'success');
assert.equal(await verifyReceiptCall(proof.receipt,proof.expected),true);
const plain=v=>{
  if(v instanceof Map)return Object.fromEntries([...v].map(([k,x])=>[k,plain(x)]));
  if(Array.isArray(v))return v.map(plain);
  if(typeof v==='bigint'){assert.ok(Number.isSafeInteger(Number(v)));return Number(v);}
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,plain(x)]));
  return v;
};
const call=plain(abi.calldata.decode(Buffer.from(proof.receipt.data.calldata,'base64')));
assert.deepEqual(call,proof.decoded_call);
assert.deepEqual(call.args,proof.expected.args);
const i=before.intended_operation,e=proof.expected;
assert.deepEqual(call.args,[i.workspace,2,i.question,i.draft,e.request_id,true]);
assert.equal(await digest([e.method,e.args]),e.callDigest);
assert.equal(await digest([i.workspace,i.account,e.request_id]),e.review_id);
assert.equal(e.hash,'0xeb94cb35bc3bb2d21d8c65059f43a79c5775091b63df40fa3da1ea33e8b7fb99');
const leaders=proof.receipt.consensus_data.leader_receipt.filter(r=>r.mode==='leader');
assert.equal(leaders.length,1);
const encoded=Buffer.from(typeof leaders[0].result==='string'?leaders[0].result:leaders[0].result.raw,'base64');
assert.equal(encoded[0],0);
assert.deepEqual(plain(abi.calldata.decode(encoded.subarray(1))),proof.stored_review);
assert.deepEqual(proof.decoded_return_payload,proof.stored_review);
assert.equal(proof.stored_review.author,i.account);
assert.equal(proof.stored_review.id,e.review_id);
assert.equal(proof.stored_review.request_digest,i.request_digest);
assert.equal(proof.stored_review.reference_digest,i.reference_digest);
assert.equal(proof.stored_review.recorded_at,proof.timing.stored_recorded_at);
assert.equal(proof.stored_review.assessment.verdict,i.expected_verdict);
assert.equal(proof.stored_review.assessment.question_status,i.expected_question_status);
assert.deepEqual(proof.stored_review.assessment.findings.map(f=>f.reason_code),i.expected_reason_codes);
assert.equal(proof.observations.length,10);
for(const r of proof.observations){
  const old=before.observations.find(x=>x.key===r.key).output;
  if(r.key==='workspace')assert.deepEqual(r.output,{...old,review_count:11});
  else if(r.key==='reviews'){
    assert.equal(r.output.length,11);
    assert.deepEqual(r.output.filter(x=>x.id!==e.review_id),old);
    assert.deepEqual(r.output.filter(x=>x.id===e.review_id),[proof.stored_review]);
  }else assert.deepEqual(r.output,old,r.key);
}
assert.equal(proof.verified_checks.length,6);
assert.ok(Object.values(proof.constraints).every(v=>v===false));
assert.equal(capture.execution.state,'success');
assert.equal(capture.receipt.status,'FINALIZED');
assert.ok(capture.browser_observations[0].snapshot.includes('paragraph: accepted'));
assert.ok(capture.browser_observations[1].snapshot.includes('TRANSACTION CHECKED'));
assert.equal(capture.account_or_network_switch_requested_after_approval,false);
console.log(JSON.stringify({saved_transaction_verification:'PASS',groups:6,full_state_outputs:10,review_count:11,hash:e.hash,pending_identity_case:proof.pending_identity_case,note:'Offline replay; no resubmission or pending-transition pass claimed.'},null,2));
