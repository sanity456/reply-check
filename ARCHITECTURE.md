# ReplyCheck

## Product contract

ReplyCheck is a public-reference review workspace for GenLayer Studionet. A team publishes a versioned information bundle, members submit a public question and draft, validators assess each sentence, and a reviewer may promote a matching assessment into a reusable answer card. Nothing sends a customer message automatically. There is no escrow, payment, token reward, or private-customer-data claim.

## Authority boundary

- **Browser:** editing, reference display, privacy warnings, practice exercises, local preferences, transaction preparation and progress. Curated practice is visibly separate from recorded assessments. It never supplies an authoritative verdict to the contract.
- **Contract:** wallet-based membership and explicit role acceptance; append-only reference versions; evidence-bound semantic assessment; exact input digests; immutable review records; reviewer-controlled answer-card publication; stale-card detection; membership and ownership transitions. GenLayer consensus determines whether a draft is eligible for approval, not just a decorative receipt.
- **Team:** reference content is owner-attested public information. A URL is attribution, not proof that the contract fetched or authenticated its author. V1 does not fetch URLs or claim external source verification.
- **Hosting:** a static client without server credentials or an app-owned login database. Everyone can read public records. The contract authorizes every write; hiding a button is never authorization.

## Assessment flow

1. Member chooses a workspace and the current reference version.
2. Browser displays question, draft, reference version, and an explicit public-data consent step. High-confidence secret/contact patterns block submission; warnings are not a guarantee of anonymization.
3. Contract checks membership, public consent, input limits, reference freshness, and a caller-scoped idempotency key before any model work.
4. Deterministic sentence segmentation fixes the complete set of text to review. Every segment must receive a verdict; none can be omitted or duplicated.
5. Leader evaluates the same immutable bundle and question, returns structured segment findings and bounded, non-authoritative rewrite suggestions.
6. Every validator independently evaluates those inputs and compares all decision fields. Literal citations are checked against the stored reference text. A further evidence-based check verifies the proposed explanations and suggestions. Invalid model output or a failed audit cannot become a successful stored assessment.
7. Overall verdict is derived in deterministic code. A matching result becomes eligible for reviewer approval; uncertainty never becomes a pass.
8. Only an authorized reviewer can publish an answer card from an eligible current assessment. A later reference version makes the old card require rechecking, without rewriting the earlier evidence.

## Durable state and privacy

Workspaces, memberships, reference versions, reviews, and answer cards live on the contract. Browser storage is limited to pending transaction identifiers, device-local practice progress and preferences. Draft text stays in memory. A reverted transaction can still expose its submitted calldata: consent must happen before sending, not just in contract validation. V1 is unsuitable for private tickets, secrets, regulated data or confidential policies.

## Failure and recovery

Wallet rejection makes no recorded review. Account or network changes clear authorization assumptions. A returned transaction hash is saved before polling. Accepted/finalized lifecycle status is not enough: execution success and the expected stored record must also be checked. Unknown outcomes keep the hash for recovery and must not be auto-resubmitted. Idempotency retries return the same result for identical input and reject changed input under the same key. Model/network failure does not store a fabricated fallback verdict.

## Delivery gates

- [x] User and owner workflows implemented; source, offline tests and actual live observations remain distinct evidence types.
- [x] Contract linter, direct tests, and independent-validator adversarial tests pass.
- [x] Frontend logic tests, formatting, lint, types, production build and npm dependency audit pass locally.
- [x] Real GenVM deployment and six-case automated live model/workflow run, with exact source hash and application-client replay.
- [x] Recorded human-wallet rejection, account/network changes, role acceptance, ownership/archive lifecycle and scoped interrupted-session/hashless recovery cases. The final public-site review also passed.
- [x] Anonymous reviewer access, immutable release evidence and the complete clean Ubuntu suite. See [STEWARD-RESPONSE.md](STEWARD-RESPONSE.md).
- [ ] Owner review, portal CAPTCHA and explicit final submission approval.

The agreed desktop verification scope is complete. A full live adversarial/concurrency matrix, every native recovery path and independent security/accessibility certification are not claimed. Those broader limits are distinct from the remaining portal action; [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) is the current gate list. Passing evidence does not guarantee acceptance.
