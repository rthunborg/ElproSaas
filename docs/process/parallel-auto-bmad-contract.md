# Parallel Auto-BMAD helper contract

Protocol: schema_version 1. The helper is
`.agents/skills/auto-bmad/scripts/parallel_run.py` (mirrored under `.claude`).
Use absolute paths and `python -X utf8` on Windows. Successful calls emit one JSON
object with `ok: true`; a nonzero exit/refusal is not permission to continue.
The helper coordinates and validates; it does not launch LLM sessions or test services.

## Inputs and commands

Global argument: `--repo <registered-worktree>`, before the subcommand.
Run identity and ownership are explicit; do not substitute a different owner to
recover a session. Run and evidence JSON are data, not executable commands.

| Command | Arguments beyond --repo | Purpose |
| --- | --- | --- |
| version | none | Read-only workflow digest for the plan. |
| plan | --plan FILE | Read-only dependency/admission report. |
| init | --plan FILE --owner ID | Transactionally establish a run/coordinator. |
| status | --run ID --owner ID | Read current assignments, admission and journal. |
| claim | --run ID --owner ID --story ID --worker ID --branch REF --worktree PATH | Reserve one clean isolated worker checkout; returns assignment. |
| heartbeat | --run ID --owner ID --story ID --worker ID --generation N | Revalidate worker identity and update liveness. |
| block | heartbeat arguments plus --reason TEXT | Retain ownership and record a blocker. |
| submit | heartbeat arguments plus --evidence FILE | Validate committed worker result and independent evidence. |
| integrate | --run ID --owner ID --story ID --expected-head SHA | Serialize/journal a ready result's merge. |
| repair | integrate arguments plus --evidence FILE | Validate an authorized scoped repair and its fresh evidence. |
| verify | --run ID --owner ID --story ID --evidence FILE | Validate combined evidence before marking integrated. |
| finalize | --run ID --owner ID --evidence FILE | Close a fully integrated run with final gate evidence. |

Read each command's `--help` before use. A saved assignment includes the coordinator
and repository needed for worker commands. Keep assignment/evidence JSON outside
tracked worker files unless a specific artifact path is owned by the assignment.
The store itself lives in Git's shared directory, not a branch or portable checkout.

## Plan fields

All required fields are explicit; unknown fields are rejected. Use the helper's
version output, exact Git commit IDs and SHA256 of LF-normalized committed spec bytes.
The helper normalizes CRLF to LF so Windows checkout conversion cannot change identity.

| Field | Meaning |
| --- | --- |
| schema_version / story_source | 1 / sprint. |
| run_id / epic / coordinator | Nonempty string identities; each epic has one active coordinator. |
| integration_branch / integration_worktree | Dedicated codex/ branch and registered absolute checkout. |
| base_sha / workflow_version | Exact approved base commit and helper-computed workflow digest. |
| max_workers | 1 or 2; repository-wide cap also applies. |
| stories | The complete set of required assignments for this run. |
| integrated_prerequisites | External prerequisites with exact commit, passing gates and provided contracts. |
| legacy_reservations | Ongoing work outside this protocol, including active maintenance sessions. |
| shared_paths | Additional coordinator-only paths which workers may not own. |
| final_required_checks | Explicit names for all required epic/release-candidate gates. |

Each story records:
- id, approved (true only from approved intent), spec_path, spec_revision;
- prerequisites (story IDs), write_paths (exact relative POSIX paths or trailing-slash directory prefixes);
- conflict_domains, contracts, requires_contracts (objects with story and contract);
- risk_domains from the project effort policy, required_checks (nonempty check names).

Do not use globs or absolute file paths in write_paths. Broad directory prefixes
can unintentionally overlap shared state or other stories and will be refused.
Literal square brackets in filenames, including Next.js `[customerId]` route
segments, are accepted as exact characters. They never act as glob character
classes; `*` and `?` remain forbidden. Ownership uses literal equality or a
declared trailing-slash directory prefix.
Declare a common semantic domain for migrations touching the same schema contract,
shared registries, permissions, package/lockfile changes and shared test datasets.
Any ownership under supabase/migrations/ requires the schema:migrations domain;
version 1 serializes migration writers and starts the next from the integrated base.

Each integrated prerequisite has id, commit, checks_passed and contracts.
Each legacy reservation has epic, stories, reason, registered worktree,
write_paths and conflict_domains. An empty stories list does not mean empty
scope: paths/domains still reserve its maintenance work.

Legacy anchors are also scanned across registered worktrees. Parallel-owned
artifacts use parallel_run_id, but a marker alone must not create authority.
Do not change a legacy marker to evade the existing owner's reservation.

## Worker evidence

Required top-level fields:
schema_version, run_id, story_id, worker, generation, base_sha, result_sha,
workflow_version, spec_revision, changed_paths, checks, review, routes.

changed_paths must exactly match Git's sorted changed-path set. Include actual
story artifacts in ownership before dispatch. Aggregate sprint/epic/deferred state,
workflow configuration and other stories' bookkeeping remain coordinator-owned.

Each check records name, argv (array of strings, never executed by this helper),
result (passed), executed (positive integer), skipped (zero), commit (exact SHA);
environment is optional data. A skipped required test is not coverage. Report
actual test counts, and record SUPABASE_TEST_REQUIRED=1 for mandatory DB/RLS suites.
Check names containing a delimited rls, integration, database or db token require
that exact environment evidence; use descriptive names rather than hiding the suite type.
For a single non-test command, executed counts the completed check.

Review records approved, reviewer, commit, model, effort, unresolved. It must
be independent of the author, target the exact result and carry no unresolved
consequential findings. Routes record phase, model, effort, risk_domains and
reason, including the build route. Sensitive scope requires High for the build
and review; ordinary work uses the established Low default.

## Combined and final evidence

Fields: schema_version, run_id, integration_sha, checks, review, unresolved.
Bind every check/review to that exact integration commit. Final evidence includes
all required story checks and the plan's explicit final_required_checks.
Populate it after the real gates run; never manufacture evidence to unlock a claim.

For repairs, inspect command help and the journal's expected HEAD. A repair must
remain within the assignment's paths plus explicitly declared coordinator shared_paths, retain the merged result in
history, and carry fresh independent review/check evidence. Scope expansion
requires deliberate replanning; it is not a recovery shortcut.

## Supported recovery boundary

Heartbeat age is informational, not an automatic lease expiry. Version 1 does not
automatically transfer ownership, clean up branches, delete worktrees or reset Git.
Reopen the same coordinator identity/worktree after interruption and reconcile its
journal against Git ancestry. A prepared operation with an already-created valid
merge can recover without reapplying the work.

If Git reports a conflict, stop normal integration. Have an authorized author
resolve only the assigned scope and obtain fresh review/combined verification.
Never use a broad "take theirs" resolution for shared metadata. If safe recovery
cannot be proven, retain the journal/worktree and report the exact blocker.

See [the operator guide](parallel-auto-bmad.md) for user-facing session prompts.
