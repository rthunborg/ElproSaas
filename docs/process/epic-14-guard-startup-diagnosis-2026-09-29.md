# Epic 14 guarded Compose startup diagnosis — 2026-09-29

## Purpose

This record captures the evidence available after the repeated isolated test-stack startup failure for Story 14.1. It preserves the distinction between guarded admission and proven service and schema readiness.

## Scope and safety boundary

The diagnosis used bounded read-only checks plus one guarded startup attempt and its Stop request. No successful stack startup or populated-data/system configuration changes were demonstrated. It did not reset, prune, remove, or bypass the guarded lifecycle path.

The resource lifecycle contract requires guard-managed admission and readiness before the isolated stack is used. It also prohibits runtime staging, activation, rollback, uninstall, and broad administrative actions from this agent session.

## Environment observations

- The guard Status/List projection was healthy.
- The installed guard package was `0.9.13-4190dac0-09ec-4d36-8e39-173cfcebcea9`; its locator timestamp was `2026-09-27T17:43:25Z`.
- Docker `29.8.0` and Compose `5.5.1` were healthy.
- The active Docker context was `desktop-linux`; its endpoint, `npipe:////./pipe/dockerDesktopLinuxEngine`, matched the adapter requirement.
- The private Compose working directory was `C:\Users\Rasmus\.codex\worktrees\epic14-scheduling\guard-compose-01a0ecb9-r4` using `compose.test.yaml`.
- Compose configuration validation completed with native exit code `0`. The configuration declares five services and two named volumes, uses only read-only in-directory existing binds, and declares no privileged service, build, global network, or fixed container name.

These observations only establish configuration and host-adapter prerequisites. They do not establish that Compose dispatched successfully, that any service is healthy, or that the schema is ready.

## Fresh guarded admission evidence

A fresh root-owned Compose request created lifecycle resource `6dcd6e61-0fd5-4027-a67f-96355d2634ae`.

| Event | Time / result |
| --- | --- |
| Admission accepted | `2026-09-29T14:31:38.7811353Z` |
| Terminal observed | `2026-09-29T14:31:39.6309505Z` |
| Lifecycle state | `start_uncertain` |
| Compose phase | `uncertain` |
| Dispatch | `dispatchCommitted=true` |
| Backend category | `worker-failed` |
| Progress | `worker-failed` |
| Error code | `RETAINED_START_INCOMPLETE` |
| Guard project / Compose exit / failing service | all null |
| Verified outcome | `false` |

The Stop request was submitted once and accepted with native exit code `0`, `ok=true`, `state=stop_requested`, and `verified=false`. Shutdown was not polled.

## Diagnosis

The failure reproduces before the guard exposes a Compose project, service-level failure, or Compose exit code. The installed signed package provides no supplied source or diagnostic documentation, and the public projection discards the specific worker exception. The exact cause is therefore unestablished. No specific repair could be identified from the exposed evidence.

## Required continuation condition

A host/runtime maintainer must expose the worker exception and repair the supported guard startup path. Before `/auto-bmad epic --epic 14` resumes, that repaired path must demonstrate that the isolated services and schema are ready. Until then, the Story 14.1 integration/RLS and browser evidence remains unexecuted, review round count remains zero, and Phase 5 is incomplete.

## Recovery checkpoint — 2026-10-01

The deployed guard `0.9.15` admitted a root-owned attempt for the same private Compose file and guard project (`rg-5d1e5b8fb28e4c7805b8217575533233ee377234`) as lifecycle resource `50e9273a-c10b-4f1c-9022-7d6d823ee043` at `2026-10-01T12:50:58.1615681Z`. It reached stopped at `2026-10-01T12:50:58.8405642Z`; the accepted Stop confirms that attempt closed, not that the prior retained registration was repaired.

The authoritative `startOutcome` establishes the current blocker without attributing a Compose-service failure: `attemptDisposition=refused_before_backend`, `backendInvocation=not_attempted`, and `temporaryUsage=not_acquired`. The retained reference is `partial`, `retainedLiveState=unknown`, `diagnosticCode=RETAINED_START_INCOMPLETE`, and `recoveryRoute=new_registration_requires_choice`. The compose operation is `failed/prelaunch-failed/retained-restart` with `dispatchCommitted=true`. Consequently this attempt has no service or schema readiness result to use for Story 14.1.

Read-only Docker evidence does not identify a faulty Compose configuration. The guarded private `compose.test.yaml` is byte-identical to the repository source and declares `db`, `auth`, `rest`, `storage`, and `gateway`, plus the two project-owned named volumes. The retained REST container logged a successful PostgreSQL connection and schema-cache growth from 5 to 33 relations and from 3 to 18 RPCs, with no captured fatal diagnostic and no Docker `State.Error`. Its later `255` exit is stop evidence, not the root cause. The retained database and storage volumes are still local-driver, project-scoped, and guard-managed; no volume content was inspected, reset, removed, or changed.

### Recovery options

1. **Recommended:** repair or explicitly reconcile the guard's retained registration while preserving the existing Compose identity and both named volumes. The available evidence supports no Compose-file or data correction.
2. **Only if a clean-data run is intentionally selected:** use a guard-supported new registration with fresh project-scoped volumes, while preserving the existing volumes untouched. This option discards no data but cannot use the retained database as verified test state; migrations and service readiness must be demonstrated again before integration or browser execution.

Do not change the Compose working directory, edit Compose configuration, remove containers or volumes, or infer runtime readiness from this checkpoint. A supported guard recovery or an explicit clean-data choice remains necessary before Phase 5 can resume.


## Maintainer live recovery evidence — 2026-10-01 18:29 UTC

The owner explicitly approved a corrected fresh test stack and fresh volumes;
deleting unused containers was not required. The retained registration was not
reset or adopted. Further diagnosis established REST's missing admin-server
port: `postgrest --ready` could not satisfy its configured health probe. The
later exit 255 during Stop was not the startup cause.

The approved two-line change in repository `compose.test.yaml` sets
`PGRST_ADMIN_SERVER_PORT: "3001"` and `PGRST_ADMIN_SERVER_HOST: "127.0.0.1"`.
The same private working directory now has byte-identical corrected
`compose.ready.test.yaml`; the old private `compose.test.yaml` is unchanged.
No additional host port, credentials, feature flags, product implementation,
Docker Desktop setting or hosted environment changed.

Installed guard **0.9.15** successfully started project
`rg-f58d95e0aa76f813445d407dfe410638d75a0041` under the maintainer actor's own
fresh context. Lifecycle `a465c621-0b7d-49f2-ae3a-3de7ab00b272` was accepted at
18:17:53Z and active at 18:18:09Z. The original response envelope was lost to a
local helper property-read error after dispatch; authoritative List recovered
the exact request and active outcome without another launch. Separate probes
proved all five services healthy, REST readiness exit 0, Auth/Storage gateway
HTTP 200 and Storage schema availability.

The SQL-only migration attempt then committed **80 of 81** repository migrations
and failed SQLSTATE **42601** at `public.person_work_hours`. In
`supabase/migrations/20260929120000_resource_person_profiles_and_work_hours.sql`
line 40, `);` must become `));` to close the table declaration. The migration
ledger ends at `20260928110819`; all three Story 14 tables are absent, and seed
was not reached. This product correction belongs to the Story author and was
not made by the guard investigation. Static review additionally found missing
resource-profile membership fixture IDs in E2E global setup; resource-specific
integration/RLS cases remain skipped scaffolds.

Ordinary guarded reuse then admitted lifecycle
`f7f5d0f2-f8e5-4021-917b-c3177234d97a` at 18:26:49Z with
`ok=true/state=starting/verified=false`. Its List outcome became active and
verified at 18:27:07Z. Independent checks found the same five healthy containers,
the same network and volumes, and the identical 80-entry migration ledger after
Stop/reuse. Both lifecycles received successful Stop acknowledgments. A separate
18:29:16Z physical snapshot confirmed all five stopped with saved objects intact.
The original project's five known stopped containers and both volumes also
remained present. No deletion or registration recovery was performed.

The guard/infrastructure blocker is cleared for the selected corrected route;
application schema and required Story integration/RLS/browser acceptance are
still incomplete. Zero Story acceptance or browser tests ran here; no review
round or Phase 5 completion is claimed. Continue using the ElproSaas actor's own
new trusted context and normal `ComposeUp`, existing private directory,
`composeFiles=['compose.ready.test.yaml']`, `downTimeoutSeconds=10`, and a new
logical requestId. Let the guard reuse the now-proven saved registration; do
not request another fresh database, use the old partial file or replay the
maintainer actor's identity. Fix the product migration/fixtures, finish schema
and seed, then execute required verification and Stop owned lifecycles.

Detailed results and supported handoff:
`C:\Users\Rasmus\Documents\Codex\2026-08-31\investigate-and-design-a-machine-level\work\elpro-live-readiness-2026-10-01\RESULTS.md`
and `ELPRO-AGENT-HANDOFF.md` in that same directory. Optional generic 0.9.16
partial-retry source and regression evidence are prepared but uninstalled;
this approved route needs no guard upgrade or additional owner choice.

## Story 14.1 continuation — 2026-10-02

The selected corrected route remained usable. Normal guarded Compose reuse admitted lifecycle `06ea959a-53a1-41af-bc07-b817d80424fb` on the same private registration and guard project, retaining the original five container IDs. The outcome was active and verified; all five services were healthy, REST readiness exited 0, and Auth and Storage returned HTTP 200. This resolved the earlier Compose admission/readiness failure without a reset, migration-ledger edit, volume deletion, registration recovery, or hosted access.

The Story author corrected the `person_work_hours` declaration, used the authorized SQL-only loopback migration-and-seed path, and added/applied forward migration `20261002113000_resource_profile_form_date_regex_fix.sql` for the already-applied composite date-regex defect. The ledger then aligned locally and remotely. Focused required command/RLS evidence passed 6/6 with `SUPABASE_TEST_REQUIRED=1`; the exact inventory policy test passed 11/11; focused retry-seam/CDP units passed 2/2; the unit suite passed 1,928/1,929 with one existing skip. Typecheck and a Next 16.3.6 production build passed. No database reset or ledger repair was run.

Bounded local application diagnosis used the physical Node executable after a symlinked Node path was refused as `PATH_UNSAFE`. The private production build was rebuilt with the verified local stack target. Narrow local gateway CORS corrections were made from observed preflight failures, including the required API-version request header; before/after preflight evidence and a foreground three-scenario browser diagnostic confirmed login and browser transport. That foreground run was before final review patches and was not accepted as final guarded-browser evidence. No hosted origin, broad CORS policy, or public runtime flag was added.

Final guard-owned browser admission remains blocked. Guarded Chromium lifecycle `e2f5bdd8-7619-4fe3-97da-413fc2a5b445` failed closed as `START_NOT_CREATED`; the exact Job was verified empty, then the resource was stopped. The catalog reports legacy `inspect_only` and no evidenced safe input correction or retry route. No unmanaged browser was used. The optional CDP fixture closes only its own page and context and does not invoke `browser.close()`; root retains Chromium lifecycle ownership if guarded admission later succeeds.

The required full corrected-target `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` gate remains red: its final applicable sweep, before the later inventory/review patches, reported 1,081 passed, 156 failed, and one skip across 124 files. A serial reachability-affected file passed 12/12; a representative pre-Story quote-follow-ups grant expectation remained 9/11 and is outside Story 14.1. This is recorded as an inherited prerequisite, without asserting a downstream bypass. Do not waive or rerun the full gate without a concrete correction.

Root later requested Stop for app `8eb8ee65` and Compose `06ea959a`; both returned native exit 0, `ok=true`, `stop_requested`, and `verified=false`. These are accepted Stop acknowledgments, not confirmed shutdown; no polling was performed. Preserved resources and data remain under the guard lifecycle.

## Guarded browser correction — 2026-10-02

The browser launch blocker is resolved through a supported executable-path
correction on installed guard **0.9.15**. Use
`C:\Program Files\Google\Chrome\Application\chrome.exe` (verified installed
version 154.0.8037.97) for guarded headless/CDP automation on this host. Keep
the existing working directory, `resourceType='browser'`, loopback CDP and the
guard-supplied private profile.

Windows Application/SideBySide Event 33 at **09:47:32.5005805Z** identifies the
original Chromium 1228 image and failure to resolve private assembly
`149.0.7827.55`. A maintainer-owned guarded reproduction returned the same
verified-empty `START_NOT_CREATED` and a second matching event at
**12:12:30.2216208Z**. An independent read-only `CreateActCtxW` probe of the
embedded executable manifest reproduced **14001
(`ERROR_SXS_CANT_GEN_ACTCTX`)** without creating a child process; installed
Chrome passed that probe. The guard's rollback handler discarded this native
cause, explaining why its result only established Job emptiness. The exact
packaging subdefect in the cached Playwright image remains unestablished and
the cache was preserved.

Using the maintainer actor's own trusted context, Chrome lifecycle
`ebcac249-b2cb-46c9-8fee-04aae2a9d92a` became active/verified at **12:14:09Z**.
Its ephemeral loopback CDP endpoint matched the exact authenticated profile and
process identity. CDP version, isolated page/context, DOM interaction, rendered
screenshot and test-context cleanup passed; the test did not close the browser.
Stop at **12:19:47Z** returned native 0 / ok=true / stop_requested /
verified=false. A single later independent snapshot at **12:20:54Z** found all
seven recorded browser-process identities and the listener absent, with the
profile and its retention marker unchanged. The original failed profile remains
present. No process-name cleanup, user-browser adoption, profile deletion,
runtime upgrade, database action or historical registration recovery ran.

Evidence and supported continuation instructions:
`C:\Users\Rasmus\Documents\Codex\2026-08-31\investigate-and-design-a-machine-level\work\chromium-launch-2026-10-02\RESULTS.md`
and `ELPRO-AGENT-HANDOFF.md` in that directory. Continue with the ElproSaas
actor's own new trusted context and its own newly verified CDP endpoint. Use
the runner-only `E2E_GUARD_CHROMIUM_CDP_ENDPOINT` for the existing fixture,
including its required `E2E_RESOURCE_SAVE_FAILURE_ENABLED=true` seam when
applicable. The fixture closes only its page/context; the root requests guard
Stop and preserves the profile. Port `0` can be discovered in `DevToolsActivePort`
under the exact authenticated registration's retained profile. A chosen fixed
port must first be available; do not stop an existing listener to claim it.

Corrected Compose reuse still needs no further fresh database or recovery.
This establishes browser infrastructure, not the project-pinned Playwright
scenarios or Story 14.1 acceptance; the full integration prerequisite recorded
above is not waived or rerun here.
## Integration prerequisite continuation — 2026-10-02

The corrected guarded Compose route remained usable for the approved local prerequisite. The same registered stack retained its five container IDs and passed healthy-service, REST-readiness, Auth, and Storage checks. The accepted work used SQL-only loopback migration-and-seed pushes with the existing data and ledger; no reset, ledger edit, volume deletion, hosted access, or native Supabase lifecycle operation occurred.

Forward repairs removed inherited effective table access on the confirmed quote-follow-ups, CRM, and audit paths while preserving authenticated tenant reads, checked wrappers, RLS, and service paths. A seed-only correlation-scoped 	est_support.forced_audit_failures helper replaced an interrupted test-owned trigger; review verified that it has no anon, authenticated, or service-role effective schema/table/function privileges and cannot create a shipped failure-injection surface. Focused required evidence passed 10/10, 14/14, 13/13, and 24/24 after complete effective-privilege coverage was added. Typecheck, diff check, and the 12-reference review-order check passed.

The direct installed-Vitest required gate used verified --no-file-parallelism and a private persisted JSON report: 124 actual file results (112 passed, 12 failed) and 1,239 assertions (1,126 passed, 112 failed, 1 skipped). The one retained skip is the isolated recovery physical-loader proof gated by ISOLATED_RECOVERY_STORAGE_PROOF=1; it is not DB/RLS acceptance. Remaining observed inherited-PUBLIC expectations are mapped in the [ADR-B012 public-inheritance repair approval plan](../decisions/ADR-B012-public-inheritance-repair-approval-plan.md): 22 active tables and two RLS helpers. The plan is non-runnable documentation. Automatic approval rejected the inventory proposal as broad ACL revocation across nearly the entire tenant-table inventory and the follow-up as broad 22-table ACL migration submitted immediately after rejection without user approval. No rejected SQL was applied.

This prerequisite does not waive Story 14.1's project-pinned browser acceptance. Later guard maintenance established a separate verified Chrome/CDP lifecycle, but did not execute the Story scenarios. Root requested Stop for Compose lifecycle 534d6b00-e76a-4419-a624-9c0b10f7d407 after final database checks; native 0 / ok=true / stop_requested / verified=false is an accepted request, not confirmed shutdown, and no polling was performed.

## Integration prerequisite completion — 2026-10-02

The owner-approved ACL and successor forward migrations were applied to the
root-owned loopback stack with seed and without a reset or migration-ledger
change. The successor scope revoked service-role execution for the two named
quote wrappers, narrowed authenticated `tenant_memberships` UPDATE to the
onboarding dismissal column, and reduced the shared RLS batch limit to 50.

The required Auth readiness probe retains its two-second attempt cap and
fail-closed mode. A timeout now receives one bounded retry after 50 ms, within
a 4.25-second total budget. HTTP and authorization failures remain fail-closed;
successful probes are worker-local cached and failed probes are not cached.
The concurrent affected command suite passed 3 files and 42 tests. The final
root-bound `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` passed with native exit
0: 124 passed and 1 intentionally skipped file; 1,242 passed and 1 intentionally
skipped test. Private metadata confirms API 127.0.0.1:55421 and database
127.0.0.1:55422 resolving to PostgreSQL 10.240.8.2:5432.

This clears the integration/RLS prerequisite blocker. It does not supply or
waive Story 14.1 browser acceptance evidence.
