# Codex Config Verification

Use this checklist before trusting the project `.codex` layer.

## 1. Verify Codex Reads `AGENTS.md`

Manual check:

1. Start Codex from the project root: `codex -C C:\ElproSaas`
2. Ask: `What is the current project phase and what scope is deferred?`
3. Expected answer: Phase B / Legacy Parity Release; scope is manifest-governed (`src/scope/manifest.ts`) — a module's surface may exist only when the module is `active`; the Phase C ledger (all AI flows, live supplier vendor APIs, customer portal / BankID online acceptance, bookkeeping beyond Fortnox, the public anonymous suggestion endpoint, the full-release legal/GDPR program, a native mobile app, self-serve tenant signup) is deferred with no exceptions without a new owner decision.

Do not treat this as verified until the answer cites the repo instructions or matches them exactly.

## 2. Verify `config.toml` Loads

Run:

```powershell
codex --strict-config -C C:\ElproSaas --help
```

Expected:

- No unknown-key errors.
- If `[agents]` keys are rejected, move agent limits to documentation until the installed version supports them.

## 3. Verify Custom Agents Load

Manual check:

1. Start Codex from the project root: `codex -C C:\ElproSaas`
2. Open the agent list if available, for example `/agents`.
3. Confirm these agents appear:
   - `phase-scope-reviewer`
   - `security-rls-reviewer`
   - `money-tax-reviewer`
   - `test-gap-reviewer`
   - `legacy-oracle-explorer`
   - `docs-writer`
   - `pr-reviewer`

If Codex does not load `.codex/agents/*.toml`, treat the files as advisory prompts until the correct agent schema/path is confirmed.

## 4. Verify Execpolicy Rules Parse And Decide Correctly

Run from `C:\ElproSaas`:

```powershell
Set-Location C:\ElproSaas
codex execpolicy check --pretty --rules .\.codex\rules\default.rules -- git status --short
codex execpolicy check --pretty --rules .\.codex\rules\default.rules -- rg --files docs
codex execpolicy check --pretty --rules .\.codex\rules\default.rules -- npm install
codex execpolicy check --pretty --rules .\.codex\rules\default.rules -- git push origin docs/guardrails
codex execpolicy check --pretty --rules .\.codex\rules\default.rules -- cat .env
codex execpolicy check --pretty --rules .\.codex\rules\default.rules -- Get-Content .env
codex execpolicy check --pretty --rules .\.codex\rules\default.rules -- powershell -NoProfile -Command "cat .env"
codex execpolicy check --pretty --rules .\.codex\rules\default.rules -- pwsh -NoProfile -Command "cat .env"
codex execpolicy check --pretty --rules .\.codex\rules\default.rules -- supabase migration new test_migration
codex execpolicy check --pretty --rules .\.codex\rules\default.rules -- supabase db reset
codex execpolicy check --pretty --rules .\.codex\rules\default.rules -- supabase db push
codex execpolicy check --pretty --rules .\.codex\rules\default.rules -- supabase db push --linked
codex execpolicy check --pretty --rules .\.codex\rules\default.rules -- __codex_rule_smoke_test__
```

If not running from `C:\ElproSaas`, use an absolute rules path instead of `.\.codex\rules\default.rules`.

The `--` separator before the tested command is required. Without it, command flags can be parsed as `codex execpolicy check` flags instead of command tokens.

`{"matchedRules":[]}` means no rule matched and should not be treated as success. Expected governed commands should show both `matchedRules` and a `decision`.

Expected decisions:

| Command | Expected decision |
| --- | --- |
| `git status --short` | `allow` |
| `rg --files docs` | `allow` |
| `npm install` | `prompt` |
| `git push origin docs/guardrails` | `prompt` |
| `cat .env` | `forbidden` |
| `Get-Content .env` | `forbidden` |
| `powershell -NoProfile -Command "cat .env"` | `prompt` |
| `pwsh -NoProfile -Command "cat .env"` | `prompt` |
| `supabase migration new test_migration` | `prompt` |
| `supabase db reset` | `prompt` |
| `supabase db push` | `prompt` |
| `supabase db push --linked` | `forbidden` |
| `__codex_rule_smoke_test__` | `forbidden` |

## 5. Verify Hooks Are Visible Before Trusting Them

The active `.codex/hooks.json` is intentionally empty:

```json
{
  "hooks": {
    "UserPromptSubmit": [],
    "PreToolUse": [],
    "Stop": []
  }
}
```

Manual check:

1. Start Codex from the project root.
2. Open `/hooks` if available.
3. Confirm no blocking hooks are enabled.
4. After scripts are implemented, confirm proposed hooks appear under `UserPromptSubmit`, `PreToolUse`, and `Stop`.

Do not assume hooks are enforceable until `/hooks` shows them and dry-run prompts prove behavior.

## 6. Verify Project `.codex` Layer Is Trusted

Manual check:

1. Start Codex from `C:\ElproSaas`.
2. If Codex shows a project trust prompt, approve only after reviewing `.codex/config.toml`, `.codex/hooks.json`, `.codex/rules/default.rules`, and `.codex/agents/*.toml`.
3. Do not use `--dangerously-bypass-hook-trust` for normal work.

Project-local `.codex` rules, hooks, config, and agents require the project `.codex` layer to be trusted before they should be relied on.

## Version-Specific Uncertainty

- Hook object fields beyond event arrays are not verified.
- Agent TOML schema may require additional keys in future versions.
- `[agents] max_threads/max_depth` support must be confirmed with `--strict-config`.
- Execpolicy rules are verified with `prefix_rule([...], "allow|prompt|forbidden")` on the local Codex CLI, but runtime integration with interactive tool approvals still needs manual confirmation.
