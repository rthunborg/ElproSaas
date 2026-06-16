# PreToolUse guard for Claude Code (Bash matcher).
#
# Defense-in-depth that mirrors the Codex execpolicy `forbidden` decisions in
# .codex/rules/default.rules. It catches secret-reading and destructive commands
# embedded in compound shell strings that prefix-based `permissions` patterns can
# miss (e.g. `pwsh -Command "Get-Content .env"`).
#
# Protocol: read the tool-call JSON from stdin. To BLOCK, write a reason to stderr
# and exit 2 (Claude Code shows stderr to the model and skips the tool). Exit 0
# allows the call (or defers to declarative `permissions`). Parse failures
# fail-open (exit 0) so the guard never wedges normal work; `permissions.deny`
# remains the backstop.
#
# Documented in docs/process/claude-code-coexistence.md. This file is local
# (.claude/ is git-ignored).

$ErrorActionPreference = 'Stop'

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $payload = $raw | ConvertFrom-Json
} catch {
    exit 0
}

if ($payload.tool_name -ne 'Bash') { exit 0 }

$cmd = [string]$payload.tool_input.command
if ([string]::IsNullOrWhiteSpace($cmd)) { exit 0 }

# (regex, human reason). Matching is case-insensitive.
$blocked = @(
    @('\b(cat|type|gc|Get-Content|more|head|tail|rg|less|bat)\b[^\n]*\.env\b', 'Reading .env / secrets is forbidden (security-guardrails.md).'),
    @('\bprintenv\b',                          'Dumping environment variables is forbidden (may leak secrets).'),
    @('\b(Get-ChildItem|gci)\s+Env:',          'Dumping environment variables is forbidden (may leak secrets).'),
    @('\brm\s+-[a-zA-Z]*[rf][a-zA-Z]*\s+/',    'Recursive delete of root is forbidden.'),
    @('supabase\s+db\s+push\s+--linked',       'Pushing to a linked/prod Supabase project is forbidden until a release process exists.'),
    @('supabase\s+db\s+push\s+--project-ref',  'Targeting a specific Supabase project ref is forbidden until a release process exists.'),
    @('supabase\s+functions\s+deploy',         'Deploying edge functions is forbidden until a release process exists.'),
    @('supabase\s+secrets\b',                  'Supabase secrets operations are forbidden.'),
    @('supabase\s+projects\s+delete',          'Deleting Supabase projects is forbidden.'),
    @('git\s+reset\s+--hard',                  'git reset --hard is destructive; do it manually if truly intended.'),
    @('git\s+push\b[^\n]*(--force\b|--force-with-lease\b|\s-f\b)', 'Force-pushing is destructive; do it manually if truly intended.')
)

foreach ($rule in $blocked) {
    if ([System.Text.RegularExpressions.Regex]::IsMatch($cmd, $rule[0], 'IgnoreCase')) {
        [Console]::Error.WriteLine("Blocked by .claude/hooks/guard.ps1: $($rule[1])")
        exit 2
    }
}

exit 0
