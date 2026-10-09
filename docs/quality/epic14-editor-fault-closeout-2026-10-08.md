# Epic 14 editor fault-fixture closeout — 2026-10-08

Author: `/root/kernel_fix`, explicitly `gpt-6.1-sol` High because rollback evidence and tenant/correlation isolation are sensitive. Approved bounded harness repair only. Ownership: resource test-support sections of `supabase/seed.sql`, `editorFault` in `tests/support/booking-editor-production.ts`, and this author evidence file. No application code, migration, product grant, shared Vitest configuration, timeout/retry/skip or unrelated fixture cleanup was changed by this author.

## Failure and repair

The fresh root CI gate over `e1e663ce` failed with **1,466 total / 1,437 passed / 28 failed / 1 inherited skip**. Four create/update `after_acceptance`/`before_audit` rollback cases failed with `40P01` while `editorFault` installed triggers on shared booking/conflict/audit tables, before the booking save or rollback assertions. Its rejected cached installation promise repeated the same bootstrap error in later cases. The other 24 failures belong to the separately recorded fresh/retained ACL contract difference. All failed CI and diagnostic evidence remains preserved.

The original `e1e663ce` E2E job separately reported **193 passed / four failed / four skipped**. The skips are retained explicitly; they are not execution coverage.

The actual root seed already installs owner-only correlation-scoped booking/conflict fault hooks. The editor helper was still performing global CREATE/DROP TRIGGER during each test. This repair follows the existing root seed pattern: add the editor hooks once during seed setup, then let runtime cases change only their own correlation/stage row. That addresses the concrete DDL contention source without duplicating or modifying the separately reserved runner partition work. Source inspection of another branch that lacks the root Epic 14 seed hooks is not evidence that this root needs a different runner contract.

The resource seed block runs only when `bookings`, `booking_assignees` and `booking_conflicts` exist. Resources owns their first schema; scheduling stays pending. Repeated seed application recreates the same named hooks and functions and leaves marker/business rows intact. Fresh creation of the editor marker table specifies a primary-key correlation UUID and a closed stage CHECK. `CREATE TABLE IF NOT EXISTS` does not add that CHECK to a pre-existing retained table; this patch does not alter its constraints. The helper's closed stage union, trigger arguments and SQL correlation/stage equality remain enforced, so the retained constraint difference creates no unscoped fault path. `test_support` schema/table/function ACLs exclude PUBLIC, anon, authenticated and service_role; control DML is through the existing privileged test SQL helper, never the application client.

The three editor hooks retain the original semantics: a booking row write sets the transaction-local test tenant; the conflict UPDATE statement hook and audit INSERT statement hook check **both current booking correlation and requested stage**; only then do they read actual accepted conflict keys for that tenant inside the transaction and raise the original error with those sorted keys as its detail. No marker means no forced fault. No accepted rows means no claimed acceptance observation.

Before each case, the helper now performs a read-only catalog check for the marker table and all three enabled hooks with the exact function, event mask and stage arguments. Missing or invalid installation fails closed with an explicit seed-fixture error; no runtime DDL fallback or cached rejected promise exists. The RPC proxy's original error/detail parsing and reached/accepted-key observations remain unchanged. `finally` restores the original application client, then deletes only that case's exact correlation/stage marker. Hooks/functions remain installed for other consumers and later tests.

## Restricted provisioning caller — latest bounded repair

Fresh CI over `992df83b37d9831333d2fc288d3d94abc30580e3` failed its database gate with **1,477 total / 1,463 passed / 13 failed / one inherited skip**, **268.14 seconds**. All 13 provisioning/onboarding failures reported `42501` against the private editor control table or schema. The original failed log remains at `tmp/epic14-closeout-stack/ci-992df83b-db.log`; only sanitized error names/counts are recorded here. The earlier local resource pack did not cover this restricted provisioning caller.

`public.provision_tenant` executes as its restricted `provisioning_function_owner` (migration `20260919183425_provisioning_review_authority_fixes.sql:216`). Its legitimate audit INSERT reaches the editor audit statement trigger. The previous invoker fault function attempted to read `test_support.editor_faults` with that restricted authority, even when no editor marker matched. The enforced private ACL therefore rejected an otherwise unrelated provisioning transaction. Existing seed-only audit/provisioning fault functions already use SECURITY DEFINER with an empty search path and revoked public/runtime EXECUTE privileges.

The approved correction gives only `test_support.fail_editor_transaction` that same private SECURITY DEFINER execution pattern. It retains its existing owner, empty search path, ACL revocations, qualified table references, exact correlation/stage lookup and actual accepted-key error detail. `mark_editor_tenant` remains invoker. No role receives a schema/table/function grant, and no production function, migration or application command changes. The helper's read-only readiness check now also requires each installed function's owner to match the private marker-table owner, the exact expected invoker/definer mode, and the empty search path; malformed seed authority fails closed before case-marker insertion.

Focused ESLint and TypeScript `--noEmit` each returned native 0 after this latest two-file patch. Parent subsequently validated guarded reuse and applied the complete corrected seed **twice**, native 0: **three hooks / zero markers**, false control DML/function EXECUTE privileges for every checked API role, and unchanged **99-record migration-ledger count/digest**. `editor-seed-application.json` now records current seed SHA256 `e26dcd882414fdba59a23318588db06e2e6a3dfc136584aff42f3b9693a9d0b6`, matching the author's read-only source hash. This is retained-stack seed evidence, not a fresh reset or migration operation.

The parent's complete three-file REQUIRED pack passed **72 total / 72 passed / zero failed / zero skipped**, native 0, **126.964 seconds from JSON start to the last file end**: 58 booking-editor cases, 13 provision-tenant cases and one first-admin onboarding lifecycle journey. All four original create/update × after_acceptance/before_audit rollback cases execute inside the 58-case suite; the restricted provisioning suite and journey cover all13 prior failures. Saved evidence: `integration-editor-role-provisioning-full.json` / `.log`; author read-only report inspection confirms the counts and file inventory. Post-pack SQL reports **zero markers / three hooks** in `editor-seed-post-pack.json`. Parent's combined-main production build also returned native 0. No runtime execution is attributed to this author.

Independent `gpt-6.1-sol` High final source/trail review returned **no findings**, with 13 quality and 30 Story14.4 verified stops, separately from this author's checks. The older seed SHA and 153-case/23-case passes below describe the earlier invoker fixture and remain historical evidence. Fresh full CI for the corrected combined source remains pending; the actual72-case restricted-caller/rollback pass does not waive the published13-failure run or inherited skips.

## Executed evidence and limits

- `node node_modules/eslint/bin/eslint.js tests/support/booking-editor-production.ts`: native 0.
- `node node_modules/typescript/bin/tsc --noEmit`: native 0 after the stable source patch.
- Source inspection confirms runtime `editorFault` contains only the read-only catalog probe plus its marker INSERT/DELETE; trigger/function DDL occurs in the seed resource section. This is source evidence, not SQL execution evidence.
- At the first-fixture checkpoint, parent validated guard reuse of the same dedicated project and saved data: native admission 0, followed by active/verified Compose outcome. That invoker seed was applied **twice**, both SQL native 0. Catalog checks found **three editor triggers / zero marker rows**, and all table DML plus both function EXECUTE privileges were false for each of anon, authenticated and service_role. The **99-record migration ledger count and digest remained unchanged**. Historical seed SHA256 was `d663531842713f3cb933fc677c3a021cf741e036006812722bd592548bc842cb`; `editor-seed-application.json` was subsequently refreshed for the corrected definer source described above. This is parent-executed retained-stack evidence, not a fresh database reset or migration operation.
- Parent's first mistyped `INT-005` filter executed **two accepted-identity cases passed / zero failed / 56 excluded**, native 0. These are accepted-identity checks, not rollback credit.
- Parent's corrected `INT-002-rollback` filter executed **four rollback cases passed / zero failed / 54 excluded**, native 0, **9.094 seconds for the invocation**. Every create/update × after_acceptance/before_audit case executed its original actual accepted-key, exact rollback and same-command retry assertions. Excluded cases are not execution coverage.
- Independent `gpt-6.1-sol` High review returned **no findings**. Its advisory noted the fresh-only stage CHECK behavior qualified above; no constraint change was requested or performed. Independent review is separately attributed and does not replace runtime evidence.
- Parent's complete six-file REQUIRED resource command pack passed **153 / zero failed / zero skipped**, native 0, **111.286 seconds from the JSON report's end minus start**. This is one complete six-file run, including 58 editor and 62 conflict cases plus the retained round-two/review-fix/booking/replay cases. Saved evidence: `integration-editor-seed-resources-final.json` / `.log`. It is actual retained-stack command evidence; the report duration is not tool invocation wall latency or a performance target.
- Parent's final whole current browser pack passed **23 / zero failed / zero skipped / zero flaky**, native 0, **65.835 seconds**, alongside the complete153-case command pack. This run includes the profile test correction by its separate author; this seed/helper author claims neither that correction nor browser execution. The unchanged Next16.3.8 production build source was reused. Post-browser SQL found **zero editor markers / three hooks**. Parent-owned application/browser/database Stop requests were accepted with saved state preserved; acceptance is not a verified shutdown claim. These current local results do not erase the separately retained published CI flaky/failure counts.
- Published `1cd4ec028ffc7f0ec8ef77638950930d16612441` CI completed: database evidence is **1,466 total / 1,461 passed / four failed / one inherited skip**; the four failures remain the same runtime DDL `40P01` cases. The 24 ACL expectation failures are repaired in that published baseline. Verify/recovery jobs passed. Its E2E job passed with **196 passed / one flaky / four skipped**, approximately 5.5 minutes: the profile32 resource-save-status assertion at line 81 failed initially and passed on retry. Skips are the inherited entity-file expired-link case plus three quote follow-up/lost retry cases. A passing browser job with one retry is not a zero-flaky result; none of those skips is coverage. This failed database CI result is retained and is not waived by subsequent local harness checks.
- This author ran no seed application, database, browser, service or native integration command. Fresh CI verification of this harness patch and final completion remain pending. No prospective CI PASS is claimed.

The existing rollback assertions are unchanged: fault reached, exact accepted keys observed from actual in-transaction rows, SERVER_ERROR, exact durable rollback, one successful same-command retry, accepted selected keys and one attributable audit. Seed-only fixture installation does not change production migrations or hosted state. Broader failure attribution is not claimed, and inherited skips are not coverage.

Review limits remain unchanged: Story 14.1 has its original three completed broad rounds; Stories 14.2, 14.3 and 14.4 each have two. This is narrow CI/harness regression repair and latest-fix verification only, with no additional broad round or story/epic status change.

## Suggested Review Order

Author: `/root/kernel_fix`, actual seed/helper fix author. Latest narrow working-tree authority patch over `992df83b37d9831333d2fc288d3d94abc30580e3`; original `e1e663ce` and `1cd4ec028ffc7f0ec8ef77638950930d16612441` failure provenance remains above.

### Runtime rollback probes require the installed fixture without global DDL

The helper verifies the seed-installed hooks, exact stage arguments, private owner and execution/search-path contract before setting its marker. A missing or invalid fixture fails loudly before any marker is inserted.

- `tests/support/booking-editor-production.ts:404` — `editorFault`: existing runtime rollback boundary.
- `tests/support/booking-editor-production.ts:406` — `expected(table_name`: read-only exact hook verification.
- `tests/support/booking-editor-production.ts:417` — `p.proowner=control.relowner`: exact owner and definer-mode readiness.
- `tests/support/booking-editor-production.ts:418` — `search_path`: fixed empty search-path readiness.
- `tests/support/booking-editor-production.ts:424` — `Seed-installed editor fault`: explicit missing/invalid seed failure.

### Seed hooks observe actual accepted keys within the failing transaction

The seed owns trigger lifecycle only when the resource schema exists. The private definer can inspect its control table during a restricted caller's legitimate audit write; correlation and stage still gate the original accepted-row observation. The fixture stays private to test SQL.

- `supabase/seed.sql:170` — `do $resource_faults$`: resource-schema conditional installation.
- `supabase/seed.sql:214` — `revoke all`: owner-restricted editor marker table.
- `supabase/seed.sql:216` — `security definer set search_path=''`: restricted callers need no private-control grants.
- `supabase/seed.sql:219` — `editor_faults`: correlation/stage-scoped fault lookup.
- `supabase/seed.sql:232` — `mark_editor_tenant`: per-booking transaction-local tenant marker.

### Per-case cleanup preserves proof and other consumers

The application proxy retains its reached/accepted-key observations, and the case restores its own client and removes only its own marker. Runtime no longer removes shared hooks/functions.

- `tests/support/booking-editor-production.ts:431` — `acceptedKeysObserved`: unchanged actual SQL-detail parsing.
- `tests/support/booking-editor-production.ts:439` — `fx.adminClient = original`: application client restoration.
- `tests/support/booking-editor-production.ts:440` — `stage=$2`: exact case marker removal.

Evidence: latest author static checks pass; parent twice-applied corrected seed/catalog/unchanged-ledger checks, the complete72-case restricted-caller/editor pack, combined-main build and separately attributed final High source/trail review pass. Earlier four filtered rollback passes, the complete153-case resource pack and final23-case browser pack remain historical evidence for the first invoker fixture. Limits: fresh full CI remains pending; the latest published database gate has13 failures. Filtered exclusions and inherited skips are not coverage. This author performed no runtime execution or self-review. All failed historical runs and original rollback assertions are retained.
