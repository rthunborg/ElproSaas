const fs = require('node:fs');
const cp = require('node:child_process');
const list = cp.spawnSync('wsl.exe', ['--list', '--verbose'], { encoding: 'utf16le', timeout: 5000 });
if (list.status !== 0 || !/docker-desktop\s+Running/.test(list.stdout)) throw new Error('approved backend not proven running');
const shell = String.raw`
printf 'PID1_NAME|'; cat /proc/1/comm
awk '/^NSpid:/ {print "PID1_NSPID|" $0}' /proc/1/status
printf 'PID1_PIDNS|'; readlink /proc/1/ns/pid
printf 'PID1_MNTNS|'; readlink /proc/1/ns/mnt
awk -F: '{print "PID1_CGROUP|" $3}' /proc/1/cgroup
for tool in ctr containerd docker; do
  found="$(command -v "$tool" 2>/dev/null)"
  test -z "$found" || printf 'EXISTING_TOOL|%s|%s\n' "$tool" "$found"
done
for sock in /run/containerd/containerd.sock /run/docker/containerd/containerd.sock /var/run/docker/containerd/containerd.sock /run/desktop/containerd/containerd.sock; do
  test ! -S "$sock" || printf 'EXISTING_SOCKET|%s\n' "$sock"
done
find /run -maxdepth 4 -type s -name '*containerd*.sock' -print 2>/dev/null | while read -r sock; do printf 'CONTAINERD_SOCKET|%s\n' "$sock"; done
for base in /mnt/docker-desktop /mnt/wsl/docker-desktop /mnt/host/wsl/docker-desktop; do
  if test -d "$base/shared-sockets"; then
    printf 'EXISTING_SHARED_SOCKET_ROOT|%s/shared-sockets\n' "$base"
    find "$base/shared-sockets" -maxdepth 3 -type s -name '*containerd*.sock' -print 2>/dev/null | while read -r sock; do printf 'CONTAINERD_SOCKET|%s\n' "$sock"; done
  fi
done
`;
const run = cp.spawnSync('wsl.exe', ['--distribution', 'docker-desktop', '--user', 'root', '--exec', 'sh'], {
  input: shell, encoding: 'utf8', timeout: 10000, maxBuffer: 65536,
});
const output = { readOnly: true, nativeExit: run.status, stderrBytes: Buffer.byteLength(run.stderr || ''),
  scope: 'already-running backend PID1 namespace/cgroup and existing tool/socket paths only',
  identityLines: (run.stdout || '').trim().split('\n').filter(Boolean) };
fs.writeFileSync('_bmad-output/test-artifacts/story14-3-time-backend-surface.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output));
