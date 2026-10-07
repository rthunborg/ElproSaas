// Bounded, read-only identity inspection of actual time providers only.
(async () => {
const fs = await import('node:fs');
const cp = await import('node:child_process');
const list = cp.spawnSync('wsl.exe', ['--list', '--verbose'], { encoding: 'utf16le', timeout: 5000 });
if (list.status !== 0) throw new Error('WSL running-state inventory failed');
const shell = String.raw`
for entry in /proc/[0-9]*/comm; do
  read -r pname < "$entry" 2>/dev/null || continue
  case "$pname" in
    chronyd|systemd-timesyn*)
      pdir="$(dirname "$entry")"
      pid="$(basename "$pdir")"
      printf 'PROCESS|%s|%s\n' "$pid" "$pname"
      awk '/^NSpid:/ {print "NSPID|" $0}' "$pdir/status" 2>/dev/null
      printf 'PIDNS|'; readlink "$pdir/ns/pid" 2>/dev/null
      printf 'MNTNS|'; readlink "$pdir/ns/mnt" 2>/dev/null
      printf 'EXE|'; readlink "$pdir/exe" 2>/dev/null
      awk -F: '{print "CGROUP|" $3}' "$pdir/cgroup" 2>/dev/null
      printf 'END\n'
      ;;
  esac
done
`;
const observations = [];
for (const distro of ['Ubuntu-24.04', 'docker-desktop']) {
  const running = new RegExp(distro.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+Running').test(list.stdout);
  if (!running) {
    observations.push({ distro, runningProven: false, inspected: false });
    continue;
  }
  const run = cp.spawnSync('wsl.exe', ['--distribution', distro, '--user', 'root', '--exec', 'sh'], {
    input: shell, encoding: 'utf8', timeout: 10000, maxBuffer: 65536,
  });
  observations.push({ distro, runningProven: true, nativeExit: run.status,
    stderrBytes: Buffer.byteLength(run.stderr || ''),
    targetedIdentityLines: (run.stdout || '').trim().split('\n').filter(Boolean) });
}
const output = { readOnly: true, scope: 'comm/NSpid/namespace/cgroup/executable of chronyd and systemd-timesyncd only; no argv/env', observations };
fs.writeFileSync('_bmad-output/test-artifacts/story14-3-time-provider-provenance.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output));

})().catch((error) => {
  console.error('Diagnostic failure:', error?.code || error?.name || 'Error');
  process.exitCode = 1;
});
