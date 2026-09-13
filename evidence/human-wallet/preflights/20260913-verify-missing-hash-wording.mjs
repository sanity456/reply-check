/** Explicit read-only live check. Not part of the offline CI suite. No wallet. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getReceipt } from '../../../lib/reply/chain.ts';
import { errorMessage } from '../../../lib/reply/core.ts';

const bytes = await readFile(new URL('../20260913-two-tab-final-receipt.json', import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'), 'd9691ae3b5c0fa4d8e17662968fd44b6fdd584b26a6ff47171072e80fb119c6c');
const fixture = JSON.parse(bytes);
const candidate = { ...fixture.expected, hash: '0x' + '0'.repeat(64) };
const requested = new Date().toISOString();
let observedError;
try { await getReceipt(candidate); } catch (error) { observedError = error; }
const result = {
  status: 'INCONCLUSIVE',
  requested_at_utc: requested,
  observed_at_utc: new Date().toISOString(),
  method: 'eth_getTransactionByHash',
  params: [candidate.hash],
  observed_error: observedError ? {
    name: observedError.name, code: observedError.code,
    details: observedError.details,
    safe_ui_message: errorMessage(observedError),
  } : null,
  transaction_sent: false,
  journal_mutated: false,
  native_ui_recovery_retested: false,
};
try {
  assert.equal(observedError?.name, 'ResourceNotFoundRpcError');
  assert.equal(observedError?.code, -32001);
  assert.equal(observedError?.details, `Transaction ${candidate.hash} not found`);
  assert.equal(errorMessage(observedError), 'Transaction not found on Studionet. Check the hash in wallet Activity and try the lookup again. Keep your recovery record; do not resend.');
  result.status = 'PASS_SCOPED_LIVE_MISSING_HASH_WORDING';
} catch (error) {
  result.assertion = error.message;
  process.exitCode = 1;
}
console.log('REPLYCHECK_WORDING_RESULT\n' + JSON.stringify(result) + '\nREPLYCHECK_WORDING_END');
