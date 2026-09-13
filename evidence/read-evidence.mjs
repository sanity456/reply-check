/** Explicit, byte-pinned historical resolutions; never rewrite original evidence. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const WORKFLOW_PATH = '.github/workflows/verify.yml';
export const WORKFLOW_SNAPSHOT = 'evidence/source-snapshots/20260913-pre-release-workflow/verify.yml.snapshot';
export const WORKFLOW_SNAPSHOT_SHA256 = '3a42c82d9674dd496103c72c627920903c0ef106e43da5100029c4564c679bc7';
export const RECOVERY_UI_SNAPSHOTS = {
  'hooks/use-reply-chain.ts': '616bff6f7f1a61ce5d813fdc13333bb45b59be50e5afcf23b015860dda545088',
  'components/reply/reply-app.tsx': 'c6d999aec22e8092773435bc40c1ee6f06073659382c286b5a9ed5de9b65ae22',
  'tests/web/session-reliability.test.mjs': '9fa2f8bc5b053604718c91808b803c0055ca33cc7a9d1474df18421bf93b09db',
};

export function createEvidenceReader(root, options = {}) {
  const historicalWorkflow = options.historicalWorkflow ?? process.argv.includes('--historical-workflow');
  const historicalRecoveryUi = options.historicalRecoveryUi ?? process.argv.includes('--historical-recovery-ui');
  let workflowNoticeShown = false;
  let recoveryNoticeShown = false;
  return async (path) => {
    assert.equal(typeof path, 'string');
    const recoveryHash = historicalRecoveryUi && Object.hasOwn(RECOVERY_UI_SNAPSHOTS, path) ? RECOVERY_UI_SNAPSHOTS[path] : null;
    const selected = recoveryHash
      ? 'evidence/source-snapshots/20260913-pre-recovery-hash/' + path + '.snapshot'
      : historicalWorkflow && path === WORKFLOW_PATH ? WORKFLOW_SNAPSHOT : path;
    const url = new URL(selected, root);
    assert.ok(url.href.startsWith(root.href), 'Evidence read must remain inside the project');
    const bytes = await readFile(url);
    if (recoveryHash) {
      assert.equal(createHash('sha256').update(bytes).digest('hex'), recoveryHash, 'Exact pre-recovery-fix snapshot');
      if (!recoveryNoticeShown) {
        console.error('Evidence scope: this proof describes the pre-recovery-fix UI/source snapshot, not a fresh test of the changed UI. Current code is checked separately by the complete suite and the new fix proof.');
        recoveryNoticeShown = true;
      }
    }
    if (historicalWorkflow && path === WORKFLOW_PATH) {
      assert.equal(createHash('sha256').update(bytes).digest('hex'), WORKFLOW_SNAPSHOT_SHA256, 'Exact historical workflow bytes');
      if (!workflowNoticeShown) {
        console.error('Evidence scope: the workflow pin uses its exact historical snapshot; it is not a claim about the current workflow. All remaining source pins are checked in their explicitly selected scope.');
        workflowNoticeShown = true;
      }
    }
    return bytes;
  };
}
