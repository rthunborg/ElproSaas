# Epic 14 profile submission settlement — 2026-10-08

Author: `/root/checkpoint_sensitive`, explicitly routed to `gpt-6.1-sol` High for persistence verification. Scope: the first admin persistence scenario in `tests/e2e/resources-person-profile.e2e.spec.ts`, one file-private helper and the existing Story 14.1 review trail. Other authors own concurrent seed/helper changes. No product, SQL, permission, fixture, runner configuration, retry or timeout change is included.

## Evidence and diagnosis

The published `1cd4ec02` CI browser job passed natively with **196 passed / one flaky / four skipped**. The profile persistence case's first attempt failed after **17,429 ms** at its final success assertion; retry 1 passed after **3,657 ms**. The earlier local 23/23 resource pack remains separate evidence. The new booking seed patch was absent from that published head and cannot explain this attempt.

The ignored downloaded report was decoded as ZIP/JSON data without executing its HTML or launching a browser. Its failed retry-0 result binds the first-attempt error-context attachment. That snapshot shows the schedule panel present, an enabled save button, a validation alert, blank cleared fields, and the exception kind still selected as `blocked_time` while its date is blank. The test previously asserted the empty kind before its final date clear. This is a concrete inconsistent clear state; the server's partial-exception guard correctly rejects that shape. The snapshot does not establish a pending save, hydration failure, removed panel or failed database write.

Three successive invalid submissions asserted the same existing validation text. Such an assertion could finish before its own action completed. Installed Next React client source schedules a form reset for an action and later calls native `form.reset()` during commit. A prior action's reset restoring the initial selection between edits is therefore a supported explanation, **not a traced interleaving or proven sole cause**. No production fix is claimed from that inference.

## Repair

The affected scenario now uses `submitResourceAndSettle` for its three invalid submissions. It registers a real response witness before clicking, matching POST, a Next action header and the current origin/path. It then requires HTTP success, completed response body and rendered nonpending save state before subsequent edits. The initial successful submission retains its original saved-status assertion and reload before the first invalid response witness is registered; each preceding invalid request is then settled. An earlier request cannot satisfy the next witness by induction. The final successful clear retains its original click, saved-status assertion and reload/readback checks.

Existing fixture data, invalid inputs, three validation alerts, both success assertions, explicit empty-kind check and every reload/readback assertion remain intact. Other profile cases are unchanged. The response wait uses the existing 15-second bound, and the shared expectation, action, test timeout and CI retry settings are unchanged. No server response, acceptance receipt or persistence result is synthesized; no header, proof, fixture identifier or payload is logged.

## Executed checks and limits

- `node node_modules/typescript/bin/tsc --noEmit`: native 0.
- `node node_modules/eslint/bin/eslint.js tests/e2e/resources-person-profile.e2e.spec.ts`: native 0.
- Initial review-order check exposed one wrong author-report line reference; corrected to the actual server validation branch before final validation.
- `node scripts/verify/check-review-order.mjs` targeting the Story 14.1 spec and this report: native 0, 31 spec stops and six report stops, zero errors after correction.
- `git diff --check` targeting the three authored files: native 0.
- Author browser/database/service executions: zero. Parent owns guarded production browser verification and fresh CI.

The parent-owned first-patch four-profile run **failed natively: three passed / one timeout / zero skipped / zero flaky**, **81.658 seconds** for the invocation. The affected case exhausted its existing 60-second timeout after the first four helper calls completed; the final successful save was blocked at `response.finished()`. Its error-context attachment contains no page snapshot, only timeout/closed-page errors and test source. It therefore cannot establish saved UI, pending form, field state or a failed product write. The precise body-EOF blocking cause is unconfirmed, including any CDP/stream contribution. This failed run is retained, not waived or converted into a pass.

The first patch unnecessarily applied body completion to the two successful submissions, whose existing saved-status/reload assertions already supply server confirmation and navigation settlement. The authorized correction confines the extra barrier to the three invalid submissions; it does not catch the finished-response error, fabricate completion, or enlarge a timeout. The original flaky attempt and failed first-patch runtime remain counterevidence. Story 14.1 already has three broad rounds; this adds no broad round or completion credit.

Parent-owned corrected verification executed against the reused Next 16.3.8 production build with unchanged product source:

- Focused four-profile run: **four passed / zero failed / zero skipped / zero flaky**, native 0, report statistics **6.675 seconds**. Report: `tmp/epic14-closeout-stack/browser-profile-settlement-four-corrected.json`.
- One complete booking/profile resource pack: **23 passed / zero failed / zero skipped / zero flaky**, native 0, report statistics **65.835 seconds**. Report: `tmp/epic14-closeout-stack/browser-harness-final-23.json`. These are actual complete-pack results, not an extrapolation from the focused run.
- Independent `gpt-6.1-sol` High narrow review of corrected test SHA256 `3618CD359BF41D848DF62AB24E8493BA6C44D9DF75FC31DEF6D00077E4009C3B`: **no consequential findings**. No broad round or reviewer runtime credit is added.

After consumers finished, the parent received accepted Stop requests for its three guarded resources, preserving saved state. Acceptance does not assert verified shutdown. Final post-pack marker count was zero and hook count three. The author launched no resources and executed no browser/database tests.

Fresh full CI for this patch remains pending. The two local passes neither erase the original CI first-attempt failure nor prove the inferred reset interleaving or the failed first patch's EOF cause. Representative performance, manual physical/daylight and Story 15.1 calendar requirements retain their separately recorded status; no epic completion or merge claim follows from this bounded repair.

## Suggested Review Order

### Tie each edit sequence to its own completed submission

The helper witnesses real transport and rendered readiness before another edit. Existing fixture assertions still establish the actual persistence and invalid-input outcomes.

- `tests/e2e/resources-person-profile.e2e.spec.ts:33` — `submitResourceAndSettle`: settles each invalid submission in the affected scenario.
- `tests/e2e/resources-person-profile.e2e.spec.ts:38` — `responsePromise`: registers before the click using a bounded real response witness.
- `tests/e2e/resources-person-profile.e2e.spec.ts:46` — `response.finished`: requires completed response body transport.
- `tests/e2e/resources-person-profile.e2e.spec.ts:49` — `toBeEnabled`: waits for rendered nonpending state before later edits.
- `tests/e2e/resources-person-profile.e2e.spec.ts:98` — `toHaveValue`: preserves explicit exception-kind clearing.
- `src/features/resources/actions.ts:59` — `hasPartialWorkTime`: retains server refusal of incomplete exception/calendar inputs.

Evidence: actual static checks, independent narrow review and parent-owned corrected 4/4 and complete 23/23 runs above. Limits: exact reset timing and the failed first patch's EOF cause remain untraced; original failed attempts are preserved and fresh full CI is still pending.
