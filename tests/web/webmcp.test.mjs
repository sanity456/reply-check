import test from 'node:test';
import assert from 'node:assert/strict';
import { registerReplyTools } from '../../lib/reply/webmcp.ts';
test('WebMCP registration uses only read and stage actions; no wallet execution', async () => {
  const tools = [],
    controller = new AbortController();
  let state = {
    workspaceId: null,
    referenceVersion: null,
    role: 'visitor',
    liveEnabled: false,
    question: '',
    draft: '',
  };
  await registerReplyTools(
    {
      registerTool(tool, options) {
        tools.push(tool);
        assert.equal(options.signal, controller.signal);
      },
    },
    () => state,
    (question, draft) => {
      state = { ...state, question, draft };
    },
    controller.signal,
  );
  assert.deepEqual(
    tools.map((t) => t.name),
    ['replycheck_read_context', 'replycheck_stage_draft'],
  );
  assert.equal(tools[0].annotations.readOnlyHint, true);
  assert.equal(tools[1].annotations.readOnlyHint, false);
  assert.equal(tools[0].execute({}).hasDraft, false);
  assert.deepEqual(
    tools[1].execute({
      question: 'Refund timing?',
      draft: 'The reference says seven days.',
    }).transactionSubmitted,
    false,
  );
  assert.equal(state.draft, 'The reference says seven days.');
  assert.equal(tools[0].execute({}).hasDraft, true);
  assert.equal('draft' in tools[0].execute({}), false);
  assert.throws(
    () => tools[1].execute({ question: 'q', draft: 'changed' }),
    /already exists/,
  );
  assert.throws(
    () => tools[1].execute({ question: 'q', draft: 'x', send: true }),
    /Invalid/,
  );
  assert.throws(
    () =>
      tools[1].execute({
        question: 'q',
        draft: 'Email me@example.org',
        replaceExisting: true,
      }),
    /Remove email/,
  );
  assert.throws(() => tools[0].execute({ extra: true }));
  tools[1].execute({
    question: 'q',
    draft: 'Rewritten.',
    replaceExisting: true,
  });
  assert.equal(state.draft, 'Rewritten.');
});
