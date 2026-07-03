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
- Per-tool mechanical config (`.codex/`, `.claude/`, `.agents/`) and the `_bmad/`
  install are **committed** for this project so the Codex + Claude Code + BMAD
  setup is reproducible and identical across clones; only personal overrides
  (`.claude/settings.local.json`) stay git-ignored. The **authoritative shared
  contract remains the committed Markdown** (`AGENTS.md` + `CLAUDE.md` + `docs/`):
  the tool folders are regenerable, the Markdown is the source of truth.
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
  commands (`rm -rf /`, `supabase functions deploy`, `supabase secrets`,
  `supabase projects delete`). `supabase db push` (incl. `--linked`) was
  REMOVED from the deny set on 2026-07-03 (owner decision, MVP): the demo
  Supabase project is agent-provisioned, so applying committed migrations to
  it is sanctioned; project deletion, secrets ops, and function deploys stay
  denied.
- **`permissions.ask`** — manual approval before `gh pr merge` only. The broader
  product-code / migration-file / dependency-install / network / `git push`
  gates were intentionally relaxed so autonomous runs (e.g. auto-bmad) proceed
  hands-off; enforcement for those paths now rests on `permissions.deny` + the
  PreToolUse hook below, plus CI. **Note:** `ask` (and `deny`) rules fire even
  under `bypassPermissions` mode — bypass only auto-approves the *default* prompt
  flow, it does not override explicit `ask`/`deny`/hooks. That is why the real
  backstops are `deny` + the hook, not `ask`. Codex's execpolicy
  (`.codex/rules/default.rules`) has been relaxed **symmetrically** — its `prompt`
  rules were flipped to `allow` except `gh pr merge`, while its `forbidden` set was
  extended (force-push, `git reset --hard`) to match this hook — so both tools
  behave the same. Caveat: Codex prefix rules can't inspect shell-wrapped strings,
  so a Codex-side `pwsh -Command "cat .env"` is not blocked the way this hook
  blocks it; port `guard.ps1` to a Codex hook if that gap matters.
- **PreToolUse hook** (`.claude/hooks/guard.ps1`) — defense-in-depth that blocks
  secret-reading and destructive commands (force-push, `git reset --hard`, prod
  Supabase, env dumps) hidden inside compound shell strings; runs in all
  permission modes including `bypassPermissions`.

`.claude/` is committed, so this enforcement applies **identically to every
clone**. The settings are also documented in
[docs/process/claude-code-coexistence.md](docs/process/claude-code-coexistence.md)
so they can be regenerated if needed; personal tweaks go in the git-ignored
`.claude/settings.local.json`.

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

All seven are materialized as committed `.claude/agents/*.md` subagents (invoke
them with the `Agent` tool); the `.codex/agents/*.toml` files remain the source
of truth — see the coexistence doc.
