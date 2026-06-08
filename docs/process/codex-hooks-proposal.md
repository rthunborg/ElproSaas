# Codex Hooks Proposal

Status: proposal only. Active `.codex/hooks.json` intentionally contains empty official event arrays until scripts and hook syntax are verified.

## Active Hook Events

The intended Codex event mapping is:

| Event | Intended control |
| --- | --- |
| `UserPromptSubmit` | Prompt scope check before work starts. |
| `PreToolUse` | Tool/path/secret check before `Bash`, `apply_patch`, `Edit`, or `Write`. |
| `Stop` | Final-summary validation. |

## Proposed Hooks

| Hook | Event | Blocking after verified? | Purpose |
| --- | --- | --- | --- |
| `prompt-scope-check` | `UserPromptSubmit` | Yes | Require manual approval for product code, migrations, dependencies, network commands, `.env`, or deferred scope. |
| `secret-detection` | `PreToolUse` | Yes | Block `.env` reads/edits, service-role leakage, API keys, tokens, private keys, and raw private fixtures. |
| `stop-summary-validation` | `Stop` | No initially | Warn if final response omits changed files, checks run, skipped checks, manual setup, enforceable/advisory controls, or risks. |

## Proposed Script Locations

Scripts are not created yet.

| Script | Runtime |
| --- | --- |
| `.codex/hooks/prompt-scope-check.ps1` | Dependency-free PowerShell |
| `.codex/hooks/secret-detection.ps1` | Dependency-free PowerShell |
| `.codex/hooks/stop-summary-validation.ps1` | Dependency-free PowerShell |

## Activation Policy

1. Confirm installed Codex hook schema.
2. Create scripts with no third-party dependencies.
3. Run hooks in non-blocking/dry-run mode.
4. Verify hooks appear in `/hooks`.
5. Enable blocking only for scope and secret checks after test prompts prove expected behavior.

