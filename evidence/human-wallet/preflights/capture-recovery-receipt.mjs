/** Fast read-only receipt capture from an observed public recovery export. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { abi } from 'genlayer-js';
import { getReceipt } from '../../../lib/reply/chain.ts';
import { verifyReceiptCall } from '../../../lib/reply/receipt.ts';
import { digest } from '../../../lib/reply/core.ts';
const hash=process.argv[2];
assert.match(hash??'',/^0x[0-9a-f]{64}$/);
const path=`C:/Users/user/Downloads/replycheck-transaction-${hash}.json`;
const bytes=await readFile(path),expected=JSON.parse(bytes);
assert.equal(expected.hash,hash);
assert.equal(expected.account,'0x7cef5dbbd598ba74ef9c665c9853e573448d97d0');
assert.equal(expected.contract,'0xBD35B1E68aeC803Bd793Db9c6B9762b60f60029A');
assert.equal(expected.method,'submit_review');
assert.equal(expected.workspace,'reply-wallet-20260910-105817');
assert.equal(expected.chainId,61999);
const requestedAt=new Date().toISOString();
const result=await getReceipt(expected);
const observedAt=new Date().toISOString();
const exactCallVerified=await verifyReceiptCall(result.receipt,expected);
const plain=(v)=>{
  if(v instanceof Map)return Object.fromEntries([...v].map(([k,x])=>[k,plain(x)]));
  if(Array.isArray(v))return v.map(plain);
  if(typeof v==='bigint'){assert.ok(Number.isSafeInteger(Number(v)));return Number(v);}
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,plain(x)]));
  return v;
};
let call=null,fixtureVerified=false;
if(exactCallVerified&&typeof result.receipt.data?.calldata==='string'){
  call=plain(abi.calldata.decode(Buffer.from(result.receipt.data.calldata,'base64')));
  assert.equal(call.method,'submit_review');
  const nonce=call.args[4];
  assert.match(nonce,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.deepEqual(call.args,[expected.workspace,2,'How long do I have to request a refund?','Refund requests must be submitted within 14 days of purchase.',nonce,true]);
  assert.equal(expected.effect.fields.id,await digest([expected.workspace,expected.account,nonce]));
  assert.equal(expected.effect.fields.request_digest,'2ae740d30b55e5991fe14ba32b3e9d41d247db9e66232f47823048f48067686c');
  assert.equal(expected.effect.fields.reference_digest,'1041401ae7c08750497e55652d30fc9119a0a27e6e712c016e13b9faaa1ca9f0');
  fixtureVerified=true;
}
const proof={format:'replycheck-recovery-receipt-capture-v1',requested_at_utc:requestedAt,observed_at_utc:observedAt,expected,app_transaction_export:{path,sha256:createHash('sha256').update(bytes).digest('hex'),payload:expected},receipt:result.receipt,execution:{state:result.state,label:result.label},exact_call_verified:exactCallVerified,fixture_verified:fixtureVerified,decoded_call:call,transaction_sent:false,wallet_approved_by_agent:false};
console.log('REPLYCHECK_RECEIPT_RESULT\n'+JSON.stringify(proof,(_,v)=>typeof v==='bigint'?v.toString():v)+'\nREPLYCHECK_RECEIPT_END');
