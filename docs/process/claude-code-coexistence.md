# Claude Code Migration Audit & Coexistence

Status: active. This repo is governed for **both OpenAI Codex and Claude Code**.
`AGENTS.md` is the shared source of truth; `CLAUDE.md` imports it. This document
records the migration audit and maps every Codex guardrail to its Claude Code
home so both tools enforce the same Phase A rules.

Related: [ADR-0001](../decisions/ADR-0001-agentic-development-process.md),
[agent-workflow.md](agent-workflow.md), [codex-hooks-proposal.md](codex-hooks-proposal.md),
[codex-config-verification.md](codex-config-verification.md).

## 1. Agent-Instruction Inventory

| File | Scope | Tool |
| --- | --- | --- |
| `AGENTS.md` | Phase A scope, deferrals, oracle policy, hard gates. Tool-agnostic. | Both |
| `CLAUDE.md` | Imports `@AGENTS.md`; binds gates to Claude Code permissions/hooks/subagents. | Claude Code |
| `_bmad-output/project-context.md` | BMAD context: product boundary, architecture, money/tax, oracle, quality. | Both (BMAD) |
| `docs/decisions/ADR-0001-agentic-development-process.md` | Decision establishing the BMAD + Codex operating layer and hard gates. | Both |
| `docs/process/agent-workflow.md` | Operating model, source hierarchy, hard approval gates. | Both |
| `docs/process/branching-and-pr-policy.md` | Branch types, PR requirements, merge gates. | Both |
| `docs/process/codex-hooks-proposal.md` | Proposed (not active) Codex hooks. | Codex |
| `docs/process/codex-config-verification.md` | Checklist to verify the `.codex` layer. | Codex |
| `docs/quality/quality-gates.md` | Gate 0–5 + phase acceptance matrix. | Both |
| `docs/quality/ci.md` | CI gate-to-command mapping; deferred gates. | Both |
| `docs/quality/definition-of-done.md` | Definition of Done. | Both |
| `docs/security/security-guardrails.md` | Non-negotiable security rules. | Both |
| `.codex/config.toml` | Codex runtime: approval policy, sandbox, network, agent limits. | Codex |
| `.codex/hooks.json` | Hook event arrays — intentionally empty (proposal-only). | Codex |
| `.codex/rules/default.rules` | Execpolicy `prefix_rule` allow/prompt/forbidden — the real command gates. | Codex |
| `.codex/agents/*.toml` (7) | Reviewer agent definitions. | Codex |
| `.github/workflows/ci.yml` | CI enforcement of Static Quality (Gate 2). | Both |

The 7 Codex reviewer agents: `pr-reviewer`, `phase-scope-reviewer`,
`security-rls-reviewer`, `money-tax-reviewer`, `test-gap-reviewer`,
`legacy-oracle-explorer`, `docs-writer`.

## 2. Codex-Specific Constructs → Claude Code Equivalents

`AGENTS.md` is already tool-agnostic — it contains **no** Codex tool names,
approval modes, or `.codex`/`config.toml` paths, so it imports into `CLAUDE.md`
cleanly with nothing to rewrite. The Codex-specific surface is isolated to
`.codex/` and the two `docs/process/codex-*.md` files:

| Codex construct | Codex mechanism | Claude Code equivalent |
| --- | --- | --- |
| `config.toml` `approval_policy = "on-request"` | Ask before sensitive ops | Default permission mode + `permissions.ask` in `.claude/settings.json`. |
| `config.toml` `sandbox_mode = "workspace-write"` | Workspace-write sandbox | Claude Code default workspace write + Bash sandbox; gated by `permissions`. |
| `config.toml` `network_access = false` | No network in sandbox | `permissions.ask` on `curl`/`wget`/`Invoke-WebRequest`/`Invoke-RestMethod`. |
| `config.toml` `[agents] max_threads/max_depth` | Subagent concurrency caps | No settings knob; advisory. Controlled per-invocation via the `Agent` tool. |
| `hooks.json` `UserPromptSubmit` | Prompt scope check | Claude Code `UserPromptSubmit` hook (optional; scope is also enforced by `ask` rules). |
| `hooks.json` `PreToolUse` | Pre-tool path/secret check | Claude Code `PreToolUse` hook (`guard.ps1`) + `permissions.deny`/`ask`. |
| `hooks.json` `Stop` | Final-summary validation | Claude Code `Stop`/`PostToolUse` hook (optional; advisory). |
| `rules/default.rules` `"forbidden"` | Hard block | `permissions.deny` + `PreToolUse` hook (exit 2). |
| `rules/default.rules` `"prompt"` | Require approval | `permissions.ask`. |
| `rules/default.rules` `"allow"` | Auto-allow read-only | `permissions.allow` (or just leave un-gated). |
| `agents/*.toml` | Custom reviewer agents | `Agent` tool tasks / `code-review` + `bmad-code-review` skills; optionally `.claude/agents/*.md`. |

## 3. Guardrail → New Home Mapping

### Advisory conventions → `CLAUDE.md` / `docs/` (already committed)

- Phase A scope boundary, deferred modules, Lovable-oracle policy, source
  hierarchy, money/tax conventions, branching/PR policy, operating modes,
  reviewer responsibilities. These remain in `AGENTS.md` + `docs/` and are
  surfaced to Claude Code via `CLAUDE.md`.

### Hard gates → `.claude/settings.json` (permissions + hooks)

| Guardrail (origin) | Claude Code binding |
| --- | --- |
| No `.env`/secret reads or edits (`security-guardrails.md`; execpolicy `forbidden`) | `permissions.deny` on `Read/Edit/Write(.env*)` + `guard.ps1` blocks `cat/type/gc/Get-Content .env`, `printenv`, `Get-ChildItem Env:`. |
| No irreversible/prod commands (execpolicy `forbidden`) | `permissions.deny` on `rm -rf /`, `supabase db push --linked`, `supabase functions deploy`, `supabase secrets`, `supabase projects delete`; `guard.ps1` also blocks `git reset --hard`, force-push. |
| Approval before installs/migrations/push/network (execpolicy `prompt`; `agent-workflow.md` hard gates) | `permissions.ask`. |
| Protected paths — no product code/migrations without approved story (`AGENTS.md`; `definition-of-done.md`) | `permissions.ask` on `Edit/Write` of `app/**`, `src/**`, `components/**`, `supabase/migrations/**`, `package.json`, `pnpm-lock.yaml`. |
| Test / Static-Quality gate (`quality-gates.md` Gate 2; `ci.md`) | **CI-owned**, not a local hook: `.github/workflows/ci.yml`. Local hooks do not duplicate it. |
| Visual validation | **No existing Codex guardrail to migrate.** Not defined for Phase A (no product UI test gate yet). Attach when product UI work begins, e.g. via the Claude Preview MCP, per the activating story. |

### Why the test gate is not a local hook

Static Quality is enforced uniformly for every PR by CI and cannot be bypassed
locally. Re-implementing it as a local hook would (a) be machine-specific and
(b) slow every push. CI remains the single enforcement surface; see `ci.md`. The
unit-test step is an honest placeholder until the TEA `testarch-framework`
harness lands (~Epic 2).

## 4. Claude Code Enforcement Layer (regenerable)

`.claude/` is git-ignored, so the live `.claude/settings.json` and
`.claude/hooks/guard.ps1` are **local to each machine** (symmetric with how
`.codex/` is treated). The exact content is recorded here so any clone can
recreate it.

`.claude/settings.json`:

```json
{
  "permissions": {
    "deny": [
      "Read(./.env)", "Read(./.env.*)", "Read(./**/.env)",
      "Edit(./.env)", "Edit(./.env.*)", "Write(./.env)", "Write(./.env.*)",
      "Bash(printenv:*)",
      "Bash(rm -rf /:*)", "Bash(rm -fr /:*)",
      "Bash(supabase db push --linked:*)",
      "Bash(supabase functions deploy:*)",
      "Bash(supabase secrets:*)",
      "Bash(supabase projects delete:*)"
    ],
    "ask": [
      "Bash(pnpm install:*)", "Bash(pnpm add:*)", "Bash(pnpm update:*)",
      "Bash(npm install:*)", "Bash(npm i:*)", "Bash(npm update:*)",
      "Bash(bun install:*)", "Bash(npx supabase:*)",
      "Bash(git push:*)", "Bash(git reset:*)", "Bash(git checkout --:*)",
      "Bash(git rebase:*)", "Bash(gh pr merge:*)",
      "Bash(supabase db push:*)", "Bash(supabase db reset:*)",
      "Bash(supabase migration new:*)",
      "Bash(powershell:*)", "Bash(pwsh:*)", "Bash(cmd:*)",
      "Bash(curl:*)", "Bash(wget:*)",
      "Bash(Invoke-WebRequest:*)", "Bash(Invoke-RestMethod:*)",
      "Edit(app/**)", "Write(app/**)",
      "Edit(src/**)", "Write(src/**)",
      "Edit(components/**)", "Write(components/**)",
      "Edit(supabase/migrations/**)", "Write(supabase/migrations/**)",
      "Edit(package.json)", "Write(package.json)",
      "Edit(pnpm-lock.yaml)", "Write(pnpm-lock.yaml)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "pwsh -NoProfile -File \"$CLAUDE_PROJECT_DIR/.claude/hooks/guard.ps1\"" }
        ]
      }
    ]
  }
}
```

`.claude/hooks/guard.ps1` — dependency-free defense-in-depth that blocks
secret-reading and destructive commands embedded in compound shell strings
(things prefix-based `permissions` patterns can miss). Blocks by exiting 2. See
the live file for the exact regex set.

### Optional: sharing the gates

If you want the gates enforced for every clone (not just locally), un-ignore the
declarative settings only:

```gitignore
.claude/
!.claude/settings.json
```

The hook script can stay local or be shared the same way.

## 5. Verification Checklist (Claude Code)

1. `permissions.deny` blocks a `.env` read (try `Read` on `.env` → denied).
2. `permissions.ask` prompts on `git push` and on editing `app/**`.
3. `guard.ps1` blocks `pwsh -Command "Get-Content .env"` (PreToolUse exit 2).
4. CI still runs the full Static-Quality gate on every PR to `main`.
5. Codex side unchanged: `.codex` execpolicy still verified per
   `codex-config-verification.md`.
