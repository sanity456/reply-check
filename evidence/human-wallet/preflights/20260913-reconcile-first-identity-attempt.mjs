/** Read-only reconciliation of the one completed review; never resubmits it. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { abi } from 'genlayer-js';
import { read, verifyDeployment, verifyEffect } from '../../../lib/reply/chain.ts';
import { receiptState, verifyReceiptCall } from '../../../lib/reply/receipt.ts';
import { digest } from '../../../lib/reply/core.ts';
const root = new URL('../../../', import.meta.url);
const local = (path) => readFile(new URL(path,root));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const beforePath='evidence/human-wallet/20260913-pending-identity-preflight.json';
const capturePath='evidence/human-wallet/20260913-pending-identity-first-receipt.json';
const beforeBytes=await local(beforePath),captureBytes=await local(capturePath);
assert.equal(sha(beforeBytes),'c6daddbc41f2fefb333e1b53e495622876518e3469bd2fc421095a1449697c93');
assert.equal(sha(captureBytes),'d7ffa1ba34f15d1d6713015d6343437c9ab542a2406bd12d2873aab1aed0725e');
const before=JSON.parse(beforeBytes), capture=JSON.parse(captureBytes);
for(const [path,hash] of Object.entries(before.source_pins)) assert.equal(sha(await local(path)),hash,path);
const {expected,receipt}=capture;
assert.equal(receiptState(receipt,expected).state,'success');
assert.equal(await verifyReceiptCall(receipt,expected),true);
const plain=(v)=>{
  if(v instanceof Map)return Object.fromEntries([...v].map(([k,x])=>[k,plain(x)]));
  if(Array.isArray(v))return v.map(plain);
  if(typeof v==='bigint'){assert.ok(Number.isSafeInteger(Number(v)));return Number(v);}
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,plain(x)]));
  return v;
};
const call=plain(abi.calldata.decode(Buffer.from(receipt.data.calldata,'base64')));
const intended=before.intended_operation;
const nonce=call.args[4];
assert.match(nonce,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
assert.equal(call.method,'submit_review');
assert.deepEqual(call.args,[intended.workspace,2,intended.question,intended.draft,nonce,true]);
assert.equal(await digest([call.method,call.args]),expected.callDigest);
const reviewId=await digest([intended.workspace,intended.account,nonce]);
assert.equal(reviewId,expected.effect.fields.id);
const leaders=receipt.consensus_data.leader_receipt.filter(r=>r.mode==='leader');
assert.equal(leaders.length,1);
assert.equal(leaders[0].node_config.address.toLowerCase(),receipt.last_leader.toLowerCase());
const encoded=Buffer.from(typeof leaders[0].result==='string'?leaders[0].result:leaders[0].result.raw,'base64');
assert.equal(encoded[0],0);
const returned=plain(abi.calldata.decode(encoded.subarray(1)));
// Verified successful execution precedes every deployment/state read below.
await verifyDeployment();
const sourceVerifiedAt=new Date().toISOString();
const stored=await verifyEffect(expected.effect);
assert.deepEqual(stored,returned);
assert.equal(stored.id,reviewId);
assert.equal(stored.author,intended.account);
assert.equal(stored.request_digest,intended.request_digest);
assert.equal(stored.reference_digest,intended.reference_digest);
assert.equal(stored.assessment.verdict,intended.expected_verdict);
assert.equal(stored.assessment.question_status,intended.expected_question_status);
assert.deepEqual(stored.assessment.findings.map(f=>f.reason_code),intended.expected_reason_codes);
const observations=[];
for(const old of before.observations){
  const output=await read(old.method,old.args);
  observations.push({key:old.key,method:old.method,args:old.args,observed_at_utc:new Date().toISOString(),output});
  if(old.key==='workspace')assert.deepEqual(output,{...old.output,review_count:11});
  else if(old.key==='reviews'){
    assert.equal(output.length,11);
    assert.deepEqual(output.filter(r=>r.id!==reviewId),old.output);
    assert.deepEqual(output.filter(r=>r.id===reviewId),[stored]);
  }else assert.deepEqual(output,old.output,old.key);
}
const proof={format:'replycheck-identity-attempt-reconciliation-v1',status:'PASS_TRANSACTION_VERIFICATION',pending_identity_case:'NOT_EXERCISED_FINALIZED_BEFORE_SWITCH',observed_at_utc:new Date().toISOString(),generator:{path:'evidence/human-wallet/preflights/20260913-reconcile-first-identity-attempt.mjs',sha256:sha(await readFile(new URL(import.meta.url)))},before_evidence:{path:beforePath,sha256:sha(beforeBytes)},receipt_evidence:{path:capturePath,sha256:sha(captureBytes)},source_pins:before.source_pins,expected:{...expected,args:call.args,request_id:nonce,review_id:reviewId},receipt,decoded_call:call,decoded_return_payload:returned,stored_review:stored,deployment_verification:{source_sha256:before.deployment_verification.source_sha256,verified_at_utc:sourceVerifiedAt,matched:true},observations,verified_checks:['Exact successful receipt identity, zero-value calldata and final-round output','Fresh request UUID and derived review ID match the public recovery export','Deployed source/protocol match the pinned app','Complete final leader return equals the stored review and expected classification/reason codes','Exactly one review increases ten to eleven; all previous full reviews/timestamps are preserved','Both complete reference bundles and cards, all roles/invitations/ownership/settings remain unchanged'],timing:{receipt_request_started_at:capture.requested_at_utc,receipt_observed_at:capture.observed_at_utc,receipt_created_at:receipt.created_at,stored_recorded_at:stored.recorded_at},constraints:{transaction_sent_by_this_script:false,resubmitted:false,agent_wallet_approval:false,pending_identity_transition_observed:false,pending_network_transition_observed:false},limitation:'The first browser snapshot displayed accepted, but the first independent receipt was already finalized before any account/network switch. This successful review is not a pass of the intended pending-transition test.'};
console.log('REPLYCHECK_RECONCILIATION_RESULT\n'+JSON.stringify(proof,(_,v)=>typeof v==='bigint'?v.toString():v)+'\nREPLYCHECK_RECONCILIATION_END');
