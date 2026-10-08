"""PROPOSAL ONLY: explicit --attach needed; no clock/config/service writes.

Run only after the parent assesses this exact bounded observational scope.
Uses existing Python and tracefs: four uniquely named kprobes enabled solely
in a private trace instance. Never alters root/other tracing state or options.
Kernel BTF verified do_adjtimex(arg1=__kernel_timex*), modes@0,freq@16,tick@88.
"""
import argparse
import errno
import json
import os
import re
import select
import signal
import time
import uuid
from pathlib import Path

TRACE = Path("/sys/kernel/tracing")
parser = argparse.ArgumentParser()
parser.add_argument("--attach", action="store_true")
parser.add_argument("--seconds", type=float, default=55.0)
args = parser.parse_args()
if not 0 < args.seconds <= 55:
    raise SystemExit("duration must be >0 and <=55 seconds")


def read_root_state():
    return {name: (TRACE / name).read_text().strip()
            for name in ("tracing_on", "current_tracer")}


def registrations():
    return set((TRACE / "kprobe_events").read_text().splitlines())


before = read_root_state()
previous = registrations()
if not args.attach:
    print(json.dumps({"attached": False, "rootState": before,
                      "registrationCount": len(previous),
                      "tracefsInstanceParentWritable": os.access(TRACE / "instances", os.W_OK),
                      "probeRegistryWritable": os.access(TRACE / "kprobe_events", os.W_OK),
                      "maximumCaptureSeconds": 55,
                      "scope": "shared-kernel transient probes; private buffer only; numeric time controls/process names only"}))
    raise SystemExit(0)

group = "story143_time_" + uuid.uuid4().hex
instance = TRACE / "instances" / group
names = []
enabled = []
fd = None
records = []
pending = {}
unparsed = 0
truncated = False
cleanup_errors = []
origin = time.monotonic_ns()
failure = None
stage = "initialization"


def write(path, value):
    with open(path, "w") as stream:
        stream.write(value)


def registry(value):
    # Text append mode implicitly seeks to EOF, which tracefs rejects (EINVAL).
    # Use one unbuffered append write; never seek or replace the registry.
    payload = (value + "\n").encode("ascii")
    registry_fd = os.open(TRACE / "kprobe_events", os.O_WRONLY | os.O_APPEND)
    try:
        if os.write(registry_fd, payload) != len(payload):
            raise OSError(errno.EIO, "partial registry command")
    finally:
        os.close(registry_fd)


def interrupted(_signum, _frame):
    raise KeyboardInterrupt


signal.signal(signal.SIGTERM, interrupted)
signal.signal(signal.SIGINT, interrupted)
try:
    stage = "allocate-private-instance"
    instance.mkdir()  # tracefs allocation, not a persistent filesystem artifact
    stage = "disable-private-buffer"
    write(instance / "tracing_on", "0")
    stage = "size-private-buffer"
    write(instance / "buffer_size_kb", "64")
    definitions = [
        ("adjust", "p", "do_adjtimex modes=+0($arg1):u32 freq=+16($arg1):s64 tick=+88($arg1):s64"),
        ("adjust_result", "r", "do_adjtimex result=$retval:s64"),
        ("wall_set", "p", "do_settimeofday64"),
        ("hyperv_sync", "p", "hv_set_host_time"),
    ]
    for name, kind, definition in definitions:
        names.append(name)
        stage = "register-own-probe:" + name
        registry(f"{kind}:{group}/{name} {definition}")
        event = instance / "events" / group / name
        if name == "adjust":
            stage = "filter-own-probe:" + name
            write(event / "filter", "modes != 0")
        enabled.append(event)
        stage = "enable-own-probe:" + name
        write(event / "enable", "1")
    stage = "open-private-buffer"
    fd = os.open(instance / "trace_pipe", os.O_RDONLY | os.O_NONBLOCK)
    stage = "enable-private-buffer"
    write(instance / "tracing_on", "1")
    deadline = time.monotonic_ns() + int(args.seconds * 1_000_000_000)
    buffer = ""
    stage = "capture-private-buffer"
    # Only fixed common header plus our fields is accepted. Kernel addresses,
    # absolute timestamps, SQL, user arguments and environment never leave here.
    pattern = re.compile(r"^\s*(?P<comm>\S+)-(?P<pid>\d+)\s+\[\d+\].*?\s+(?P<stamp>\d+\.\d+):\s+(?P<event>adjust_result|adjust|wall_set|hyperv_sync):\s*(?P<data>.*)$")
    while time.monotonic_ns() < deadline:
        ready, _, _ = select.select([fd], [], [], 0.25)
        if not ready:
            continue
        buffer += os.read(fd, 65536).decode("utf8", errors="replace")
        while "\n" in buffer:
            line, buffer = buffer.split("\n", 1)
            if line.startswith("#"):
                continue
            match = pattern.match(line)
            if not match:
                unparsed += 1
                continue
            pid, event = int(match["pid"]), match["event"]
            row = {"elapsedMs": (time.monotonic_ns() - origin) / 1_000_000,
                   "processName": match["comm"], "pid": pid, "event": event}
            if event == "adjust":
                values = re.search(r"\bmodes=(\d+)\s+freq=(-?\d+)\s+tick=(-?\d+)", match["data"])
                if not values:
                    unparsed += 1
                    continue
                row["modes"] = int(values[1])
                row["requestsAdjTick"] = bool(row["modes"] & 0x4000)
                row["requestsSetOffset"] = bool(row["modes"] & 0x100)
                # Only fields selected by modes are initialized controls.
                # Unselected stack contents must never leave the private buffer.
                if row["modes"] & 0x2:
                    row["frequencyScaled"] = int(values[2])
                if row["requestsAdjTick"]:
                    row["tickUs"] = int(values[3])
                pending[pid] = True
            elif event == "adjust_result":
                if not pending.pop(pid, False):
                    continue  # Don't report unrelated read-only timex queries.
                value = re.search(r"\bresult=(-?\d+)", match["data"])
                if not value:
                    unparsed += 1
                    continue
                row["result"] = int(value[1])
            if len(records) < 256:
                records.append(row)
            else:
                truncated = True
except BaseException as exc:
    failure = {"type": type(exc).__name__, "errno": getattr(exc, "errno", None), "stage": stage}
    # No raw exception text, paths, pointers or probe-buffer output.
finally:
    if fd is not None:
        os.close(fd)
    if instance.exists():
        try:
            write(instance / "tracing_on", "0")
        except OSError:
            cleanup_errors.append("disable-private-buffer")
    for event in reversed(enabled):
        try:
            write(event / "enable", "0")
        except OSError:
            cleanup_errors.append("disable-own-event")
    for name in reversed(names):
        if not (TRACE / "events" / group / name).exists():
            continue
        try:
            registry(f"-:{group}/{name}")  # release only our unique probe
        except OSError:
            cleanup_errors.append("release-own-probe")
    if instance.exists():
        try:
            instance.rmdir()  # release only our tracefs buffer allocation
        except OSError:
            cleanup_errors.append("release-own-buffer")
    after = read_root_state()
    remaining = registrations()
    output = {"durationSeconds": args.seconds, "failure": failure,
              "ownTraceGroup": group,
              "rootStateBefore": before, "rootStateAfter": after,
              "rootStateUnchanged": before == after,
              "priorProbeRegistrationsPreserved": previous <= remaining,
              "ownProbeRegistrationsReleased": not any(group in line for line in remaining),
              "ownBufferReleased": not instance.exists(),
              "cleanupErrors": cleanup_errors, "unparsedLines": unparsed,
              "truncated": truncated, "records": records,
              "temporarySharedKernelProbes": True,
              "clockServiceConfigChanges": False, "clockWrites": False}
    print(json.dumps(output))
    if failure or cleanup_errors:
        raise SystemExit(1)
