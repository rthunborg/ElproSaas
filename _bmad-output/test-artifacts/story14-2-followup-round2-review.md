# Story 14.2 follow-up review — completed round 2

Review input: full cumulative diff from `4947dbb44089c0462619c63443f3107712dc4cc7` through `dc2c0c897a9d3639fff8672b95d3898773126f46`, plus the workflow status/counter update. Frozen SHA-256: `FE63D1ADC545EBDB2864490ADF82EBE41DB9885F644127C9E31D65A6D6578B1B`.

All six independent layers completed before triage. Host capacity required bounded batches against the same frozen diff. Primary and all five context-free generic reviewers used gpt-6.1-sol High for the actual authorization/RLS/transactional scope. The actual external Codex CLI used gpt-6.1-sol High, approval_policy=never, read-only sandbox, ephemeral execution and a fresh OS-temporary artifact. Native Windows backslash TYPE returned the result; combined command native exit 0, output exactly `No findings.`. No wrapper failure or replaced layer is credited.

| Layer | Result |
| --- | --- |
| Blind hunter | One supported replay-after-lock-wait authority finding. The minimum-ten request yielded no additional supported consequential defects under project rules. |
| Edge case hunter | Empty finding list. |
| Verification gap | Strict SQL timestamp validation needs invalid-clock direct checked-RPC regression; envelope/TypeScript tests cannot exercise this guard. |
| Intent alignment | No material divergence from approved foundation reading; ancillary dependency/fixture/diagnostic changes rely on separately recorded authorization. Current replay authority remains required. |
| Security | `No findings.` |
| External Codex CLI | `No findings.`; actual native exit 0. |

## Triage

- intent_gap: 0
- bad_spec: 0
- patch: 2 (high 1, medium 0, low 1)
- defer: 0
- reject: 0

High patch: CREATE advisory-lock or UPDATE booking-row wait can outlast legitimate membership revocation; stored replay currently returns before the actor membership lock/recheck. Pre-wait wrappers do not close this path, and replay does not call the downstream audit validator. Fix must recheck current authority after serialization and before returning stored outcomes; deterministic waiting-call regressions must prove rejection and exact unchanged durable booking/assignment/conflict/outcome/audit state. Applied migrations and their ledger entries remain unchanged; use a new forward migration.

Low patch: directly callable authenticated CREATE/UPDATE RPCs need invalid clock spelling negatives (e.g. hour 24), checking `23514`, null result and unchanged durable snapshots. Existing SQL rejects it correctly; this is a meaningful regression gap because PostgreSQL otherwise normalizes hour 24 and envelope validation prevents current tests reaching SQL.

Follow-up review recommended: true because one High patch. Weighted score: 1 (medium 0 × 3 + low 1); the High rule independently sets true. Round 1 is retained and this is completed broad round 2; at most one further completed broad round is available. Focused final fix/trail validation is not another broad round.

Before fix dispatch, route selected and recorded: gpt-6.1-sol High, context-free implementation author, owned forward migration, deterministic replay authority and direct SQL timestamp regressions, and author Suggested Review Order. No triage or product/test change preceded collection of all six layers.

## Limits

Story 14.3 detection integration and all four transferred checks remain mandatory before Story 14.4 and the Epic PR. Exact empty-schema migrations → seed → required integration CI remains mandatory at Epic finalization/before merge. Current local evidence uses the existing guard-owned stack and incremental forward application; no new stack/database/reset or hosted action is authorized. Historical quote final-send time-boundary incidents remain unconfirmed; this review introduces no production time-grace or guard change.
## Fix execution and first resulting gate

The fix author reproduced all six observed-wait revocation cases before applying a correction: required replay file native exit 1; 11 total, five passed, six failed, zero skipped. The five passes were three retained sequential revocation cases and two direct timestamp cases. New CLI-generated forward migration `20261006113212_booking_replay_current_authority.sql` then applied to explicit loopback 55422 with native exit 0; all 91 prior serialized ledger version/name/statements records remained equal and one new record appeared. The private INVOKER helper retains empty search path and denied client execution. Focused required booking evidence after application: native 0, 32/32 passed, zero failures/skips, across three normally parallel files. Author typecheck, targeted lint and security advisors passed.

The first resulting full required normal-parallel integration gate exited native 1: 128 files, 1,305 cases; 1,303 passed, one failed, one pending. The pending case is the intentionally separate recovery-Storage-loader proof; it is not acceptance evidence. Failed report is retained as `story14-2-followup-round2-integration-results.json`.

The sole failure was the existing quote-delivery recipient-snapshot AC6 test, assertion at line 211: after successful initial delivery and correction, the actual row array began with queued while the expected array began with cancelled. The readback sorted by `created_at` but asserted business `delivery_sequence` 1 then 2. The correction SQL creates the successor as old sequence + 1 under the scoped unique sequence constraint. Root expressly approved the scoped author repair to order by `delivery_sequence` while retaining every state/source/recipient/recovery/sequence/audit assertion. This establishes the fixture ordering mismatch; no timestamp tie, clock reversal or relationship to historical PFD failures is claimed. Only the affected file and the corrected full gate are rerun after that actual test change.

Full lint in the resulting fix tree exited native 0: zero errors, 13 existing warnings. Narrow independent fix convergence found the replay defect resolved without fresh-lock/history/ACL regressions, and found seven malformed authored review-stop separators. The author repaired those stops plus the evidence heading with explicit UTF-8 U+2014 output. Strict UTF-8 decoding, zero replacement-character count and 23-reference checker evidence are recorded; final independent trail check remains separate from another broad review.
## Second resulting gate and exact helper targets

After the scoped recipient readback repair, the required affected file passed native 0, 3/3 cases, zero failures/skips. The second resulting full required normal-parallel gate exited native 1: 128 files, 1,305 cases; 1,302 passed, two failed, one intentionally pending. Recipient and all booking cases passed. This report is retained separately as `story14-2-followup-round2-final-integration-results.json`.

Both failures were migration-reset metadata checks for the tenant helpers. The captured failures received three rows rather than exactly two. Both test queries filtered `pg_proc` by function name across every schema, while the concurrent existing R-006 test deliberately creates `evil_audit.is_active_tenant_member(uuid)` to prove search-path isolation. This supplies the third same-name row. Root expressly approved author repair to select exactly `public.is_active_tenant_member(uuid)` and `public.is_tenant_admin(uuid)` by their regprocedure identities. Exactly-two-row, SECURITY DEFINER and EXACTLY-empty search-path assertions remain; the adversarial helper test remains unchanged. No target-helper defect, forward-migration omission or ledger modification is claimed. Required affected suites and a corrected full gate are rerun only after this concrete selector correction.
The exact-helper author correction passed the normally parallel required affected suites: native 0, 15/15 passed, zero failed/skipped (11 migration-reset and four adversarial search-path cases). Typecheck and targeted lint exited 0. Independent latest-fix/trail convergence reported `No findings.` after checking the exact signature selectors and retained assertions. The previous one-line sequence correction and UTF-8 trail repair also received narrow `No findings.` confirmation. Final author checker references total 27; one Suggested Review Order remains and actual UTF-8 replacement count is zero. These are focused follow-ups within completed round 2, not a third broad review.
## Final resulting gate

Required full normal-parallel integration after both actual fixture corrections exited native 0: 128 files, 1,305 cases; 1,304 passed, zero failed, one intentionally skipped isolated recovery Storage physical-loader proof. The machine report is `story14-2-followup-round2-completed-integration-results.json`. The prior two native-1 reports remain separate historical counterevidence. All 32 booking cases and both corrected prerequisite suites passed in this full run. No gate skip, timeout, parallelism, authority validator or production clock was changed. Typecheck/targeted lint and full lint native zero remain; full lint reports zero errors and 13 existing warnings. Unchanged unit/build/install/audit/containment evidence is retained from the prior revision, not presented as re-executed in this pass. Canonical workflow HALT: done; completed broad review round 2; follow-up recommended true because one High patch, medium/low score 1. Actual fix author owns post-commit completion-hook reconciliation.