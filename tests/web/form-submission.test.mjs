import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';

// Base UI defaults to type="button". Check the actual app JSX rather than a
// duplicated fixture; Chrome separately verifies native click/Enter behavior.
const directory = new URL('../../components/reply/', import.meta.url);
const sources = readdirSync(directory)
  .filter((name) => name.endsWith('.tsx'))
  .map((name) =>
    ts.createSourceFile(
      name,
      readFileSync(new URL(name, directory), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
  );

function descendants(root, predicate) {
  const matches = [];
  function visit(node) {
    if (predicate(node)) matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(root);
  return matches;
}

function opening(node) {
  return ts.isJsxElement(node) ? node.openingElement : node;
}

function elements(root, tag) {
  return descendants(
    root,
    (node) =>
      (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) &&
      opening(node).tagName.getText() === tag,
  );
}

function attribute(node, name) {
  return opening(node).attributes.properties.find(
    (prop) => ts.isJsxAttribute(prop) && prop.name.getText() === name,
  );
}

function literal(node, name) {
  const value = attribute(node, name)?.initializer;
  return value && ts.isStringLiteral(value) ? value.text : undefined;
}

function label(node) {
  return descendants(node, ts.isJsxText)
    .map((part) => part.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const forms = sources.flatMap((source) => elements(source, 'form'));
const workflows = [
  ['review-lookup', 'Open'],
  ['workspace-lookup', 'Open'],
  ['new-id', 'Review workspace creation'],
  ['view-version', 'View'],
  ['invite-wallet', 'Review invitation'],
  ['next-owner', 'Review transfer'],
];

function matchesField(form, id) {
  return elements(form, 'Field').some((field) => literal(field, 'id') === id);
}

for (const [id, buttonLabel] of workflows) {
  test(`${id}: primary button submits through the form handler`, () => {
    const matching = forms.filter((form) => matchesField(form, id));
    assert.equal(matching.length, 1, 'Exactly one matching form must exist');
    const form = matching[0];
    assert.ok(attribute(form, 'onSubmit'), 'Keep the form submit handler');
    const primary = elements(form, 'Button').filter(
      (button) => label(button) === buttonLabel,
    );
    assert.equal(primary.length, 1, 'Exactly one primary button must exist');
    assert.equal(literal(primary[0], 'type'), 'submit');
    assert.ok(attribute(primary[0], 'disabled'), 'Keep the validation gate');
    assert.equal(
      attribute(primary[0], 'onClick'),
      undefined,
      'Use one submission path for mouse and keyboard, not a second handler',
    );
  });
}

test('all ReplyCheck forms are covered by a named submission regression', () => {
  assert.equal(forms.length, workflows.length);
  for (const form of forms)
    assert.equal(
      workflows.filter(([id]) => matchesField(form, id)).length,
      1,
      'Add a named regression for any new form',
    );
});

test('secondary form actions cannot accidentally submit the form', () => {
  for (const form of forms) {
    const buttons = elements(form, 'Button');
    assert.equal(
      buttons.filter((button) => literal(button, 'type') === 'submit').length,
      1,
      'Each form must have exactly one submit button',
    );
    for (const button of buttons.filter((item) => attribute(item, 'onClick')))
      assert.equal(literal(button, 'type'), 'button');
  }
});
