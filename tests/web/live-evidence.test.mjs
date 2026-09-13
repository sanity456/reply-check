import test from 'node:test';
import assert from 'node:assert/strict';
import {
  publicReceipt,
  requireLiveApproval,
  renameEvidence,
} from '../../scripts/live-studionet.mjs';

test('evidence rename retries transient Windows locks without repeating a transaction', async () => {
  let calls = 0;
  await renameEvidence(
    'public.tmp',
    'public.json',
    async (from, to) => {
      assert.equal(from, 'public.tmp');
      assert.equal(to, 'public.json');
      if (++calls < 3)
        throw Object.assign(new Error('locked'), { code: 'EPERM' });
    },
    async () => {},
  );
  assert.equal(calls, 3);
});

test('evidence rename failures remain bounded and propagate', async () => {
  let calls = 0;
  await assert.rejects(
    renameEvidence(
      'from',
      'to',
      async () => {
        calls += 1;
        throw Object.assign(new Error('locked'), { code: 'EPERM' });
      },
      async () => {},
    ),
  );
  assert.equal(calls, 8);
  await assert.rejects(
    renameEvidence(
      'from',
      'to',
      async () => {
        throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      },
      async () => assert.fail('Do not retry nontransient errors'),
    ),
  );
});

test('live harness is opt-in and rejects malformed reuse addresses', () => {
  assert.throws(() => requireLiveApproval({}));
  assert.throws(() => requireLiveApproval({ REPLYCHECK_RUN_LIVE: '0' }));
  assert.throws(() =>
    requireLiveApproval({
      REPLYCHECK_RUN_LIVE: '1',
      REPLYCHECK_CONTRACT: 'bad',
    }),
  );
  assert.doesNotThrow(() => requireLiveApproval({ REPLYCHECK_RUN_LIVE: '1' }));
});

test('live evidence excludes credentials, signed transactions and provider configuration', () => {
  const tx = {
    hash: 'public-hash',
    secretKey: 'NEVER_COPY',
    rawTransaction: 'NEVER_COPY',
    node_config: { api_key: 'NEVER_COPY' },
    data: { calldata: 'public-input', secret: 'NEVER_COPY' },
    consensus_data: {
      final: true,
      votes: { validator: 'agree' },
      leader_receipt: [
        {
          execution_result: 'SUCCESS',
          result: 'public-output',
          node_config: { api_key: 'NEVER_COPY' },
          genvm_result: {
            stdout:
              'NEVER_COPY\nREPLYCHECK_VALIDATION: AUDIT_REJECTED\nREPLYCHECK_VALIDATION: untrusted-text',
            stderr: 'NEVER_COPY',
          },
        },
      ],
    },
  };
  const output = JSON.stringify(publicReceipt(tx));
  assert.ok(output.includes('public-hash'));
  assert.ok(output.includes('public-input'));
  assert.ok(output.includes('public-output'));
  assert.equal(output.includes('NEVER_COPY'), false);
  assert.ok(output.includes('REPLYCHECK_VALIDATION: AUDIT_REJECTED'));
  assert.equal(output.includes('untrusted-text'), false);
});
