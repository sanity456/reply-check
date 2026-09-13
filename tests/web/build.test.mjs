import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const shim = new URL('../../scripts/graceful-exit.mjs', import.meta.url).href;
for (const exitCode of [0, 1, 7])
  test(`Windows drain preserves exit code ${exitCode}`, () => {
    const result = spawnSync(
      process.execPath,
      ['--import', shim, '--eval', `process.exit(${exitCode})`],
      { encoding: 'utf8', timeout: 5000 },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, exitCode);
  });
