import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptState, verifyReceiptCall } from '../../lib/reply/receipt.ts';
import { digest } from '../../lib/reply/core.ts';
import { abi } from 'genlayer-js';
import {
  recoveryFor,
  parseRecovery,
  rejected,
} from '../../lib/reply/journal.ts';
import {
  walletState,
  connectWallet,
  switchNetwork,
  configured,
  deployment,
  isConfiguredDeployment,
} from '../../lib/reply/chain.ts';
const account = '0x' + 'a'.repeat(40),
  contract = '0x' + 'b'.repeat(40),
  hash = '0x' + 'c'.repeat(64);
const pending = { account, contract, hash };
const tx = {
  hash,
  from_address: account,
  to_address: contract,
  status: 'FINALIZED',
  txExecutionResultName: 'FINISHED_WITH_RETURN',
};
test('finalization and execution are separate', () => {
  assert.equal(receiptState(tx, pending).state, 'success');
  assert.equal(
    receiptState({ ...tx, status: 'ACCEPTED' }, pending).state,
    'pending',
  );
  assert.equal(
    receiptState({ ...tx, txExecutionResultName: undefined }, pending).state,
    'unknown',
  );
  assert.equal(
    receiptState(
      { ...tx, txExecutionResultName: 'FINISHED_WITH_ERROR' },
      pending,
    ).state,
    'failed',
  );
});
for (const status of [
  'PENDING',
  'ACCEPTED',
  'UNDETERMINED',
  'READY_TO_FINALIZE',
  'LEADER_TIMEOUT',
  'VALIDATORS_TIMEOUT',
])
  test(`${status} never means success`, () =>
    assert.equal(receiptState({ ...tx, status }, pending).state, 'pending'));
for (const field of ['hash', 'from_address', 'to_address'])
  test(`receipt binds ${field}`, () =>
    assert.equal(
      receiptState(
        { ...tx, [field]: '0x' + 'd'.repeat(field === 'hash' ? 64 : 40) },
        pending,
      ).state,
      'unknown',
    ));
test('numeric chain receipts require a proven successful return', () => {
  assert.equal(
    receiptState(
      {
        txId: hash,
        sender: account,
        recipient: contract,
        status: 7,
        txExecutionResult: 1,
      },
      pending,
    ).state,
    'success',
  );
  assert.equal(
    receiptState({ ...tx, txExecutionResult: 2 }, pending).state,
    'unknown',
  );
});
test('simulator final round requires one explicit final successful leader result', () => {
  const simulator = {
    ...tx,
    txExecutionResultName: undefined,
    consensus_data: {
      final: true,
      leader_receipt: [{ execution_result: 'SUCCESS' }],
    },
  };
  assert.equal(receiptState(simulator, pending).state, 'success');
  assert.equal(
    receiptState(
      {
        ...simulator,
        consensus_data: {
          final: false,
          leader_receipt: [{ execution_result: 'SUCCESS' }],
        },
      },
      pending,
    ).state,
    'unknown',
  );
  assert.equal(
    receiptState(
      {
        ...simulator,
        consensus_data: {
          final: true,
          leader_receipt: [
            { execution_result: 'SUCCESS' },
            { execution_result: 'ERROR' },
          ],
        },
      },
      pending,
    ).state,
    'unknown',
  );
});
test('cancellation is terminal failure, not a review', () =>
  assert.equal(
    receiptState({ ...tx, status: 'CANCELED' }, pending).state,
    'failed',
  ));
test('unrecognized outcome and missing identity fail closed', () => {
  assert.equal(
    receiptState({ ...tx, txExecutionResultName: 'OK' }, pending).state,
    'unknown',
  );
  assert.equal(receiptState({}, pending).state, 'unknown');
});
test('pre-wallet recovery excludes draft calldata and survives missing hash', async () => {
  const op = {
    method: 'submit_review',
    args: ['secret draft'],
    details: ['secret draft'],
    title: 'Check reply',
    workspace: 'team',
    effect: {
      method: 'get_review',
      args: ['team', 'id'],
      fields: { id: 'id' },
    },
  };
  const entry = await recoveryFor(op, account, contract);
  assert.ok(!JSON.stringify(entry).includes('secret draft'));
  assert.equal(
    parseRecovery(JSON.stringify(entry), contract).method,
    'submit_review',
  );
  assert.equal(
    parseRecovery(JSON.stringify({ ...entry, hash }), contract).hash,
    hash,
  );
  assert.equal(
    parseRecovery(JSON.stringify({ ...entry, hash: 'bad' }), contract),
    null,
  );
  assert.equal(parseRecovery(JSON.stringify(entry), account), null);
});
test('recovery cannot silently cross deployments or networks', async () => {
  const entry = {
    ...(await recoveryFor(
      {
        method: 'm',
        title: 't',
        workspace: 'w',
        args: [],
        effect: { method: 'v', args: [], equals: '' },
      },
      account,
      contract,
    )),
    hash,
  };
  assert.equal(
    parseRecovery(JSON.stringify({ ...entry, chainId: 1 }), contract),
    null,
  );
  assert.equal(parseRecovery('{bad', contract), null);
  assert.equal(
    parseRecovery(
      JSON.stringify({ ...entry, effect: { method: 'v', args: [] } }),
      contract,
    ),
    null,
  );
});
test('only explicit wallet rejection resolves an unknown attempt', () => {
  assert.ok(rejected({ code: 4001 }));
  assert.ok(rejected({ cause: { code: 4001 } }));
  assert.equal(rejected(new Error('network timeout')), false);
});
test('wallet state reads do not request authorization', async () => {
  const calls = [];
  const provider = {
    request: async ({ method }) => {
      calls.push(method);
      return method === 'eth_accounts' ? [account] : '0xf22f';
    },
  };
  assert.deepEqual(await walletState(provider), { account, chainId: 61999 });
  assert.deepEqual(calls, ['eth_accounts', 'eth_chainId']);
});
test('wallet connect surfaces rejection without retrying', async () => {
  let calls = 0;
  const provider = {
    request: async () => {
      calls++;
      throw { code: 4001 };
    },
  };
  await assert.rejects(connectWallet(provider));
  assert.equal(calls, 1);
});
test('unknown network is added only after explicit missing-chain response', async () => {
  const calls = [];
  const provider = {
    request: async (req) => {
      calls.push(req);
      if (req.method === 'wallet_switchEthereumChain') throw { code: 4902 };
      if (req.method === 'eth_accounts') return [account];
      if (req.method === 'eth_chainId') return '0xf22f';
    },
  };
  const result = await switchNetwork(provider);
  assert.equal(result.chainId, 61999);
  assert.equal(calls[1].method, 'wallet_addEthereumChain');
  assert.equal(calls[1].params[0].chainId, '0xf22f');
});
test('network rejection is not converted into a network-add prompt', async () => {
  let calls = 0;
  await assert.rejects(
    switchNetwork({
      request: async () => {
        calls++;
        throw { code: 4001 };
      },
    }),
  );
  assert.equal(calls, 1);
});
test('an undeployed manifest cannot enable live operations', () => {
  assert.equal(isConfiguredDeployment({ ...deployment, address: null }), false);
  assert.equal(
    isConfiguredDeployment({
      ...deployment,
      address: contract,
      sourceSha256: 'invalid',
    }),
    false,
  );
  assert.equal(
    isConfiguredDeployment({ ...deployment, address: contract, chainId: 1 }),
    false,
  );
  assert.equal(
    isConfiguredDeployment({ ...deployment, address: contract }),
    true,
  );
  assert.equal(configured, isConfiguredDeployment(deployment));
});
test('conflicting identity and lifecycle aliases fail closed', () => {
  assert.equal(
    receiptState({ ...tx, txId: '0x' + 'd'.repeat(64) }, pending).state,
    'unknown',
  );
  assert.equal(
    receiptState({ ...tx, statusName: 'PENDING' }, pending).state,
    'unknown',
  );
});
test('recovered receipt binds exact calldata with the installed SDK', async () => {
  const args = ['team', 1, 'Question?', 'Seven days.', 'request-1', true],
    method = 'submit_review';
  const callDigest = await digest([method, args]);
  const encoded = abi.calldata.encode(
    abi.calldata.makeCalldataObject(method, args, undefined),
  );
  const simulator = {
    ...tx,
    value: 0,
    data: { calldata: { raw: [...encoded] } },
  };
  assert.equal(
    await verifyReceiptCall(simulator, { method, callDigest }),
    true,
  );
  assert.equal(
    await verifyReceiptCall({ ...simulator, value: 1 }, { method, callDigest }),
    false,
  );
  assert.equal(
    await verifyReceiptCall(simulator, { method: 'different', callDigest }),
    false,
  );
  assert.equal(
    await verifyReceiptCall(simulator, {
      method,
      callDigest: await digest([
        method,
        [...args.slice(0, 4), 'different-id', true],
      ]),
    }),
    false,
  );
  assert.equal(
    await verifyReceiptCall({ ...tx, value: 0 }, { method, callDigest }),
    false,
  );
  const chain = {
    ...tx,
    value: 0,
    txDataDecoded: {
      type: 'call',
      leaderOnly: false,
      callData: abi.calldata.decode(encoded),
    },
  };
  assert.equal(await verifyReceiptCall(chain, { method, callDigest }), true);
  assert.equal(
    await verifyReceiptCall(
      { ...chain, txDataDecoded: { ...chain.txDataDecoded, leaderOnly: true } },
      { method, callDigest },
    ),
    false,
  );
});
