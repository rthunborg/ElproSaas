# Agent Workflow

This document defines how BMAD and Codex are used together in this repo.

## Operating Model

BMAD is used for product, architecture, story, test, and review structure. Codex is used for repository edits, file-level verification, and implementation once a story is approved.

During the current setup phase, agents may create process, configuration, and documentation files only. Product code, database migrations, dependencies, and `.env` are out of scope.

## Source Hierarchy

| Priority | Source |
| --- | --- |
| 1 | Direct user instruction in the current task |
| 2 | `AGENTS.md` |
| 3 | Baseline plan: `docs/planning/saas-rebuild-phased-plan-2026-06-07.md` |
| 4 | ADRs in `docs/decisions` |
| 5 | Process, quality, and security docs |
| 6 | Existing Lovable app as behavioral oracle only |

## Standard Flow

1. Read `AGENTS.md` and the baseline plan.
2. Identify phase: Phase A, External Beta, or Commercial V1+.
3. Run a scope check against explicit deferrals.
4. If coding is requested, require an approved story or ADR-backed change.
5. Use the Lovable app only to understand behavior or produce fixtures.
6. Make narrowly scoped changes.
7. Run the relevant quality gates.
8. Summarize changed files, verification, remaining risks, and any manual setup.

## BMAD Responsibilities

BMAD agents should:

- Create or validate PRDs, stories, architecture notes, test plans, and reviews.
- Keep Phase A small.
- Ask owner questions for ambiguous Swedish domain terms.
- Produce artifacts with acceptance criteria and explicit deferrals.
- Avoid implementation details unless the artifact requires them.

## Codex Responsibilities

Codex should:

- State whether it is operating in read-only, docs/config-only, or implementation mode before making changes.
- Edit files in the repo.
- Avoid destructive commands.
- Avoid network commands unless explicitly approved.
- Avoid touching `.env`.
- Avoid adding dependencies unless explicitly approved.
- Verify changes locally with available non-network commands.
- Report exact files changed and checks run.

## Lovable Oracle Workflow

Use the existing app to answer "what does the current business process do?" not "what code should we copy?"

Allowed outputs from oracle exploration:

- Behavior notes.
- Domain questions.
- Golden-master fixture descriptions.
- Exact candidate function names for later tested reuse.

Forbidden outputs by default:

- Direct copied product code.
- Recreated insecure service-role patterns.
- Deferred module expansion.

## Hard Approval Gates

Manual approval is required before:

- Product feature implementation starts.
- Database migrations are created.
- Dependencies are added or upgraded.
- Network commands are run.
- `.env` or secrets handling changes.
- Fortnox, supplier APIs, AI jobs, field-worker UX, HR, rentals, assets, DoU, tender/FKU RAG, or full RBAC is brought into active scope.
