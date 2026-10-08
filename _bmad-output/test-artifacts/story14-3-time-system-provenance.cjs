(async () => {
const fs = await import('node:fs');
const cp = await import('node:child_process');
const list = cp.spawnSync('wsl.exe', ['--list', '--verbose'], { encoding: 'utf16le', timeout: 5000 });
const help = cp.spawnSync('wsl.exe', ['--help'], { encoding: 'utf16le', timeout: 5000 });
if (list.status !== 0 || !/Ubuntu-24\.04\s+Running\s+2/.test(list.stdout) || !/docker-desktop\s+Running\s+2/.test(list.stdout)) {
  throw new Error('existing utility VM not proven active by both named running distros');
}
if (!help.stdout.includes('--system')) throw new Error('installed system-surface option not documented');
const shell = String.raw`
printf 'INSPECTION_SELF_PIDNS|'; readlink /proc/self/ns/pid
if test -S /mnt/wslg/.X11-unix/X0; then printf 'EXISTING_WSLG_SOCKET|true\n'; else printf 'EXISTING_WSLG_SOCKET|false\n'; fi
for pid in 241 729 450; do
  pdir="/proc/$pid"
  pname="$(cat "$pdir/comm" 2>/dev/null)"
  case "$pid:$pname" in
    241:chronyd|729:systemd-timesyn*|450:chronyd|450:systemd-timesyn*|450:*timesync*|450:*time-sync*|450:ntpd)
      printf 'MATCHED_PROCESS|%s|%s\n' "$pid" "$pname"
      awk '/^NSpid:/ {print "NSPID|" $0}' "$pdir/status"
      printf 'PIDNS|'; readlink "$pdir/ns/pid"
      printf 'MNTNS|'; readlink "$pdir/ns/mnt"
      printf 'EXE|'; readlink "$pdir/exe"
      awk -F: '{print "CGROUP|" $3}' "$pdir/cgroup"
      printf 'END\n'
      ;;
    *) printf 'TARGET_COMM_NOT_MATCHED|%s\n' "$pid" ;;
  esac
done
`;
const run = cp.spawnSync('wsl.exe', ['--system', '--user', 'root', '--exec', 'sh'], {
  input: shell, encoding: 'utf8', timeout: 10000, maxBuffer: 65536,
});
const output = { readOnly: true, nativeExit: run.status, stderrBytes: Buffer.byteLength(run.stderr || ''),
  existingVmProvenActive: true, systemOptionDocumented: true,
  scope: 'exact captured kernel PIDs241/729/450; time-name guard before metadata; self namespace/WSLg active marker only; no namespace entry or argv/env',
  identityLines: (run.stdout || '').trim().split('\n').filter(Boolean) };
const resultPath = '_bmad-output/test-artifacts/story14-3-time-system-provenance.json';
if (fs.existsSync(resultPath)) output.priorIdentityPasses = [JSON.parse(fs.readFileSync(resultPath, 'utf8'))];
fs.writeFileSync(resultPath, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output));

})().catch((error) => {
  console.error('Diagnostic failure:', error?.code || error?.name || 'Error');
  process.exitCode = 1;
});
