# Running Auto-BMAD work in parallel

The parallel workflow is opt-in. Ordinary `/auto-bmad epic --epic N` remains sequential.
Use one coordinator chat and up to two worker chats in separate Git worktrees.
This first version supports sprint stories, one computer and one shared Git repository.

## Existing sessions

As inspected on 2026-10-07:
- **Resume Epic 14 from checkpoint** is implementing/reviewing Story 14.3.
- **Run Auto-BMAD Epic 13** is repairing the background runner in
  `codex/runner-cursor-resilience` and validating PR #83. Its title is historical.

Leave both in their current checkouts. This tooling is developed separately on
`codex/parallel-auto-bmad-workflow`. Do not pull workflow changes into a running loop
mid-phase. Adopt at a clean checkpoint with no old delegates still writing, or after
the current epic finishes.

## What you ask the coordinator

After the tooling is integrated and you have a fresh coordinator checkout, start
Sol 6.1 Light with:

> Use Auto-BMAD to prepare a parallel readiness plan for Epic 15. Inspect current
> prerequisites and existing sessions. Keep their work excluded. Finalize ready
> story specs through the planning delegate, identify path and semantic conflicts,
> and run the read-only parallel planner. Start no workers yet. Explain which
> stories can run together and which must wait.

Change the epic number to the one you intend. This is preparation, not permission
to implement unapproved product scope. If only one story is ready, one worker is correct.
E15 and E16 are potential later concurrent workstreams once E14 is integrated, not
a preapproved parallel pair. Each epic still has its own coordinator and final gates;
repository-wide claims prevent cross-epic conflicts.

When the plan is ready:

> /auto-bmad epic --epic 15 --parallel --plan <absolute-path-to-plan.json>
> Run the approved plan with up to two workers. Give me the assignment artifacts
> and exact worktree paths for worker chats. Continue integration and epic gates
> as results become ready; retain existing merge approval rules.

Angle-bracket paths are placeholders the coordinator replaces. The skill instructions
drive this flow; the Python helper supplies deterministic checks and coordination.
No global setting turns every existing session parallel.

## What you ask each worker

Open a new Codex chat in the assigned worktree, select Sol 6.1 Light, and paste:

> /auto-bmad worker --assignment <absolute-path-to-assignment.json>
> Complete only this assignment using its pinned spec and ownership constraints.
> Escalate sensitive work to High automatically. Keep independent review and
> required tests, submit the committed result and evidence, and report blockers.

Use the second assignment in a second worktree/chat. Never point both chats at
C:/DEV/ElproSaas or the same worker folder. An ordinary chat opened in the project
root does not become isolated just because its title says "worker".

Alternatively, explicitly tell the coordinator to use internal subagents if you
prefer one visible chat. The same claims and worktree separation still apply.
Creating or messaging user-owned chats requires your authorization.

## Results and recovery

The coordinator owns merge order and aggregate state. A worker finishing does not
mean the story is integrated. The result passes through submission, integration
and combined verification before it is counted as landed. Epic finalization and
the normal tests/PR/CI gates happen after all required results.

If a worker blocks, let unrelated work continue. Ask the coordinator to inspect
status and explain the blocker. Do not open another session on the same story or
delete the ownership record. Heartbeat age alone does not prove a worker stopped.
For a coordinator restart, reopen its same integration worktree and ask it to resume
the run ID through the parallel helper, preserving the journal and completed work.

Containers/test data use the resource guard. Workers need separate mutable test
resources or exclusive test scheduling; worktrees alone do not isolate databases.
Nested reviewers and tests consume machine capacity, so start with two workers.

## Limits and adoption

The helper enforces declared paths/contracts and recorded Git facts; it cannot
discover every semantic dependency or prove that an agent reported a test honestly.
The coordinator and independent reviewers still assess scope and inspect evidence.
Do not edit the plan after initialization; changed scope requires deliberate
checkpoint/replanning and ownership reconciliation.

This is a local coordination system, not a cross-machine scheduler. Workflow
installation, product pilot results and measured speedup must be reported separately.
The synthetic Git test suite validates mechanics without touching the live epics.

On Windows, use `python -X utf8` for helper help/output when the shell encoding cannot display Unicode.

Technical procedure:
[parallel epic protocol](../../.agents/skills/auto-bmad/references/parallel-epic.md)
and the [CLI and evidence contract](parallel-auto-bmad-contract.md).
