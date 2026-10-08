param([Parameter(Mandatory=$true)][ValidateSet('verify','focused','affected','full','typecheck','lint','scan')][string]$Mode)
$ErrorActionPreference = 'Stop'
$taskRoot = 'C:\DEV\ElproSaas'
$privateFixture = 'C:\Users\Rasmus\.codex\worktrees\epic14-scheduling\guard-compose-01a0ecb9-r4\.env.test'
$values = @{}
foreach ($line in [System.IO.File]::ReadAllLines($privateFixture)) {
  if ($line.Trim() -match '^([A-Z_][A-Z0-9_]*)=(.*)$') {
    $value = $Matches[2]
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) { $value = $value.Substring(1,$value.Length-2) }
    $values[$Matches[1]] = $value
  }
}
foreach ($required in @('POSTGRES_PASSWORD','ANON_KEY','SERVICE_ROLE_KEY')) { if (-not $values[$required]) { throw 'Private local fixture incomplete' } }
$env:SUPABASE_TEST_URL = 'http://127.0.0.1:55421'
$env:SUPABASE_TEST_DB_URL = 'postgresql://postgres:' + [System.Uri]::EscapeDataString($values['POSTGRES_PASSWORD']) + '@127.0.0.1:55422/postgres'
$env:SUPABASE_TEST_ANON_KEY = $values['ANON_KEY']
$env:SUPABASE_TEST_SERVICE_ROLE_KEY = $values['SERVICE_ROLE_KEY']
$env:SUPABASE_TEST_REQUIRED = '1'
$env:NEXT_PUBLIC_SUPABASE_URL = $env:SUPABASE_TEST_URL
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $values['ANON_KEY']
$env:BOOKING_CONFLICT_ATTESTATION_KEY_ID = 'test_v1'
$env:BOOKING_CONFLICT_ATTESTATION_HMAC_SECRET = 'local-test-only-booking-conflict-attestation-secret-v1'
Set-Location -LiteralPath $taskRoot
& node '_bmad-output/test-artifacts/epic-14-gate-iter1-run-local.mjs' $Mode
exit $LASTEXITCODE
