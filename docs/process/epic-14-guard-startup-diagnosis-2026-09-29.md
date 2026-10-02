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
