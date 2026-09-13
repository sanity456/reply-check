import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  canonical,
  checkEffect,
  digest,
  draftProblem,
  hasControls,
  isAddress,
  isHash,
  isId,
  normalizeReferences,
  privacyProblem,
  referenceProblem,
  safeAttribution,
  segments,
  utf8,
  canApprove,
  canEdit,
  canReview,
  errorMessage,
} from '../../lib/reply/core.ts';
import { gymProgress, challenges } from '../../lib/reply/gym.ts';
const doc = {
  id: 'faq',
  title: 'Public FAQ',
  body: 'Refund requests must be submitted within 7 days of purchase.',
  url: '',
};

test('UTF-8 limits count bytes, including multibyte text', () => {
  assert.equal(utf8('hello'), 5);
  assert.equal(utf8('🐧'), 4);
  assert.match(draftProblem('Question', '🐧'.repeat(751)), /3,000/);
  assert.equal(draftProblem('Question', '🐧'.repeat(750)), null);
});
test('complete sentence segmentation is deterministic', () => {
  assert.deepEqual(segments(' First. Second!\nThird?  Fourth '), [
    'First.',
    'Second!',
    'Third?',
    'Fourth',
  ]);
  assert.equal(draftProblem('Q', 'A. '.repeat(12)), null);
  assert.match(draftProblem('Q', 'A. '.repeat(13)), /12 sentences/);
});
for (const text of ['', ' '.repeat(10)])
  test(`empty input rejected (${text.length})`, () => {
    assert.ok(draftProblem(text, 'Reply'));
    assert.ok(draftProblem('Question', text));
  });
for (const text of [
  'me@example.org',
  'api_key: xyz',
  'recovery phrase=secret',
  'sk-' + 'a'.repeat(30),
  '0x' + 'a'.repeat(64),
])
  test(`privacy blocks high-confidence pattern ${text.slice(0, 10)}`, () =>
    assert.ok(privacyProblem(text)));
test('privacy guard is conservative, not a promise of anonymization', () => {
  assert.equal(privacyProblem('Seven days.'), null);
  assert.equal(privacyProblem('My name is Ada'), null);
});
test('control characters blocked, whitespace preserved', () => {
  assert.ok(hasControls('a\x00b'));
  assert.ok(hasControls('a\x7fb'));
  assert.equal(hasControls('a\nb\tc\r'), false);
  assert.ok(draftProblem('q', 'a\x01b'));
});
for (const value of ['', '../team', 'a:b', 'a'.repeat(65), 'with space', null])
  test(`invalid identifier ${String(value).slice(0, 15)}`, () =>
    assert.equal(isId(value), false));
test('nonzero wallet addresses and exact transaction hashes', () => {
  assert.ok(isAddress('0x' + 'A'.repeat(40)));
  assert.equal(isAddress('0x' + '0'.repeat(40)), false);
  assert.equal(isAddress('0x' + 'a'.repeat(64)), false);
  assert.ok(isHash('0x' + 'a'.repeat(64)));
  assert.equal(isHash('0xabc'), false);
});
for (const url of [
  'http://example.org',
  'javascript:alert(1)',
  'https://user@example.org/',
  'https://example.org/#secret',
  'https://example.org\\evil',
  'https://example.org/a b',
])
  test(`unsafe attribution ${url}`, () => {
    assert.equal(safeAttribution(url), false);
    assert.ok(referenceProblem([{ ...doc, url }]));
  });
test('public attribution is optional and never fetched', () => {
  assert.ok(safeAttribution(''));
  assert.ok(safeAttribution('https://example.org/faq?lang=en'));
  assert.equal(referenceProblem([doc]), null);
});
test('reference limits, uniqueness and aggregate limit', () => {
  assert.ok(referenceProblem([]));
  assert.ok(referenceProblem([doc, doc]));
  assert.ok(referenceProblem([{ ...doc, body: 'x'.repeat(6001) }]));
  assert.ok(
    referenceProblem(
      [0, 1, 2, 3].map((i) => ({
        ...doc,
        id: 'faq' + i,
        body: 'x'.repeat(6000),
      })),
    ),
  );
});
test('reference normalization binds order and whitespace', () => {
  assert.deepEqual(
    normalizeReferences([
      { ...doc, id: 'z', body: ' a ' },
      { ...doc, id: 'a', title: ' T ' },
    ]).map((d) => [d.id, d.title, d.body]),
    [
      ['a', 'T', doc.body],
      ['z', doc.title, 'a'],
    ],
  );
});
test('canonical SHA-256 is stable and compatible with sorted JSON', async () => {
  const value = { z: '🐧', a: [1, true, 'hello'] };
  const expected = '{"a":[1,true,"hello"],"z":"🐧"}';
  assert.equal(canonical(value), expected);
  assert.equal(
    await digest(value),
    createHash('sha256').update(expected).digest('hex'),
  );
});
test('effect verification requires exact declared fields', () => {
  assert.ok(
    checkEffect(
      { owner: 'alice', other: 1 },
      { method: 'view', args: [], fields: { owner: 'alice' } },
    ),
  );
  assert.equal(
    checkEffect(
      { owner: 'bob' },
      { method: 'view', args: [], fields: { owner: 'alice' } },
    ),
    false,
  );
  assert.equal(checkEffect({}, { method: 'view', args: [] }), false);
  assert.equal(
    checkEffect('1', { method: 'view', args: [], equals: 1 }),
    false,
  );
  assert.ok(checkEffect('', { method: 'view', args: [], equals: '' }));
});
for (const [role, review, edit, approve] of [
  ['visitor', false, false, false],
  ['member', true, false, false],
  ['editor', true, true, false],
  ['reviewer', true, false, true],
  ['owner', true, true, true],
])
  test(`role matrix: ${role}`, () => {
    assert.equal(canReview(role), review);
    assert.equal(canEdit(role), edit);
    assert.equal(canApprove(role), approve);
  });
test('raw RPC messages never leak submitted calldata into UI errors', () => {
  assert.ok(
    !errorMessage(new Error('RPC failed with private calldata')).includes(
      'calldata',
    ),
  );
  assert.match(errorMessage({ code: 4001 }), /declined/);
  assert.match(
    errorMessage(new Error('[EXPECTED] REFERENCE_VERSION_CHANGED')),
    /references changed/,
  );
  assert.match(errorMessage(new Error('insufficient funds')), /Studionet GEN/);
});
test('practice progress only recognizes curated exercises', () => {
  assert.deepEqual(gymProgress('not json'), []);
  assert.deepEqual(
    gymProgress(
      JSON.stringify([challenges[0].id, challenges[0].id, 'admin', 1]),
    ),
    [challenges[0].id],
  );
  assert.equal(new Set(challenges.map((c) => c.id)).size, challenges.length);
  for (const c of challenges)
    assert.ok(c.answer >= 0 && c.answer < c.options.length);
});
test('deployment manifest pins the exact current source bytes', async () => {
  const source = await readFile(
    new URL('../../contracts/reply_check.py', import.meta.url),
  );
  const manifest = JSON.parse(
    await readFile(
      new URL('../../lib/reply/deployment.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    manifest.sourceSha256,
  );
  assert.match(
    source.toString().split('\n')[0],
    /^# \{ "Depends": "py-genlayer:[a-z0-9]{40,}" \}/,
  );
  assert.ok(!source.includes('\r\n'));
});
