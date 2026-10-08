# UNSUPPORTED FOR AUTOMATION: DO NOT EXECUTE AGAIN.
# WSL2.7.12 --debug-shell is a shared interactive console, not an exec interface.
# Windows-client cleanup does not prove guest-reader termination. Kept as evidence.
# Owner-launched diagnostic only. No UAC launch, clock/service/config writes.
# One ten-second command budget; kills/closes only process handles it created.
$ErrorActionPreference = 'Stop'
$diagnosticWatch = [System.Diagnostics.Stopwatch]::StartNew()
$diagnosticProcesses = New-Object 'System.Collections.Generic.List[System.Diagnostics.Process]'
$diagnosticResultPath = 'C:/DEV/ElproSaas/_bmad-output/test-artifacts/story14-3-time-admin-probe-result.json'
$diagnosticResult = [ordered]@{
  readOnly = $true; administrator = $false; existingVmProvenActive = $false
  commandBudgetMs = 10000; failureStage = $null; failureType = $null
  nativeExit = $null; safeLines = @(); readCompleted = $false
  stderrBytes = 0; administratorRequired = $false; disabledByPolicy = $false
  explicitExitSent = $false; ownProcessIds = @(); ownHandlesClosed = $false
  ownWindowsProcessesExited = $true; timedOut = $false
  clockServiceConfigChanges = $false
}

function Invoke-DiagnosticRead {
  param([string]$Arguments, [string]$InputText, [System.Text.Encoding]$OutputEncoding)
  $remaining = 10000 - [int]$diagnosticWatch.ElapsedMilliseconds
  if ($remaining -le 0) { throw [System.TimeoutException]::new('diagnostic-budget') }
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = 'C:/Windows/System32/wsl.exe'
  # These are fixed argument strings below; no shell evaluation or user inputs.
  $info.Arguments = $Arguments
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  $info.RedirectStandardInput = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.StandardOutputEncoding = $OutputEncoding
  $info.StandardErrorEncoding = $OutputEncoding
  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $info
  if (-not $process.Start()) { throw [System.InvalidOperationException]::new('diagnostic-start') }
  $diagnosticProcesses.Add($process)
  $diagnosticResult.ownProcessIds += $process.Id
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  if ($InputText) { $process.StandardInput.Write($InputText) }
  $process.StandardInput.Close()
  $remaining = [Math]::Max(0, 10000 - [int]$diagnosticWatch.ElapsedMilliseconds)
  if (-not $process.WaitForExit($remaining)) {
    $diagnosticResult.timedOut = $true
    $process.Kill() # Only the exact process object created by this invocation.
    [void]$process.WaitForExit(250)
    throw [System.TimeoutException]::new('diagnostic-budget')
  }
  if (-not $stdoutTask.Wait(250) -or -not $stderrTask.Wait(250)) {
    throw [System.TimeoutException]::new('diagnostic-output')
  }
  return @{ nativeExit = $process.ExitCode; stdout = $stdoutTask.Result; stderr = $stderrTask.Result }
}

# Single-quoted here-string preserves all Linux $variables literally.
$diagnosticShell = @'
printf 'SAFE|SELF_PIDNS|'; readlink /proc/self/ns/pid
for pid in 241 729 450; do
  pdir="/proc/$pid"
  pname="$(cat "$pdir/comm" 2>/dev/null)"
  printf 'SAFE|TARGET_COMM|%s|%s\n' "$pid" "$pname"
  case "$pid:$pname" in
    241:chronyd|729:systemd-timesyn*|450:chronyd|450:systemd-timesyn*|450:*timesync*|450:*time-sync*|450:ntpd)
      awk '/^NSpid:/ {print "SAFE|NSPID|" $0}' "$pdir/status"
      printf 'SAFE|PIDNS|'; readlink "$pdir/ns/pid"
      printf 'SAFE|MNTNS|'; readlink "$pdir/ns/mnt"
      printf 'SAFE|EXE|'; readlink "$pdir/exe"
      awk -F: '{print "SAFE|CGROUP|" $3}' "$pdir/cgroup"
      for release in "$pdir/root/etc/os-release" "$pdir/root/usr/lib/os-release"; do
        test ! -f "$release" || awk '/^(ID|VERSION_ID)=/ {print "SAFE|OS|" $0}' "$release"
      done
      if test "$pid:$pname" = '241:chronyd'; then
        for config in "$pdir/root/etc/chrony.conf" "$pdir/root/etc/chrony/chrony.conf"; do
          if test -f "$config"; then
            printf 'SAFE|CHRONY_CONFIG_PRESENT|%s\n' "$config"
            awk '
              $1 ~ /^(server|pool|peer)$/ {print "SAFE|CHRONY_SOURCE|" $1 "|reference_redacted"; next}
              $1 == "refclock" {print "SAFE|CHRONY_SOURCE|refclock|" $2 "|reference_redacted"; next}
              $1 ~ /^(maxslewrate|corrtimeratio|makestep|maxdrift|maxupdateskew|minsources)$/ {
                out="SAFE|CHRONY_CONTROL|" $1; for(i=2;i<=NF;i++) if($i ~ /^[-0-9.]+$/) out=out "|" $i; print out
              }
              $1 ~ /^(rtcsync|local|leapsecmode)$/ {print "SAFE|CHRONY_CONTROL|" $1}
            ' "$config"
          fi
        done
      fi
      printf 'SAFE|END_TARGET|%s\n' "$pid"
      ;;
    *) printf 'SAFE|METADATA_STOPPED_UNMATCHED_TARGET|%s\n' "$pid" ;;
  esac
done
printf 'SAFE|READ_COMPLETE|true\n'
exit
'@

try {
  $diagnosticResult.failureStage = 'administrator-check'
  $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  $diagnosticResult.administrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  $diagnosticResult.administratorRequired = -not $diagnosticResult.administrator
  if (-not $diagnosticResult.administrator) { throw [System.UnauthorizedAccessException]::new('administrator-required') }
  $diagnosticResult.failureStage = 'fresh-running-vm-proof'
  $running = Invoke-DiagnosticRead '--list --verbose' '' ([System.Text.Encoding]::Unicode)
  if ($running.nativeExit -ne 0 -or $running.stdout -notmatch 'Ubuntu-24\.04\s+Running\s+2' -or $running.stdout -notmatch 'docker-desktop\s+Running\s+2') {
    throw [System.InvalidOperationException]::new('existing-vm-not-proven')
  }
  $diagnosticResult.existingVmProvenActive = $true
  $diagnosticResult.failureStage = 'documented-option-check'
  $help = Invoke-DiagnosticRead '--help' '' ([System.Text.Encoding]::Unicode)
  if ($help.stdout -notmatch '--debug-shell') { throw [System.InvalidOperationException]::new('option-not-documented') }
  $diagnosticResult.failureStage = 'bounded-root-read'
  $diagnosticResult.explicitExitSent = $true
  $read = Invoke-DiagnosticRead '--debug-shell' ($diagnosticShell.Replace("`r`n", "`n") + "`n") ([System.Text.Encoding]::UTF8)
  $diagnosticResult.nativeExit = $read.nativeExit
  $diagnosticResult.stderrBytes = [System.Text.Encoding]::UTF8.GetByteCount($read.stderr)
  $normalized = $read.stdout.Replace([string][char]0, '')
  $diagnosticResult.administratorRequired = $normalized.Contains('Running the debug shell requires running wsl.exe as Administrator.')
  $diagnosticResult.disabledByPolicy = $normalized.Contains('The debug shell is disabled by the computer policy.')
  $diagnosticResult.safeLines = @($normalized -split "`r?`n" | ForEach-Object { $_ -replace '\x1b\[[0-9;]*[A-Za-z]', '' } | Where-Object { $_ -match '^SAFE\|[A-Z_]+\|' -and $_ -notmatch 'printf|awk' })
  $diagnosticResult.readCompleted = $diagnosticResult.safeLines -contains 'SAFE|READ_COMPLETE|true'
  if ($read.nativeExit -eq 0 -and $diagnosticResult.readCompleted) { $diagnosticResult.failureStage = $null }
} catch {
  $diagnosticResult.failureType = $_.Exception.GetType().Name
} finally {
  foreach ($owned in $diagnosticProcesses) {
    try {
      if (-not $owned.HasExited) { $owned.Kill(); [void]$owned.WaitForExit(250) }
      if (-not $owned.HasExited) { $diagnosticResult.ownWindowsProcessesExited = $false }
    } catch { $diagnosticResult.ownWindowsProcessesExited = $false }
    finally { $owned.Close() }
  }
  $diagnosticResult.ownHandlesClosed = $true
  $diagnosticResult.elapsedMs = $diagnosticWatch.ElapsedMilliseconds
  $json = $diagnosticResult | ConvertTo-Json -Depth 6
  [System.IO.File]::WriteAllText($diagnosticResultPath, $json + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))
  Write-Output $json
}
if ($diagnosticResult.failureStage -or -not $diagnosticResult.ownWindowsProcessesExited) { exit 1 }
exit 0
