# ReplyCheck

Reference-led reply reviews for GenLayer Studionet. A team publishes public information, checks a draft against that exact version, and approves useful answers for reuse.

**Status: public source release; submission verification is still in progress.** The verified Studionet contract is configured in the local app. The earlier automated milestone covered six live model fixtures and 26 transactions, including six deliberate rejections; see [LIVE-VALIDATION.md](LIVE-VALIDATION.md) for its exact source hash, receipts and preserved failures. Subsequent human-wallet, recovery and accessibility observations are saved under `evidence/`.

The latest local suite passed 183 frontend tests, 97 contract tests and 20 registered evidence replays. Scoped Narrator checks and 25 responsive layout checks also passed. These are not a claim of complete accessibility conformance or public Ubuntu CI success. See [DEVICE-RELEASE-PREFLIGHT.md](DEVICE-RELEASE-PREFLIGHT.md) for the dated pre-publication findings and remaining gates: clean public CI, real-phone testing, a published evaluator site and signed-out evidence access. Reply Gym works without a wallet. The website is not yet published, and no portal submission has been made for ReplyCheck.

## What is built

- Wallet-only workspace ownership and explicit member-role acceptance.
- Immutable public reference versions, literal citations and per-sentence findings.
- Independent validator assessment plus a separate semantic audit of explanations and rewrites.
- Reviewer-controlled answer cards that need rechecking after a reference update.
- Public history, reference browsing, JSON export and direct review links.
- Role changes, revocation, two-step ownership transfer and reversible archiving.
- Public-data consent before signing; no email login, server signing key or automatic message sending.
- Transaction intent saved before the wallet opens. Unknown outcomes block new writes. Recovery checks the transaction identity, exact calldata, zero value, execution success and stored state.
- Six clearly labeled practice exercises with device-local progress.

There is no escrow or withdrawal flow: this product does not hold funds or pay rewards. Every contract write rejects attached value. A network may still charge transaction fees.

## Run locally

Use Node **24.18.0** (`.nvmrc`) and Python **3.12.14** (`.python-version`).

```sh
npm ci
npm run dev -- --hostname 127.0.0.1 --port 4201
```

Open [the local preview](http://127.0.0.1:4201/). This is a static client: no database, application login server or server secrets are required.

For a production build:

```sh
npm run build
npm start
```

The static hosting directory is `dist/client`. `.openai/hosting.json` identifies the reserved, unpublished Sites project. Do not substitute a mock contract address to enable buttons.

## Verify the source

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=low
python -m venv .venv
```

Activate that Python environment, then:

```sh
python -m pip install --require-hashes -r requirements.lock
genvm-lint check contracts/reply_check.py
```

On PowerShell:

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
$env:PYTHONIOENCODING='utf-8'
python -m pytest tests/direct tests/consensus -q --tb=short
```

On Ubuntu:

```sh
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest tests/direct tests/consensus -q --tb=short
```

These are the complete **offline** suites, not real-network consensus or a human-wallet test. See [TESTING.md](TESTING.md) for the distinction and live-run procedure. The GitHub Actions workflow uses Ubuntu 24.04 and commit-pinned actions. Check the [public workflow runs](https://github.com/sanity456/reply-check/actions/workflows/verify.yml) for the result on the exact commit being evaluated; local results do not replace that release gate.

## Read before enabling live mode

All submitted questions, drafts, references, titles and wallet addresses can become public permanently. Failed transactions can still expose calldata. The privacy detector is not anonymization. Do not use private support tickets, passwords, recovery phrases, personal records or confidential policies.

Reference text is team-attested. Attribution URLs are not fetched or authenticated. A matching assessment means consistency with those references, not independent verification of real-world truth. Human approval and a fresh check are required after editing a reply.

See [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md) and [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md).

## Tooling notes

The Windows-only build preload allows 200 ms for runtime shutdown before preserving the original exit code. This addresses the observed abrupt-exit crash after successful prerendering; it does not suppress errors. Background: [Node’s upstream issue](https://github.com/nodejs/node/issues/56645). The tests verify exit codes 0, 1 and 7.

The installed shadcn primitives are unchanged. Lint and formatting exclude that generated vendor directory and its starter mobile hook; all application-owned UI and logic remain checked.

`requirements.lock` was generated with `uv 0.12.12` in universal mode, with exact versions and artifact hashes. JavaScript resolution is locked by `package-lock.json`. The GenVM runner is pinned in the first line of the contract. Do not use a `latest` or local-only runner alias.
