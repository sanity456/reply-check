# ReplyCheck UI audit — September 13, 2026

## Current release scope

The scoped desktop checks below are complete and retained as historical observations, not full accessibility certification. The app is now [publicly hosted](https://reply-check-sanity3.vercel.app/); [STEWARD-RESPONSE.md](STEWARD-RESPONSE.md) and [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) describe current release verification. Owner review and portal submission remain. Physical-phone testing is optional and outside the agreed scope; other engines, broader speech coverage and independent conformance certification are not claimed.

All checkpoints below retain their original counts, source references and then-pending work. They do not override current release status. [Exact pre-clarification report bytes](evidence/source-snapshots/20260913-before-release-clarification/document-bytes.json) preserve the document hashes recorded by the original evidence. No browser, wallet or native preference test is rerun by this text change.

## Historical checkpoints

## Latest native follow-up: human-reported Narrator speech

**Scoped listening checks completed.** With Windows Narrator 10.0.26100.8972 running against the rebuilt Chrome preview, the human reported hearing the Question label and its 1,500-byte error guidance, the reply's 3,000-byte error guidance, and the “Check this reply” dialog title plus consent-checkbox label. These are human reports, not captured audio or an exact speech transcript. The earlier general-page-reading response remains inconclusive for the reply error; the specific later confirmation is preserved separately.

Correcting the public fixture cleared both field errors and invalid states in the DOM. The unsigned dialog kept consent unchecked and Continue to wallet disabled, then was cancelled without a wallet request. Original valid draft, latest review and all 16 history rows were restored. Windows Narrator was turned off through its accessibility settings, verified by both the visible Off switch and absence of the Narrator process. The pre-existing Settings window was minimized again; browser zoom and motion/contrast preferences remain unchanged.

[Narrator closure evidence](evidence/browser/20260913-native-screen-reader-closure.json) links the exact prompts, human responses, observations and earlier source checkpoint. Application, contract, dependency and test files are unchanged; the preceding 280-test/20-replay results were not rerun for this evidence/documentation-only follow-up. The three prior reports are archived byte-for-byte before this update. Exact spoken “invalid” state, announcement timing/order, speech on other screens, physical devices and other browser/screen-reader combinations remain unverified. This is not full accessibility conformance or submission approval.

## Latest fix: A11Y-05 field-specific draft errors

**Implemented and retested.** Each draft field now exposes its own `aria-invalid` state and directly associated polite error text. Untouched empty fields are not marked invalid; blur or invalid nonempty input activates feedback, and correction clears it. Existing counters remain associated. The combined validator still controls submission, including privacy matches spanning both fields, and wallet/permission/recovery guards are unchanged. The purple/gold design is preserved.

The full existing Windows suites pass **183 frontend and 97 contract/tooling tests (280 total)**, including 13 new feedback/history regressions. All 20 registered saved-evidence replays, lint, formatting, types and production build pass. The rebuilt Chrome preview passed **16 scoped checks across 19 observations**: empty/blur behavior, simultaneous errors, ASCII/accent/emoji boundaries, sentence limits, synthetic privacy warnings, correction, keyboard focus and restoration of the original public fixture/latest review with 16 history rows. The measured viewport was 638×608 CSS pixels at 100% zoom; no horizontal overflow was detected. No review confirmation or wallet request was opened.

[Field-feedback fix evidence](evidence/local/20260913-draft-field-feedback-fix.json) pins the changed source and preserves the older native zoom/preference observations without relabeling them as tests of this build. The form's original bytes are archived; two older replays explicitly use that historical form snapshot while other pins remain strict in their declared scope. No old evidence JSON or replay inventory entry changed. This new browser record still needs consolidated release-CI coverage. Actual screen-reader speech, physical devices, other engines and a fresh enlarged/preference check of the changed form remain unverified; the earlier native tests below describe the preceding build.

## September 13: native enlargement and reliability check

The human set Chrome to **200%**. Measured device-pixel ratio doubled from 1.5 to 3 and the viewport changed from 638×608 to 319×304 CSS pixels. All five main screens fit without detected horizontal overflow. The draft-consent and answer-card dialogs stayed within the short viewport, scrolled internally and returned visible focus after Escape. Forward/reverse keyboard navigation stayed inside the consent dialog; its checkbox remained unchecked and Continue to wallet stayed disabled. No wallet request was made. The human restored 100% zoom, verified by the original dimensions and pixel ratio.

The full local suites passed again: **170 frontend and 97 contract/tooling tests**, plus **20 saved-evidence replays**, lint, formatting and typecheck. These use the existing locked Windows environments, not a clean Ubuntu install, live model rerun or public CI. The existing production preview stayed running; it was not rebuilt in this audit. A real missing-review lookup produced safe alert feedback, retry cleared it, and a later successful result did not steal the user's selected Team tab. The original review was reopened, with 16 history rows still present.

[Saved checkpoint](evidence/browser/20260913-native-accessibility-reliability.json): 30 browser observations, 15 passing scoped checks and one improvement recommendation. All 39 compared source/evidence pins match the preceding verified checkpoint. This new JSON record is not yet part of the consolidated public-CI evidence replay.

### A11Y-05 · Improve field-specific draft errors

Historical finding, resolved by the separately recorded fix above. The observations below remain the pre-fix record.

Recommendation, not a demonstrated WCAG conformance failure: at 1,501 question bytes or 3,001 reply bytes, Review draft is correctly disabled and a polite general hint explains the limit. However, neither textarea exposes `aria-invalid`, and its `aria-describedby` references counters rather than the actual error instruction. A user returning focus to the invalid field may benefit from that direct association. The answer-title dialog already has this stronger pattern.

Suggested change: derive field-specific validation state, associate a concise error with its field, and apply `aria-invalid` only after an actual validation failure. Preserve the existing byte counters, privacy checks, live feedback and submission gates. See [W3C ARIA21](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA21) and [ARIA1](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA1); these are techniques, not mandatory implementation choices. No application fix was made during this checks-only task.

A test-input replacement briefly left a shrinking textarea offscreen. Repeating the replacement using keyboard select-all and typing kept it visible, so this is preserved as a test-method observation, not asserted as a native typing defect.

### Native preference follow-up: passed and restored

The human turned Windows Animation effects off, and Chrome independently reported `prefers-reduced-motion: reduce`. Computed animation/transition durations were **0.01 ms**, with one animation iteration and automatic rather than smooth scrolling, across all five main screens and both tested dialogs. The actual visible refresh spinner also had one 0.01 ms iteration. Both dialogs remained usable and returned visible focus after Escape. [Reduced-motion evidence](evidence/browser/20260913-native-reduced-motion.json) records 12 passing scoped checks. The browser bridge did not expose an animation-timeline API; no frame-by-frame or screen-reader speech claim is made.

Using the native Windows Settings window after the human reopened it, the agent restored Animation effects to On, temporarily applied the **Aquatic** contrast theme, then restored the original **None** theme. Chrome independently reported forced colors active during the test and inactive after restoration. All five screens fit, the decorative flecks disappeared, and system-colored text, inputs, panel/button borders and keyboard focus remained visible. Both dialogs stayed readable/cancellable and restored visible focus. [Contrast/restoration evidence](evidence/browser/20260913-native-contrast-restoration.json) records 11 passing scoped checks and the final original preferences: reduced motion false, forced colors false, 100% zoom, 16 loaded reviews and no dialog/recovery request. The earlier pending-preference/restoration JSON files remain byte-for-byte historical checkpoints.

No application source, dependency, contract or wallet operation changed. The preceding 267-test/20-replay full run was not repeated for these evidence/documentation-only preference checks; source/evidence pins are reverified. The new records still need consolidated offline/CI coverage. Browser policy blocked direct Chrome-settings navigation and no workaround was used; only the permitted native Windows Settings surface changed OS display preferences. Actual screen-reader announcements, physical devices and other engines remain unverified. Aquatic is one tested contrast theme, not every supported system/theme combination, and DOM semantics are not proof of spoken announcements.

Status: **Local UI, reliability and accessibility follow-ups pass within their recorded scope; live/native accessibility and release gates remain**.

The original Chrome pass recorded 55 browser snapshots and 53 checks: 49 passed and four identified issues. Its observations are preserved below. This is not a complete accessibility certification or submission approval.

## Latest follow-up: local reliability and accessibility

Two additional regressions were reproduced and fixed: a stale failed wallet-state read can no longer add an error after newer successful hydration, and reduced-motion animations are limited to one negligible iteration instead of looping indefinitely. The established purple/gold design and installed UI primitives are preserved. The send, check and recovery callbacks remain byte-identical at the AST-initializer level.

The complete local suite now passes **237 tests (140 frontend, 97 contract/tooling)**, including 20 new isolated session and accessibility regressions. Twelve focused Chrome checks across 16 observations cover mobile labels/reflow, keyboard navigation, unsigned consent cancellation/reset, safe alert/status semantics and clean closing state. No wallet request or on-chain action was initiated. Original evidence remains unchanged.

[Reliability/accessibility evidence](evidence/browser/20260912-reliability-accessibility.json), SHA-256: `7a2c61285b3de570544a0c796a3a0dbb658a8a9e20e703ed4b2b80b1a3a5b0e3`.

```sh
node evidence/browser/replay-20260912-reliability-accessibility.mjs
```

Important limits: native zoom shortcuts produced no measured enlargement, so 200% text/zoom remains unchecked. Reduced-motion and forced-colors behavior are source-tested, not browser-emulated. DOM label and live-region checks do not replace a live screen reader. Ten opaque theme pairs meet the [W3C minimum text-contrast threshold](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html); gradients, every interactive state, physical devices and other browser engines are not certified. Simulated concurrency is not a live wallet race. Public CI and evaluator access remain open.

## Earlier follow-up: resize focus and reference-gap wording

The answer-card dialog now reveals its restored trigger after closing, including a resize while it was open. The app does not move focus itself or override the installed dialog primitive. It scrolls only the still-focused, connected, enabled, rendered trigger; a newer dialog or navigation focus is left alone.

For `UNSUPPORTED / NOT_IN_REFERENCES`, the UI now offers an explicitly labeled local rewrite: “The references do not confirm this claim: …”. The exact original claim follows it. This avoids inventing a replacement policy. The recorded suggestion remains accessible under **Original recorded suggestion**; the assessment, original-reply copy and JSON export are unchanged. Applying a local suggestion still requires a new check. This is a UI editing aid, not a changed deployed prompt or a newly validated model answer.

The full local suites now pass **120 frontend tests and 97 contract/tooling tests (217 total)**. Thirteen additional [regressions](tests/web/focus-wording.test.mjs) cover focus guards, real app callbacks/rendering, the actual mixed-claim fixture, immutable export/copy, local apply output, alternate topics and escaped markup. Typecheck, lint, formatting and production build pass. The Sites build helper encountered a Windows npm-path error; the unchanged pinned project build command succeeded instead.

The rebuilt preview passed **12 focused Chrome checks across 19 observations**. At 740×320, Escape after resize returned the approval button at y=272.65–314.65, inside the viewport. Keyboard trapping, internal scrolling, fixed portrait/landscape return and portrait-to-landscape Close also pass. The local rewrite, expandable original suggestion and mobile width were checked against the existing historical review. Ten reviews, empty drafts, the original matching v2 review and the default viewport were restored; no wallet request was initiated.

[Focus and wording evidence](evidence/browser/20260912-focus-wording-verification.json), SHA-256: `3966c1ae5ce0c5e19b9a4c341ac0dd962e25b5974e7b30e265dafc7fb420b7b7`.

```sh
node evidence/browser/replay-20260912-focus-wording.mjs --historical-ui
```

This older replay validates saved observations against exact historical frontend snapshots, while other source pins still check current files; it does not run a fresh browser test. Original failures and model output remain byte-for-byte preserved. Contract, signing code, deployment, dependency locks and the existing visual design were unchanged in that follow-up. No GitHub push or publication occurred. Other browser engines, physical mobile devices, live screen readers, broader live reliability and release gates remain open.

## Earlier UI-01–UI-04 verification

All four fixes are implemented:

- UI-01: the shared popup has a dynamic-viewport height limit and internal scrolling.
- UI-02: opening a review navigates immediately; late results never select a tab. Revision/workspace guards discard stale reads, including leaving and returning to a workspace and unmounting. Direct review links also preserve newer navigation.
- UI-03: manual/direct-link read errors use safe lookup-specific feedback, clear on retry, and never change wallet/recovery errors. A new lookup clears the old assessment.
- UI-04: titles show UTF-8 byte counts, an associated over-limit instruction, invalid state and a polite live announcement. Empty and over-100-byte titles stay blocked.

The complete local suites pass **107 frontend tests and 97 contract/tooling tests**, with typecheck, lint, formatting and production build passing. The 13 new [regressions](tests/web/ui-audit-regression.test.mjs) execute actual component handlers with deferred reads, test ASCII/accent/emoji boundaries against the publication gate, and check field association and the dialog stylesheet. See the separate [verification record](evidence/browser/20260912-ui-fix-verification.json) for source pins and limits.

After the user approved reopening Chrome, the focused retest passed **20 checks across 35 preserved observations**. The 740×320 dialog is bounded at y=16 through y=304 and scrolls internally; Tab brings the publication control into view. Forward/reverse focus trapping and fixed-size Escape/focus return pass. Portrait layout, ASCII/accent/emoji byte boundaries, empty titles, trimming, error/retry behavior and delayed navigation through manual and direct-link reads also pass. The copied review link opens the existing matching v2 assessment; the final page retains ten reviews, empty drafts, no dialog/recovery warning and the restored default viewport.

[Fresh Chrome evidence](evidence/browser/20260912-ui-fix-browser-retest.json), SHA-256: `a463a516722b6cf95cb90bd13950f1d5f4140664a526dca2baf81ce3ccd4a6cf`.

```sh
node evidence/browser/replay-20260912-ui-fix-browser.mjs --historical-ui
```

This command validates the saved observations and explicit historical UI snapshots; other pins still check current source. It does not rerun Chrome. The prior automated record remains unchanged as a historical pre-browser checkpoint. No app source, signing code, contract or deployment changed during that retest. No publication or wallet signature was requested, and nothing was pushed or hosted.

That earlier checkpoint recorded an accessibility edge: after resizing an already-open dialog, Escape returned focus to its trigger but the trigger could be below the viewport. The original observation is preserved, and the latest follow-up above fixes and retests that answer-card case. General page-wide focus scrolling, physical devices, live screen readers and other browser engines are not claimed complete. The existing owner wallet session was reused, so this is not signed-out evaluator proof.

## Original audit: what passed

- All five main screens fit at 320, 390, 768 and 1280 CSS-pixel widths: 20 screen/size combinations without detected horizontal overflow.
- Keyboard focus trapping, Escape/focus return, manual tab activation and the skip link's next keyboard stop work.
- Invalid review IDs, empty questions, question-byte/sentence limits, empty titles and invalid reference versions are blocked.
- Copying a review URL and reply preserves the exact text. The copied link opens the correct review in another local Chrome tab.
- A fresh JSON export exactly matches the previously verified stored review and reference bundle, including the original chain timestamp.
- Historical v1 and current v2 references remain distinct; mobile answer cards and the reference editor fit.
- The unsigned confirmation keeps consent unchecked and wallet continuation disabled. It was cancelled without a wallet request.

## Original findings and browser reproductions

### UI-01 · Short-screen answer-card dialog

At 740×320, the dialog is about 369px tall and extends above and below the viewport. Unlike the workspace chooser, it has no internal scrolling.

Reproduce: open the latest matching review, choose **Approve answer card**, then use a 740×320 viewport. Do not choose Review publication.

Fix: add a dynamic-viewport height bound and scrolling to the relevant dialog popup. Retest short landscape, portrait and keyboard focus.

Source: [answer-card dialog](components/reply/reply-app.tsx).

### UI-02 · Late lookup changes the selected tab

Start opening a valid review, then select Team while it loads. When the read completes, History appears again even though focus remains on Team.

Fix: preserve newer navigation choices and guard late/out-of-order reads. Avoid switching tabs unconditionally after an awaited lookup.

Source: [lookup completion](components/reply/reply-app.tsx).

### UI-03 · Stale and misleading lookup feedback

A failed read-only review lookup displays a connection/transaction-hash warning. A subsequent successful lookup leaves that earlier alert visible until manually dismissed.

Fix: use lookup-specific safe feedback and clear the appropriate read error on retry/success. Keep wallet recovery errors separate; never expose raw RPC data.

Sources: [lookup handling](components/reply/reply-app.tsx), [unchanged wallet fallback](lib/reply/core.ts).

### UI-04 · No explanation for an overlong title

Entering 101 ASCII characters in Answer title disables Review publication, but shows no 100-byte limit, counter or field-associated error.

Fix: provide concise UTF-8 byte-limit guidance associated with the field while retaining the existing guard.

Source: [title validation](components/reply/reply-app.tsx).

## Evidence and limits

[Browser evidence](evidence/browser/20260912-usability-audit.json), SHA-256:

`a4832aa075a342802f83b821498e7025a5800ad82a46ce4168f23ceabfdaed1f`

Offline evidence-consistency replay:

```sh
node evidence/browser/replay-20260912-usability.mjs --historical-ui
```

The replay validates saved evidence, not a fresh browser session. The four original failures are expected and preserved. Its explicit `--historical-ui` mode verifies the changed UI files against [byte-exact pre-fix snapshots](evidence/source-snapshots/README.md); all other source pins still check the current source. Without the flag, the original current-source pins remain mandatory.

During the original audit, no application, contract, deployment or dependency lock was changed; fifteen source/lock hashes were checked. No transaction was sent, no wallet consent was approved, and nothing was pushed or published. Temporary test inputs/tab were cleared or closed, the original viewport was restored, and that audit ended on its existing ten-review history with no pending UI. The subsequent fixes change only UI, tests and local documentation/evidence; contract, signing hook, chain client, receipt verifier, deployment and dependency locks remain unchanged.

The direct-link tab reused the existing B wallet session: this is not signed-out evaluator access. Physical mobile devices, a live screen reader, zoom/forced-colors/reduced-motion behavior, other browser engines, remaining transaction/reliability cases and public Ubuntu CI still need their own checks.
