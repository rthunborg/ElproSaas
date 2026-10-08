# Epic 14 concurrent-create fixture closeout — 2026-10-08

Author: `/root/kernel_fix`, explicitly `gpt-6.1-sol` High for sensitive replay/transaction identity. Bounded test-only repair over `abff9615b6a5b6540953f2efb28454076f007deb`. Ownership: `tests/integration/commands/bookings.int.test.ts`, `tests/support/bookings-atdd.ts`, this record, and the existing Story14.2 author trail. Parent owns runtime execution, resources, Git and official completion metadata. No production command, SQL, cache, grants, worker/configuration, timeout, retry or skip change.

## Failure evidence and diagnostic limit

Fresh CI run `37780712377` passed verify (2,153 unit cases), isolated recovery (one case), dashboard browser (57 cases), and general browser (197 passed / zero failed / zero flaky / four inherited skipped). Its REQUIRED database gate failed with **1,477 total / 1,475 passed / one failed / one inherited skip**, **267.56 seconds**. The only failure was INT-005's four-success assertion for concurrent identical booking creates. That original assertion recorded no failure codes, so its specific cause remains unobservable. The raw failed evidence `ci-abff9615-db.log` is retained; skipped cases receive no coverage credit. No pilot execution is inferred.

Parent's first plain focused run with sanitized command diagnostics passed **one case / zero failed / 15 excluded**, native 0, in `integration-concurrent-create-diagnostic.json` / `.log`. This was not a complete16-case pass and did not reproduce the CI failure.

Read-only source inspection found a separate reachable fixture path. The helper prepares an implicit review within each call and checks its review cache only before awaiting the real snapshot. SQL already enforces current authorization, tenant/command serialization and the full reviewed-decision replay digest. A fourth cache-missing helper whose snapshot arrives after another real save commits can submit an absent decision instead of the committed nonempty reviewed decision. SQL correctly refuses that different canonical identity with `BK409`; the helper catches the pre-review error and the actual envelope then returns `COMMAND_CONFLICT`. This finding identifies a test-adapter path, not a production idempotency bypass.

The parent executed an authorized controlled diagnostic using the **existing case and original assertions**. A temporary shared real-client RPC proxy waited for all four real preview requests/cache misses, forwarded three real previews, then forwarded the fourth only after observing a successful real committed finalize response. It fabricated no reply, performed no retry and changed no budget. The first run failed **zero passed / one failed / 15 excluded**, native 1, with three successful outcomes and one `COMMAND_CONFLICT`; the JSON-only reporter omitted console stage evidence. The parent repeated solely to capture that missing witness using JSON plus the default reporter. `integration-concurrent-create-controlled-witness.json` / `.log` again records **zero passed / one failed / 15 excluded**, native 1, **925.7382 ms for the executed case**, and sanitized evidence:

- `first_four_snapshots_arrived=true`, `real_commit_observed=true`.
- Real `snapshot_booking_editor` rejection: `BK409`, no claims.
- Pre-review rejection: `BK409`, fixed reason `pre-review-rejected`.
- Envelope outcome: `COMMAND_CONFLICT`; the other three outcomes succeeded.

Invocation-array position differs from snapshot-arrival order, so the failing array index varied without changing the observed path. The earlier controlled failure without its console witness remains retained. These actual controlled failures prove the reachable helper race; they do not establish the missing codes from the original CI failure.

## Final test contract and current checks

INT-005 now prepares **one actual signed reviewed input before dispatch**, positively checking that the review exists, acknowledges nonempty reviewed warning IDs, and selects no acceptance IDs. It then passes that same complete command to **four real saves in the original `Promise.all`**. All four must succeed and return identical results. The original independent SQL assertions still require one booking, two exact assignees, one attributable audit, the stored create command/result and an empty update-outcome map. Preparing the command does not serialize those four writes or borrow a fabricated review/result.

The temporary flag, proxy and barriers are entirely removed. Support retains only the approved opt-in current-editor RPC diagnostics and sanitized pre-review error observation. Its code sanitizer emits a five-character SQLSTATE or `unknown`, never the raw error message. Existing proof readback contains booleans/relative clock deltas and remains labeled as **after-failure readback**, not the rejecting transaction's snapshot. No arguments, receipts, tokens, model/tenant/user data or raw payloads are printed.

Author focused ESLint, TypeScript `--noEmit` and whitespace checks pass native 0; a source search confirms the temporary control is absent. Parent's repaired **complete REQUIRED booking file** passed **16 total / 16 passed / zero failed / zero skipped or excluded**, native 0, **26.487 seconds from JSON start to the last file end**, saved in `integration-concurrent-create-final-full16.json`. Post-pack SQL found **zero editor markers / three hooks**. This includes the repaired real concurrent-create case and every other existing booking-file obligation; the earlier one-case pass was not full-file coverage.

Independent `gpt-6.1-sol` High source review returned **no findings**, bound to test SHA256 `035a751d5c8480e941029622dc4828ede75815a331cfe4250d0abb24eaeb7939` and support SHA256 `031b9d2b24db41ffc1659c7df33fe8677db1bc469bc20b441a07342b7875f4b2`. It confirmed the temporary control is absent and all four actual writes, result equality and durable assertions remain. Review and runtime are separately attributed; this author ran no database/browser/service/integration command or self-review. Final author-trail verification and fresh five-job CI remain pending; no official completion flag or workflow state was applied.

Original broad rounds remain3/2/2/2 across Stories14.1–14.4. This is latest-fix verification with no new broad pass or score waiver. Performance/daylight/manual and Story15.1 calendar obligations remain open.

## Suggested Review Order

Author: `/root/kernel_fix`, actual bounded fixture/diagnostic fix author.

### Build one complete command, then race its four real writes

The reviewed decision belongs to canonical replay identity. Preparation supplies one real signed command; dispatch and all durable assertions retain the original concurrency contract.

- `tests/integration/commands/bookings.int.test.ts:245` — `reviewedFixtureInput`: obtains one real review before dispatch.
- `tests/integration/commands/bookings.int.test.ts:247` — `decision.acknowledged`: preserves meaningful nonempty review as a positive control.
- `tests/integration/commands/bookings.int.test.ts:249` — `selectedLogicalIds`: selects no acceptance IDs.
- `tests/integration/commands/bookings.int.test.ts:250` — `Promise.all`: executes all four real commands concurrently.
- `tests/integration/commands/bookings.int.test.ts:255` — `after.bookings`: starts unchanged independent durable multiplicity checks.

### Observe current failures without changing the command or cache

Opt-in diagnostics follow current editor RPCs and preserve the original client identity for fixture review preparation. A rejected preparation stays observable without suppressing the envelope's real outcome.

- `tests/support/bookings-atdd.ts:76` — `diagnosticSqlCode`: bounds failure output to a SQLSTATE or unknown.
- `tests/support/bookings-atdd.ts:98` — `snapshot_booking_editor`: includes current editor issuance observation.
- `tests/support/bookings-atdd.ts:140` — `pre-review-rejected`: records sanitized discarded preparation errors.

Evidence: actual parent plain/controlled failures, repaired complete16-case pass, separately attributed High source review and author static checks above. Limits: original CI cause is unobservable; final author-trail verification and fresh five-job CI are pending. Excluded/skipped cases are not coverage; source inspection, controlled failure and execution are separately attributed.
