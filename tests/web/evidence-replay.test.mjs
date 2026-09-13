import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  createEvidenceReader,
  WORKFLOW_PATH,
  WORKFLOW_SNAPSHOT_SHA256,
  RECOVERY_UI_SNAPSHOTS,
} from '../../evidence/read-evidence.mjs';

const root = new URL('../../', import.meta.url);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('evidence: current workflow is the strict default; historical workflow is explicit and hash pinned', async () => {
  const strict = createEvidenceReader(root, { historicalWorkflow: false });
  const historical = createEvidenceReader(root, { historicalWorkflow: true });
  assert.deepEqual(
    await strict(WORKFLOW_PATH),
    await readFile(new URL(WORKFLOW_PATH, root)),
  );
  assert.equal(sha(await historical(WORKFLOW_PATH)), WORKFLOW_SNAPSHOT_SHA256);
});

test('evidence: historical workflow mode does not substitute application or contract source', async () => {
  const historical = createEvidenceReader(root, { historicalWorkflow: true });
  for (const path of [
    'hooks/use-reply-chain.ts',
    'lib/reply/receipt.ts',
    'contracts/reply_check.py',
    'package-lock.json',
  ])
    assert.deepEqual(
      await historical(path),
      await readFile(new URL(path, root)),
      path,
    );
});

test('evidence: readers reject paths outside the project in both modes', async () => {
  for (const historicalWorkflow of [false, true]) {
    const reader = createEvidenceReader(root, { historicalWorkflow });
    for (const path of [
      '../outside.json',
      '../../outside.json',
      'https://example.com/receipt.json',
    ])
      await assert.rejects(reader(path), /inside the project/);
  }
});

test('evidence: pre-recovery UI snapshots require their own explicit flag and exact hashes', async () => {
  const strict = createEvidenceReader(root, { historicalRecoveryUi: false });
  const historical = createEvidenceReader(root, { historicalRecoveryUi: true });
  for (const [path, expected] of Object.entries(RECOVERY_UI_SNAPSHOTS)) {
    assert.equal(sha(await historical(path)), expected);
    assert.deepEqual(await strict(path), await readFile(new URL(path, root)));
    assert.notEqual(sha(await strict(path)), expected);
  }
});

test('evidence: the Ubuntu entry point covers every saved replay and cannot invoke the live write harness', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('evidence/offline-replays.json', root), 'utf8'),
  );
  const paths = manifest.map((entry) => entry.path);
  assert.equal(new Set(paths).size, paths.length);
  const discovered = [];
  for (const directory of ['evidence/browser', 'evidence/human-wallet/replays'])
    for (const name of await readdir(new URL(directory + '/', root)))
      if (
        name.endsWith('.mjs') &&
        (directory.endsWith('/replays') || name.startsWith('replay-'))
      )
        discovered.push(directory + '/' + name);
  assert.deepEqual(
    paths.filter((path) => path.startsWith('evidence/')).sort(),
    discovered.sort(),
  );
  assert.ok(paths.includes('scripts/verify-live-evidence.mjs'));
  assert.ok(!paths.some((path) => path.includes('live-studionet')));
  const workflow = await readFile(new URL(WORKFLOW_PATH, root), 'utf8');
  assert.ok(workflow.includes('node scripts/verify-saved-evidence.mjs'));
  assert.ok(workflow.includes('runs-on: ubuntu-24.04'));
  assert.ok(workflow.includes('persist-credentials: false'));
  for (const match of workflow.matchAll(/uses:\s*([^\s#]+)/g))
    assert.match(match[1], /@[a-f0-9]{40}$/);
});
