// vinext 1.0.0-beta.9 calls process.exit immediately after HTTP prerendering.
// Node on Windows can abort while libuv is still closing those async handles:
// https://github.com/nodejs/node/issues/56645
// Give shutdown callbacks one short event-loop drain. Preserve nonzero exits;
// never reinterpret a failed build as success. No installed dependency is edited.
if (process.platform === 'win32') {
  const originalExit = process.exit.bind(process);
  let scheduled = false;
  process.exit = (code) => {
    const next = Number(code ?? process.exitCode ?? 0);
    if (next !== 0 || process.exitCode === undefined) process.exitCode = next;
    if (!scheduled) {
      scheduled = true;
      setTimeout(() => originalExit(process.exitCode), 200);
    }
  };
}
