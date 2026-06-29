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
| `config.toml` `approval_policy = "on-request"` | Ask before sensitive ops | Permission mode + `permissions.ask` in `.claude/settings.json`. **Both tools relaxed symmetrically:** `ask` (Claude) and execpolicy `prompt` (Codex) now gate `gh pr merge` only; the rest rely on `permissions.deny`/`guard.ps1` (Claude) and execpolicy `forbidden` (Codex). |
| `config.toml` `sandbox_mode = "workspace-write"` | Workspace-write sandbox | Claude Code default workspace write + Bash sandbox; gated by `permissions`. |
| `config.toml` `network_access = true` | Network allowed in sandbox | No longer an `ask` gate on the Claude Code side (`curl`/`wget`/`Invoke-WebRequest`/`Invoke-RestMethod` run without a prompt); Codex `network_access` relaxed to `true` to match. Sandbox network egress is no longer blocked on either side. |
| `config.toml` `[agents] max_threads/max_depth` | Subagent concurrency caps | No settings knob; advisory. Controlled per-invocation via the `Agent` tool. |
| `hooks.json` `UserPromptSubmit` | Prompt scope check | Claude Code `UserPromptSubmit` hook (optional). Scope discipline is now advisory (operating modes + review + CI), not an `ask` prompt. |
| `hooks.json` `PreToolUse` | Pre-tool path/secret check | Claude Code `PreToolUse` hook (`guard.ps1`) + `permissions.deny`/`ask`. |
| `hooks.json` `Stop` | Final-summary validation | Claude Code `Stop`/`PostToolUse` hook (optional; advisory). |
| `rules/default.rules` `"forbidden"` | Hard block | `permissions.deny` + `PreToolUse` hook (exit 2). |
| `rules/default.rules` `"prompt"` | Require approval | `permissions.ask` (Claude Code side narrowed to `gh pr merge`; the destructive subset moved to `permissions.deny` + `guard.ps1`). |
| `rules/default.rules` `"allow"` | Auto-allow read-only | `permissions.allow` (or just leave un-gated). |
| `agents/*.toml` | Custom reviewer agents | `Agent` tool tasks / `code-review` + `bmad-code-review` skills; materialized as `.claude/agents/*.md` (all 7 — see §4). |

## 3. Guardrail → New Home Mapping

### Advisory conventions → `CLAUDE.md` / `docs/` (already committed)

- Phase A scope boundary, deferred modules, Lovable-oracle policy, source
  hierarchy, money/tax conventions, branching/PR policy, operating modes,
  reviewer responsibilities. These remain in `AGENTS.md` + `docs/` and are
  surfaced to Claude Code via `CLAUDE.md`.

### Hard gates → `.claude/settings.json` (permissions + hooks)

| Guardrail (origin) | Claude Code binding |
| --- | --- |
| No `.env`/secret reads or edits (`security-guardrails.md`; execpolicy `forbidden`) | `permissions.deny` on `Read/Edit/Write` of every standard env file — `.env`, `.env.local`, `.env.*.local`, `.env.development`, `.env.production`, `.env.test` — plus nested `**/.env`; `guard.ps1` also blocks `cat/type/gc/Get-Content .env`, `printenv`, `Get-ChildItem Env:`. The safe placeholder templates `.env.example` / `.env.sample` / `.env.template` are carved out via `permissions.allow` so docs/setup stories (e.g. Story 1.4) can author them. Deny outranks allow and the glob dialect has no negation syntax, so the deny **enumerates the secret files** instead of a broad `.env.*` block that would also catch the templates. |
| No irreversible/prod commands (execpolicy `forbidden`) | `permissions.deny` on `rm -rf /`, `supabase db push --linked`, `supabase functions deploy`, `supabase secrets`, `supabase projects delete`; `guard.ps1` also blocks `git reset --hard`, force-push. |
| Approval before installs/migrations/push/network (execpolicy `prompt`; `agent-workflow.md` hard gates) | **Relaxed on the Claude Code side** — `permissions.ask` now gates `gh pr merge` only, so autonomous runs (auto-bmad) proceed hands-off. The destructive subset stays hard-blocked by `permissions.deny` + `guard.ps1` (prod Supabase, force-push, `git reset --hard`, env dumps); CI is the merge-blocking gate. Codex's execpolicy was relaxed symmetrically — `prompt` rules flipped to `allow` (except `gh pr merge`), `forbidden` set extended to force-push + `git reset --hard`. |
| Protected paths — no product code/migrations without approved story (`AGENTS.md`; `definition-of-done.md`) | **No longer an `ask` gate.** Product-code/migration writes proceed without a prompt; the approved-story discipline is enforced by the operating-modes convention (`agent-workflow.md`), code review, and CI — not by a Claude Code permission prompt. |
| Test / Static-Quality gate (`quality-gates.md` Gate 2; `ci.md`) | **CI-owned**, not a local hook: `.github/workflows/ci.yml`. Local hooks do not duplicate it. |
| Visual validation | **No existing Codex guardrail to migrate.** Not defined for Phase A (no product UI test gate yet). Attach when product UI work begins, e.g. via the Claude Preview MCP, per the activating story. |

### Why the test gate is not a local hook

Static Quality is enforced uniformly for every PR by CI and cannot be bypassed
locally. Re-implementing it as a local hook would (a) be machine-specific and
(b) slow every push. CI remains the single enforcement surface; see `ci.md`. The
unit-test step is an honest placeholder until the TEA `testarch-framework`
harness lands (~Epic 2).

## 4. Claude Code Enforcement Layer (committed)

`.claude/` is **committed** for this project (along with `.codex/`, `.agents/`,
and the `_bmad/` install), so `.claude/settings.json` and
`.claude/hooks/guard.ps1` are enforced **identically for every clone**. Only
personal machine-local overrides (`.claude/settings.local.json`) stay
git-ignored. The content is also recorded here so it can be regenerated if ever
needed.

`.claude/settings.json`:

```json
{
  "permissions": {
    "deny": [
      "Read(./.env)", "Read(./.env.local)", "Read(./.env.*.local)",
      "Read(./.env.development)", "Read(./.env.production)", "Read(./.env.test)", "Read(./**/.env)",
      "Edit(./.env)", "Edit(./.env.local)", "Edit(./.env.*.local)",
      "Edit(./.env.development)", "Edit(./.env.production)", "Edit(./.env.test)",
      "Write(./.env)", "Write(./.env.local)", "Write(./.env.*.local)",
      "Write(./.env.development)", "Write(./.env.production)", "Write(./.env.test)",
      "Bash(printenv:*)",
      "Bash(rm -rf /:*)", "Bash(rm -fr /:*)",
      "Bash(supabase db push --linked:*)",
      "Bash(supabase functions deploy:*)",
      "Bash(supabase secrets:*)",
      "Bash(supabase projects delete:*)"
    ],
    "allow": [
      "Read(./.env.example)", "Read(./.env.sample)", "Read(./.env.template)",
      "Edit(./.env.example)", "Edit(./.env.sample)", "Edit(./.env.template)",
      "Write(./.env.example)", "Write(./.env.sample)", "Write(./.env.template)"
    ],
    "ask": [
      "Bash(gh pr merge:*)"
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

### Local-only overrides

The shared gates live in the committed `.claude/settings.json`. For a personal,
machine-specific tweak that should NOT be shared, put it in
`.claude/settings.local.json` (git-ignored) — Claude Code merges it over
`settings.json`. To make the whole `.claude/` local again, re-add `.claude/` to
`.gitignore`.

### Materialized review subagents (`.claude/agents/`)

All seven Codex reviewers are also materialized as Claude Code subagents so they
can be invoked with the `Agent` tool during a Claude Code session. The
`.codex/agents/*.toml` files remain the source of truth; these `.md` copies are
committed alongside `settings.json` (and regenerable from the TOMLs):

| `.claude/agents/*.md` | Source TOML | Access | Use |
| --- | --- | --- | --- |
| `phase-scope-reviewer.md` | `phase-scope-reviewer.toml` | read-only | Phase A scope + deferral check on a diff/plan. |
| `security-rls-reviewer.md` | `security-rls-reviewer.toml` | read-only | Tenant-isolation / RLS / service-role / secrets review. |
| `money-tax-reviewer.md` | `money-tax-reviewer.toml` | read-only | SEK öre, VAT/ROT/grön teknik, snapshot/immutability review. |
| `test-gap-reviewer.md` | `test-gap-reviewer.toml` | read-only | Missing unit/integration/RLS/golden-master coverage. |
| `pr-reviewer.md` | `pr-reviewer.toml` | read-only | Final merge-readiness review of a branch/PR. |
| `legacy-oracle-explorer.md` | `legacy-oracle-explorer.toml` | read-only | Lovable-oracle exploration (no code copy). |
| `docs-writer.md` | `docs-writer.toml` | docs-write | Docs-only authoring; keeps `AGENTS.md` concise. |

All are read-only (`tools: Read, Grep, Glob, Bash`) except `docs-writer`, which
also has `Edit`/`Write` for documentation files. Each inherits the `permissions`
+ `guard.ps1` gates above.

**auto-bmad does not invoke these automatically** — its review roster is fixed
(blind / edge / auditor / security / triage + TEA). Three overlap with that
built-in coverage (`test-gap-reviewer` ≈ the TEA trace/test-review gates,
`pr-reviewer` ≈ the auto-bmad triage + final report, `docs-writer` ≈ the BMAD
doc skills); the other four fill gaps the fan-out does not (project scope, tenant
RLS, money/tax, and the legacy oracle). Run any of them as a manual pass —
directly via the `Agent` tool or alongside the `code-review` skill — on a branch
or PR.

## 5. Verification Checklist (Claude Code)

1. `permissions.deny` blocks a `.env` / `.env.local` read (try `Read` on `.env` → denied); `permissions.allow` permits a template (try `Write` on `.env.example` → allowed, as Story 1.4 needs).
2. `permissions.ask` prompts on `gh pr merge` (the only remaining `ask` gate); editing `app/**`/`src/**` and `git push` now proceed without a prompt by design. Note `ask`/`deny`/hooks fire even under `bypassPermissions` — bypass only auto-approves the default prompt flow.
3. `guard.ps1` blocks `pwsh -Command "Get-Content .env"` (PreToolUse exit 2).
4. CI still runs the full Static-Quality gate on every PR to `main`.
5. Codex side relaxed symmetrically: `.codex/rules/default.rules` `prompt` rules
   flipped to `allow` (except `gh pr merge`), `forbidden` extended to force-push +
   `git reset --hard`, and `.codex/config.toml` `network_access = true`. Verify with
   `codex execpolicy check --rules .codex/rules/default.rules <command>` per
   `codex-config-verification.md` (e.g. `npm install` → allow, `git push --force` →
   forbidden, `gh pr merge 123` → prompt, `supabase db push --linked` → forbidden).
