# Epic 14 closeout — main merge author handoff

Author: closeout merge implementation/fix delegate, `gpt-6.1-sol` High.
Scope: eight expected governance/workflow conflicts, resolved under the owner's
explicit direct-closeout fallback. This was prepared as an uncommitted merge
handoff. After independent inspection, the merge was committed as
`612ea4e43c3138e3fe20a606aa5b790c79f65d4e` and fast-forward published to PR 86.
It is not a new broad review, product acceptance, retrospective sign-off, or
release approval.

## Merge identity and decisions

The closeout branch started at Epic 14 head
`eef577cadffaf1b67fdff362081127d77a814beb`. Main was
`ab1ca0445b58f5f496be0d938906c744b6dff87e`; their merge base was
`8cc2d192672e80b8a2dd2e3925997ce8988a13b1`. Remote heads were checked before
merging. `git merge --no-commit --no-ff origin/main` produced exactly the eight
expected conflict paths; no additional conflict ownership was needed.

Main's later owner-approved Astra Low exception for non-sensitive planning is
retained alongside Epic 14's Sol Low ordinary / Sol High sensitive policy.
Implementation, review and sensitive decisions stay explicitly on Sol; the
validator admits Astra only in the four documented planning phases. Main's
assigned-worker adapter, aggregate-write exclusions and existing routing guards
are preserved, with matching `.agents` and `.claude` copies.

The sprint conflict retains Epic 14's later recorded `last_updated` timestamp.
Existing Epic 14 story states, the `in-progress` epic state and the historical
retrospective entry are carried forward without new completion or acceptance
flips. They must be reconciled independently against closeout evidence by the
coordinator. Story 19.1's separate worktree and services were not used.

The reusable Build Auto customization retains the review-order and routing
references and the author completion-hook caveats. It drops the two obsolete
Story 14.3 resume facts that still described R2 as undispatched and earlier test
counts as current. Original story/spec/review artifacts preserve those historical
facts and remaining evidence limits; the merge does not rewrite them or credit
another review round. No rendered BMAD workflow source was read or executed.

`package.json` and `pnpm-lock.yaml` have no delta versus the Epic 14 starting
head. No dependency edit or upgrade was performed by this delegate.

## Suggested Review Order

### Owner policy and enforced routing

The newer planning exception and the existing sensitive-effort floor must agree
between instructions and validation. Same-phase escalation remains reasoned;
downgrades remain refused.

- `AGENTS.md:31` — `Use`: retains the newer owner planning exception and Sol execution policy.
- `docs/process/agent-model-routing.md:104` — `Optional Astra`: limits the alternative to non-sensitive planning and coordination.
- `.agents/skills/auto-bmad/scripts/state_update.py:760` — `astra_planning`: enforces the exact four-phase Astra Low allowance.
- `.agents/skills/auto-bmad/scripts/tests/test_routing_migration.py:46` — `test_astra_allowed_only_for_low_planning_routes`: checks allowed and denied model/phase combinations.
- `.agents/skills/auto-bmad/scripts/tests/test_routing_migration.py:396` — `test_same_phase_critical_downgrade_is_rejected_without_state_change`: checks critical-route refusal without state mutation.

### Worker isolation and durable historical state

Main's opt-in worker adapter remains bounded. The coordinator owns aggregate
completion; merging existing status entries does not constitute new acceptance.

- `.agents/skills/auto-bmad/references/pipeline.md:3` — `Assigned parallel workers`: keeps aggregate writes and Phase 8/9 outside worker scope.
- `AGENTS.md:57` — `Parallel development ownership`: preserves the claims/separate-worktree protocol.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:63` — `last_updated`: retains the later existing timestamp.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:247` — `epic-14`: retains in-progress without a merge-induced done flip.

### Reusable author hooks and evidence limits

Reusable instructions no longer replay stale story-specific dispatch facts.
Author trail reconciliation retains the explicit post-terminal limitation.

- `_bmad/custom/bmad-build-auto.toml:8` — `persistent_facts`: retains durable convention and routing references.
- `_bmad/custom/bmad-build-auto.toml:15` — `on_complete`: preserves incomplete exits and the non-atomic completion-hook caveat.
- `.agents/skills/auto-bmad/scripts/tests/test_parallel_cli.py:366` — `test_cli_test_installations_are_identical`: checks the two installed CLI/test copies.

## Verification

Commands use the bundled Python runtime with `-B`; tests create disposable
temporary repositories and do not launch app/database/browser resources.

- `python -B -m unittest discover -s .agents/skills/auto-bmad/scripts/tests -p test_routing_migration.py -v`: native 0, 26 passed, 0 failed, 0 skipped. Includes routing persistence, Astra restrictions, Sol effort floors, critical downgrade refusal and installation mirror assertions.
- `python -B -m unittest discover -s .agents/skills/auto-bmad/scripts/tests -p test_parallel_run.py -v`: native 0, 30 passed, 0 failed, 0 skipped. Covers real concurrent claims, scoped repair/reverification, worker ownership, semantic conflict admission and exact-head recovery in disposable Git fixtures.
- `python -B -m unittest discover -s .agents/skills/auto-bmad/scripts/tests -p test_parallel_cli.py -v`: native 0, 7 passed, 0 failed, 0 skipped. Covers actual entry points, two-worker serialized verification and stale evidence rejection in disposable Git fixtures.
- `node scripts/verify/check-review-order.mjs docs/process/epic14-closeout-2026-10-08.md`: native 0, 12 verified stops, 0 errors.
- `git diff --check` and `git diff --cached --check`: native 0 after conflict-marker removal. `git diff --name-only --diff-filter=U` is empty after explicit resolution staging.

This verification concerns workflow/routing merge semantics. It supplies no new
database, browser, hosted, performance, money/tax or product acceptance evidence.
Fresh product verification and retained review/advisory closure belong to the
separate closeout tasks; skipped historical tests are not coverage. The merge
was committed after independent inspection. Current execution and remaining
gates are recorded in `docs/quality/epic14-direct-closeout-evidence-2026-10-08.md`.
