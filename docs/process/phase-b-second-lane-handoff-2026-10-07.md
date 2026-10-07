# Phase B second-lane handoff — 2026-10-07

## Ownership and current state

This package is prepared by the `Assess remaining Phase B work` chat. The existing
`Assess Phase B parallel readiness` chat is idle and has not been messaged or assigned
implementation. Do not have both chats launch the same story.

Epic 14 remains owned by `Resume Epic 14 from checkpoint` in C:/DEV/ElproSaas.
The inspected checkpoint is 7982e5d3: Story 14.3 landed locally; Story 14.4 is blocked
on two owner product decisions. Do not resolve those decisions by implication here.
The separate `Run Auto-BMAD Epic 13` maintenance PR #83 is merged and its chat idle.
Before launch, refresh actual status and outstanding edits: inactivity alone does not
release an existing claim, but a completed maintenance task is not a permanent
reservation of every notification/email file.

## First launch is one story, not the entire epic

Target the stable key `19-1-widget-registry-and-dashboard-framework`, with
`_bmad-output/implementation-artifacts/spec-19-1-dashboard-framework-and-quote-pipeline.md`.
It includes the framework and only the live Offertpipeline widget. All five other
widgets remain in 19.2. Neither 19.1 completion nor its PR closes Epic 19.

Use ordinary bounded Auto-BMAD single-story mode for this initial lane. Two
independent sessions in different worktrees can progress while each retains its
sequential internal story pipeline. The new whole-epic parallel adapter must not
be given a fabricated complete Epic 19 plan containing only 19.1. Do not create
placeholder specs for 19.2 to satisfy the planner.

## Launch gates

1. Merge the reviewed preparation package and accepted workflow (PR #84) under
   normal approval/CI rules. Confirm relevant CI including Windows contracts.
   Ordinary Auto-BMAD Phase 1 branches from configured git.base_branch (currently
   main), so fetch and safely reconcile that base, then prove it contains both the
   reviewed ready-for-dev spec/canonical amendments and accepted workflow. Starting
   a checkout at an unmerged preparation commit alone is insufficient. Do not reset
   divergent local main or change the active Epic 14 checkout; preserve local commits.
2. Create a fresh dedicated managed worktree from that verified configured base;
   use a new codex/ branch. Never use C:/DEV/ElproSaas or reuse the preparation
   checkout while this chat owns it. Inspect existing story/epic anchors with the
   standard preflight; do not delete or relabel inherited ownership to get past it.
3. Resolve 19.1 and its spec with story_plan.py; confirm ready-for-dev, exact spec
   revision, no other owner, and the gates required by ordinary Auto-BMAD. The inspected E18 retrospective
   is absent; the existing Phase 0 gate blocks only a found, rejected verdict.
   Absence therefore does not invent a new E18 completion prerequisite or imply
   its acceptance. Refresh that result before launch.
4. Refresh E14 planned/actual paths before dispatch. Exclude bookings, scheduling,
   person records, migrations and permission-matrix changes. Reserve shared manifest
   integration for serialized review. A live scope change requires rechecking overlap.
5. Resolve external review commands against this story worktree during normal
   preflight/provisioning. A copied absolute C:/DEV/ElproSaas review command must
   not review the Epic 14 checkout. Confirm the resolved root before review.
6. Use one extra implementation lane initially. Keep mutable test infrastructure
   isolated through the resource guard or schedule exclusive use. Count nested
   reviews/test services toward machine capacity.

## Prompt for the existing coordinator

After the preparation and workflow changes are available in the dedicated worktree:

> Use the reviewed Phase B second-lane package. Run /auto-bmad --story
> 19-1-widget-registry-and-dashboard-framework, adopting the existing ready-for-dev
> spec. Own only this story in a dedicated worktree and new codex/ branch. Verify
> launch gates in docs/process/phase-b-second-lane-handoff-2026-10-07.md first.
> Preserve Epic 14 ownership and leave its pending product decisions there. Keep
> 19.2 and Epic 19 incomplete. The coordinator may use GPT-6 Astra Light; explicitly
> dispatch implementation/review on Sol 6.1, using High for the spec's permission,
> tenant and money boundaries. Retain required tests, independent review and normal
> PR/merge gates. Stop after this story; do not auto-select 19.2 or E20.

The coordinator can use internal subagents; a second visible worker chat is not
required for this initial one-story lane. Do not run the same prompt in two chats.
Messaging the idle coordinator remains a separate user-authorized handoff.

Independent High review approved the 19.1 specification for ready-for-dev on
2026-10-07. Its material handoff finding (Phase 1 rebranches from configured base)
is addressed by launch gate 1 above. This is specification review, not product
implementation/test evidence.

## Documents follows preparation gates

The early B2 exception is limited to E20/FR109 and is recorded in
`_bmad-output/planning-artifacts/early-b2-documents-checkpoint-2026-10-07.md`.
It retains source-entity authorization, active-module coverage, signed access and
archive/restore integrity. It does not complete B1b exit or admit all B2/B3 work.
Resolve the recorded oracle and full-story review conditions before implementation;
keep E20 out of automatic story selection until they are satisfied.

## Measure the pilot

Record wall-clock start/end, active implementation/review time, waiting on shared
resources, integration conflicts and test rework. One admitted additional lane is
the initial capacity target; no measured speedup is claimed by this preparation.
