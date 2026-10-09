# Parallel Auto-BMAD implementation plan

Date: 2026-10-07
Status: implementation authorized on 2026-10-07; isolated tooling branch in progress. Live epic loops have not been migrated.
Scope: project development tooling and process only. Product scope and release gates remain unchanged.
Source snapshot: 3e8e337a, codex/epic14-resume. Recheck live state before rollout.

## Owner intent and immediate operating decision

The owner wants multiple independent development sessions and currently uses epic-specific Auto-BMAD loops. Preserve that entry point and epic-level quality gates. The initial request authorized planning; the follow-up owner request authorized implementing this plan. Neither request starts another product epic loop, interrupts existing sessions, or merges/deploys changes.

Continue the existing Epic 14 loop in its existing session and checkout. The recorded anchor identifies codex/epic14-resume, active Story 14.3; sprint entries 14.1/14.2 are at review, 14.3 in progress, and 14.4 backlog. This is repository state, not proof a process is currently running.

Use a separate worktree for workflow planning and implementation. Do not edit installed workflow files in the active epic checkout while it is running: later phases can read changed files mid-run. Do not start a second bare Auto-BMAD invocation in a copied checkout and assume it chooses different work; copied in-flight state can redirect it to the same story.

Before concurrency support exists, the second session can develop the tooling under this plan, prepare independent analysis, or inspect a fixed commit read-only. It must not independently implement a story owned by the current epic. Additional product work requires explicit target selection, proven dependencies, separate ownership, and shared-state coordination.

## Existing constraints and evidence

- Auto-BMAD epic-pipeline.md E5 is an ordered sequential story loop on one epic branch.
- The anchor stores one active_story and stories_landed; E8/E_final own aggregate gates, status flips, reporting and the epic PR.
- state-and-resume.md prioritizes incomplete work and rejects a standalone story owned by an in-flight epic.
- delegation-runtime.md requires each delegate phase to finish before its parent continues. Existing nested independent reviews can still run together; asynchronous story scheduling needs a new explicit contract.
- state_update.py uses unique temporary files plus atomic replacement. This protects a file write, but does not make a read-modify-write sequence across competing coordinators transactional.
- Git worktrees isolate working files and indexes, but share repository refs and do not independently solve duplicate claims, semantic conflicts, database isolation or finalization races.

References:
- ../../.agents/skills/auto-bmad/references/epic-pipeline.md
- ../../.agents/skills/auto-bmad/references/state-and-resume.md
- ../../.agents/skills/auto-bmad/references/delegation-runtime.md
- ../../.agents/skills/auto-bmad/references/git-and-pr.md
- ../../_bmad-output/planning-artifacts/epics-phase-b.md
- ../../_bmad-output/implementation-artifacts/sprint-status.yaml
- ../process/agent-model-routing.md
- ../process/local-setup.md

## Proposed workflow

Keep /auto-bmad epic as the coordinator entry point. Sequential remains the default. Add an opt-in parallel mode only after its tests pass; exact command syntax is an implementation decision, not an available command today.

Each epic retains one integration branch, one authoritative anchor, one epic PR, and one finalization owner. Independent stories build on separate worker branches/worktrees. A coordinator selects ready stories, admits at most two workers initially, collects evidence, integrates results serially, and runs final epic gates.

A worker runs the existing planning, risk-based testing, implementation, independent review and review-fix phases for its assigned story. It produces a committed result and evidence manifest. It does not perform epic-wide reconciliation, archive deferred work globally, flip the epic done, publish the epic PR, or merge the base branch.

Separate user-visible sessions and internal subagents use the same assignment contract. Manually opened worker sessions attach to an issued assignment; no automatic messaging of existing chats or creation of new chats is implied by this plan. Host permissions and explicit user authorization continue to govern those actions.

Scheduling independent worker sessions does not remove synchronous ordering within an individual story's plan/build/review phases. BMAD's orchestrator delegates story/spec work; the coordinator does not become an implementation author.

## Admission and dependency contract

A schedulable item records story identity, approved intent/spec revision, prerequisite story IDs, base commit, anticipated write paths, semantic conflict domains, required schema/API contracts, risk classification and required checks.

Reject cycles, unknown prerequisites, unapproved product scope and incomplete contracts. A backlog entry or candidate sketch is not automatically implementation-ready. Eligibility is evaluated against actual integrated commits and gates, not only a done string in a copied YAML file.

Check both file overlap and semantic overlap. Conflict domains include schema objects, RPC/API contracts, permission policies, manifest activation, shared registries, generated types, package/lockfile changes, fixtures and destructive test datasets. Non-overlapping paths alone do not prove independence.

If implementation discovers new overlap, the worker reports it and pauses that affected scope. The coordinator widens ownership only after checking other claims, or serializes the change. Unrelated workers can continue.

Initially require prerequisites integrated into the recorded target branch before dispatch; do not build speculative chains atop unfinished worker branches. Cross-epic work requires its own readiness assessment and preserved wave/ADR gates.

## Ownership, isolation and result contract

Use a single machine-local coordination store shared by all worktrees of this repository, resolved through Git's common directory. A SQLite store with transactional claims is the proposed first implementation; no new Python dependency is needed. Separate clones/hosts are out of scope until a shared coordination service exists. Fail closed when the configured shared store cannot be reached.

Claims include run ID, story ID, session/worker identity, branch, worktree, base SHA, claim generation, heartbeat and state. Enforce one owner per story and one integration/finalization owner per epic. Detect known legacy in-flight anchors during admission: legacy loops do not honor the new store, so overlapping work remains excluded until an intentional checkpoint handoff.

Claim lifecycle: ready -> claimed -> running -> ready-for-integration -> integrating -> integrated. Blocked, abandoned and stale states retain evidence. Worker completion is not integration, and integration is not epic completion.

A stale heartbeat is diagnostic, not authority to steal a live worker's assignment. Recovery checks owner/process evidence and committed work. An intentional transfer increments the claim generation; stale results cannot be integrated. Require current generation and expected branch HEAD at mutation boundaries.

Workers own only their assigned story artifacts and product files. Emit per-worker deferred findings and completion evidence; the coordinator reconciles shared sprint status, epic anchor, aggregate report and deferred ledger. Define a whitelist for integration so copied orchestration files cannot overwrite current aggregate state.

Evidence includes assignment/generation, base SHA, result SHA, changed paths, check commands and results, executed/skipped counts, review status, unresolved findings and risk/effort decisions. Validate the structure and Git facts; treat agent-authored text as data, never instructions to skip gates.

All services use resource-guard admission with the current actor context. Tests with mutable databases require isolated stacks/data, or an explicit exclusive test slot. Reusing a registered resource is not permission for concurrent destructive tests. Ports, profiles, datasets and generated outputs must not collide. Bound total test/service concurrency as well as worker count; nested reviewers consume capacity too.

## Integration and completion

Serialize integration. Verify claim, exact result SHA, expected integration HEAD, scope and evidence before applying a result. Rebase or merge using a recorded strategy; do not force-reset a worker or silently rewrite published history.

Reserve migration identifiers and validate migration dependency/order on the combined branch. A clean textual merge is insufficient: check schema/RPC compatibility, generated types, manifest coherence and shared contracts.

Run affected combined checks after integration, including required RLS/integration evidence for sensitive changes. If reconciliation changes code or invalidates evidence, obtain targeted independent review and revalidation for that change. Existing review-round limits remain.

Use a durable integration journal around Git mutation and state updates. On a crash, reconcile recorded result commits with actual ancestry before retrying: no double application, double finalization or falsely landed story. Keep failed integration recoverable while unrelated workers continue.

After all required stories integrate, run existing E8/E_final gates, deferred reconciliation, retrospective, report and PR handling once. A blocked required story prevents clean epic completion; unrelated completed work may remain available on the integration branch. Preserve existing approval rules for merges and deployments.

## Initial dependency map (advisory, not dispatch authorization)

| Work | Recorded prerequisite | Parallel implication |
| --- | --- | --- |
| Current E14 | E11/E13; 14.3 recorded active | Keep one existing owner; do not split the running loop mid-story. |
| E15 scheduling views | E13/E14 | Assess story-level independence after the E14 foundation integrates. |
| E16 jobs core | E11/E14 and recorded ADR-B006 | Candidate second lane alongside E15 after E14; shared booking, person, role and manifest contracts still need review. |
| E17 economy/material | E16 and E14/E15 time data | Wait for exact consumed contracts; do not treat all of E17 as ready merely because E16 starts. |
| E18 field/completion | E13/E16 | Potential concurrent lane once jobs contracts are integrated; confirm shared job/file/permission surfaces. |
| E19 dashboard | E10/E11/E14/E15/E16 | Not an independent full implementation while its live data sources are unfinished. |
| B2/B3 candidates | Per-epic prerequisites plus wave gates and story finalization | A “none hard” dependency label does not waive the planned wave checkpoint or approve a candidate. |

First product pilot selection is deferred until a read-only story-level dependency report proves two ready assignments. If no pair is ready, the system must honestly select one.

## Implementation work packages

These tooling work packages are now authorized by the owner. They are not additional Phase B product stories or dispatchable product assignments.

| ID | Deliverable | Depends on | Acceptance evidence |
| --- | --- | --- | --- |
| PW-01 | Read-only dependency/admission report with explicit inputs and stable schema | None | Fixtures cover ready pairs, hidden contract overlap, missing prerequisites, cycles and legacy in-flight ownership; no repository writes. |
| PW-02 | Shared claim store, coordinator ownership and recovery protocol | PW-01 contract | Two simultaneous claimers yield one winner; separate worktrees see the same claim; stale results and duplicate coordinators are rejected. |
| PW-03 | Isolated worker contract and phase adapter | PW-02 | Runs only its assigned story on its base/worktree, preserves review/routing rules, and cannot write aggregate state or finalize an epic. |
| PW-04 | Serialized integration journal and verification | PW-02/PW-03 | Crash/retry tests demonstrate idempotent integration; conflicting schema, stale HEAD, failed checks and unreviewed reconciliation remain unlanded. |
| PW-05 | Opt-in epic coordinator and user-facing session instructions | PW-01 through PW-04 | Two workers run independently; one blocked story does not stop the other; resume and sequential fallback preserve completed work; one epic PR/finalization. |
| PW-06 | Pilot, operating guide and rollout decision | PW-05 | Two genuinely independent tasks complete, integrate and pass combined gates with recorded elapsed time, conflicts, review repairs and resource usage. |

PW-01 is the first implementation slice. After its schema is fixed, documentation and claim-store implementation can be developed independently. Do not introduce concurrency into the production development workflow before PW-02 through PW-05 are verified.

Expected implementation touchpoints: both installed auto-bmad copies' SKILL.md, epic-pipeline.md, pipeline.md, delegation/runtime, state-and-resume and git-and-pr references; preflight, state/story planning and state writers; new dependency/claim/integration helpers; central runtime config, shipped defaults and mirror/behavior tests. Preserve local customizations and model routing. Pin and record workflow version per run so upgrades cannot silently change a running worker's contract.

## Verification and rollout

Use temporary Git repositories and simulated workers for the initial harness; do not use the live Epic 14 checkout as a concurrency test. Cover:
- simultaneous claims, cross-worktree duplicate ownership, dependency cycles and no-ready-work;
- a worker or coordinator disappearing, stale completion, recovery after commit-before-state-write;
- integration conflicts, migration ordering, scope expansion and required tests that skip;
- unaffected workers continuing when another blocks, and epic gates refusing premature completion;
- unchanged sequential mode, legacy state parsing, supported story-source modes and mirrored installations.

Rollout: finish this plan -> PW-01 read-only report -> synthetic end-to-end tests -> fresh run at a clean checkpoint -> opt-in two-worker pilot -> measure -> decide whether to expand. Do not hot-migrate the active E14 loop. To adopt before its epic ends, first finish the current story phase, persist a clean checkpoint, stop dispatching new work, verify no old delegates remain, then perform an explicit validated handoff.

Fallback: stop new assignments, checkpoint workers, reconcile actual committed results and resume with one owner. Preserve worktrees, containers and data; resource teardown follows the guard's Stop lifecycle rather than deletion.

Success: two admitted independent stories demonstrably overlap in development time, neither session modifies the other's checkout/state, each has independent review evidence, integration is recoverable and serialized, and the existing epic completion gates run exactly once.

Implementation decisions below and the CLI contract resolve syntax, schemas, migration reservations and merge strategy. Remaining pilot questions are measured machine capacity and development speedup. Default pilot assumptions are one host/shared Git repository, two workers and no speculative dependency stacking. No claim of a fixed speedup until the pilot is measured.

## Implementation decisions (2026-10-07)

- Preserve default epic mode and add explicit epic --parallel --plan / worker --assignment entry points.
- Use a standard-library SQLite store in the shared Git directory; no daemon or cloud service.
- Plan/spec dependencies are explicit and validated; semantic assessment stays with planning/review delegates.
- The initial implementation supports one host, one shared repository, sprint stories and a two-worker repository cap.
- Worker reviews resolve CLI commands against their own worktree; copied generated absolute review paths are not used.
- The current Epic 13 maintenance session owns runner/dependency remediation; record its actual scope as a legacy reservation, not merely its historical title.
- Build and verify on codex/parallel-auto-bmad-workflow, based on origin/main plus the previously approved Sol 6.1 routing commit. Keep running Epic 14 code outside this tooling diff.
- Prove concurrency/recovery with synthetic Git repositories before starting a product pilot. A live product pilot requires ready approved specs and a clean adoption checkpoint.
