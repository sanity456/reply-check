import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';
import {
  canReview,
  draftProblem,
  segments,
  utf8,
} from '../../lib/reply/core.ts';
import { draftFieldProblem } from '../../lib/reply/draft-feedback.ts';

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
    (n) => ts.isVariableDeclaration(n) && n.name.getText(source) === name,
  );
  assert.ok(node?.initializer, name);
  return node.initializer.getText(source);
}
const section = find(
  (n) =>
    ts.isJsxElement(n) &&
    n.openingElement.getText(source).includes('className="panel editor-panel"'),
);
assert.ok(section);
function evaluate(expression, bindings) {
  const { outputText } = ts.transpileModule(`const actual = ${expression};`, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
    },
  });
  return runInNewContext(`(() => { ${outputText}; return actual; })()`, {
    exports: {},
    require: (name) => {
      assert.equal(name, 'react/jsx-runtime');
      return jsxRuntime;
    },
    ...bindings,
  });
}
function nodes(element) {
  if (!element || typeof element !== 'object') return [];
  return [element, ...[element.props?.children].flat(Infinity).flatMap(nodes)];
}
function harness(overrides = {}) {
  const state = {
    question: 'What is the policy?',
    draft: 'This is a public example.',
    questionTouched: false,
    draftTouched: false,
    ...overrides,
  };
  const events = [];
  const bindings = {
    utf8,
    segments,
    canReview,
    draftFieldProblem,
    Textarea: 'textarea',
    Button: 'button',
    ShieldCheck: () => null,
    ArrowUpRight: () => null,
    bundle: { version: 2 },
    workspace: { version: 2, archived: false },
    configured: true,
    ready: true,
    writable: true,
    role: 'owner',
    preparing: false,
    setQuestion: (value) => {
      state.question = value;
    },
    setDraft: (value) => {
      state.draft = value;
    },
    setQuestionTouched: (value) => {
      state.questionTouched = value;
    },
    setDraftTouched: (value) => {
      state.draftTouched = value;
    },
    setResult: (value) => events.push(['result', value]),
    checkDraft: () => events.push(['check']),
  };
  const render = (extra = {}) => {
    const scope = {
      ...bindings,
      ...state,
      problem: draftProblem(state.question, state.draft),
      ...extra,
    };
    scope.questionError = evaluate(initializer('questionError'), scope);
    scope.draftError = evaluate(initializer('draftError'), scope);
    const tree = evaluate(section.getText(source), scope);
    const all = nodes(tree);
    return {
      tree,
      scope,
      field: (id) => all.find((n) => n.props?.id === id),
      action: all.find((n) => n.props?.className === 'review-action'),
      hint: all.find((n) => n.props?.className === 'context-hint'),
      html: () => renderToStaticMarkup(tree),
    };
  };
  return { state, events, render };
}

test('draft feedback: UTF-8 question boundaries reuse the unchanged validator', () => {
  for (const [value, invalid] of [
    ['q'.repeat(1500), false],
    ['q'.repeat(1501), true],
    ['é'.repeat(750), false],
    ['é'.repeat(751), true],
    ['🐧'.repeat(375), false],
    ['🐧'.repeat(376), true],
    ['  ' + 'q'.repeat(1500) + ' ', false],
  ])
    assert.equal(
      !!draftFieldProblem('question', value),
      invalid,
      utf8(value).toString(),
    );
});

test('draft feedback: UTF-8 reply boundaries and sentence limits stay enforced', () => {
  for (const [value, invalid] of [
    ['r'.repeat(3000), false],
    ['r'.repeat(3001), true],
    ['é'.repeat(1500), false],
    ['é'.repeat(1501), true],
    ['🐧'.repeat(750), false],
    ['🐧'.repeat(751), true],
    ['Reply. '.repeat(12), false],
    ['Reply. '.repeat(13), true],
  ])
    assert.equal(!!draftFieldProblem('reply', value), invalid);
  assert.equal(draftFieldProblem('question', 'Question? '.repeat(13)), null);
});

test('draft feedback: privacy and control errors identify only the affected field without echoing content', () => {
  for (const field of ['question', 'reply']) {
    for (const value of [
      'Contact example@example.test',
      'api_key: fictional-example',
      'hello\u0001world',
    ]) {
      const h = harness({
        [field === 'question' ? 'question' : 'draft']: value,
      });
      const view = h.render();
      const own = view.field(field),
        other = view.field(field === 'question' ? 'reply' : 'question');
      assert.equal(own.props['aria-invalid'], true);
      assert.equal(other.props['aria-invalid'], false);
      const error = view.field(field + '-error').props.children;
      assert.ok(error);
      assert.ok(!error.includes(value));
      assert.equal(view.action.props.disabled, true);
    }
  }
});

test('draft feedback: untouched empty fields are not marked invalid; blur validates each field', () => {
  const h = harness({ question: '', draft: '' });
  let view = h.render();
  for (const id of ['question', 'reply'])
    assert.equal(view.field(id).props['aria-invalid'], false);
  assert.equal(view.action.props.disabled, true);
  view.field('question').props.onBlur();
  view = h.render();
  assert.equal(view.field('question').props['aria-invalid'], true);
  assert.equal(view.field('reply').props['aria-invalid'], false);
  view.field('reply').props.onBlur();
  assert.equal(h.render().field('reply').props['aria-invalid'], true);
  assert.deepEqual(h.events, []);
});

test('draft feedback: whitespace input is validated even before blur', () => {
  const view = harness({ question: ' ', draft: '\n' }).render();
  assert.equal(view.field('question').props['aria-invalid'], true);
  assert.equal(view.field('reply').props['aria-invalid'], true);
  assert.equal(view.action.props.disabled, true);
});

test('draft feedback: errors are associated, live, escaped and not duplicated in the general hint', () => {
  const view = harness({
    question: 'q'.repeat(1501),
    draft: 'Reply. '.repeat(13),
  }).render();
  assert.equal(
    view.field('question').props['aria-describedby'],
    'question-count question-error',
  );
  assert.equal(
    view.field('reply').props['aria-describedby'],
    'reply-count reply-sentences reply-error',
  );
  for (const id of ['question-error', 'reply-error'])
    assert.equal(view.field(id).props['aria-live'], 'polite');
  assert.equal(view.hint.props.children, '');
  assert.equal(
    view.html().split('Add a question of up to 1,500 UTF-8 bytes.').length - 1,
    1,
  );
  assert.equal(
    view.html().split('Keep the draft to 12 sentences or fewer.').length - 1,
    1,
  );
  const escaped = harness({ question: '<script>alert(1)</script>' })
    .render()
    .html();
  assert.ok(!escaped.includes('<script>'));
  assert.ok(escaped.includes('&lt;script&gt;'));
});

test('draft feedback: correction clears invalid state and keeps counters and stable live regions', () => {
  const h = harness({ question: 'q'.repeat(1501), draft: 'r'.repeat(3001) });
  let view = h.render();
  view.field('question').props.onChange({ target: { value: 'Question?' } });
  view.field('reply').props.onChange({ target: { value: 'Public reply.' } });
  view = h.render();
  assert.equal(view.field('question').props['aria-invalid'], false);
  assert.equal(view.field('reply').props['aria-invalid'], false);
  assert.equal(
    view.field('question').props['aria-describedby'],
    'question-count',
  );
  assert.equal(
    view.field('reply').props['aria-describedby'],
    'reply-count reply-sentences',
  );
  assert.equal(view.field('question-error').props.children, null);
  assert.equal(view.field('reply-error').props.children, null);
  assert.equal(view.action.props.disabled, false);
  assert.match(view.hint.props.children, /before signing/);
  assert.deepEqual(h.events, [
    ['result', null],
    ['result', null],
  ]);
});

test('draft feedback: a cross-field privacy match still blocks submission and retains the general warning', () => {
  const view = harness({ question: 'password', draft: ': fictional' }).render();
  assert.equal(view.scope.questionError, null);
  assert.equal(view.scope.draftError, null);
  assert.equal(view.scope.problem, 'Remove secrets before submitting.');
  assert.equal(view.hint.props.children, view.scope.problem);
  assert.equal(view.action.props.disabled, true);
});

test('draft feedback: visitor, unavailable workspace and busy wallet gates do not depend on feedback', () => {
  const h = harness();
  for (const extra of [
    { role: 'visitor' },
    { writable: false },
    { workspace: { version: 0 } },
  ])
    assert.equal(h.render(extra).action.props.disabled, true);
  assert.equal(
    h.render({ ready: false, writable: false }).hint.props.children,
    'Connect your wallet on Studionet to check this draft.',
  );
  assert.deepEqual(h.events, []);
});
