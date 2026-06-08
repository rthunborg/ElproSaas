# ADR-0001: Agentic Development Process

Status: Accepted  
Date: 2026-06-08

## Context

The repository contains a Lovable-generated internal app with valuable domain coverage but known production-readiness risks. The rebuild is not starting with product implementation. The first need is an operating layer that lets BMAD and Codex collaborate safely without expanding scope beyond Phase A.

Phase A is Internal Pilot MVP only. Fortnox, field-worker UX, supplier APIs, AI jobs, HR, rentals, assets, DoU automation, tender/FKU RAG, and full RBAC are deferred.

## Decision

Use BMAD for structured product, architecture, story, test, and review artifacts. Use Codex for repository edits and verification. Govern both through:

- Root `AGENTS.md`.
- BMAD context in `_bmad-output/project-context.md`.
- Process docs in `docs/process`.
- Quality docs in `docs/quality`.
- Security guardrails in `docs/security`.
- Codex config/rules/hooks in `.codex`.
- Focused reviewer agent definitions in `.codex/agents`.

## Consequences

Benefits:

- Agents can proceed on safe docs/config tasks with fewer repeated confirmations.
- Hard approval gates remain for code, migrations, dependencies, network access, secrets, and deferred scope.
- Review responsibilities are split into focused agents.
- The Lovable app is kept as an oracle, not a code source.

Costs:

- Codex hook/rule syntax must be verified against the installed Codex version.
- Codex config, hooks, rules, and custom agents are not enforcement mechanisms until verified against the installed Codex version.
- Some controls are advisory until hook scripts are implemented.
- Process overhead is intentionally higher before product implementation starts.

## Alternatives Considered

| Alternative | Reason not chosen |
| --- | --- |
| BMAD only | Good planning structure, but does not manage repo edits and local verification. |
| Codex only | Good execution, but weaker phase/story governance without BMAD artifacts. |
| Manual process only | Too easy to miss scope, security, and test gates during agentic work. |
| Full automation now | Risky before Codex hook syntax and repo baseline are verified. |

## Hard Gates

Manual approval remains required for:

- Product feature implementation.
- Database migrations.
- Dependency changes.
- Network commands.
- `.env` or secret handling changes.
- Bringing deferred modules into active scope.
