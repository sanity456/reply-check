import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../fixtures/studionet/deploy-186cc40d.json' with { type: 'json' };
import disagreement from '../fixtures/studionet/disagreement-0054dc85.json' with { type: 'json' };
import validLeaderDisagreement from '../fixtures/studionet/disagreement-0f40b07c.json' with { type: 'json' };
import { receiptState, verifyReceiptCall } from '../../lib/reply/receipt.ts';

const pending = {
  hash: fixture.hash,
  account: fixture.from_address,
  contract: fixture.to_address,
};
const failedPending = {
  hash: disagreement.hash,
  account: disagreement.from_address,
  contract: disagreement.to_address,
};
test('finalized consensus disagreement is a recoverable terminal failure', () => {
  assert.equal(receiptState(disagreement, failedPending).state, 'failed');
  assert.equal(
    receiptState({ ...disagreement, status: 'UNDETERMINED' }, failedPending)
      .state,
    'pending',
  );
});
test('a successful leader cannot override finalized validator disagreement', () => {
  assert.equal(
    validLeaderDisagreement.consensus_data.leader_receipt.find(
      (r) => r.mode === 'leader',
    ).execution_result,
    'SUCCESS',
  );
  assert.equal(
    receiptState(validLeaderDisagreement, {
      hash: validLeaderDisagreement.hash,
      account: validLeaderDisagreement.from_address,
      contract: validLeaderDisagreement.to_address,
    }).state,
    'failed',
  );
});
test('disagreement failure requires matching finalized round evidence', () => {
  const tx = structuredClone(disagreement);
  tx.last_round.result = 6;
  assert.equal(receiptState(tx, failedPending).state, 'unknown');
  assert.equal(
    receiptState(
      { ...disagreement, txExecutionResultName: 'FINISHED_WITH_RETURN' },
      failedPending,
    ).state,
    'unknown',
  );
});
test('observed Studionet final round proves success despite an idle validator record', () => {
  assert.equal(receiptState(fixture, pending).state, 'success');
  assert.equal(fixture.consensus_data.leader_receipt.length, 2);
  assert.equal(
    fixture.consensus_data.leader_receipt[1].execution_result,
    'ERROR',
  );
});
for (const [name, mutate] of [
  [
    'missing final history',
    (tx) => {
      delete tx.consensus_history;
    },
  ],
  [
    'unfinalized history',
    (tx) => {
      tx.consensus_history.current_status_changes = ['ACCEPTED'];
    },
  ],
  [
    'later unresolved round',
    (tx) => {
      tx.consensus_history.consensus_results.push({
        consensus_round: 'Undetermined',
      });
    },
  ],
  [
    'different last leader',
    (tx) => {
      tx.last_leader = '0x' + 'd'.repeat(40);
    },
  ],
  [
    'conflicting round result',
    (tx) => {
      tx.last_round.result = 999;
    },
  ],
  [
    'duplicate actual leader',
    (tx) => {
      tx.consensus_data.leader_receipt.push(
        tx.consensus_data.leader_receipt[0],
      );
    },
  ],
  [
    'conflicting history execution',
    (tx) => {
      tx.consensus_history.consensus_results[0].leader_result[0].execution_result =
        'ERROR';
    },
  ],
  [
    'conflicting result bytes',
    (tx) => {
      tx.consensus_history.consensus_results[0].leader_result[0].result =
        'different';
    },
  ],
  [
    'wrong transaction alias',
    (tx) => {
      tx.tx_id = '0x' + 'd'.repeat(64);
    },
  ],
  [
    'contradicting explicit final flag',
    (tx) => {
      tx.consensus_data.final = false;
    },
  ],
  [
    'return bytes labeled as execution error',
    (tx) => {
      tx.consensus_data.leader_receipt[0].execution_result = 'ERROR';
      tx.consensus_history.consensus_results[0].leader_result[0].execution_result =
        'ERROR';
    },
  ],
])
  test('Studionet fails closed on ' + name, () => {
    const tx = structuredClone(fixture);
    mutate(tx);
    assert.equal(receiptState(tx, pending).state, 'unknown');
  });
test('a finalized accepted execution error is failure, not success', () => {
  const tx = structuredClone(fixture);
  tx.consensus_data.leader_receipt[0].execution_result = 'ERROR';
  tx.consensus_history.consensus_results[0].leader_result[0].execution_result =
    'ERROR';
  tx.consensus_data.leader_receipt[0].result =
    'AVtFWFBFQ1RFRF0gUk9MRV9SRVFVSVJFRA==';
  tx.consensus_history.consensus_results[0].leader_result[0].result =
    'AVtFWFBFQ1RFRF0gUk9MRV9SRVFVSVJFRA==';
  assert.equal(receiptState(tx, pending).state, 'failed');
});
test('unverified or nonzero Studio value is never repaired by assuming zero', async () => {
  for (const value of [undefined, null, 1, '1']) {
    assert.equal(
      await verifyReceiptCall(
        { ...fixture, value },
        { method: 'deploy', callDigest: 'unused' },
      ),
      false,
    );
  }
});
