# Historical UI source snapshots

The September 12 original browser audit and after-signing wallet proof pin the UI bytes that were tested then. Before UI-01–UI-04 were edited, these two files were copied byte-for-byte into `20260912-pre-ui-fixes/`:

| Original file | Snapshot SHA-256 |
| --- | --- |
| `app/reply.css` | `029087c9b6359d10b95a3f6fdd900ffab61add65e9d1c10669f74e8ee7b63d48` |
| `components/reply/reply-app.tsx` (stored with `.snapshot` suffix) | `7c892ebab9ac1f3bf690344179d0eef164025d1a926a00ae316321efcf0ccfac` |

The original evidence JSON, its hashes, observations and original failures remain unchanged. These copies are historical evidence, not application imports or a new passing browser run.

The two replays accept `--historical-ui` to verify the exact archived UI bytes against the original pins; every other pinned source still comes from the current workspace. Without that explicit flag, they continue to require all original pins to match the current source and will intentionally fail once the UI changes. The later review-result snapshot below is also used by the original audit if that file is pinned there.

```sh
node evidence/browser/replay-20260912-usability.mjs --historical-ui
node evidence/human-wallet/replays/20260912-after-signing-recovery.mjs --historical-ui
```

Neither mode sends RPCs, opens a wallet, or proves that the changed UI passed a fresh browser test. The post-fix verification is recorded separately.

## Before the resize-focus and uncertainty-wording fixes

Before the next two UI changes, these files were copied byte-for-byte into `20260912-pre-focus-wording/` with `.snapshot` suffixes:

| Original file | Snapshot SHA-256 |
| --- | --- |
| `components/reply/reply-app.tsx` | `0528ca0736ed6f9a83bf86f63bf9fd50ac0d4fac33467e28ab918d6f851d037d` |
| `components/reply/review-result.tsx` | `4f47ab39f49dcc26362a84198975b786a517c36147212b4df9778b92cb28b461` |

The first UI-fix browser replay now also accepts `--historical-ui`. It reads that checkpoint's exact reply-app snapshot, checks all other pinned files normally, and continues to assert the original offscreen-focus observation as recorded. It does not turn that historical failure into a pass.

```sh
node evidence/browser/replay-20260912-ui-fix-browser.mjs --historical-ui
```

The original mixed-reply JSON still contains “Refund processing time may vary.” Its recorded assessment, source hashes, timestamps and exports are not rewritten by the new UI editing aid.

## Before the reliability/accessibility follow-up

`20260912-pre-reliability/` preserves two more exact files, with `.snapshot` suffixes:

| Original file | Snapshot SHA-256 |
| --- | --- |
| `app/reply.css` | `f1b5e306217866749e1198a66d09ac896369f99f9a731ff7dc56d3ce682f80a0` |
| `hooks/use-reply-chain.ts` | `db4601aa0c32d48e147e4d287e9882c6a9a8d8a5fddcbad3e5e312bf6a7883b9` |

The stylesheet only gains the reduced-motion iteration limit. The hook only gains a revision guard on a failed wallet-state refresh. Exact AST comparisons confirm that `send`, `check`, `persist`, `connect`, `attachHash`, `confirmNotSent` and `dismiss` callbacks remain unchanged.

For all four older replays, `--historical-ui` now resolves every changed frontend file, including this hook, to the correct checkpoint's snapshot. Other pins remain current. No original evidence JSON or its hashes/results were changed. The flag name is retained for compatibility; it does not mean a fresh wallet test.

```sh
node evidence/browser/replay-20260912-focus-wording.mjs --historical-ui
node evidence/browser/replay-20260912-reliability-accessibility.mjs
```

The new replay requires the current source pins and preserves the distinction between isolated local tests and still-unverified live/native browser conditions.

## Before expanding the release workflow

`20260913-pre-release-workflow/verify.yml.snapshot` preserves the exact former
workflow bytes, SHA-256
`3a42c82d9674dd496103c72c627920903c0ef106e43da5100029c4564c679bc7`.
The workflow now invokes `node scripts/verify-saved-evidence.mjs`, which runs the
explicit inventory in `evidence/offline-replays.json`. That inventory includes
the newer September 13 proofs, the pending-network preparation, and the saved
completed automated Studionet run. It never invokes the write-producing live
harness.

Older proofs intentionally retain their original workflow pin. Their replays
accept a separate `--historical-workflow` flag, which resolves only
`.github/workflows/verify.yml` to this exact hash-checked snapshot. All other
source pins stay strict; `--historical-ui` remains separately required for the
older UI checkpoints. Without the workflow flag, an old workflow pin correctly
fails against the changed current workflow. A console notice identifies this
historical workflow scope.

No original evidence JSON, result, failure, timestamp, receipt or source pin was
rewritten. Four regression tests cover strict default reads, the explicit
workflow exception, unchanged application-source reads, and complete replay
inventory/current workflow wiring. These offline replays establish saved-data
consistency, not a new live execution or a public Ubuntu CI result.

## Before the recovered-hash correction fix

Later inventory-only checkpoint: `20260913-before-network-registration/offline-replays.json.snapshot` preserves the exact 19-entry inventory (`16982aaf4cdfb431380b9d61c6c9b135b6727d52cfd1795b8d63c459a0900966`). The recovery-fix and pending-network proof replays explicitly opt into this one historical metadata pin via `verifyCheckpointPins`. Every other pinned source stays current, and every old inventory entry must remain unchanged in the expanded current inventory. The strict default rejects a changed pin; the opt-in cannot substitute application, contract, lockfile, arbitrary inventory hashes or out-of-project paths. Four new regressions and the existing complete-discovery inventory test verify this boundary. No original JSON proof was modified.

`20260913-pre-recovery-hash/` preserves three exact pre-fix files:

| Original file | Snapshot SHA-256 |
| --- | --- |
| `hooks/use-reply-chain.ts` | `616bff6f7f1a61ce5d813fdc13333bb45b59be50e5afcf23b015860dda545088` |
| `components/reply/reply-app.tsx` | `c6d999aec22e8092773435bc40c1ee6f06073659382c286b5a9ed5de9b65ae22` |
| `tests/web/session-reliability.test.mjs` | `9fa2f8bc5b053604718c91808b803c0055ca33cc7a9d1474df18421bf93b09db` |

Old replays now also receive the explicit `--historical-recovery-ui` flag. It
checks only these three named files against their exact archived hashes; older
`--historical-ui` mappings still select their own earlier checkpoints. The
original JSON proofs remain unchanged. Their pending-account/reload results
describe the old UI, not fresh native-wallet tests of the recovery-hash fix.
The current complete test suite and separate fix proof validate the new source.

The pending-network confirmation was cancelled while still unsigned after the
hash-correction defect was reproduced. Its preserved setup is not an approval
instruction or a passed test. See
`evidence/human-wallet/20260913-pending-network-paused.json`; no hash was observed
and no agent wallet request was made. Future live work requires a fresh staged
action on the rebuilt preview.

## Before draft-field error feedback

`20260913-before-draft-errors/source-bytes.json` archives four exact files as base64 with per-file SHA-256 hashes. Decoding preserves original line endings. The form snapshot is `3ae7e2932a1fc284f05ecd052d06d13eb50b9cafe6393d994cccda6faf1545a7`. The two replay scripts' original bytes are also retained, as is the unchanged checkpoint-pin helper.

The recovery-hash-fix and pending-network replays now explicitly select only that exact historical form through `verifyDraftUiPins(..., { historicalDraftUi: true, historicalInventory: true })`. The existing inventory exception remains separately scoped. Other source pins still require current bytes. Without explicit historical scope the old form pin fails against the changed app, and arbitrary UI hashes, other stale files and escaping paths cannot use this exception. Four new regressions cover the boundary and unchanged application guards.

The 20-entry replay inventory and original evidence JSON are byte-identical. Their old observations are not proof of the changed form; the fresh full suite and browser observations are recorded in `evidence/local/20260913-draft-field-feedback-fix.json`. The nine new field-feedback tests exercise the actual JSX and validation expressions with isolated state setters. No wallet transaction, public CI run or release approval is implied.
