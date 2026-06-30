# Auth/RLS Performance Baseline (Epic 2 — Gap G-9 / R-013)

**Status:** NON-GATING baseline. **Owner of the real SLA: post-pilot (R-013).**

## Why a baseline, not a gate

Phase A is an internal pilot with **no defined performance SLA**, so a tight performance
gate would be arbitrary and flaky. Instead `tests/integration/perf/auth-rls-baseline.int.test.ts`:

- **measures** the representative auth/RLS hot paths and **logs `p50 / p95 / max`** each run
  (`[perf-baseline] …`), so real numbers are visible and a future SLA can be set from data;
- asserts only a **generous ceiling** (`p95 < 2000ms`) that fires on a catastrophic (~10–40×)
  regression but never on normal local/CI variance.

## Measured paths

| Path | What it exercises |
| --- | --- |
| `resolveTenantContext({ client })` | the full per-request server auth/tenant path — JWT re-validation (`getClaims`) + the membership read + the no-access/SERVER_ERROR decision logic |
| authed own-tenant RLS read on `tenant_memberships` | the `is_active_tenant_member` policy predicate end-to-end under RLS |

Methodology: 3 warm-up iterations discarded (cold connection / cache fill), then 30 timed
iterations; percentiles over the sorted samples. Local stack only (skips visibly when down).

## How to tighten post-pilot (R-013)

1. Collect the logged `p50/p95` across several CI runs to establish a real distribution.
2. Define the SLA (e.g. `resolveTenantContext p95 < N ms` at the pilot's expected concurrency).
3. Lower `P95_CEILING_MS` in the baseline test toward that SLA, and add load/concurrency
   scenarios if the pilot's traffic warrants them.
4. Re-scope from "baseline" to "gate" only once the SLA is agreed (owner/product sign-off).

## Disposition of G-9

Closed as a **baseline** (this doc + the test). The blocking perf SLA + load testing remain
deferred under R-013 until the pilot defines real targets — this is the deliberate Phase A
posture, not an omission.
