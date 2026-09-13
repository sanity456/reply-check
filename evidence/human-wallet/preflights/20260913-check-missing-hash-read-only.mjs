/** One public receipt read through the app client; no browser journal or send. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getReceipt } from '../../../lib/reply/chain.ts';
import { verifyReceiptCall } from '../../../lib/reply/receipt.ts';
const bytes = await readFile(new URL('../20260913-two-tab-final-receipt.json', import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'), 'd9691ae3b5c0fa4d8e17662968fd44b6fdd584b26a6ff47171072e80fb119c6c');
const final = JSON.parse(bytes);
const candidate = { ...final.expected, hash: '0x' + '0'.repeat(64) };
const requested = new Date().toISOString();
let result;
try {
  const outcome = await getReceipt(candidate);
  const exact = await verifyReceiptCall(outcome.receipt, candidate);
  assert.equal(outcome.state, 'unknown');
  assert.equal(exact, false);
  result = { status: 'PASS_SCOPED_LIVE_MISSING_HASH_READ', candidate, requested_at_utc: requested, observed_at_utc: new Date().toISOString(), outcome, exact_call_verified: exact, native_ui_retried: false, journal_mutated: false, transaction_sent: false };
} catch (error) {
  result = { status: 'INCONCLUSIVE_PUBLIC_READ_FAILED', candidate, requested_at_utc: requested, observed_at_utc: new Date().toISOString(), error: String(error), native_ui_retried: false, journal_mutated: false, transaction_sent: false };
  process.exitCode = 1;
}
console.log('REPLYCHECK_MISSING_RESULT\n' + JSON.stringify(result, (_, value) => typeof value === 'bigint' ? value.toString() : value) + '\nREPLYCHECK_MISSING_END');
