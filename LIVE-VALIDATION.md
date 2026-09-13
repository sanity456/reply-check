# ReplyCheck — Studionet validation

## Current release — September 13, 2026

**The agreed desktop release verification is complete; owner review and portal submission remain.** The [public app](https://reply-check-sanity3.vercel.app/) and [public repository](https://github.com/sanity456/reply-check) are available. The [steward response](STEWARD-RESPONSE.md) links the complete passing Ubuntu suite, pinned evidence and anonymous evaluator checks. Consult [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) for the current gates and stated limits.

The latest [public-origin human-wallet test](evidence/release/20260913-public-wallet-reconciled.json) finalized transaction `0x0ab18b98ac37b140991fbb3bf8506ce9b9e8ed4180fd4368519f8fcaf57e1c75`, stored at chain timestamp `2026-09-13T12:59:48.716658+00:00`, with `MATCHES_REFERENCES / ANSWERED / CLAIM_SUPPORTED`. Reviews increased only from 16 to 17; all prior reviews were preserved. Exact calldata, receipt, returned/stored payload and deployed source were verified. [Browser closure](evidence/release/20260913-public-wallet-browser-close.json) records safe recovery completion. The agent did not approve the wallet transaction. Exhaustive live adversarial/concurrency coverage is not claimed.

## Historical validation checkpoints

All status claims below, including “local”, “not submission-ready” and then-pending cases, describe their original checkpoints. They are preserved to retain failures and test history, not presented as current release status. The automated disposable-account run and later human-approved wallet runs are distinct evidence; no new transaction was sent for this documentation clarification.

Status: **automated Studionet milestone passed; not submission-ready**.

Latest native recovery result: **passed end to end** on September 13. Transaction `0xd066a1ac1d9f6192b69e81235751efd8b68a7d32ec9e17d16b1d137fffdb5c84` was recovered through the actual form after the original page reload, missing-hash feedback and unrelated-hash rejection. The unique original request finalized successfully and added review `a1b507a470346dafee0035b8761c1e54507ac4808248cc3c48263d7a2ecd5d10`, recorded by the chain at `2026-09-13T10:33:04.390478+00:00`. Output: `MATCHES_REFERENCES / ANSWERED / CLAIM_SUPPORTED`. All earlier full state was preserved; only review count changed from 15 to 16. [Exact receipt, inputs, returned/stored payloads and source verification](evidence/human-wallet/20260913-native-hash-recovery-reconciled.json); [safe browser closure](evidence/human-wallet/20260913-native-hash-recovery-browser-close.json). This closes the native missing-hash/hashless recovery case left open in the historical wording checkpoint below, not the whole release matrix. No new request remains to approve.

September 13 wording follow-up: the missing-transaction message is now fixed and verified through the actual app client using one read-only Studionet lookup, plus seven offline recovery regressions. All 267 local tests and 20 saved-evidence replays pass. The original missing-hash finding below is retained as historical evidence; its wording portion is closed, while the native-browser recovery case remains open. See [scoped fix evidence](evidence/local/20260913-missing-hash-wording-fix.json). No new wallet request, chain write, GitHub push or publication occurred.

The website is still local. No GitHub repository, push, website publication or submission has been performed. All automated transactions use newly generated disposable test accounts, fictional public text, zero attached value and full validator consensus.

## Latest human-wallet recovery checkpoint — September 13 UTC

The pending-network recovery case passes on the fixed frontend. An independent pending receipt was bracketed by Chrome observations showing the app off Studionet, the same B-bound recovery hash and disabled repeat submission. The same transaction finalized successfully; the full returned/stored review and all ten public-state outputs were independently reconciled.

- Transaction: `0x88440d641b31d15c9b66cb81e994bc55d1fb57dd89b2b0dc045ede4b83fcd41a`.
- Stored chain timestamp: `2026-09-13T08:54:57.538340+00:00`.
- Result: `MATCHES_REFERENCES`, `ANSWERED`, `CLAIM_SUPPORTED`.
- Only change: reviews 13 → 14. All earlier reviews/timestamps, references, cards, roles and settings remain unchanged.
- [Exact inputs, receipts, output payload and state/source verification](evidence/human-wallet/20260913-pending-network-after-fix-reconciled.json).
- [Successful local recovery acknowledgment and all fourteen history rows](evidence/human-wallet/20260913-pending-network-after-fix-browser-close.json).

Strict offline replay: `node evidence/human-wallet/replays/20260913-pending-network-after-fix.mjs`. The subsequent registration check caught the missing inventory entry, then passed all 163 frontend tests and all 20 registered replays. Original evidence JSON and the former 19-entry inventory are preserved; only that exact historical inventory pin is explicitly substituted in the two affected replays, with all application/source pins current. See `evidence/local/20260913-network-replay-registration.json`. This is local verification, not a public CI run.

The alternative network ID and native wallet clicks were not independently captured; the observed app state proves off-Studionet recovery, not an exact Ethereum chain-ID assertion. No replacement hash was tested: the transaction had already finalized before that separate check could start. This does not close the full reliability, accessibility or public-release matrix.

## Current deployment

Most recent human-wallet result: the [two-tab/hash reconciliation](evidence/human-wallet/20260913-two-tab-hash-reconciled.json) verifies wallet-lock denial of the competing tab, recovery-lock denial, malformed-hash rejection, real unrelated-receipt rejection, byte-identical recovery exports, and exactly one 14-to-15 review delta. Transaction `0xf311de10a7afbf3ba0dc72d9736abfb007cc6ca91dd9d420c6e8b02ae144c3a7` succeeded with stored chain time `2026-09-13T09:27:34.678801+00:00` and `MATCHES_REFERENCES / ANSWERED / CLAIM_SUPPORTED`. All older state and source remained unchanged. [Both tabs were cleared safely](evidence/human-wallet/20260913-two-tab-browser-close.json). The [missing-hash wording finding](evidence/human-wallet/20260913-missing-hash-wording-finding.json) stays open; a read-only follow-up observed the explicit missing-resource RPC error, not the null payload initially expected by the test harness. No request remains to approve.

- Network: Studionet, chain ID `61999`.
- Contract: `0xBD35B1E68aeC803Bd793Db9c6B9762b60f60029A`.
- Deployment transaction: `0x3cdfb52022ae0aa7e5e28d2dba2998f2f23fd37abfae6d4f84b4a59756c2d000`.
- Deployed source SHA-256: `cb09037c7ba0b4dc4a675eb09ee561eb828d82b57ff5eb703d76e204f555c1eb`.
- GenVM runner: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`.
- [Passing run's exact public inputs, chain timestamps, receipts and outputs](evidence/studionet/749f58e6-6c2c-4401-9848-e2a03df7326e.json).

The contract's actual deployed bytes were fetched and hashed, not inferred from a local source file or a deployment command's exit code. The three earlier test deployments are superseded; the app must not point to them.

## Completed automated checks

The complete opt-in live harness passed in **21 minutes 11 seconds**: **26 finalized transactions**, comprising **20 successful executions and 6 expected contract rejections**. All six real-model cases passed with their unchanged expected outcomes:

| Case                            | Overall verdict        | Reason codes                       | Question coverage |
| ------------------------------- | ---------------------- | ---------------------------------- | ----------------- |
| Greeting only                   | NOT_ENOUGH_INFORMATION | NON_FACTUAL_TEXT                   | UNANSWERED        |
| Correct refund window           | MATCHES_REFERENCES     | CLAIM_SUPPORTED                    | ANSWERED          |
| Incorrect refund window         | NEEDS_CHANGES          | CONTRADICTS_REFERENCE              | ANSWERED          |
| Unsupported guarantee           | NEEDS_CHANGES          | NOT_IN_REFERENCES                  | UNANSWERED        |
| Correct plus unsupported claims | NEEDS_CHANGES          | CLAIM_SUPPORTED, NOT_IN_REFERENCES | ANSWERED          |
| Injected evaluator instruction  | NEEDS_CHANGES          | CONTRADICTS_REFERENCE              | ANSWERED          |

The workflow also verified invitation acceptance, unauthorized-action rejection, idempotent review replay, card eligibility, new-reference staleness, unchanged old evidence, stale-version rejection, card retirement, member revocation, two-step ownership transfer, and archive/restore.

- [Read-only evidence replay](evidence/studionet/749f58e6-6c2c-4401-9848-e2a03df7326e-verification.json): every saved receipt passes the current app's outcome and calldata checks; source/harness snapshots and the dependency lock match their hashes.
- [Fresh application-client checks](evidence/studionet/749f58e6-6c2c-4401-9848-e2a03df7326e-app-client.json): source verified again, all six immutable reviews re-read exactly, final workspace/card/role state checked, and actual successful/rejected receipts reconciled through `getReceipt`.
- Passing run artifact SHA-256: `aaf0777dcf7cc73e5593e54091c9fcdff6faba2de733f250be840c332875e270`.
- The verified deployment is configured in the local app. The complete offline suites, TypeScript, lint, formatting and production rebuild passed after enabling it.

These are automated disposable-account tests, not human MetaMask approvals, exhaustive model reliability, or an independent security certification.

## Issues found and corrected

1. **Live test tooling:** the pinned Python SDK handles several Studio methods as testnet methods. The opt-in integration test now uses the same pinned JavaScript client as the app, with an explicit Studionet profile and chain-ID check. The test configuration schema and Ubuntu linter command were corrected.
2. **Receipts and recovery:** Studio includes idle validator records alongside the actual leader and the generic Ethereum formatter drops its numeric zero value. The app now reads raw Studio receipts and binds the unique leader to the final accepted round, exact calldata, zero value and consistent execution-result bytes. Confirmed, finalized consensus disagreement is a terminal failure, not success or an indefinitely pending operation.
3. **Claim classification and coverage:** a real model run called an unsupported guarantee a contradiction and mistook related-topic text for an answer. Shared rules now distinguish the exact attribute being asserted, missing evidence, direct contradiction and the information actually requested. The unchanged failing input subsequently produced `NOT_IN_REFERENCES` and `UNANSWERED` as expected.
4. **Greeting-only replies:** real validators rejected malformed neutral findings. The model instructions now explicitly require empty citations and rewrites for neutral text and enumerate the permitted question-status strings. Validation was not relaxed.
5. **Evidence capture:** transient Windows/OneDrive file locks interrupted a run. Only the local atomic rename is retried, with a bounded limit; no transaction is automatically resent.
6. **Audit clarity and diagnostics:** a subsequent greeting case produced correctly formatted leader assessments but still ended in finalized validator disagreement. The older output did not expose the validator's internal rejection stage. The auditor instructions now explicitly distinguish a correct negative assessment from a good draft, and allow observations of courtesy/omissions to be grounded in the draft itself. Constant diagnostic codes identify schema, decision or audit failures without logging raw model output. The greeting case then passed in the complete live run; broader reliability testing remains necessary.
7. **Browser form submission:** the human-wallet check found an enabled workspace-creation button that did not submit. Six primary form buttons now explicitly declare `type="submit"`, preserving the shared button default and confirmation safeguards. Eight JSX-wiring regressions were added. Chrome verified creation staging by click and Enter, consent/empty-input gates and the three read-only lookup forms. Owner-only invitation/transfer browser flows still await a human-owned workspace. The original failure and retest are retained in the [in-progress human-wallet evidence](evidence/human-wallet/20260910-105817.json); no transaction was sent by this UI retest.

Regression tests include sanitized actual network receipts and deliberately conflicting variants. The latest complete offline checks pass: **97 contract/tooling tests and 159 frontend/transport tests**, including the recovery-hash fix. These are Windows results, not public Ubuntu evidence. The new pending-network case changes no application or contract source.

## Preserved unsuccessful runs

- [Initial receipt-verifier mismatch](evidence/studionet/5daa1929-415a-4b5e-98a1-ac06837f4c94.json).
- [Unsupported-claim classification failure](evidence/studionet/b2efae75-d702-4d1d-bbba-19f25e3cd398.json).
- [Interrupted local evidence write after a correct permission rejection](evidence/studionet/8704667b-9329-4b80-a145-e5628c01b35f.json).
- [Four passing model cases followed by malformed greeting output and validator disagreement](evidence/studionet/11fa4b52-e047-477d-b3ed-490b839c31b2.json).
- [Four passing model cases followed by valid leader output but validator disagreement](evidence/studionet/cf969a76-203b-460d-a136-dbec1e081cb6.json). Its greeting transaction later finalized with `MAJORITY_DISAGREE`; the [sanitized final receipt](tests/fixtures/studionet/disagreement-0f40b07c.json) confirms the app correctly treats it as failure despite successful individual leader execution.

Hashed source and harness snapshots are retained under `evidence/studionet/`. An incomplete run is not a passing run; a finalized transaction is not proof of execution success. Never relabel an old failed result after a source change.

## Remaining release gates

- Human wallet/browser tests: actual connect/reject/approve interactions, switching accounts/networks, reload and interrupted-session recovery, concurrent changes, and accessibility.
- Additional adversarial and reliability testing beyond six fixed model examples; these examples cannot establish perfect model robustness.
- Explicit approval for GitHub creation and website publication.
- Public clean Ubuntu Actions on an immutable commit, signed-out evaluator access and a concise evidence-backed steward response.
- Owner approval before submission.
