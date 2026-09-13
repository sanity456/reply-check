# Security boundaries

## Scope

ReplyCheck is a public-reference consistency checker, not a private helpdesk or a source-of-truth oracle. The contract does not custody funds. Security review here means implementation controls and local adversarial tests, not an independent third-party audit or live-network certification.

## Controls implemented

| Boundary             | Control                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authorization        | Contract-enforced roles; invitations require wallet acceptance; ownership transfer requires acceptance; removed members lose write access.                            |
| Reference integrity  | Append-only versioned bundles, canonical SHA-256 digests, optimistic version checks and immutable review inputs.                                                      |
| Model output         | Strict field sets, bounded text, complete segment coverage, derived overall verdicts and exact literal citations.                                                     |
| Consensus            | Validators independently classify the input and semantically audit proposed reasons, quotes, summaries and rewrites. Disagreement or malformed output fails closed.   |
| Prompt injection     | Questions, drafts, references and candidates are explicitly treated as data, not instructions. This is defense in depth, not a guarantee of perfect model robustness. |
| Public data          | Consent before wallet invocation; conservative privacy checks; draft text stays in memory until deliberately submitted.                                               |
| Transaction recovery | Persist metadata before wallet invocation; serialize same-origin writes with Web Locks; preserve unknown outcomes; never automatically resend.                        |
| Receipt acceptance   | Bind hash, sender, recipient, exact method/arguments and zero value; require finalized successful execution and a matching stored result.                             |
| Deployment identity  | The browser compares fetched source bytes to the pinned SHA-256 before enabling writes. RPC and chain availability remain external dependencies.                      |
| Frontend rendering   | React text rendering, no model-generated HTML execution, no remote URL fetching, constrained HTTPS attribution links, no embedded private key.                        |
| Model trust          | Suggested rewrites invalidate the displayed draft assessment and must be checked again. Only a reviewer or owner may publish an eligible current answer card.         |

## Limits and unresolved release risks

- Real GenVM deployment and matching source bytes have been verified. Real model disagreement, prompt-injection resilience and the complete consensus timing matrix still need live evidence.
- The observed Studionet deployment receipt is regression-tested, including idle validator records, final-history conflicts and dropped zero values. Human wallet/provider and interrupted-session paths still require verification. Unsupported or conflicting receipt shapes stay unverified rather than being accepted.
- A finalized action can be followed quickly by another authorized change. If its expected postcondition is no longer visible, the app retains the recovery record instead of assuming success. Live concurrency testing must examine those cases.
- Privacy pattern matching is intentionally incomplete and may produce false positives. Public references can include public contact information; neither contract nor browser guarantees secret removal.
- A malicious owner can publish misleading references. The product must not present owner-attested content as independent fact checking.
- Global workspace and per-workspace limits are capacity bounds, not Sybil resistance. Public discovery and abuse policy need review before a broader launch.
- Public blockchain data cannot be deleted by archiving a workspace or retiring an answer card.
- Browser-storage corruption blocks writes until reconciled against wallet Activity. Clearing a recovery record never cancels a chain transaction.
- No real-money guarantees, insurance, custodial safety claims or automatic customer communications are made.

## Release procedure

Never publish `.env` files, seed phrases, test account private keys, generated wallet exports, Sites credentials, raw validator/model configuration or database credentials. The live harness exports only whitelisted public evidence fields, retaining only the public validator address from `node_config` where needed to bind a final-round result.

Before publication, run all local checks, repeat them from a clean Ubuntu checkout, execute the live and human-wallet matrix, verify deployed source bytes and inspect evidence while signed out. Do not submit until every applicable gate in `RELEASE-CHECKLIST.md` is backed by actual evidence.
