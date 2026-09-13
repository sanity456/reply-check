import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { isId, utf8 } from '../../lib/reply/core.ts';

// Execute the actual component handlers, with deferred read-only RPCs and React
// setter spies. This tests both resolution orders without a network or wallet.
const source = ts.createSourceFile(
  'reply-app.tsx',
  readFileSync(
    new URL('../../components/reply/reply-app.tsx', import.meta.url),
    'utf8',
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
function find(predicate, root = source) {
  if (predicate(root)) return root;
  return ts.forEachChild(root, (child) => find(predicate, child));
}
function initializer(name) {
  const node = find(
    (item) =>
      ts.isVariableDeclaration(item) && item.name.getText(source) === name,
  );
  assert.ok(node?.initializer, name);
  return node.initializer.getText(source);
}
function evaluate(expression, bindings) {
  const code = ts.transpileModule(`const actual = ${expression};`, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  return runInNewContext(`(() => { ${code}\nreturn actual; })()`, bindings);
}
const workspace = 'test-workspace';
const firstId = 'a'.repeat(64);
const secondId = 'b'.repeat(64);
const firstReview = { id: firstId, version: 1 };
const secondReview = { id: secondId, version: 2 };
const refs = { version: 1 };
const flush = () => new Promise((resolve) => setImmediate(resolve));
function harness() {
  const state = {
    tab: 'library',
    reviewLoading: false,
    reviewError: 'Previous read failed',
    historyResult: { id: 'previous' },
    historyBundle: { version: 0 },
    reviewId: '',
    walletError: 'Keep the pending transaction hash',
  };
  const requests = [];
  const bindings = {
    workspace: { id: workspace },
    workspaceRef: { current: workspace },
    reviewRequestRevision: { current: 0 },
    isId,
    read(method, args) {
      return new Promise((resolve, reject) =>
        requests.push({ method, args, resolve, reject }),
      );
    },
    chain: {
      setError: (value) => {
        state.walletError = value;
      },
    },
  };
  for (const key of [
    'tab',
    'reviewLoading',
    'reviewError',
    'historyResult',
    'historyBundle',
    'reviewId',
  ])
    bindings[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value) => {
      state[key] = value;
    };
  return {
    state,
    requests,
    bindings,
    open: evaluate(initializer('openReview'), bindings),
  };
}
async function resolveReview(h, request, review, bundle = refs) {
  request.resolve(review);
  await flush();
  const next = h.requests.at(-1);
  assert.equal(next.method, 'get_references');
  assert.deepEqual(Array.from(next.args), [workspace, review.version]);
  next.resolve(bundle);
}

test('UI-02: lookup navigates immediately and preserves newer tab navigation', async () => {
  const h = harness();
  const pending = h.open(firstId);
  assert.equal(h.state.tab, 'history');
  assert.equal(h.state.reviewLoading, true);
  assert.equal(h.state.reviewError, '');
  assert.equal(h.state.historyResult, null);
  assert.equal(h.state.historyBundle, null);
  h.state.tab = 'team';
  await resolveReview(h, h.requests[0], firstReview);
  await pending;
  assert.equal(h.state.tab, 'team');
  assert.equal(h.state.historyResult, firstReview);
  assert.equal(h.state.historyBundle, refs);
  assert.equal(h.state.reviewId, firstId);
  assert.equal(h.state.reviewLoading, false);
});

test('UI-02: an older first read cannot fetch references or end a newer loading state', async () => {
  const h = harness();
  const older = h.open(firstId);
  const newer = h.open(secondId);
  h.requests[0].resolve(firstReview);
  await older;
  assert.equal(h.requests.length, 2);
  assert.equal(h.state.reviewLoading, true);
  await resolveReview(h, h.requests[1], secondReview, { version: 2 });
  await newer;
  assert.equal(h.state.historyResult, secondReview);
  assert.equal(h.state.historyBundle.version, 2);
});

test('UI-02: an older reference response cannot overwrite a newer completed review', async () => {
  const h = harness();
  const older = h.open(firstId);
  h.requests[0].resolve(firstReview);
  await flush();
  const oldReferences = h.requests[1];
  const newer = h.open(secondId);
  await resolveReview(h, h.requests[2], secondReview, { version: 2 });
  await newer;
  oldReferences.resolve(refs);
  await older;
  assert.equal(h.state.historyResult, secondReview);
  assert.equal(h.state.historyBundle.version, 2);
  assert.equal(h.state.reviewId, secondId);
});

test('UI-03: failed reads use safe read-specific feedback and retry clears it', async () => {
  const h = harness();
  const failed = h.open(firstId);
  h.requests[0].reject(
    new Error('SECRET RPC response, transaction hash, raw payload'),
  );
  await failed;
  assert.match(h.state.reviewError, /Could not load this review/);
  assert.match(h.state.reviewError, /Check the ID and your connection/);
  assert.doesNotMatch(h.state.reviewError, /SECRET|transaction|payload/);
  assert.equal(h.state.reviewLoading, false);
  assert.equal(h.state.historyResult, null);
  const retry = h.open(secondId);
  assert.equal(h.state.reviewError, '');
  await resolveReview(h, h.requests[1], secondReview);
  await retry;
  assert.equal(h.state.reviewError, '');
  assert.equal(h.state.walletError, 'Keep the pending transaction hash');
});

test('UI-03: late failures never replace a newer result or its read error', async () => {
  const h = harness();
  const older = h.open(firstId);
  const newer = h.open(secondId);
  await resolveReview(h, h.requests[1], secondReview);
  await newer;
  h.requests[0].reject(new Error('Old failed lookup'));
  await older;
  assert.equal(h.state.historyResult, secondReview);
  assert.equal(h.state.reviewError, '');
  assert.equal(h.state.reviewLoading, false);
});

test('UI-02/03: workspace changes invalidate reads even after leaving and returning', async () => {
  const h = harness();
  Object.assign(h.bindings, {
    window: {
      location: { href: 'http://localhost/' },
      history: { replaceState() {} },
    },
    URL,
    setOperation() {},
    setOperationAccount() {},
    setWorkspace() {},
    setBundle() {},
    setRole() {},
    setReviews() {},
    setCards() {},
    setResult() {},
    setWorkspaceId: (id) => {
      h.bindings.workspace = { id };
    },
    setChooser() {},
  });
  const select = evaluate(initializer('selectWorkspace'), h.bindings);
  const pending = h.open(firstId);
  select('another-workspace');
  select(workspace);
  assert.equal(h.state.reviewLoading, false);
  assert.equal(h.state.reviewError, '');
  assert.equal(h.state.historyResult, null);
  assert.equal(h.state.historyBundle, null);
  assert.equal(h.state.reviewId, '');
  h.requests[0].reject(new Error('Old workspace failure'));
  await pending;
  assert.equal(h.state.tab, 'check');
  assert.equal(h.state.reviewError, '');
});

test('invalid IDs and stale workspace state do not start a lookup', async () => {
  const h = harness();
  await h.open('');
  await h.open('invalid space');
  h.bindings.workspaceRef.current = 'another-workspace';
  await h.open(firstId);
  assert.equal(h.requests.length, 0);
  assert.equal(h.state.tab, 'library');
});

function mountReviewLink(h) {
  Object.assign(h.bindings, {
    configured: true,
    URLSearchParams,
    window: {
      location: { search: `?workspace=${workspace}&review=${firstId}` },
    },
    verifyDeployment: () => Promise.resolve(),
    setWorkspaceId() {},
    invalidateReviewReads: () => {
      h.bindings.reviewRequestRevision.current++;
    },
  });
  const effect = find(
    (node) =>
      ts.isCallExpression(node) &&
      node.expression.getText(source) === 'useEffect' &&
      node.arguments[0]?.getText(source).includes('new URLSearchParams'),
  );
  assert.ok(effect);
  return evaluate(effect.arguments[0].getText(source), h.bindings)();
}

test('UI-02: opening a direct review link also respects newer navigation', async () => {
  const h = harness();
  const cleanup = mountReviewLink(h);
  await flush();
  assert.equal(h.state.tab, 'history');
  h.state.tab = 'team';
  assert.equal(h.requests[0].method, 'get_workspace');
  h.requests[0].resolve({ id: workspace });
  await flush();
  await resolveReview(h, h.requests[1], firstReview);
  await flush();
  assert.equal(h.state.tab, 'team');
  assert.equal(h.state.historyResult, firstReview);
  cleanup();
});

test('UI-03: a failed direct-link lookup is cleared by a successful manual retry', async () => {
  const h = harness();
  const cleanup = mountReviewLink(h);
  await flush();
  h.requests[0].resolve({ id: workspace });
  await flush();
  h.requests[1].reject(new Error('Private raw RPC data'));
  await flush();
  assert.match(h.state.reviewError, /Could not load this review/);
  const retry = h.open(secondId);
  assert.equal(h.state.reviewError, '');
  await resolveReview(h, h.requests[2], secondReview);
  await retry;
  assert.equal(h.state.reviewError, '');
  assert.equal(h.state.walletError, 'Keep the pending transaction hash');
  cleanup();
});

test('UI-02/03: unmount invalidates a pending reference read without changing UI state', async () => {
  const h = harness();
  const cleanup = mountReviewLink(h);
  await flush();
  h.requests[0].resolve({ id: workspace });
  await flush();
  const manual = h.open(secondId);
  h.requests[2].resolve(secondReview);
  await flush();
  cleanup();
  const previous = { ...h.state };
  h.requests[3].reject(new Error('Unmounted read'));
  h.requests[1].reject(new Error('Unmounted initial link'));
  await manual;
  await flush();
  assert.deepEqual(h.state, previous);
});

function opening(node) {
  return ts.isJsxElement(node) ? node.openingElement : node;
}
function element(tag, predicate = () => true) {
  return find(
    (node) =>
      (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) &&
      opening(node).tagName.getText(source) === tag &&
      predicate(node),
  );
}
function attribute(node, name) {
  return opening(node).attributes.properties.find(
    (prop) => ts.isJsxAttribute(prop) && prop.name.getText(source) === name,
  )?.initializer;
}
function expression(node, name) {
  const value = attribute(node, name);
  assert.ok(value && ts.isJsxExpression(value));
  return value.expression.getText(source);
}

test('UI-04: byte boundaries, including multibyte text, gate the actual publication button', () => {
  const button = element('Button', (node) =>
    node.getText(source).includes('Review publication'),
  );
  for (const [title, expectedBytes, disabled] of [
    ['', 0, true],
    ['   ', 0, true],
    ['a'.repeat(100), 100, false],
    ['a'.repeat(101), 101, true],
    ['é'.repeat(50), 100, false],
    ['é'.repeat(51), 102, true],
    ['🐧'.repeat(25), 100, false],
    ['🐧'.repeat(25) + 'a', 101, true],
    ['  ' + 'a'.repeat(100) + ' ', 100, false],
  ]) {
    const bindings = {
      cardTitle: title,
      utf8,
      writable: true,
      canApprove: () => true,
      role: 'owner',
    };
    bindings.cardTitleBytes = evaluate(initializer('cardTitleBytes'), bindings);
    bindings.cardTitleTooLong = evaluate(
      initializer('cardTitleTooLong'),
      bindings,
    );
    assert.equal(bindings.cardTitleBytes, expectedBytes);
    assert.equal(evaluate(expression(button, 'disabled'), bindings), disabled);
  }
});

test('UI-04: title feedback is field-associated, live and explains how to continue', () => {
  const field = element(
    'Field',
    (node) => attribute(node, 'id')?.text === 'card-title',
  );
  assert.equal(attribute(field, 'aria-describedby')?.text, 'card-title-help');
  assert.equal(expression(field, 'aria-invalid'), 'cardTitleTooLong');
  const help = element(
    'p',
    (node) => attribute(node, 'id')?.text === 'card-title-help',
  );
  assert.equal(attribute(help, 'aria-live')?.text, 'polite');
  const content = find(ts.isJsxExpression, help).expression.getText(source);
  assert.match(
    evaluate(content, { cardTitleBytes: 101, cardTitleTooLong: true }),
    /101 \/ 100 bytes.*Shorten it/,
  );
  assert.match(
    evaluate(content, { cardTitleBytes: 100, cardTitleTooLong: false }),
    /100 \/ 100 bytes/,
  );
});

test('UI-01: the shared popup is bounded by dynamic viewport height and scrolls', () => {
  const css = readFileSync(
    new URL('../../app/reply.css', import.meta.url),
    'utf8',
  );
  const popup = css.match(/\[data-slot='dialog-content'\]\s*\{([^}]+)\}/)?.[1];
  assert.ok(popup);
  assert.match(popup, /max-height:\s*calc\(100dvh - 32px\)/);
  assert.match(popup, /overflow-y:\s*auto/);
});
