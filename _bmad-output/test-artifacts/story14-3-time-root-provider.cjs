// UNSUPPORTED FOR AUTOMATION: DO NOT EXECUTE AGAIN; retained refusal evidence.
// --debug-shell is an interactive console; client kill does not contain guests.
const fs = require('node:fs');
const cp = require('node:child_process');
const list = cp.spawnSync('wsl.exe', ['--list', '--verbose'], { encoding: 'utf16le', timeout: 5000 });
const help = cp.spawnSync('wsl.exe', ['--help'], { encoding: 'utf16le', timeout: 5000 });
if (list.status !== 0 || !/Ubuntu-24\.04\s+Running\s+2/.test(list.stdout) || !/docker-desktop\s+Running\s+2/.test(list.stdout)) {
  throw new Error('existing WSL2 utility VM not proven active');
}
if (!help.stdout.includes('--debug-shell')) throw new Error('installed diagnostic root surface not documented');
const shell = String.raw`
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
if test "$(cat /proc/241/comm 2>/dev/null)" = chronyd; then
  if command -v chronyc >/dev/null 2>&1; then
    printf 'SAFE|CHRONYC_AVAILABLE|true\n'
    chronyc -n tracking 2>/dev/null | awk '/^(Stratum|System time|Last offset|RMS offset|Frequency|Residual freq|Skew|Root delay|Root dispersion|Update interval|Leap status)/ {print "SAFE|TRACKING|" $0}'
  else printf 'SAFE|CHRONYC_AVAILABLE|false\n'; fi
fi
printf 'SAFE|READ_COMPLETE|true\n'
exit
`;
const run = cp.spawnSync('wsl.exe', ['--debug-shell'], {
  input: shell, encoding: 'utf8', timeout: 10000, maxBuffer: 131072,
});
// A debug-shell may echo its input or banners; emit only tagged actual results.
const normalized = (run.stdout || '').replace(/\0/g, '');
const safeLines = normalized.split(/\r?\n/).map(s => s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, ''))
  .filter(s => /^SAFE\|[A-Z_]+\|/.test(s) && !s.includes('printf') && !s.includes('awk'));
const output = { readOnly: true, nativeExit: run.status, transportErrorCode: run.error?.code || null,
  safeWslErrorCode: normalized.match(/Wsl\/[A-Za-z0-9_\/-]+/)?.[0] || null,
  administratorRequired: normalized.includes('Running the debug shell requires running wsl.exe as Administrator.'),
  disabledByPolicy: normalized.includes('The debug shell is disabled by the computer policy.'),
  stdoutBytes: Buffer.byteLength(run.stdout || ''),
  stderrBytes: Buffer.byteLength(run.stderr || ''), existingVmProvenActive: true,
  scope: 'documented existing root namespace; exact time caller identity/config/tracking only; addresses redacted; explicit exit and10s timeout',
  explicitExitSent: true, safeLines, readCompleted: safeLines.includes('SAFE|READ_COMPLETE|true') };
const resultPath = '_bmad-output/test-artifacts/story14-3-time-root-provider.json';
if (fs.existsSync(resultPath)) output.priorReadAttempts = [JSON.parse(fs.readFileSync(resultPath, 'utf8'))];
fs.writeFileSync(resultPath, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output));
if (run.status !== 0 || !output.readCompleted) process.exit(1);
