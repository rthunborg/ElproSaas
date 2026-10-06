# Story 14.3 local time integrity diagnosis

This is infrastructure evidence only. Story 14.3 remains blocked. No product, test, migration, spec, permission, clock, provider, service or host configuration was changed during this diagnosis. The current full gate remains **1,366 total / 1,362 passed / 3 failed / 1 intentional recovery skip**, native exit 1; the affected focused gate remains **143 / 143 / 0 / 0**, native exit 0. Both earlier representative runs remain **102 / 101 / 1 / 0**, native exit 1. These results have not been rerun or waived.

## Target and provenance

- Root-owned active lifecycle: `4c66cc2c-2c73-4332-b015-7e239dc94ca0`.
- Retained Compose project: `rg-f58d95e0aa76f813445d407dfe410638d75a0041`; approved DB container: `3ebb91d97c8e7c101b7326973fb46cb12b68146ca4fe50567320f2b786db842f`.
- API: `http://127.0.0.1:55421`; DB: `127.0.0.1:55422/postgres`. The original 54321 target was not used.
- Ledger: 95 records, last version `20261006144057`; all 94 prior complete records preserved, SHA-256 `4ee8170645ea6bf45d11d79dfcda08fa83fe1b32e920905650bbd0e1c47e3d00`. No migration or data writes were performed.
- PostgreSQL 17.6, UTC; Docker Engine 29.8.1 / Desktop 4.93.0.240920; WSL 2.7.12.0 / kernel `6.18.33.2-microsoft-standard-WSL2`; DB image Alpine 3.23.4.
- Initial three-second Node health requests timed out. Subsequent bounded native curl / PowerShell checks returned Auth 200 and REST 200; the Storage status request timed out. These observations are retained separately in `story14-3-time-readiness.json` and do not imply that all HTTP services were independently proven ready.

## Proven observations

The original 1,210-sample SQL sampler used one client, one read-only transaction and sequential awaited queries. Indices, ordering, units and finite values were checked. Each of the six backward `clock_timestamp()` differences reconstructs exactly from the independently stored age of the pinned transaction timestamp (maximum reconstruction error 0 ms). Minimum difference was -827.780 ms while host monotonic time advanced 62.090 ms. This rules out the recorded arithmetic/order/units mistakes; omitted raw epochs limit retrospective checks. See `story14-3-time-sampler-audit.json`.

An independent native BusyBox `adjtimex` query (no options, modes 0) produced 800 valid samples, native exit 0, no malformed samples or stderr. `STA_NANO` was interpreted before integer nanosecond arithmetic; `tick` remains microseconds. Native wall time moved backwards twice: -660.931225 and -758.562177 ms while Linux uptime advanced 50 and 60 ms and Windows monotonic time advanced 51.0426 and 49.7533 ms. This establishes Linux wall-clock regression independently of SQL, signed proofs or the test workload. The initial whitespace parser failure is separately preserved and is not successful sampling evidence. See `story14-3-time-native-clock-validated.json` and `story14-3-time-native-clock-samples.json`. [adjtimex units and modes](https://man7.org/linux/man-pages/man2/adjtimex.2.html).

Observed global `tick` varied from 10,518 to 10,566 microseconds (nominal 10,000 at USER_HZ 100); reported frequency corrections were -29.507 to +75.947 ppm. Linux uptime / Windows monotonic ratio was 1.054261, and non-step wall / host ratio 1.054093. A separate one-shot 101-sample raw-clock comparison found raw / Windows monotonic ratio 1.000201 and adjusted monotonic / raw ratio 1.053848 over about 2.43 host seconds. The measured discipline rate matches the inflated tick range; this short observation does not prove that TSC is always correct. See `story14-3-time-native-rate-analysis.json` and `story14-3-time-raw-clock-comparison.json`. [Linux tick discipline source](https://raw.githubusercontent.com/torvalds/linux/v6.18/kernel/time/ntp.c), [clocksource and timekeeping](https://docs.kernel.org/timers/timekeeping.html).

The signed valid-control failure previously reported issuance 772.641 ms ahead of the post-failure DB clock, with other inspected proof guards true. This is consistent with a reversing clock but lacks the same-proof direct-path receipt. The new kernel observations do not retroactively establish the cause of any particular historical CREATE, quote or replay failure. Those causal attributions remain unknown.

## Provider inventory and limits

Current clocksource is `tsc`; available alternatives include the Hyper-V TSC page / MSR and ACPI PM sources. Kernel command line has no forced clocksource and does contain `hv_utils.timesync_implicit=1`; its live module parameter was `Y`. The targeted host `[wsl2] kernelCommandLine` directive was absent. No clocksource change is supported by the short raw-clock comparison. [Hyper-V clocks](https://docs.kernel.org/virt/hyperv/clocks.html).

Both `docker-desktop` and `Ubuntu-24.04` were verified already running before bounded read-only inspections. Ubuntu has active `systemd-timesyncd`, PID 156, package 255.4-1ubuntu8.17, with CAP_SYS_TIME. Its selected unit/drop-in/config did not contain a TICK/FREQ override; `/etc/default/adjtimex` was absent. Chrony/ntp/adjtimex services were not identified inside those inspected namespaces; the subsequent global trace identifies chronyd outside their visible proc views. The WSL package drop-in only changes virtualization conditions. Bounded selected Docker VM/backend log extracts contained no matching time-provider messages. Presence of a provider alone does not establish its actions. [systemd adjustment implementation](https://github.com/systemd/systemd/blob/main/src/timesync/timesyncd-manager.c).

W32Time was stopped/manual; its status query returned native 1 / 0x80070426. The only inspected recent Windows clock event changed time by +0.5034 ms. A separate delegate-owned five-sample NTP offset comparison returned approximately -0.796 to -0.800 seconds against the public source; see `story14-3-time-windows-ntp-offsets.json`. These observations do not authorize starting/resyncing Windows time or establish its stopped state as the cause.

Linux CLOCK_REALTIME is shared across time namespaces, so a Compose-local time namespace cannot isolate this wall-clock defect. No durable project-local clock repair has been demonstrated. [Linux time namespaces](https://man7.org/linux/man-pages/man7/time_namespaces.7.html).

## Bounded attribution mechanism

Existing bpftrace, perf and strace were unavailable; no tools were installed. Actual running kernel BTF confirmed the three clock function prototypes and `__kernel_timex` field offsets (modes 0, frequency 16, tick 88). Exact symbols are present and ftrace eligible, argument access / kprobe support is configured, and none of these symbols lies in any of 728 inspected blacklist ranges. Symbol presence alone does not establish probe eligibility. See `story14-3-time-attribution-kernel-schema.json` and `story14-3-time-attribution-symbol-eligibility.json`.

The first two authorized attempts failed before capture and left root tracing state and prior registrations unchanged, with all owned UUID probes/buffers released. The original attempt recorded only OSError, so its errno/stage cannot be recovered. The instrumented attempt recorded errno 22 at `register-own-probe:adjust`. The kernel error log was readable but empty after both attempts. Both failures and zero captured records are retained in their separate result artifacts.

A zero-write I/O diagnostic demonstrated that Python text append `open(..., 'a')` itself raises EINVAL: raw append open succeeds, while its implicit SEEK_END fails with errno 22. No registry writes were executed and registrations remained byte-for-byte unchanged. This identifies a local diagnostic harness failure, not a kernel probe grammar or permission failure. The project-local proposal was corrected to raw `os.open(O_WRONLY | O_APPEND)` / one `os.write` / `finally close`, without seeking or truncating. See `story14-3-time-attribution-zero-write-io.json` and `story14-3-time-attribution-proposal.py`.

The corrected capture uses only UUID-owned probes and a private tracefs instance for at most 55 Linux monotonic seconds. It does not alter root/other tracing options or buffers. Output is restricted to elapsed deltas, numeric modes/frequency/tick/return values, PID and process name. Cleanup covers normal, exception and signal exits, removing only its own registrations and private instance. [Supported kprobe grammar](https://docs.kernel.org/trace/kprobetrace.html), [private tracing instances](https://docs.kernel.org/trace/ftrace.html).

## Corrected capture and remaining ownership boundary

The one authorized corrected capture completed with native exit 0, 55-second bound, 59 parsed records, no truncation, no unparsed lines and no stderr. Root tracing state remained `tracing_on=1` / `current_tracer=nop`; prior registrations were preserved, all owned probes and the private instance were released, and cleanup errors were empty. The executed UUID group used 46 ASCII identifier characters without hyphens. Source SHA-256 and the deterministic emitted probe definition are retained in `story14-3-time-attribution-capture.json`.

**chronyd, kernel PID 241, made 14 ADJ_TICK | ADJ_FREQUENCY requests (modes 16386), each followed by result 0.** Tick values were 10,525–10,556 microseconds, with repeated changes about every eight seconds. This identifies the actual tick mutator during the observed window. A separate `systemd-timesyncd` return record (kernel PID 729) followed an ADJ_SETOFFSET request (modes 8476), result 0. One direct wall-set event had unavailable process name (`<...>`). No Hyper-V callback was observed. Offset values/direction and whether either wall adjustment coincided with a particular earlier reversal were not captured and remain unknown.

Only timex fields selected by each request's modes are meaningful initialized controls. Thirty unselected frequency/tick field slots were omitted from the saved artifact after identifying irrelevant, potentially uninitialized contents; the proposal's output filter was corrected accordingly without another capture. This does not alter the selected ADJ_TICK / ADJ_FREQUENCY evidence. The saved executed-source hash refers to the harness before that output-filter amendment.

Chrony's documented Linux slew limit and default permit corrections substantially larger than 500 ppm; therefore a five-percent rate can arise from its tick-based discipline without implying a clocksource defect. Its actual configuration and reference remain unverified. [Chrony maxslewrate](https://chrony-project.org/doc/4.8/chrony.conf.html), [tracking report semantics](https://chrony-project.org/doc/4.8/chronyc.html).

Targeted post-capture namespace inspection finds Ubuntu `systemd-timesyncd`, local PID 156, PID namespace 4026532394 and `/system.slice/systemd-timesyncd.service`. Neither captured kernel PID is directly visible in the two current proc views; Docker Desktop's exposed distro proc view contains neither provider. Local PID numbers are namespace-relative. No chronyd service/container has been adopted, stopped or inspected via nsenter. See `story14-3-time-provider-provenance.json` and its bounded source script.

## Access attempts and current interface limit

The documented WSL `--system` surface exposed another child PID namespace (4026532355), with a pre-existing WSLg socket and both named WSL2 distros freshly confirmed running. The exact kernel PIDs 241/729/450 failed the time-name guards there, so no further target metadata was read and PID reuse was not inferred. Docker Desktop's exposed distro has neither ctr/containerd nor a containerd socket in the selected bounded `/run` / shared-socket metadata paths. These results are retained in `story14-3-time-system-provenance.json` and `story14-3-time-backend-surface.json`.

Microsoft documents that the WSL VM root namespace is separate from distributions and can be inspected through `wsl --debug-shell` while WSL is already running. The installed CLI documents that option. The bounded stdin-fed read-only wrapper was attempted with fresh active-VM proof, an explicit shell exit and a hard ten-second timeout. It returned native 1 immediately, before any read-complete marker or target record. Its exact fixed refusal is **“Running the debug shell requires running wsl.exe as Administrator.”** The artifact records `administratorRequired=true`, `disabledByPolicy=false`, 136 stdout bytes and zero stderr bytes; the prior unsuccessful error-observer attempts remain recorded. `require_escalated` removes the tool sandbox but does not create a Windows Administrator token. No UAC elevation, new privilege grant, policy change or bypass was attempted. [Microsoft root-namespace access](https://learn.microsoft.com/en-us/windows/wsl/wsl-plugins#plugins-linux-user-space), [primary refusal text](https://raw.githubusercontent.com/microsoft/WSL/master/localization/strings/en-US/Resources.resw).

The documented Docker Desktop CLI time-unit filtered log read (current boot, last ten minutes; selected chrony/timesync units only) returned native 1, zero output lines and 79 stderr bytes. Its underlying stderr reason was not retained by the safe-output observer, so no permission/date/unit cause is claimed and no absence of time-service logs is inferred. Root directed termination of further provenance work; this read was not retried. See `story14-3-time-docker-unit-logs.json`.

Root subsequently launched the saved PowerShell wrapper with owner UAC consent. The actual result is **Administrator=true, existingVmProvenActive=true**, followed by `TimeoutException` at `bounded-root-read`, elapsed 10,069 ms, native exit unavailable. Its Windows processes exited and handles closed; no clock/service/config changes were requested. Therefore Administrator access is **no longer the current blocker**. The result is retained in `story14-3-time-admin-probe-result.json`. The wrapper reads/sanitizes stdout only after a normal return; its timeout discards partial stdout, so zero retained safe lines **does not prove the guest emitted zero lines or did not execute**. Guest read completion and guest exit are unknown. No cleanup of any guest console/service was attempted.

Installed-version source establishes the interface mismatch. In WSL tag **2.7.12**, `WslClient.cpp` lines 1424–1426 return parameterless `RunDebugShell()` immediately; trailing exec/command arguments are not parsed. Lines 1351–1397 attach an existing console pipe, wake agetty and relay stdin/stdout until pipe/VM closure. Linux `init/main.cpp` lines 1118–1155 keep a DebugShell supervisor that relaunches setsid/agetty after its child exits. A guest `exit` is consequently not a per-command Windows completion signal; closing/killing this Windows client is not guest process-group containment. This explains why the wrapper's completion assumption is unsupported; it does not establish which guest commands ran in the observed timeout. [Version-matched CLI](https://github.com/microsoft/WSL/blob/2.7.12/src/windows/common/WslClient.cpp#L1351-L1397), [argument dispatch](https://github.com/microsoft/WSL/blob/2.7.12/src/windows/common/WslClient.cpp#L1424-L1426), [guest supervisor](https://github.com/microsoft/WSL/blob/2.7.12/src/linux/init/main.cpp#L1118-L1155), [release identity](https://github.com/microsoft/WSL/releases/tag/2.7.12).

The retained PowerShell and Node wrappers are now explicitly headed **UNSUPPORTED FOR AUTOMATION — DO NOT EXECUTE AGAIN**. Their executable bodies remain evidence of the attempts; no second elevated attempt or larger timeout was used. There is no supported noninteractive exec/guest containment guarantee for this debug-console route. No persistent debug shell, namespace entry, provider adoption, new tool, or global cleanup was introduced to work around it.

## Concrete owner-run alternative (not executed)

An owner can perform the targeted read interactively in their own **Administrator PowerShell**. First check `wsl.exe --list --verbose`; proceed only while the existing Ubuntu-24.04 and docker-desktop WSL2 distros are already Running. Then use the documented command:

```powershell
wsl.exe --debug-shell
```

In the guest root console, first run `command -v timeout` and `timeout --version`. Continue only if an **existing GNU coreutils timeout** is available; stop if missing/different, without installation or an unbounded fallback. The following guest job creates its own GNU timeout process group, uses a three-second TERM deadline plus one-second KILL deadline, and reads only fixed guarded time callers. Do not add `--foreground`, which disables descendant timeout coverage. Tool availability/version in the root console is currently unverified. [GNU timeout group and signal implementation](https://github.com/coreutils/coreutils/blob/master/src/timeout.c#L163-L231), [group creation](https://github.com/coreutils/coreutils/blob/master/src/timeout.c#L524-L529).

```sh
timeout --signal=TERM --kill-after=1s 3s sh <<'STORY143_READONLY'
for pid in 241 729 450; do
  pdir="/proc/$pid"
  name="$(cat "$pdir/comm" 2>/dev/null)"
  printf 'SAFE|TARGET_COMM|%s|%s\n' "$pid" "$name"
  case "$pid:$name" in
    241:chronyd|729:systemd-timesyn*|450:chronyd|450:systemd-timesyn*|450:*timesync*|450:*time-sync*|450:ntpd)
      awk '/^NSpid:/ {print "SAFE|NSPID|" $0}' "$pdir/status"
      printf 'SAFE|PIDNS|'; readlink "$pdir/ns/pid"
      printf 'SAFE|MNTNS|'; readlink "$pdir/ns/mnt"
      printf 'SAFE|EXE|'; readlink "$pdir/exe"
      awk -F: '{print "SAFE|CGROUP|" $3}' "$pdir/cgroup"
      if test "$pid:$name" = '241:chronyd'; then
        for config in "$pdir/root/etc/chrony.conf" "$pdir/root/etc/chrony/chrony.conf"; do
          test -f "$config" || continue
          awk '
            $1 ~ /^(server|pool|peer)$/ {print "SAFE|SOURCE|" $1 "|reference_redacted"; next}
            $1 == "refclock" {print "SAFE|SOURCE|refclock|" $2 "|reference_redacted"; next}
            $1 ~ /^(maxslewrate|corrtimeratio|makestep|maxdrift|maxupdateskew|minsources)$/ {
              out="SAFE|CONTROL|" $1; for(i=2;i<=NF;i++) if($i ~ /^[-0-9.]+$/) out=out "|" $i; print out
            }
          ' "$config"
        done
      fi
      ;;
    *) printf 'SAFE|METADATA_STOPPED_UNMATCHED_TARGET|%s\n' "$pid" ;;
  esac
done
printf 'SAFE|GUEST_READ_COMPLETE|true\n'
STORY143_READONLY
guest_read_status=$?
printf 'SAFE|GUEST_JOB_STATUS|%s\n' "$guest_read_status"
```

The owner observes the completion marker and guest job status at the prompt; status 124/137 is timeout evidence, not successful metadata coverage. This guest job does not depend on Windows client death for its deadline. After recording only the tagged output, use `exit` to leave the guest login shell. That can return to the existing agetty login state while the Windows console client stays connected. Ctrl+C can reach the guest foreground job; it is not a reliable per-command Windows detach mechanism. **Closing/detaching the owner's Windows console is separate from guest job completion and does not stop the existing DebugShell supervisor, agetty, WSL VM or time providers.** No such owner manual read or current guest cleanup has been performed by this author. There is no approved automatic retry of the unsupported wrapper.

The required result is exact chronyd ownership/configuration/reference and correlation of kernel PID 729 with the Ubuntu provider. Then the root can present the smallest supported intervention, its shared-kernel effects and rollback for explicit owner approval. At present, neither stopping Ubuntu timesyncd or chronyd nor changing a kernel tick/provider parameter is justified: the tick mutator is known, but its ownership/reference and the causal identity of the observed backward steps are not. No durable project-local clock repair is demonstrated. The only applied repair is the reversible diagnostic harness's no-seek registry access and mode-selected output filtering.

All author diagnostic invocations have ended, and the actual elevated probe verifies only its owned Windows processes/handles are closed. **Guest reader completion/exit is unknown**; the existing shared DebugShell supervisor/agetty was not adopted or stopped. The successful trace verifies no owned probes/private buffer remain and prior/root tracing state is preserved. No functional test, SQL sampler or tracer is active; no spec restoration or gate rerun occurred. Root's Stop request for lifecycle `4c66cc2c-2c73-4332-b015-7e239dc94ca0` was accepted and saved state preserved; no further DB use occurred. Acceptance is not independently confirmed shutdown. This diagnostic handoff is **needs-human**; Story 14.3 remains in its existing blocked state with all failed historical/current gate evidence unchanged, and no build HALT/status was overwritten.
