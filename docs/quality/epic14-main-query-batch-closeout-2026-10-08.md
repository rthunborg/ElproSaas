# Epic 14/main query-batch test closeout — 2026-10-08

Author: `/root/kernel_fix`, explicitly `gpt-6.1-sol` High for the shared RLS query/money result boundary. Approved narrow test-only main-integration repair over `b7ac3504e357d16f3bc120ce317f164db4285429`. Ownership: `tests/unit/server/read-models/quote-pipeline-result.test.ts`, this evidence, and necessary existing Story19.1 review-trail references/rationale. No production query helper, batch size, money arithmetic, role/tenant authority, DTO, manifest, dependency, fixture reduction, retry/skip/timeout or workflow status change was made.

## Proven mismatch and fixed oracle

CI run **37777002683** failed verify at `[P1] 19.1-UNIT-015`: **actual three acceptance requests / expected two** for 101 accepted IDs. The whole unit result was **2,151 total / 2,150 passed / one failed / zero skipped**, approximately 26.765 seconds. All four downstream jobs were skipped after verify failed; they provide no runtime evidence. The retained diagnostic is `tmp/epic14-closeout-stack/ci-b7ac3504-verify-api.log`.

The real result reader calls the shared `chunkValues` through `readPipelineBatches`. `src/server/read-models/pagination.ts` fixes the authoritative request limit at **50 IDs**, under [ADR-B012's owner-approved successor decision](../decisions/ADR-B012-integration-gate-privilege-baseline-and-local-reliability.md). Its rationale is the demonstrated 101-ID gateway failure and 501-ID list boundary. The incoming test hardcoded100 and expected two queries; the implementation correctly issued three. No production workaround is justified.

The test now authors50 as its independent expected request bound and101 as a separate fixture cardinality. All original101-ID acceptance/latest-version late-fault fixtures and501-row page fixtures remain unchanged in size. The original positive101-ID case remains, requiring exact `[50,50,1]` query sizes. Two additional positive cases exercise501 and1001 accepted IDs, with fixed expected11 and21 chunks respectively, plus their exact event-page ranges. Every case requires exact sent/accepted/lost counts, exact accepted-öre totals, complete one-time accepted-ID coverage and the complete expected query sequence with no health/eager/poll query. It accepts neither arbitrary extra reads nor truncated data. Existing query-failure, strict money, entitlement, completion-clock and legacy-wrapper controls are preserved.

## Executed evidence and limits

- `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/server/read-models/quote-pipeline-result.test.ts`: **46 passed / zero failed / zero skipped**, native0, 496.8875 ms. The whole file executed, including original late-page/batch faults and all three101/501/1001-ID complete-result positives.
- `node node_modules/eslint/bin/eslint.js tests/unit/server/read-models/quote-pipeline-result.test.ts`: native0.
- `node node_modules/typescript/bin/tsc --noEmit`: native0.
- Source diagnosis and fixture preservation are inspected against the actual shared pagination/query core; expectations do not import the production constant or branch on observed query counts.

These are pure-reader tests with injected paginated transport, not live RLS/database or browser evidence. The original failing full-unit CI and four skipped downstream jobs remain explicit. Parent owns fresh whole-unit/CI verification, Git writes and independent High narrow review; no new CI PASS or acceptance transition is inferred. Story19.1's two completed broad rounds, main's existing completion, and Epic14's pending release/review history remain unchanged; this is narrow regression repair only.

## Suggested Review Order

Author: `/root/kernel_fix`, actual bounded test-fix author, over merged `b7ac3504e357d16f3bc120ce317f164db4285429`.

### The existing approved request limit remains production authority

The shared reader uses the approved50-ID limit. The test pins that value independently while preserving101-row fixtures, so a future production-limit regression cannot silently update its own oracle.

- `src/server/read-models/pagination.ts:15` — `RLS_ID_BATCH_SIZE = 50`: existing approved production contract, unchanged.
- `tests/unit/server/read-models/quote-pipeline-result.test.ts:39` — `ID_BATCH_SIZE = 50`: independent fixed request expectation.
- `tests/unit/server/read-models/quote-pipeline-result.test.ts:40` — `MULTI_BATCH_FIXTURE_IDS = 101`: original fixture cardinality retained.

### Complete results require every bounded page and exactly one copy of every ID

Original101-ID completeness and two larger501/1001-ID results assert exact query counts, ranges, money totals and accepted participants. Existing late-failure and authority/money controls still execute in the same full-file run.

- `tests/unit/server/read-models/quote-pipeline-result.test.ts:379` — `distinctAccepted`: fixed complete101/501/1001 scenario matrix.
- `tests/unit/server/read-models/quote-pipeline-result.test.ts:401` — `acceptanceCalls`: exact per-chunk sizes.
- `tests/unit/server/read-models/quote-pipeline-result.test.ts:405` — `every accepted ID appears exactly once`: rejects omitted or duplicated IDs.
- `tests/unit/server/read-models/quote-pipeline-result.test.ts:361` — `19.1-UNIT-012`: existing legacy/failure positive control retained.

Evidence: actual46-case focused run and static checks above. Limits: injected transport, no live service execution by this author, failed published CI preserved and fresh whole-unit/CI/independent review pending. No product or status change is claimed.
