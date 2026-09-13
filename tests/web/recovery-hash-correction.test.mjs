import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { abi } from 'genlayer-js';
import {
  CHAIN_ID,
  digest,
  errorMessage,
  isHash,
} from '../../lib/reply/core.ts';
import { parseRecovery } from '../../lib/reply/journal.ts';
import { receiptState, verifyReceiptCall } from '../../lib/reply/receipt.ts';

// Execute real hook callbacks against isolated storage/locks/RPC doubles.
// Receipt calldata uses the pinned SDK and the real exact-call verifier.
// These tests never open a wallet, read a browser or contact a chain.
const source = ts.createSourceFile(
  'hook.ts',
  readFileSync(
    new URL('../../hooks/use-reply-chain.ts', import.meta.url),
    'utf8',
  ),
  ts.ScriptTarget.Latest,
  true,
);
function callback(name, bindings) {
  let node;
  const visit = (current) => {
    if (
      ts.isVariableDeclaration(current) &&
      current.name.getText(source) === name
    )
      node = current.initializer;
    ts.forEachChild(current, visit);
  };
  visit(source);
  assert.ok(node, name);
  const compiled = ts.transpileModule(
    `const actual = ${node.getText(source)};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  return runInNewContext(`(() => { ${compiled}; return actual; })()`, bindings);
}
const account = '0x' + 'a'.repeat(40);
const contract = '0x' + 'b'.repeat(40);
const hash = '0x' + 'c'.repeat(64);
const wrongHash = '0x' + 'd'.repeat(64);
const args = [
  'hash-test',
  2,
  'Question?',
  'Public fictional reply.',
  'nonce',
  true,
];
const key = `replycheck:pending:${CHAIN_ID}:${contract}`;
const original = {
  account,
  contract,
  chainId: CHAIN_ID,
  method: 'submit_review',
  title: 'Check this reply',
  workspace: 'hash-test',
  effect: {
    method: 'get_review',
    args: ['hash-test', 'review-id'],
    fields: { id: 'review-id' },
  },
  startedAt: '2026-09-13T00:00:00.000Z',
  callDigest: await digest(['submit_review', args]),
};
const receipt = (method = 'submit_review') => ({
  value: 0,
  data: {
    calldata: {
      raw: [
        ...abi.calldata.encode(
          abi.calldata.makeCalldataObject(method, args, undefined),
        ),
      ],
    },
  },
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function harness(record = original) {
  const h = {
    saved: JSON.stringify(record),
    writes: [],
    rpc: 0,
    wallet: 0,
    error: '',
    message: '',
    checking: false,
    memory: null,
    lockHeld: false,
    response: async () => ({ state: 'pending', receipt: receipt() }),
  };
  const bindings = {
    recovery: record,
    uncertain: record.hash ? null : record,
    pending: record.hash ? record : null,
    terminal: false,
    checking: false,
    sending: false,
    active: { current: false },
    mounted: { current: true },
    contractAddress: record.contract,
    pendingKey: () => key,
    parseRecovery,
    isHash,
    errorMessage,
    verifyReceiptCall,
    localStorage: { getItem: () => h.saved },
    getReceipt: async (candidate) => {
      h.rpc++;
      return h.response(candidate);
    },
    persist: (value) => {
      h.writes.push(value);
      h.saved = value ? JSON.stringify(value) : null;
    },
    setError: (value) => {
      h.error = value;
    },
    setMessage: (value) => {
      h.message = value;
    },
    setChecking: (value) => {
      h.checking = value;
    },
    setMemory: (value) => {
      h.memory = value;
    },
    navigator: {
      locks: {
        request: async (name, options, run) => {
          assert.equal(name, key);
          assert.equal(options.ifAvailable, true);
          if (h.lockHeld) return run(null);
          h.lockHeld = true;
          try {
            return await run({ name });
          } finally {
            h.lockHeld = false;
          }
        },
      },
    },
  };
  h.bindings = bindings;
  h.attach = callback('attachHash', bindings);
  h.confirmNotSent = callback('confirmNotSent', bindings);
  return h;
}

test('recovery hash: a wrong but well-formed hash leaves the original intent correctable', async () => {
  const h = harness();
  h.response = async () => ({
    state: 'unknown',
    receipt: receipt('different_method'),
  });
  await h.attach(wrongHash);
  assert.deepEqual(JSON.parse(h.saved), original);
  assert.equal(h.writes.length, 0);
  assert.match(h.error, /verif|match/i);
});
test('recovery hash: only matching calldata may attach even while the receipt is pending', async () => {
  const h = harness();
  h.response = async () => ({
    state: 'pending',
    receipt: receipt('different_method'),
  });
  await h.attach(wrongHash);
  assert.equal(h.writes.length, 0);
  assert.deepEqual(JSON.parse(h.saved), original);
});
test('recovery hash: a verified candidate preserves every intent field and never signs', async () => {
  const h = harness();
  await h.attach(hash);
  assert.equal(h.rpc, 1);
  assert.deepEqual(JSON.parse(h.saved), { ...original, hash });
  assert.equal(h.wallet, 0);
  assert.equal(h.checking, false);
});
test('recovery hash: an already-saved incorrect hash can be replaced by a verified one', async () => {
  const h = harness({ ...original, hash: wrongHash });
  await h.attach(hash);
  assert.equal(h.rpc, 1);
  assert.deepEqual(JSON.parse(h.saved), { ...original, hash });
});
test('recovery hash: malformed input performs no RPC and keeps the intent', async () => {
  const h = harness();
  await h.attach('0x1234');
  assert.equal(h.rpc, 0);
  assert.equal(h.writes.length, 0);
});
test('recovery hash: timeout keeps the original record and permits another attempt', async () => {
  const h = harness();
  h.response = async () => {
    throw Error('RPC timeout');
  };
  await h.attach(hash);
  assert.equal(h.writes.length, 0);
  assert.equal(h.checking, false);
  assert.equal(h.bindings.active.current, false);
  h.response = async () => ({ state: 'pending', receipt: receipt() });
  await h.attach(hash);
  assert.deepEqual(JSON.parse(h.saved), { ...original, hash });
});
test('recovery hash: rapid duplicate checks do not overlap', async () => {
  const h = harness(),
    held = deferred();
  h.response = () => held.promise;
  const first = h.attach(hash);
  await h.attach(hash);
  held.resolve({ state: 'pending', receipt: receipt() });
  await first;
  assert.equal(h.rpc, 1);
  assert.equal(h.writes.length, 1);
});
test('recovery hash: a record changed during verification is never overwritten', async () => {
  const h = harness(),
    held = deferred();
  h.response = () => held.promise;
  const first = h.attach(hash);
  h.saved = JSON.stringify({ ...original, title: 'Newer operation' });
  held.resolve({ state: 'pending', receipt: receipt() });
  await first;
  assert.equal(h.writes.length, 0);
  assert.equal(JSON.parse(h.saved).title, 'Newer operation');
});
test('recovery hash: unmount while checking never writes a stale candidate', async () => {
  const h = harness(),
    held = deferred();
  h.response = () => held.promise;
  const first = h.attach(hash);
  h.bindings.mounted.current = false;
  held.resolve({ state: 'pending', receipt: receipt() });
  await first;
  assert.equal(h.writes.length, 0);
});
test('recovery hash: no locks, another active tab, terminal state and active signing fail closed', async () => {
  for (const mode of ['no-locks', 'held-lock', 'terminal', 'signing']) {
    const h = harness();
    if (mode === 'no-locks') h.bindings.navigator.locks = undefined;
    if (mode === 'held-lock') h.lockHeld = true;
    if (mode === 'terminal') h.bindings.terminal = true;
    if (mode === 'signing') h.bindings.sending = true;
    await h.attach(hash);
    assert.equal(h.rpc, 0, mode);
    assert.equal(h.writes.length, 0, mode);
  }
});
test('recovery hash: no-send acknowledgment cannot clear a record during verification', () => {
  const h = harness();
  h.bindings.active.current = true;
  h.confirmNotSent();
  assert.equal(h.writes.length, 0);
});

test('recovery hash: no-send acknowledgment respects the shared tab lock and durable record', async () => {
  for (const mode of ['unchanged', 'held-lock', 'newer-record', 'unmounted']) {
    const h = harness();
    if (mode === 'held-lock') h.lockHeld = true;
    if (mode === 'newer-record')
      h.saved = JSON.stringify({ ...original, hash });
    if (mode === 'unmounted') h.bindings.mounted.current = false;
    await h.confirmNotSent();
    assert.equal(h.writes.length, mode === 'unchanged' ? 1 : 0, mode);
    if (mode === 'unchanged') assert.equal(h.saved, null);
    if (mode === 'newer-record') assert.equal(JSON.parse(h.saved).hash, hash);
    assert.equal(h.rpc, 0);
  }
});

test('recovery hash: the actual app receipt client accepts the saved public call and rejects conflicting payloads', async () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        '../../evidence/human-wallet/20260913-fourth-identity-reconciled.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const { hash: publicHash, ...record } = fixture.expected;
  const chain = ts.createSourceFile(
    'chain.ts',
    readFileSync(new URL('../../lib/reply/chain.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = chain.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === 'getReceipt',
  );
  assert.ok(declaration);
  const compiled = ts.transpileModule(
    `const actual = ${declaration.getText(chain).replace(/^export\s+/, '')};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  for (const mode of [
    'exact',
    'wrong-sender',
    'conflicting-hash',
    'nonzero-value',
    'missing-call',
    'leader-only',
    'missing-receipt',
  ]) {
    const h = harness(record);
    let raw = structuredClone(fixture.receipt);
    if (mode === 'wrong-sender') raw.from_address = '0x' + 'e'.repeat(40);
    if (mode === 'conflicting-hash') raw.hash = wrongHash;
    if (mode === 'nonzero-value') raw.value = 1;
    if (mode === 'missing-call') delete raw.data.calldata;
    if (mode === 'leader-only') raw.leader_only = true;
    if (mode === 'missing-receipt') raw = null;
    const actual = runInNewContext(
      `(() => { ${compiled}; return actual; })()`,
      {
        contractAddress: record.contract,
        CHAIN_ID,
        isHash,
        receiptState,
        verifyReceiptCall,
        fail: (message) => {
          throw Error(message);
        },
        client: async () => ({
          request: async (request) => {
            assert.equal(request.method, 'eth_getTransactionByHash');
            assert.equal(request.params[0], publicHash);
            return raw;
          },
        }),
      },
    );
    h.response = (candidate) => actual(candidate);
    await h.attach(publicHash);
    assert.equal(h.writes.length, mode === 'exact' ? 1 : 0, mode);
    assert.deepEqual(
      JSON.parse(h.saved),
      mode === 'exact' ? { ...record, hash: publicHash } : record,
      mode,
    );
  }
});

test('recovery hash: the nonterminal UI exposes a labeled correction without sending a new action', () => {
  const ui = readFileSync(
    new URL('../../components/reply/reply-app.tsx', import.meta.url),
    'utf8',
  );
  const start = ui.indexOf('<summary>Wrong hash?</summary>');
  assert.ok(start > 0);
  const correction = ui.slice(start, ui.indexOf('</details>', start));
  assert.ok(
    correction.includes(
      'label="Correct transaction hash from wallet Activity"',
    ),
  );
  assert.ok(correction.includes('disabled={chain.checking || chain.sending}'));
  assert.ok(correction.includes('void chain.attachHash(recoveryHash.trim())'));
  assert.ok(!correction.includes('chain.send('));
});
