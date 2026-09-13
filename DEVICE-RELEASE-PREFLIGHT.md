# ReplyCheck device and release preflight

Recorded 2026-09-13T12:21:13.7081340Z. **Local checks passed within scope; public release verification remains open.**

## Completed

- 25 layout checks: Check, Library, History, Reply Gym and Team at 320×640, 390×844, 768×1024, 1280×800 and 740×320 CSS pixels. No detected horizontal overflow.
- Narrow-screen byte/sentence errors and correction cleared correctly; disconnected visitors could not submit reviews.
- Public workspace history loaded 16 rows without connecting a wallet.
- Workspace dialog fit narrow/short screens with internal scrolling and restored focus on close.
- Page tools staged only the public test draft, submitted no transaction, and rejected implicit replacement. Context output excluded draft contents.
- No browser warning/error entries returned. Original empty in-app preview and viewport restored; human Chrome left untouched.
- All 59 preceding source/evidence pins remain unchanged. No source fixes were needed.

Detailed inputs, observations, assertions, restoration and release-state findings: [scoped evidence](evidence/browser/20260913-in-app-responsive-release-preflight.json).

## Still required

1. Approve the intended public repository and hosting provider. GitHub account is `sanity456`; `sanity456/reply-check` does not yet resolve. The existing ReplyCheck Sites registration has custom access and no published version or URL. Nothing was created, pushed or published during these checks.
2. Run the complete clean Ubuntu GitHub Actions workflow against the immutable release commit and require it to pass. Previous local results were 183 frontend + 97 contract tests and 20 registered evidence replays; they are **not** a public Ubuntu run. This follow-up did not rerun that suite or add these new JSON observations to its replay registry.
3. Test a real phone and any required additional browsers. The in-app viewport matrix is not physical-device, Safari or Firefox coverage. Edge control was unavailable.
4. Check the deployed site and every evidence link while signed out. Local wallet-disconnected access does not establish public evaluator access.
5. Tie the final evidence and concise steward response to the immutable release commit, including deployed contract/source verification.

No portal submission or wallet approval was performed. These results do not mean the product is 100% complete or accessibility-certified.
