# Run from an external PowerShell window after closing apps/terminals using the checkout.
# Preserves files and existing linked-worktree paths; does not stop any process.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$renameSource = [System.IO.Path]::GetFullPath('C:\DEV\ElproSaas')
$renameDestination = [System.IO.Path]::GetFullPath('C:\DEV\Kopplas')
if ($renameSource -ne 'C:\DEV\ElproSaas' -or $renameDestination -ne 'C:\DEV\Kopplas') {
    throw 'Unexpected checkout rename targets.'
}

# Never hold the source directory open as this shell's working directory.
Set-Location -LiteralPath 'C:\DEV'
$sourceItem = Get-Item -LiteralPath $renameSource -Force
if (-not $sourceItem.PSIsContainer -or $sourceItem.LinkType) {
    throw 'Expected the original real directory; inspect an already-moved checkout manually.'
}
if (-not (Test-Path -LiteralPath (Join-Path $renameSource '.git') -PathType Container)) {
    throw 'Expected the primary Git checkout.'
}
if (Test-Path -LiteralPath $renameDestination) {
    throw 'Destination already exists. Nothing was overwritten.'
}

Move-Item -LiteralPath $renameSource -Destination $renameDestination
if (-not (Test-Path -LiteralPath (Join-Path $renameDestination '.git') -PathType Container)) {
    throw 'Move verification failed; inspect both locations before taking further action.'
}
if (Test-Path -LiteralPath $renameSource) {
    throw 'The checkout moved, but its previous path is occupied. No junction was created.'
}

# Existing linked worktrees and saved project references keep resolving. Use the
# real new directory for new guard-managed resources (the guard rejects reparse paths).
New-Item -ItemType Junction -Path $renameSource -Target $renameDestination | Out-Null
Write-Output 'Checkout moved to C:\DEV\Kopplas. The old path is a compatibility junction.'
Write-Output 'Reopen the project at C:\DEV\Kopplas in Codex and other tools.'
