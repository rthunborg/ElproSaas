# Epic 14 profile submission settlement — 2026-10-08

Author: `/root/checkpoint_sensitive`, explicitly routed to `gpt-6.1-sol` High for persistence verification. Scope: the first admin persistence scenario in `tests/e2e/resources-person-profile.e2e.spec.ts`, one file-private helper and the existing Story 14.1 review trail. Other authors own concurrent seed/helper changes. No product, SQL, permission, fixture, runner configuration, retry or timeout change is included.

## Evidence and diagnosis

The published `1cd4ec02` CI browser job passed natively with **196 passed / one flaky / four skipped**. The profile persistence case's first attempt failed after **17,429 ms** at its final success assertion; retry 1 passed after **3,657 ms**. The earlier local 23/23 resource pack remains separate evidence. The new booking seed patch was absent from that published head and cannot explain this attempt.

The ignored downloaded report was decoded as ZIP/JSON data without executing its HTML or launching a browser. Its failed retry-0 result binds the first-attempt error-context attachment. That snapshot shows the schedule panel present, an enabled save button, a validation alert, blank cleared fields, and the exception kind still selected as `blocked_time` while its date is blank. The test previously asserted the empty kind before its final date clear. This is a concrete inconsistent clear state; the server's partial-exception guard correctly rejects that shape. The snapshot does not establish a pending save, hydration failure, removed panel or failed database write.

Three successive invalid submissions asserted the same existing validation text. Such an assertion could finish before its own action completed. Installed Next React client source schedules a form reset for an action and later calls native `form.reset()` during commit. A prior action's reset restoring the initial selection between edits is therefore a supported explanation, **not a traced interleaving or proven sole cause**. No production fix is claimed from that inference.

## Repair

The affected scenario uses `submitResourceAndSettle` for its three invalid submissions. Before clicking, it acknowledges installation of a DOM-only MutationObserver on the current enabled save control and registers a real response witness matching POST, a Next action header and the current origin/path. After HTTP success it requires an observed disabled true→false cycle on that same connected control. `useActionState.pending` directly drives this disabled attribute in the existing product component. Recording attribute old values retains a fast cycle even when both mutations reach one callback. An initially enabled control or old validation alert cannot satisfy the witness; remount fails, and `finally` disconnects the observer and deletes its private state.

The initial successful submission retains its original saved-status assertion and reload before the first invalid response witness is registered; each preceding invalid pending cycle is then settled. An earlier request cannot satisfy the next witness by induction. The final successful clear retains its original click, saved-status assertion and reload/readback checks. Whole RSC stream EOF is no longer treated as action-state settlement; its earlier blocking cause remains unconfirmed.

Existing fixture data, invalid inputs, three validation alerts, both success assertions, explicit empty-kind check and every reload/readback assertion remain intact. Other profile cases are unchanged. Response and pending-cycle waits use the existing 15-second bound; shared expectation, action, test timeout and CI retry settings are unchanged. No server response, acceptance receipt or persistence result is synthesized; no header, proof, fixture identifier or payload is logged.

## Executed checks and limits

- `node node_modules/typescript/bin/tsc --noEmit`: native 0.
- `node node_modules/eslint/bin/eslint.js tests/e2e/resources-person-profile.e2e.spec.ts`: native 0.
- Initial review-order check exposed one wrong author-report line reference; corrected to the actual server validation branch before final validation.
- Earlier EOF-variant review-order check: native 0, 31 spec stops and six report stops, zero errors after correction; earlier whitespace check native 0.
- Latest pending-cycle variant: TypeScript and targeted ESLint native 0; review-order checker native 0, 32 spec stops and seven report stops, zero errors.
- Author browser/database/service executions: zero. Parent owns guarded production browser verification and fresh CI.

The parent-owned first-patch four-profile run **failed natively: three passed / one timeout / zero skipped / zero flaky**, **81.658 seconds JSON-reported run duration**. The affected case ran for 60,025 ms, exhausting its existing 60-second timeout after the first four helper calls completed; the final successful save was blocked at `response.finished()`. Its error-context attachment contains no page snapshot, only timeout/closed-page errors and test source. It therefore cannot establish saved UI, pending form, field state or a failed product write. The precise body-EOF blocking cause is unconfirmed, including any CDP/stream contribution. This failed run is retained, not waived or converted into a pass.

The first patch unnecessarily applied body completion to the two successful submissions, whose existing saved-status/reload assertions already supply server confirmation and navigation settlement. The authorized correction confines the extra barrier to the three invalid submissions; it does not catch the finished-response error, fabricate completion, or enlarge a timeout. The original flaky attempt and failed first-patch runtime remain counterevidence. Story 14.1 already has three broad rounds; this adds no broad round or completion credit.

Parent-owned corrected verification executed against the reused Next 16.3.8 production build with unchanged product source:

- Focused four-profile run: **four passed / zero failed / zero skipped / zero flaky**, native 0, report statistics **6.675 seconds**. Report: `tmp/epic14-closeout-stack/browser-profile-settlement-four-corrected.json`.
- One complete booking/profile resource pack: **23 passed / zero failed / zero skipped / zero flaky**, native 0, report statistics **65.835 seconds**. Report: `tmp/epic14-closeout-stack/browser-harness-final-23.json`. These are actual complete-pack results, not an extrapolation from the focused run.
- Independent `gpt-6.1-sol` High narrow review of corrected test SHA256 `3618CD359BF41D848DF62AB24E8493BA6C44D9DF75FC31DEF6D00077E4009C3B`: **no consequential findings**. No broad round or reviewer runtime credit is added.

After consumers finished, the parent received accepted Stop requests for its three guarded resources, preserving saved state. Acceptance does not assert verified shutdown. Final post-pack marker count was zero and hook count three. The author launched no resources and executed no browser/database tests.

Fresh published `992df83b` CI subsequently failed its general browser job with **191 passed / six failed / four skipped**, approximately **7.3 minutes**. The profile case failed both attempts at its existing 60-second timeout, blocked on `response.finished()` during the **first invalid submission**. Five separate operator cases fail with `42501` at their owned seed-hook boundary; that independently owned repair is not attributed to this profile helper. The earlier local 4/4 and 23/23 passes remain evidence for the EOF variant, not proof that it passed fresh CI. No precise EOF/stream/CDP cause is established by the timeout.

The latest pending-cycle repair removes the unreliable EOF barrier while preserving real action-response and observed rendering evidence. Independent Sol 6.1 High narrow review found **no consequential findings**, bound to current test SHA256 `469E56B6049EBC369DADB8DA61E0EB525E3D31AF19CADDB5D4D2D9163F18E8B8`; the reviewer verified all test bodies remained unchanged by this helper replacement.

The parent-owned complete two-file profile/operator-console pack then passed natively with **12 passed / zero failed / zero skipped / zero flaky**, **28.741 seconds JSON-reported run duration**. It executed all four profile cases and eight operator cases against the rebuilt combined-main Next 16.3.8 production app. The ignored report `tmp/epic14-closeout-stack/browser-profile-pending-operator.json` independently contains expected12/unexpected0/skipped0/flaky0, duration28,740.754ms and zero top-level errors. Parent post-run SQL readback reports zero editor markers and three hooks. These actual results cover the previously failed profile journey and the five operator setup paths; they remain local evidence, not a fresh CI pass.

Fresh full five-job CI for this latest variant remains pending. The original CI first-attempt failure, both EOF failures and earlier local passes remain distinct evidence. Original reset timing and EOF/stream/CDP cause remain unproven. Representative performance, manual physical/daylight and Story 15.1 calendar requirements retain their separately recorded status; no official completion or merge claim follows from this bounded repair.

## Suggested Review Order

### Tie each edit sequence to its own completed submission

The helper witnesses real transport and rendered readiness before another edit. Existing fixture assertions still establish the actual persistence and invalid-input outcomes.

- `tests/e2e/resources-person-profile.e2e.spec.ts:33` — `submitResourceAndSettle`: settles each invalid submission in the affected scenario.
- `tests/e2e/resources-person-profile.e2e.spec.ts:47` — `new MutationObserver`: retains the actual pending cycle including fast mutations.
- `tests/e2e/resources-person-profile.e2e.spec.ts:57` — `responsePromise`: registers before clicking using a bounded real action-response witness.
- `tests/e2e/resources-person-profile.e2e.spec.ts:67` — `expect.poll`: requires the observed cycle on the same connected control.
- `tests/e2e/resources-person-profile.e2e.spec.ts:77` — `disconnect`: cleans observer state after each invalid submission.
- `tests/e2e/resources-person-profile.e2e.spec.ts:130` — `toHaveValue`: preserves explicit exception-kind clearing.
- `src/features/resources/actions.ts:59` — `hasPartialWorkTime`: retains server refusal of incomplete exception/calendar inputs.

Evidence: latest actual static checks, independent High narrow review and parent-owned complete 12-case production pack, with historical runs separately attributed above. Limits: fresh five-job CI remains pending, exact original reset timing and EOF failure causes remain untraced, and all failed attempts are preserved.
