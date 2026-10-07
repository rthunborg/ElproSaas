// One read-only run. Native argv and stdin source; no interpolated shell commands.
const fs = require('node:fs');
const cp = require('node:child_process');
const prefix = ['--distribution', 'Ubuntu-24.04', '--user', 'root', '--exec'];
const result = { readOnly: true, serviceClockMutations: false, samplerRuns: 0 };
const outputPath = 'C:/DEV/ElproSaas/_bmad-output/test-artifacts/story14-3-time-after-rollback-stability.json';
function run(args, options = {}) {
  return cp.spawnSync('wsl.exe', args, { encoding: 'utf8', timeout: 8000, maxBuffer: 65536, ...options });
}
function unitState() {
  const p = run([...prefix, 'timeout', '--kill-after=1s', '5s', 'systemctl', 'show',
    'systemd-timesyncd.service', '--property=Id,LoadState,ActiveState,SubState,MainPID,FragmentPath,UnitFileState']);
  const values = {};
  for (const line of (p.stdout || '').trim().split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0 && ['Id','LoadState','ActiveState','SubState','MainPID','FragmentPath','UnitFileState'].includes(line.slice(0,i))) {
      values[line.slice(0,i)] = line.slice(i+1);
    }
  }
  return { nativeExit: p.status, stderrBytes: Buffer.byteLength(p.stderr || ''), values };
}
try {
  const list = run(['--list', '--verbose'], { encoding: 'utf16le', timeout: 5000 });
  result.runningGuardNativeExit = list.status;
  result.ubuntuAlreadyRunningWsl2 = list.status === 0 && /Ubuntu-24\.04\s+Running\s+2/.test(list.stdout || '');
  if (!result.ubuntuAlreadyRunningWsl2) throw new Error('running-guard');
  const version = run([...prefix, 'timeout', '--version']);
  result.gnuTimeoutVerified = version.status === 0 && /GNU coreutils/.test(version.stdout || '');
  if (!result.gnuTimeoutVerified) throw new Error('existing-gnu-timeout');
  result.before = unitState();
  if (result.before.nativeExit !== 0 || result.before.values.Id !== 'systemd-timesyncd.service' ||
      result.before.values.LoadState !== 'loaded' || result.before.values.ActiveState !== 'active' ||
      result.before.values.SubState !== 'running') throw new Error('restored-unit-state');
  const source = fs.readFileSync('C:/DEV/ElproSaas/_bmad-output/test-artifacts/story14-3-time-stability-sampler.py', 'utf8');
  result.samplerRuns = 1;
  console.log('Read-only after-rollback sampler started; raw deadline55s; GNU timeout59s+1s KILL bound.');
  const p = run([...prefix, 'timeout', '--signal=TERM', '--kill-after=1s', '59s', 'python3', '-'],
    { input: source, timeout: 65000 });
  result.samplerNativeExit = p.status;
  result.samplerTransportError = p.error?.code || null;
  result.samplerStderrBytes = Buffer.byteLength(p.stderr || '');
  try { result.metrics = JSON.parse((p.stdout || '').trim()); }
  catch { result.samplerJsonAvailable = false; }
  result.after = unitState();
} catch (e) {
  result.failure = e.message;
} finally {
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
if (result.failure || result.samplerNativeExit !== 0 || !result.metrics || result.after?.nativeExit !== 0) process.exit(1);
