# Epic 14 Admin pilot query closeout — 2026-10-08

Author: `/root/kernel_fix`, explicitly `gpt-6.1-sol` High for RLS/tenant-role projection. Approved bounded optimization of the existing Admin catalogue, over published `765ee0f35ac02766dfb324d03f3a20adc40b5d58`. Ownership: Admin read model, its pagination units, meaningful worker projection regression in the existing current-tenant RLS file, this author record and the existing Epic11 pilot-spec SRO. Parent owns resources/runtime/Git/aggregate metadata. No schema, grant, auth capability, service-role application path, cache, environment, budget or fixture reduction.

## Actual failure and unchanged authority

Fresh run `37783736560` executed the REQUIRED integration gate with **1,477 total / 1,476 passed / zero failed / one preserved skip**, **207.67 seconds**, then failed the subsequent Epic11 pilot: **four authenticated RLS requests per read exceeds three**. The combined integration-plus-pilot step took216.00s. Integration success is preserved separately from the failed database job; the skip is not execution coverage. Verify, isolated recovery and dashboard browser passed; this author does not infer other jobs' final outcomes.

The pilot still measures 120 active TenantA memberships,24 TenantB memberships, five evenly distributed primary roles,40 secondary-role holders/160 TenantA assignments, five warmups and25 samples. Its p95 ceilings are250ms Admin projection and25ms synthetic bulk permissions, with≤3authenticated requests/read and unchanged execution budgets. ADR-B012's exact owner successor approved global ID batches100→50 for demonstrated101/501-ID gateway failures. It did not amend the pilot's three-request limit. Raising the pilot ceiling would require a threshold decision; no threshold is changed here.

The former catalogue performed one short membership page, then three50/50/20-ID child requests. Its four requests were necessary for that query shape, rather than a duplicated read or fabricated metric. The approved bounded repair meets both existing contracts by changing this complete tenant catalogue's child query shape; the shared50-ID cap remains unchanged for callers that genuinely use ID filters.

## Query, authority and completeness

The production caller resolves the current tenant before the read. The complete membership root query retains its explicit tenant predicate, stable created_at/id order and500-row paging. The child query uses the same authenticated RLS client, explicit resolved tenant predicate, stable membership_id/role order and complete500-row paging. It no longer generates repeated membership-ID URLs for a catalogue that already reads every visible root in that tenant. Only child rows whose IDs occur in the visible-root Set enter the returned projection. Empty/invalid root IDs retain no-child-query behavior and scalar-role fallback. Any root or child page error still returns no rows and the same generic read error.

Downstream authority is unchanged: membership_roles has forced RLS and a composite membership/tenant FK with update restriction/delete cascade. Its policy permits own-child roles or active same-tenant admin visibility. RouteAccessBoundary still checks the active manifest/capability route gate before rendering Admin users. The optimization adds no role, RLS predicate, capability or privileged client. Page-by-page reads retain the existing separate-request consistency limit; they do not claim a transaction-wide catalogue snapshot.

The unit mock deliberately has no `.in()` method, records tenant/order/range requests, and returns the original fixed projections. Tests preserve all501roots×5roles=2,505children. The original51roots×5roles=255child error fixture is retained, honestly reassigned to a first-child-page failure because255nowfits one page. An additional literal101roots×5roles=505fixture fails on the later child page after a complete500-row page and still requires rows[]. Other cases cover exactly500childrows with an empty terminal page, late root failure, empty/invalid roots, authorized child rows absent from the root snapshot, foreign roots/children and the exact120/160pilot projection in two modeled reads. Mocked completeness/request counts do not prove database RLS or measured latency.

The existing real multi-tenant-admin proof remains unchanged. A new isolated real worker proof supplies positive own/same-tenant-other/foreign child controls, independently reads them, then invokes the actual optimized helper through the worker's authenticated client. It requires the worker's two own roles, no foreign projection, unchanged complete role snapshots, and the production route predicate's worker-denied/admin-allowed result. This covers the query's own-child RLS boundary beyond existing direct-table-only worker negatives; it does not expose an Admin page to workers.

## Executed checks and pending gates

- Author focused pagination units: **10 passed / zero failed / zero skipped**, native0, **202.5633ms runner duration**.
- Focused ESLint, TypeScript `--noEmit` and whitespace checks: native0.
- Source inspection verifies shared `RLS_ID_BATCH_SIZE=50`, pilot ceiling3, profile120/24,250/25ms latency and all execution budgets unchanged.
- Parent's complete affected three-file REQUIRED RLS/read-model pack passed **11 total / 11 passed / zero failed / zero skipped**, native0, **16.510s**. It includes the unchanged multi-tenant Admin proof and the new actual worker own-child/projection/route-boundary proof.
- Parent's whole unit suite passed **2,159 total / 2,158 passed / zero failed / one preserved Windows xattr skip**, native0, **10.181s**. The skip is not execution coverage.
- The unchanged **live local pilot passed**, native0, saved in `tmp/epic14-closeout-stack/admin-pilot-current.json` / `.log`. `assertExactPilotFixture` executed:120/24active memberships, five evenly distributed primary roles,40secondary-role holders/160TenantA assignments. Five warmups and25measured iterations produced **50total authenticated requests / two per read**:25membership pages plus25role pages. Admin projection **p95=29.9952ms≤250ms**; synthetic bulk permissions **p95=2.9717ms≤25ms**; assessment passed with `violations=[]`. Harness duration was3868.645ms, distinct from projection p95. Author read-only report inspection confirms the measurements and report's **dirty working tree over765ee0f35ac02766dfb324d03f3a20adc40b5d58**. This is parent-executed retained-stack evidence, not a fresh database reset, production/full-page load test or broader Epic14 performance acceptance.
- Parent post-pack SQL found **zero editor markers / three hooks**.
- Independent `gpt-6.1-sol` High RLS/source review returned **no findings**, bound to source SHA256 `429e51ad21c0e40b680a4ae295e69a3700a0ca21e30edfb07d225713f4dba0d0`, unit SHA256 `fbab394ea343adf139a6f49a31b0f33b39793e87138d74dd6e718219813c5927`, and RLS SHA256 `512158623f49c1e9e69dfe137949d17ea9f48b50996e4b9167302c14c687fa5f`. This is separately attributed review, not author self-review.
- Parent's final production build passed native0, saved in `build-admin-pilot-final.log`. After consumers finished, the guard accepted the parent-owned Stop request (`stop_requested`, `verified=false`); this preserves saved state and is not a verified shutdown claim.
- Final author-trail review and fresh five-job CI remain pending at this author refresh. The earlier published765pilot four-request failure remains preserved and is not waived by local success.

This author ran no services/database/browser/integration command and made no Git or official completion-state writes. Historical failures, review3/2/2/2caps, deferred maintenance/performance/manual/daylight/calendar obligations and frozen pilot intent remain unchanged. The pilot is a local measured projection gate, not a full-page/production-capacity or broader Epic14 performance acceptance claim.

## Suggested Review Order

Author: `/root/kernel_fix`, actual bounded query/test fix author.

### Tenant authority remains explicit while child reads page once

The full child stream retains the resolved tenant predicate and stable paging, then intersects with authorized roots. Empty roots and every page failure preserve the original result contract.

- `src/features/admin-users/read-model.ts:47` — `visibleMembershipIds`: binds projected children to visible roots.
- `src/features/admin-users/read-model.ts:49` — `size === 0`: retains no-child read and scalar fallback.
- `src/features/admin-users/read-model.ts:57` — `eq("tenant_id", tenantId)`: constrains the authenticated child read to the current tenant.
- `src/features/admin-users/read-model.ts:58` — `order("membership_id"`: establishes stable child paging order.
- `src/features/admin-users/read-model.ts:61` — `pageResult.error`: suppresses all partial authority after any child failure.

### Complete projections survive large and failed pages

The tests preserve original data volumes and add real late-page and exact-boundary obligations. Exact pilot request shape is an independent workload assertion, without changing the assessor ceiling.

- `tests/unit/admin-users/read-pagination.test.ts:70` — `length: 501`: retains every original root and its five roles.
- `tests/unit/admin-users/read-pagination.test.ts:141` — `101-root later child page failure`: rejects partial authority after a successful full child page.
- `tests/unit/admin-users/read-pagination.test.ts:152` — `exactly 500 child roles`: requires the terminal page at the exact cap.
- `tests/unit/admin-users/read-pagination.test.ts:185` — `120-member 160-role pilot`: retains the pilot cardinality and exact two-read projection.

### Real RLS projection and route access remain separate

The worker proof verifies the optimized helper against own-child visibility with independent other/foreign positives; the existing multi-tenant Admin proof remains intact. The route capability gate still denies workers.

- `tests/integration/rls/admin-users-current-tenant-counts.rls.test.ts:78` — `worker own-child RLS`: exercises the actual paged projection through the worker client.
- `tests/integration/rls/admin-users-current-tenant-counts.rls.test.ts:105` — `raw.data`: establishes actual own-role RLS visibility before projection.
- `tests/integration/rls/admin-users-current-tenant-counts.rls.test.ts:112` — `canAccessPhaseARoute`: retains worker-denied Admin access.

Evidence and limits: current10focused-unit/static checks, parent11-case REQUIRED RLS pack, whole-unit2159/2158/0/1, actual unchanged local pilot, final production build and separately attributed High source review above. Final author-trail review/fresh CI remain pending. No skipped case, modeled request count or source inspection receives actual database/performance credit; the real pilot is qualified to this local retained-stack projection workload.
