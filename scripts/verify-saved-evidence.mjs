/** Run every registered saved-evidence replay. This never runs a live harness. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const entries = JSON.parse(
  await readFile(new URL('evidence/offline-replays.json', root), 'utf8'),
);
assert.ok(Array.isArray(entries) && entries.length > 0);
const seen = new Set();
for (const entry of entries) {
  assert.ok(
    /^evidence\/(browser\/replay-[a-z0-9-]+|human-wallet\/replays\/[a-z0-9-]+)\.mjs$/.test(
      entry.path,
    ) || entry.path === 'scripts/verify-live-evidence.mjs',
    'Only explicitly offline verification entry points are allowed',
  );
  assert.ok(!seen.has(entry.path), 'Duplicate replay');
  seen.add(entry.path);
  assert.ok(
    Array.isArray(entry.args) &&
      entry.args.every(
        (value) =>
          value === '--historical-ui' ||
          value === '--historical-workflow' ||
          value === '--historical-recovery-ui' ||
          /^evidence\/studionet\/[a-f0-9-]+\.json$/.test(value),
      ),
  );
  console.log(`\nReplay ${seen.size}/${entries.length}: ${entry.scope}`);
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry.path, ...entry.args], {
      cwd: fileURLToPath(root),
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('exit', (status, signal) => resolve(signal ? 1 : (status ?? 1)));
  });
  if (code !== 0) {
    console.error(`Saved evidence replay failed: ${entry.path}`);
    process.exitCode = code;
    break;
  }
}
if (!process.exitCode)
  console.log(
    `\nPASS: ${entries.length} saved-evidence replays. This is consistency verification, not a new live test or a complete release pass.`,
  );
