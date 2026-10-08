# Epic 14 conflict-kernel closeout — 2026-10-08

Author: `/root/kernel_fix`, explicitly routed to `gpt-6.1-sol` High before implementation because full-tenant conflict completeness and stable transactional identities are sensitive. Approved Story 14.3/14.4 closeout only. The tested working tree contains the kernel patch over `333d0524` (reviewed main dependency reconciliation); independent pre-change kernel sources were captured from `612ea4e`.

## Change and invariant

The genuine disjoint 1,000-peer review workload spent approximately 22 seconds deriving conflicts. Whole-tenant orchestration repeatedly validated every immutable fact, parsed every UTC booking range and reconstructed the same person/day work windows for each candidate. It now calls an invocation-local batch of the same detector rule loop. Validation remains fail-loud, including cancelled/history facts and contradictory duplicate peers; consistent duplicate peers retain the existing deduplication behavior. The proposed booking still replaces every old row with its ID before detection. Every active post-overlay booking is evaluated, including unrelated peers and every aggregate participant.

Parsed booking ranges, Stockholm day ranges and person/day work terms are reused only inside one batch invocation. Full additive day demand is prepared once per person/day; subtracting the current candidate's exact microseconds supplies its peer demand. Capacity retains hundredths until the original BigInt division, including negative budgets, fractional calendar reductions, buffers, explicit overtime and layered holiday/absence/blocked subtraction. Single-candidate detection, engine/config versions, natural keys, complete v1/v2 associations and candidate-only review projection remain unchanged. No new dependencies, migrations, public surfaces, timeout changes or rule changes were introduced.

## Executed evidence

- Scheduling unit directory, using Node's strip-types runner and the existing alias register: **20 executed / 20 passed / 0 failed / 0 skipped**, native 0. This includes six new batch tests and the existing 14 named detector/capacity/DST cases. New tests compare exact serialized full-tenant output with repeated public detection and independent literal goldens; cover changed assignees/windows, old-state replacement, peer-only refresh after cancellation, duplicates, same-object invocation isolation, malformed cancelled facts, fractional reduction/buffer microseconds, explicit overtime, DST, optional job facts and candidate-third four-participant v1/v2 projection.
- `node node_modules/typescript/bin/tsc --noEmit`: native 0. Direct Node invocation was used after `pnpm exec` could not open the package-manager operation lock; this does not alter the checker.
- `node node_modules/eslint/bin/eslint.js src/features/scheduling/conflicts.ts src/features/scheduling/capacity.ts src/server/bookings/conflict-facts.ts tests/unit/features/scheduling/batch-conflicts.test.ts`: native 0.
- Ignored pure diagnostic `test-results/epic14-current-byte-benchmark.mjs --actual-1000`: native 0, **94.324 ms kernel / 104.071 ms kernel plus proof**, 1,000 rows / 1,000 candidate groups / 0 peer-only rows. Earlier first execution was 76.827 / 83.562 ms; these are local measurements, not a performance SLO.
- Independent old source capture from `git show 612ea4e:<source>` for capacity, detector and server orchestration, changing import paths only; ignored `test-results/epic14-reference-byte-benchmark.mjs --actual-1000`: native 0, **19,871.180 ms kernel / 19,878.718 ms kernel plus proof**. Exact serialized output and group SHA256 match the current implementation. Both produce output 381,001 bytes / groups 625,001 bytes / receipt 834,240 bytes / actual save transport 1,120,180 bytes, with 64-character proof/review signatures.

Matching output SHA256: `b118b548a8599465d0fdfdbd1bd970bd0812fa795e6a72d549a91948650f9f0e`.
Matching complete group SHA256: `a7434887356adf913fe6ccd2ac9d2fe4bac87eccb0deb80de7935d0dea14ea7a`.

The benchmark uses synthetic frozen schedule data and public synthetic signing material, no database, HTTP, credentials or managed resources. No earlier failure is waived, and pure measurements do not prove production transport/transaction behavior. The independent High review is parent-owned; this author does not self-approve publication.

Parent-reported fresh gates after the stable kernel patch and Next 16.3.8 reconciliation:

- Full native units: **2,042 total / 2,041 passed / 0 failed / 1 existing Windows xattr skip**, 10.527 seconds. The inherited skip is not coverage.
- Production build: native 0. Canonical lint: native 0, 0 errors / 13 existing warnings. Typecheck and all three containment checks: native 0.
- Genuine 1,000-group HTTP preview/save case: native 0, **1 passed / 0 failed / 0 skipped**, 12.742 seconds for the invocation / 9.756 seconds for the case. Actual preview fetch was 476 ms; actual save body was **1,120,245 bytes**, HTTP status 200, 1,000 groups and one selected whole group. Real durable assertions passed for **1 accepted / 999 open conflicts**, one create and one attributable audit. This is actual application HTTP and database evidence, distinct from the smaller pure diagnostic transport and its synthetic data.

At this author update, the parent is running the complete 23-case browser gate. Fresh full required integration and exact fresh empty-chain CI remain pending. These parent-reported runtime results supplement the author's own pure/static checks; they do not imply terminal release completion or waive prior failed runs.

## Suggested Review Order

Author: `/root/kernel_fix`, implementation/fix author. Current narrow working-tree patch over `333d0524`; historical Story 14.3 intent and review rounds remain preserved.

### Full tenant preview and save retain the same identities

The server switches only whole-tenant detector orchestration. Every active post-overlay booking still contributes conflicts; unchanged v1/v2 rows bind the complete identity and every remaining participant, preserving candidate-third review groups.

- `src/server/bookings/conflict-facts.ts:79` — `deriveBookingConflicts`: checked full-tenant facts and proposed state.
- `src/server/bookings/conflict-facts.ts:111` — `detectAllBookingConflicts`: complete batched detection before projection.
- `src/server/bookings/conflict-facts.ts:124` — `bookingIds.slice(2)`: complete aggregate participant associations.

### Prepared facts preserve the sole detector and exact arithmetic

One shared rule loop serves both public single-candidate and complete batch detection. Cache lifetime ends with the call; person/day capacity preserves the exact original hundredths calculation and subtracts only the candidate's own day duration from complete demand.

- `src/features/scheduling/conflicts.ts:26` — `detectAllBookingConflicts`: validate before preparing any active subset.
- `src/features/scheduling/conflicts.ts:69` — `detectPreparedConflicts`: sole shared rule loop.
- `src/features/scheduling/capacity.ts:83` — `prepareDailyCapacity`: immutable person/day work terms.
- `src/features/scheduling/capacity.ts:106` — `availableHundredths`: unchanged exact candidate-excluding arithmetic.

### Equivalence and malformed-input evidence precede remaining real gates

Exact repeated-detector comparisons and unchanged literal goldens protect output semantics; the server projection test protects complete logical IDs and supplemental keys. The independent old-source 1,000-peer comparison additionally protects exact serialized bytes at the originally slow geometry.

- `tests/unit/features/scheduling/batch-conflicts.test.ts:24` — `batch full-tenant output`: literal goldens and repeated detector comparison.
- `tests/unit/features/scheduling/batch-conflicts.test.ts:33` — `batch preserves old/new`: peer refresh, cancellation and invocation isolation.
- `tests/unit/features/scheduling/batch-conflicts.test.ts:84` — `batch validates malformed`: fail-loud cancelled/history facts.
- `tests/unit/features/scheduling/batch-conflicts.test.ts:100` — `server projection preserves`: candidate-third complete associations.

Evidence: the executed checks, counts, commands, independent old-source comparison and parent-reported fresh runtime gates above. Limits: this author executed pure/static checks; the parent executed the actual large HTTP/database case and owns full browser, required integration and fresh empty-chain CI gates. No general scalability claim, changed release status or skipped-suite coverage is implied.
