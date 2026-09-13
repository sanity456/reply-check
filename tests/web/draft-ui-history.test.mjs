import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import {
  DRAFT_UI_PATH,
  DRAFT_UI_SHA256,
  readPreDraftUi,
  verifyDraftUiPins,
} from '../../evidence/verify-draft-ui-pins.mjs';

const root = new URL('../../', import.meta.url);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('draft UI evidence: strict default rejects the old app pin; explicit scope preserves exact historical bytes', async () => {
  await assert.rejects(
    verifyDraftUiPins(root, { [DRAFT_UI_PATH]: DRAFT_UI_SHA256 }),
  );
  assert.equal(sha(await readPreDraftUi(root)), DRAFT_UI_SHA256);
  const scope = await verifyDraftUiPins(
    root,
    { [DRAFT_UI_PATH]: DRAFT_UI_SHA256 },
    { historicalDraftUi: true },
  );
  assert.equal(scope.historical_ui_pins, 1);
  assert.equal(scope.current_pins, 0);
});

test('draft UI evidence: opt-in cannot accept arbitrary UI hashes, other stale source or escaping paths', async () => {
  for (const path of [
    DRAFT_UI_PATH,
    'hooks/use-reply-chain.ts',
    'lib/reply/core.ts',
    'contracts/reply_check.py',
    'package-lock.json',
    '../outside.json',
  ])
    await assert.rejects(
      verifyDraftUiPins(
        root,
        { [path]: '0'.repeat(64) },
        { historicalDraftUi: true },
      ),
    );
});

test('draft UI evidence: current app source remains verifiable without historical scope', async () => {
  const current = sha(await readFile(new URL(DRAFT_UI_PATH, root)));
  assert.notEqual(current, DRAFT_UI_SHA256);
  const scope = await verifyDraftUiPins(root, { [DRAFT_UI_PATH]: current });
  assert.equal(scope.current_pins, 1);
});

test('draft UI change: submission, stage, lookup and busy/identity guards are unchanged', async () => {
  const before = ts.createSourceFile(
    'before.tsx',
    (await readPreDraftUi(root)).toString(),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const after = ts.createSourceFile(
    'after.tsx',
    (await readFile(new URL(DRAFT_UI_PATH, root))).toString(),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function expression(tree, name) {
    let result;
    function visit(node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name)
        result = node.initializer?.getText(tree);
      ts.forEachChild(node, visit);
    }
    visit(tree);
    assert.ok(result, name);
    return result;
  }
  for (const name of [
    'problem',
    'stage',
    'checkDraft',
    'busy',
    'ready',
    'writable',
    'selectWorkspace',
    'openReview',
  ])
    assert.equal(expression(after, name), expression(before, name), name);
});
