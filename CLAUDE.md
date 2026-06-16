# CLAUDE.md

This repository is developed with **both OpenAI Codex and Claude Code**. The
governing instructions are tool-agnostic and live in `AGENTS.md`; this file
imports them so Claude Code obeys the same rules, then adds the Claude
Code–specific bindings (permission gates, hooks, subagents).

@AGENTS.md

## Coexistence Model

- `AGENTS.md` is the single shared source of truth for both tools. Edit project
  rules there, not here, so Codex and Claude Code never drift.
- Deeper governance lives in `docs/process`, `docs/quality`, `docs/security`,
  `docs/decisions`, and `_bmad-output/project-context.md`.
- Per-tool mechanical config is local and git-ignored: `.codex/` (Codex) and
  `.claude/` (Claude Code). The **durable, shared contract is the committed
  Markdown** (`AGENTS.md` + `CLAUDE.md` + `docs/`), not the tool folders.
- Full mapping of Codex guardrails to their Claude Code homes:
  [docs/process/claude-code-coexistence.md](docs/process/claude-code-coexistence.md).

## Operating Modes (state yours before editing)

Mirrors `docs/process/agent-workflow.md`. Before making changes, state whether
you are in **read-only**, **docs/config-only**, or **implementation** mode.
Implementation mode requires an approved Phase A story or ADR-backed task.

## Hard Approval Gates → Claude Code Bindings

The Codex execpolicy (`.codex/rules/default.rules`) and the hard gates in
`agent-workflow.md` / `ADR-0001` are enforced in Claude Code through
`.claude/settings.json`:

- **`permissions.deny`** — secret reads/edits (`.env*`), and irreversible/prod
  commands (`rm -rf /`, `supabase db push --linked`, `supabase functions
  deploy`, `supabase secrets`, `supabase projects delete`).
- **`permissions.ask`** — manual approval before: dependency installs/updates,
  network commands, `git push`/`reset`/`checkout --`, `gh pr merge`, Supabase
  migrations/db push, and edits to product code (`app/**`, `src/**`,
  `components/**`, `supabase/migrations/**`, `package.json`, `pnpm-lock.yaml`).
- **PreToolUse hook** (`.claude/hooks/guard.ps1`) — defense-in-depth that blocks
  secret-reading and destructive commands hidden inside compound shell strings.

Because `.claude/` is git-ignored, this enforcement is **local to each machine**.
The exact settings are documented in
[docs/process/claude-code-coexistence.md](docs/process/claude-code-coexistence.md)
so any clone can regenerate them.

## Quality Gates Are Enforced in CI

The test/static-quality gate is owned by `.github/workflows/ci.yml`
(`pnpm install --frozen-lockfile` → `verify:lockfiles` → `typecheck` → `lint` →
`test` → `build`), not by local hooks. See `docs/quality/ci.md` and
`docs/quality/quality-gates.md`. Do not weaken or skip these; docs/config-only
PRs must state which product gates were skipped.

## Reviewer Subagents

The seven Codex reviewer roles (`.codex/agents/*.toml`) map to Claude Code as
follows. Use the `Agent` tool (or the project's `code-review` /
`bmad-code-review` skills) with the matching focus:

| Codex agent | Claude Code use |
| --- | --- |
| `phase-scope-reviewer` | Agent task: review diff against Phase A scope + deferrals in `AGENTS.md`. |
| `security-rls-reviewer` | Agent task: tenant isolation / RLS / service-role / secrets review. |
| `money-tax-reviewer` | Agent task: SEK öre, VAT/ROT/grön teknik, quote immutability review. |
| `test-gap-reviewer` | Agent task: missing unit/integration/RLS/golden-master coverage. |
| `legacy-oracle-explorer` | Agent task (read-only): Lovable app as behavioral oracle, no code copy. |
| `docs-writer` | Agent task: docs-only authoring, keep `AGENTS.md` concise. |
| `pr-reviewer` | `code-review` skill, or Agent task: final merge-readiness review. |

These can optionally be materialized as `.claude/agents/*.md` subagents (local,
git-ignored) — see the coexistence doc.
