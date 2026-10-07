"""Read-only clock diagnostic. Relative numeric metrics only; no subprocesses."""
import json
import time

duration_ns = 55_000_000_000
raw_clock = time.CLOCK_MONOTONIC_RAW

def sample():
    return (time.clock_gettime_ns(raw_clock),
            time.clock_gettime_ns(time.CLOCK_MONOTONIC),
            time.clock_gettime_ns(time.CLOCK_REALTIME))

first = previous = sample()
deadline = first[0] + duration_ns
count = 1
backward = 0
minimum_realtime = None
minimum_adjusted = None
while time.clock_gettime_ns(raw_clock) < deadline:
    remaining = deadline - time.clock_gettime_ns(raw_clock)
    if remaining <= 0:
        break
    time.sleep(min(0.02, remaining / 1_000_000_000))
    current = sample()
    realtime_delta = current[2] - previous[2]
    adjusted_delta = current[1] - previous[1]
    backward += int(realtime_delta < 0)
    minimum_realtime = realtime_delta if minimum_realtime is None else min(minimum_realtime, realtime_delta)
    minimum_adjusted = adjusted_delta if minimum_adjusted is None else min(minimum_adjusted, adjusted_delta)
    previous = current
    count += 1
raw_elapsed = previous[0] - first[0]
print(json.dumps({
    "readOnly": True,
    "rawDeadlineSeconds": 55,
    "samples": count,
    "backwardSteps": backward,
    "minimumRealtimeDeltaMs": minimum_realtime / 1_000_000 if minimum_realtime is not None else None,
    "minimumAdjustedDeltaMs": minimum_adjusted / 1_000_000 if minimum_adjusted is not None else None,
    "rawElapsedMs": raw_elapsed / 1_000_000,
    "adjustedToRawRatio": (previous[1] - first[1]) / raw_elapsed,
    "realtimeToRawRatio": (previous[2] - first[2]) / raw_elapsed,
}, separators=(",", ":")))
