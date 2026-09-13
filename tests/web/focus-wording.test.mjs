import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { revealRestoredDialogFocus } from '../../lib/reply/dialog-focus.ts';
import {
  draftSuggestion,
  hasReferenceGap,
  suggestedDraft,
} from '../../lib/reply/suggestions.ts';
import { short } from '../../lib/reply/core.ts';

function focusHarness() {
  const frames = [];
  const scrolls = [];
  const doc = {
    body: {},
    documentElement: { clientWidth: 740, clientHeight: 320 },
    defaultView: { requestAnimationFrame: (callback) => frames.push(callback) },
    activeElement: null,
  };
  const target = {
    ownerDocument: doc,
    isConnected: true,
    closest: () => null,
    matches: () => false,
    getClientRects: () => [{}],
    getBoundingClientRect: () => ({
      top: 328,
      bottom: 371,
      left: 12,
      right: 209,
    }),
    scrollIntoView: (options) => scrolls.push(options),
    focus: () => assert.fail('The helper must never change focus'),
  };
  return {
    target,
    doc,
    scrolls,
    flush: () => frames.splice(0).forEach((f) => f()),
  };
}

test('resize focus: waits for native restoration and reveals the offscreen trigger', () => {
  const h = focusHarness();
  revealRestoredDialogFocus(h.target);
  assert.deepEqual(h.scrolls, []);
  h.doc.activeElement = h.target;
  h.flush();
  assert.deepEqual(h.scrolls, [
    { block: 'nearest', inline: 'nearest', behavior: 'instant' },
  ]);
});

test('resize focus: leaves a fully visible restored trigger untouched', () => {
  const h = focusHarness();
  h.doc.activeElement = h.target;
  h.target.getBoundingClientRect = () => ({
    top: 120,
    bottom: 162,
    left: 12,
    right: 209,
  });
  revealRestoredDialogFocus(h.target);
  h.flush();
  assert.deepEqual(h.scrolls, []);
});

test('resize focus: respects a new dialog or a newer navigation focus', () => {
  const h = focusHarness();
  h.doc.activeElement = h.target;
  revealRestoredDialogFocus(h.target);
  h.doc.activeElement = { name: 'New confirmation or Team tab' };
  h.flush();
  assert.deepEqual(h.scrolls, []);
});

test('resize focus: skips removed, hidden, disabled, inert or dialog-contained targets', () => {
  for (const change of [
    (h) => {
      h.target.isConnected = false;
    },
    (h) => {
      h.target.getClientRects = () => [];
    },
    (h) => {
      h.target.matches = () => true;
    },
    (h) => {
      h.target.closest = () => ({});
    },
    (h) => {
      h.doc.body = h.target;
    },
    (h) => {
      h.doc.documentElement = h.target;
    },
  ]) {
    const h = focusHarness();
    h.doc.activeElement = h.target;
    revealRestoredDialogFocus(h.target);
    change(h);
    h.flush();
    assert.deepEqual(h.scrolls, []);
  }
  assert.doesNotThrow(() => revealRestoredDialogFocus(null));
});

test('resize focus: uses the visible viewport, including mobile keyboard offsets', () => {
  const h = focusHarness();
  h.doc.activeElement = h.target;
  h.doc.defaultView.visualViewport = {
    offsetTop: 100,
    offsetLeft: 10,
    height: 150,
    width: 600,
  };
  h.target.getBoundingClientRect = () => ({
    top: 50,
    bottom: 92,
    left: 12,
    right: 209,
  });
  revealRestoredDialogFocus(h.target);
  h.flush();
  assert.equal(h.scrolls.length, 1);
});

test('resize focus: also reveals horizontal clipping without smooth motion', () => {
  const h = focusHarness();
  h.doc.activeElement = h.target;
  h.target.getBoundingClientRect = () => ({
    top: 50,
    bottom: 92,
    left: -12,
    right: 209,
  });
  revealRestoredDialogFocus(h.target);
  h.flush();
  assert.equal(h.scrolls[0].behavior, 'instant');
});

// Run the actual app callbacks, not a second implementation of the wiring.
const app = ts.createSourceFile(
  'reply-app.tsx',
  readFileSync(
    new URL('../../components/reply/reply-app.tsx', import.meta.url),
    'utf8',
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
function find(predicate, root = app) {
  if (predicate(root)) return root;
  return ts.forEachChild(root, (child) => find(predicate, child));
}
function evaluate(expression, bindings) {
  const code = ts.transpileModule(`const actual = ${expression};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return runInNewContext(`(() => { ${code}; return actual; })()`, bindings);
}
test('resize focus: real answer-card callbacks capture the trigger and wait for closed completion', () => {
  const approve = find(
    (n) => ts.isVariableDeclaration(n) && n.name.getText(app) === 'approve',
  );
  const trigger = {};
  const cardReturnFocus = { current: null };
  const bindings = {
    document: { activeElement: trigger },
    cardReturnFocus,
    setCardReview() {},
    setCardTitle() {},
  };
  evaluate(approve.initializer.getText(app), bindings)({ question: 'Test' });
  assert.equal(cardReturnFocus.current, trigger);
  const root = find(
    (n) =>
      ts.isJsxOpeningElement(n) &&
      n.tagName.getText(app) === 'Dialog' &&
      n.attributes.properties.some(
        (p) =>
          p.name?.getText(app) === 'open' &&
          p.initializer?.getText(app) === '{!!cardReview}',
      ),
  );
  const callback = root.attributes.properties.find(
    (p) => p.name?.getText(app) === 'onOpenChangeComplete',
  );
  const calls = [];
  const complete = evaluate(callback.initializer.expression.getText(app), {
    cardReturnFocus,
    revealRestoredDialogFocus: (target) => calls.push(target),
  });
  complete(true);
  assert.deepEqual(calls, []);
  complete(false);
  assert.deepEqual(calls, [trigger]);
});

const mixed = JSON.parse(
  readFileSync(
    new URL(
      '../../evidence/human-wallet/20260910-105817-mixed-reply.json',
      import.meta.url,
    ),
    'utf8',
  ),
).stored_review;
const original = JSON.stringify(mixed);
const gap = mixed.assessment.findings[1];
const limitation =
  'The references do not confirm this claim: “Refunds are guaranteed to be instant.”';

test('wording: actual mixed-claim fixture gets an explicit local reference limitation', () => {
  assert.equal(gap.suggestion, 'Refund processing time may vary.');
  assert.equal(draftSuggestion(gap), limitation);
  assert.equal(
    suggestedDraft(mixed.assessment.findings),
    `${mixed.assessment.findings[0].text} ${limitation}`,
  );
  assert.equal(JSON.stringify(mixed), original);
});

test('wording: supported, neutral and contradicted findings preserve their exact suggestions', () => {
  for (const verdict of ['SUPPORTED', 'NEUTRAL', 'CONTRADICTED']) {
    const finding = {
      ...gap,
      verdict,
      suggestion: 'Exact recorded correction.',
    };
    assert.equal(hasReferenceGap(finding), false);
    assert.equal(draftSuggestion(finding), finding.suggestion);
  }
  assert.equal(
    draftSuggestion({ ...gap, reason_code: 'OTHER_REASON' }),
    gap.suggestion,
  );
});

test('wording: reference gaps without a model suggestion still have an honest draft, unrelated blank suggestions do not', () => {
  assert.equal(draftSuggestion({ ...gap, suggestion: '' }), limitation);
  assert.equal(suggestedDraft([mixed.assessment.findings[0]]), '');
  assert.equal(suggestedDraft([]), '');
});

test('wording: the limitation works for other topics and never invents a replacement policy', () => {
  const finding = { ...gap, text: 'Delivery is guaranteed tomorrow.' };
  assert.equal(
    draftSuggestion(finding),
    'The references do not confirm this claim: “Delivery is guaranteed tomorrow.”',
  );
  assert.doesNotMatch(draftSuggestion(finding), /refund|vary|usually/);
});

const require = createRequire(import.meta.url);
const exports = {};
const copies = [];
const downloads = [];
const buttons = [];
const source = readFileSync(
  new URL('../../components/reply/review-result.tsx', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
runInNewContext(compiled, {
  exports,
  require(name) {
    if (name === '@/lib/reply/suggestions')
      return { draftSuggestion, hasReferenceGap, suggestedDraft };
    if (name === '@/lib/reply/core') return { short };
    if (name === '@/components/ui/button')
      return {
        Button(props) {
          buttons.push(props);
          return createElement(
            'button',
            { onClick: props.onClick },
            props.children,
          );
        },
      };
    if (name === './common')
      return {
        CopyButton: (props) => {
          copies.push(props);
          return null;
        },
        DownloadButton: (props) => {
          downloads.push(props);
          return null;
        },
        Timestamp: ({ value }) => createElement('time', null, value),
      };
    return require(name);
  },
});

test('wording: real component separates local rewrite, original suggestion and immutable export', () => {
  const applied = [];
  const bundle = { documents: [] };
  copies.length = downloads.length = buttons.length = 0;
  const html = renderToStaticMarkup(
    createElement(exports.ReviewResult, {
      review: mixed,
      bundle,
      currentVersion: 2,
      apply: (draft) => applied.push(draft),
    }),
  );
  assert.match(html, /LOCAL REWRITE.*RECHECK BEFORE USE/);
  assert.match(html, /The references do not confirm this claim/);
  assert.match(
    html,
    /<details><summary>Original recorded suggestion<\/summary><p>Refund processing time may vary\.<\/p><\/details>/,
  );
  assert.match(html, /Older reference version/);
  assert.equal(
    copies.find((p) => p.label === 'Copy reviewed reply').value,
    mixed.draft,
  );
  assert.equal(downloads[0].value.review, mixed);
  assert.equal(downloads[0].value.reference_bundle, bundle);
  assert.equal(
    JSON.stringify(downloads[0].value),
    JSON.stringify({ review: mixed, reference_bundle: bundle }),
  );
  assert.equal(JSON.stringify(mixed), original);
  buttons
    .find(
      (p) =>
        Array.isArray(p.children) &&
        p.children[0].startsWith('Apply suggestions'),
    )
    .onClick();
  assert.deepEqual(applied, [suggestedDraft(mixed.assessment.findings)]);
});

test('wording: reference-gap original text is escaped, not interpreted as UI markup', () => {
  const review = {
    ...mixed,
    assessment: {
      ...mixed.assessment,
      findings: [{ ...gap, text: '<img src=x onerror=alert(1)>' }],
    },
  };
  const html = renderToStaticMarkup(
    createElement(exports.ReviewResult, { review, currentVersion: 1 }),
  );
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img/);
});
