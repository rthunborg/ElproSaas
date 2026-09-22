# Epic 12 Performance Baseline — 12.X-PERF-001

**Recorded:** 2026-09-21  
**Status:** measured, advisory, and non-gating. This record does not set a
performance PASS/FAIL threshold.

## Scope and environment

The executable harness is
[`scripts/nfr/epic-12-performance-baseline.ts`](../../scripts/nfr/epic-12-performance-baseline.ts).
It hard-fails unless `SUPABASE_TEST_REQUIRED=1`, the API target is exactly
`http://127.0.0.1:54321`, and PostgreSQL is exactly
`127.0.0.1:54322/postgres`. It ran on Windows x64 with Node `v22.23.2` and
local PostgreSQL `17.6`.

The fixture contained two pre-existing isolated base tenants, one generated
platform-operator record, and 12 newly provisioned Swedish legal-entity
tenants. Each generated tenant had a unique canonical organisation number and
one invited first Admin in `pending_first_admin_invite`; the harness verified
those persisted facts before measuring the console. The run therefore had 14
tenant rows within its own fixture. The authenticated console list observed 444
non-synthetic rows before the pilot fixture and 456 rows during measurement:
12 synthetic rows plus 444 non-synthetic rows. Those absolute counts describe
the shared authorized local stack at measurement time.

Every timed provisioning sample is an authenticated client-to-local-API-to-DB
`provision_tenant` RPC round trip. The console baseline includes both the
unfiltered `operator_console_projection` list RPC at the observed 456-row shape
and targeted detail RPCs for generated tenants. The harness verifies the list
contains every synthetic canonical identity and that every targeted
server-produced read-model row contains its requested canonical identity; it
does not mock the projection.

## Results

| Operation | Samples | Warm/cold treatment | Min | Median | P90 | Max | Observed application/read-model requests |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| `provision_tenant` | 12 | First sample is a cold candidate after fixture setup; remaining 11 are sequential warm candidates. No restart/cache flush was performed. | 5.73 ms | 15.15 ms | 16.65 ms | 20.83 ms | 1 `provision_tenant` RPC per measured provision |
| `operator_console_projection` list | 12 | 3 untimed warmups, then 12 sequential reads over 456 observed rows (12 synthetic, 444 non-synthetic) | 5.69 ms | 15.71 ms | 16.84 ms | 17.61 ms | 1 projection RPC per measured list |
| `operator_console_projection` detail | 12 | 3 untimed warmups, then 12 sequential generated-tenant reads | 2.46 ms | 15.64 ms | 16.60 ms | 17.72 ms | 1 projection RPC per measured detail read |

With 12 samples, the record includes the full sample arrays in the companion
redacted JSON rather than implying a capacity claim from a percentile alone.
The provisioning cold candidate was 17.16 ms. The warm-candidate provisioning
set (11 samples) had 5.81 ms min, 14.67 ms median, 16.44 ms P90, and 16.65 ms
max.

The observed request count is the application/API boundary count only. For each
measured provision, the harness made no server-preview RPC, no reservation RPC,
and no provider-delivery request; preview creation and HMAC construction are
local preparation for the tested approved provisioning RPC. Database-internal
SQL statement count is **unobserved**. It is not inferred from the one RPC
dispatch.

The complete redacted record is
[`epic-12-performance-baseline.json`](epic-12-performance-baseline.json).
It contains no tenant IDs, email addresses, tokens, credentials, signatures, or
other secret fixture material.

## Cleanup and reproducibility

The run completed its scoped cleanup without error. It removed its generated
provisioned tenants and dependent provisioning/audit rows, verified no generated
tenant row remained, then removed the platform operator, base fixture tenants,
and test Auth users. It did not reset the database, restart or stop a service,
or clean containers.

Re-run against an already-running authorized local stack:

```powershell
Set-Location C:\DEV\ElproSaas
$env:SUPABASE_TEST_REQUIRED='1'
node --experimental-strip-types --import ./tests/support/register.mjs scripts/nfr/epic-12-performance-baseline.ts
```

## Evidence limits and owner options

This is a sequential, local RPC/read-model baseline. It excludes Next.js route
rendering, browser hydration, action-wrapper authorization, invitation-provider
delivery, throughput, concurrency, hosted infrastructure, and production SLOs.
The console list result is affected by the 444 non-synthetic local rows; it is
useful evidence of the exact observed shared-local shape, while an isolated
larger-list fixture is still needed for a controlled scale claim.

The measured values support these owner decisions, but none is approved by this
record:

1. Keep `12.X-PERF-001` as a threshold-less evidence run and repeat it after
   material provisioning/read-model changes.
2. After several clean, comparable local runs, adopt pilot-only ceilings based
   on the observed warm P90 values with an explicitly chosen noise allowance.
   The current evidence points are 16.44 ms for warm provisioning, 16.84 ms for
   the observed 456-row console list, and 16.60 ms for the console detail read;
   they are too small and too local to set a release SLO.
3. Before making list-scale or capacity claims, add an isolated larger tenant
   list and a concurrent-operator run, then have the owner choose what a
   numeric target should cover.
