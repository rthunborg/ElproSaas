# Owner-run runtime experiment — not executed

The manual receipt identifies utility-VM chronyd PID241 with a configured PHC reference, and kernel PID729 as Ubuntu-24.04's local PID156 systemd-timesyncd. Both providers previously made successful clock-adjustment calls. This establishes simultaneous discipline of the shared Linux clock, not the cause of every backward step or failed test. The PHC device and reference remain redacted. See [receipt](story14-3-time-owner-receipt.json).

Canonical's [Ubuntu-on-WSL time guidance](https://ubuntu.com/wsl/docs/stable/explanation/time-sync/) warns that an Ubuntu24.04 NTP client can conflict with default WSL host synchronization. That supports one temporary experiment stopping only Ubuntu's timesyncd. Our proposal is narrower than its persistent-disable advice: no enablement, mask or configuration change. [Systemd v255](https://raw.githubusercontent.com/systemd/systemd/v255/man/systemd-timesyncd.service.xml) documents that timesyncd steps large offsets and slews smaller ones. [Systemctl v255](https://raw.githubusercontent.com/systemd/systemd/v255/man/systemctl.xml) defines stop/start as runtime deactivation/activation.

## Approval and scope

Explicit owner approval for this user-owned service stop and rollback is required before execution. The owner performs the commands; the root/delegate does not adopt or stop this service through the resource guard. No mutation has occurred. Existing diagnostic permission does not approve clock/provider changes.

WSL2 distributions share the utility VM's Linux kernel, and CLOCK_REALTIME is not virtualized by time namespaces. Effects can reach Docker containers and other WSL workloads, including timestamp ordering, credentials and scheduled operations. Utility-VM chronyd/PHC and implicit host synchronization remain intact; Windows W32Time, clocksource, tick/frequency and all configuration files are unchanged. [WSL architecture](https://learn.microsoft.com/en-us/windows/wsl/compare-versions), [Linux time namespaces](https://man7.org/linux/man-pages/man7/time_namespaces.7.html).

## Concrete owner commands

First, in PowerShell, run `wsl.exe --list --verbose`. Proceed only if the existing Ubuntu-24.04 WSL2 distro is already Running. Do not launch a stopped distro. Run this read-only identity check:

```powershell
wsl.exe --distribution Ubuntu-24.04 --user root --exec timeout --kill-after=1s 5s systemctl show systemd-timesyncd.service --property=Id,LoadState,ActiveState,SubState,MainPID,ControlGroup,FragmentPath,UnitFileState --no-pager
```

Require Id=systemd-timesyncd.service, loaded, active/running, and the expected `/system.slice/systemd-timesyncd.service` cgroup. Match MainPID's comm, exe and PID namespace to the recorded Ubuntu provider before stopping; changed or absent identity means stop the experiment. Record UnitFileState for comparison. The already-inspected Ubuntu service was active; if it is already inactive, do not stop/start it or infer a prior change.

After approval and identity confirmation, the owner stops only that exact unit:

```powershell
wsl.exe --distribution Ubuntu-24.04 --user root --exec timeout --kill-after=1s 5s systemctl stop systemd-timesyncd.service
wsl.exe --distribution Ubuntu-24.04 --user root --exec timeout --kill-after=1s 5s systemctl show systemd-timesyncd.service --property=ActiveState,SubState,MainPID,UnitFileState --no-pager
```

Require inactive/dead/MainPID=0 and unchanged UnitFileState. `systemctl is-active` ordinarily exits3 for inactive; that alone is not a failed stop. A timeout124/137 means the client deadline was reached, not that the systemd job was cancelled: inspect exact unit state, do not retry blindly. Keep the rollback below available if state changed or observation cannot complete.

## Bounded observation and rollback

Keep the planned stop window within90 seconds, including readbacks and rollback. Collect one read-only clock window of at most55 raw-monotonic seconds using the already-available Ubuntu Python `time.clock_gettime_ns`: REALTIME, MONOTONIC_RAW and adjusted MONOTONIC. The following owner-run stdin command writes no script/helper files and retains only numeric deltas. It has a separate60-second GNU timeout ceiling. Do not execute it unless Ubuntu is still already Running and the approved exact unit reads inactive/dead/MainPID0.

```powershell
@'
import json, time
raw = time.CLOCK_MONOTONIC_RAW
start_raw = time.clock_gettime_ns(raw)
start_mono = time.clock_gettime_ns(time.CLOCK_MONOTONIC)
start_real = time.clock_gettime_ns(time.CLOCK_REALTIME)
previous_real = start_real
steps = samples = 0
minimum = 0
while time.clock_gettime_ns(raw) - start_raw < 55_000_000_000:
    current_real = time.clock_gettime_ns(time.CLOCK_REALTIME)
    delta = current_real - previous_real
    steps += int(delta < 0)
    minimum = min(minimum, delta)
    previous_real = current_real
    samples += 1
    time.sleep(0.02)
elapsed_raw = time.clock_gettime_ns(raw) - start_raw
elapsed_mono = time.clock_gettime_ns(time.CLOCK_MONOTONIC) - start_mono
elapsed_real = time.clock_gettime_ns(time.CLOCK_REALTIME) - start_real
print(json.dumps(dict(samples=samples, backwardSteps=steps, minimumRealtimeDeltaMs=minimum/1e6,
    rawElapsedMs=elapsed_raw/1e6, adjustedToRawRatio=elapsed_mono/elapsed_raw,
    realtimeToRawRatio=elapsed_real/elapsed_raw)))
'@ | wsl.exe --distribution Ubuntu-24.04 --user root --exec timeout --kill-after=1s 60s python3 -
```

No tracing registration, installation, new helper service, database access or application tests. Compare with the retained baseline (adjusted/raw1.05384799 and independently observed realtime reversals). Verify timesyncd stays inactive before and after the window; reactivation makes the experiment inconclusive. Missing tools or timeout means incomplete evidence, followed by the reviewed rollback, not installation or another sample.

Stopping timesyncd does not reset a previously applied tick/frequency adjustment. A55-second reversal-free window cannot establish lasting stability or a proven repair. If regression/rate anomaly persists, record the result and restore the unit without repeated sampling or wider mutations.

After the single observation, or if it fails, restore the previously active unit:

```powershell
wsl.exe --distribution Ubuntu-24.04 --user root --exec timeout --kill-after=1s 5s systemctl start systemd-timesyncd.service
wsl.exe --distribution Ubuntu-24.04 --user root --exec timeout --kill-after=1s 5s systemctl show systemd-timesyncd.service --property=ActiveState,SubState,MainPID,UnitFileState --no-pager
```

Require active/running, nonzero MainPID and unchanged UnitFileState. This restores runtime service state, not time history; restarting timesyncd may itself adjust the shared clock. If restoration does not complete, report exact unit state and do not broaden cleanup. No disable/mask, `timedatectl set-ntp`, resync, chronyd restart or WSL shutdown is part of this proposal.

Story14.3 remains blocked with full1366total/1362pass/3fail/1skip. A stable-time continuation needs separate evidence before required verification and independent follow-up; this experiment neither waives those gates nor promises they will pass.
