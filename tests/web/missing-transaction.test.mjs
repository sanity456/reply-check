import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { ResourceNotFoundRpcError } from 'viem';
import { CHAIN_ID, errorMessage, isHash } from '../../lib/reply/core.ts';
import { getReceipt, contractAddress } from '../../lib/reply/chain.ts';
import { parseRecovery } from '../../lib/reply/journal.ts';
import { verifyReceiptCall } from '../../lib/reply/receipt.ts';

const missingHash = '0x' + '0'.repeat(64);
const expectedMessage =
  'Transaction not found on Studionet. Check the hash in wallet Activity and try the lookup again. Keep your recovery record; do not resend.';
const missingError = () =>
  new ResourceNotFoundRpcError(
    new Error(`Transaction ${missingHash} not found`),
  );
const fixture = JSON.parse(
  readFileSync(
    new URL(
      '../../evidence/human-wallet/20260913-two-tab-final-receipt.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const { hash: completedHash, ...intent } = fixture.expected;

// Isolated test doubles only. No browser storage, wallet or live RPC is used.
// Compile the real callbacks rather than reproducing their recovery logic.
const tree = ts.createSourceFile(
  'hook.ts',
  readFileSync(
    new URL('../../hooks/use-reply-chain.ts', import.meta.url),
    'utf8',
  ),
  ts.ScriptTarget.Latest,
  true,
);
function actualCallback(name, bindings) {
  let expression;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name)
      expression = node.initializer.getText(tree);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(expression, name);
  const compiled = ts.transpileModule(`const actual = ${expression};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return runInNewContext(`(() => { ${compiled}; return actual; })()`, bindings);
}
function harness(record, lookup = getReceipt) {
  const saved = JSON.stringify(record);
  const h = {
    saved,
    writes: [],
    error: '',
    terminal: [],
    effects: 0,
    confirmed: 0,
    checking: false,
  };
  const active = { current: false };
  const bindings = {
    recovery: record,
    checking: false,
    sending: false,
    terminal: false,
    active,
    mounted: { current: true },
    contractAddress,
    isHash,
    parseRecovery,
    errorMessage,
    verifyReceiptCall,
    getReceipt: lookup,
    pendingKey: () => `replycheck:pending:${CHAIN_ID}:${contractAddress}`,
    localStorage: { getItem: () => h.saved },
    navigator: { locks: { request: async (_key, _options, run) => run({}) } },
    persist: (value) => {
      h.writes.push(value);
      h.saved = JSON.stringify(value);
    },
    setError: (value) => {
      h.error = value;
    },
    setChecking: (value) => {
      h.checking = value;
    },
    setMessage: () => {},
    setTerminalHash: (value) => {
      h.terminal.push(value);
    },
    verifyEffect: () => {
      h.effects++;
      throw Error('Unexpected stored-state verification');
    },
    confirmed: {
      current: () => {
        h.confirmed++;
      },
    },
    useCallback: (callback) => callback,
  };
  h.attach = actualCallback('attachHash', bindings);
  h.check = actualCallback('check', bindings);
  h.assertRetained = () => {
    assert.equal(h.saved, saved, 'Exact original journal bytes retained');
    assert.equal(h.writes.length, 0);
    assert.deepEqual(h.terminal, []);
    assert.equal(h.effects, 0);
    assert.equal(h.confirmed, 0);
    assert.equal(h.checking, false);
    assert.equal(active.current, false, 'Recovery remains usable');
  };
  return h;
}

test('missing transaction: pinned SDK error gives actionable, nonterminal wording', () => {
  const error = missingError();
  assert.equal(error.name, 'ResourceNotFoundRpcError');
  assert.equal(error.code, -32001);
  assert.equal(errorMessage(error), expectedMessage);
  assert.ok(!errorMessage(error).includes(missingHash));
});

test('missing transaction: other resources, network errors and loose text are not misclassified', () => {
  for (const error of [
    new Error(`Transaction ${missingHash} not found`),
    new ResourceNotFoundRpcError(new Error('Contract not found')),
    new ResourceNotFoundRpcError(
      new Error(`Transaction ${missingHash} not found\ncalldata: private`),
    ),
    {
      name: 'ResourceNotFoundRpcError',
      code: -32005,
      details: `Transaction ${missingHash} not found`,
    },
    {
      name: 'OtherRpcError',
      code: -32001,
      details: `Transaction ${missingHash} not found`,
    },
    { code: -32001, message: 'Transaction not found' },
    new Error('EAI_AGAIN studio.genlayer.com'),
    new Error('RPC timeout containing private calldata'),
    null,
  ]) {
    assert.notEqual(errorMessage(error), expectedMessage);
    assert.match(errorMessage(error), /could not be verified/);
    assert.ok(!errorMessage(error).includes('private'));
  }
});

test('missing transaction: wallet rejection and contract reason codes retain their meaning', () => {
  assert.match(errorMessage({ code: 4001 }), /declined/);
  assert.match(
    errorMessage(new Error('[EXPECTED] ROLE_REQUIRED')),
    /permission/,
  );
});

for (const mode of ['hashless recovery', 'replacement hash', 'status check']) {
  test(`missing transaction: actual RPC client and ${mode} preserve the journal`, async (t) => {
    let requests = 0;
    // The SDK still processes a real JSON-RPC error response; only fetch is stubbed.
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      requests++;
      const request = JSON.parse(options.body);
      assert.equal(
        request.method,
        'eth_getTransactionByHash',
        'Only read requests allowed',
      );
      assert.deepEqual(request.params, [missingHash]);
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32001,
            message: `Transaction ${missingHash} not found`,
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      );
    });
    const record =
      mode === 'hashless recovery'
        ? intent
        : {
            ...intent,
            hash: mode === 'status check' ? missingHash : completedHash,
          };
    const h = harness(record);
    if (mode === 'status check') await h.check(record);
    else await h.attach(missingHash);
    assert.equal(requests, 1);
    assert.equal(h.error, expectedMessage);
    h.assertRetained();
  });
}

test('missing transaction: retry can attach an exactly verified hash after not-found without signing', async () => {
  let attempts = 0;
  const h = harness({ ...intent, hash: missingHash }, async (candidate) => {
    attempts++;
    if (candidate.hash === missingHash) throw missingError();
    assert.equal(candidate.hash, completedHash);
    return { state: 'success', receipt: fixture.receipt };
  });
  await h.attach(missingHash);
  h.assertRetained();
  assert.equal(h.error, expectedMessage);
  await h.attach(completedHash);
  assert.equal(attempts, 2);
  assert.equal(h.error, '');
  assert.equal(h.writes.length, 1);
  assert.deepEqual(JSON.parse(h.saved), { ...intent, hash: completedHash });
  assert.deepEqual(
    h.terminal,
    [],
    'Attaching a verified hash is not terminal success',
  );
});
