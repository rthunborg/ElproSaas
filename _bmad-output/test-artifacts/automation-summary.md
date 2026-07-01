---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests']
lastStep: 'step-03-generate-tests'
lastSaved: '2026-07-01'
inputDocuments:
  - _bmad-output/implementation-artifacts/3-5-snapshot-source-contract-for-settings-and-pricing-inputs.md
  - src/lib/snapshots/types.ts
  - src/lib/snapshots/build.ts
  - src/server/snapshots/resolve-source.ts
  - tests/unit/lib/snapshots/build.test.ts
  - tests/unit/lib/snapshots/golden.test.ts
  - tests/integration/snapshots/source-ownership.int.test.ts
  - tests/fixtures/golden/snapshots/work-role-source.json
  - tests/fixtures/golden/snapshots/article-source.json
  - src/server/commands/command-errors.ts
  - src/lib/result/result.ts
---

# Test Automation Expansion — Story 3.5 (Snapshot Source Contract)

## Mode & Stack

- **Mode:** BMad-Integrated (story 3.5 loaded). Create mode (expand after implementation).
- **Detected stack:** backend for THIS module — pure TS builders/types + a server-only
  RLS resolver. Prefer fast `node --test` units over more Vitest integration where a pure
  function (builder, dispatcher, resolver error-mapping) can be tested directly.
- **Framework verified:** present (`pnpm test:unit` node --test + `pnpm test:int` Vitest).

## Existing coverage (baseline — not weakened)

- `tests/unit/lib/snapshots/build.test.ts` — per-kind copy-fidelity; `work_role`
  source-mutation immutability; frozen (all 4); terms state-only + no source mutation.
- `tests/unit/lib/snapshots/golden.test.ts` — work-role + article golden masters +
  anonymization guard.
- `tests/integration/snapshots/source-ownership.int.test.ts` — both-layers cross-tenant
  rejection across all four sources (DB-touching — stays at integration).

## Gaps filled this run (fast pure units)

1. **Immutability depth per EACH kind** — for `work_role`, `article`, `company_settings`,
   `quote_terms`: mutate the ORIGINAL source object (every captured field, incl. flipping
   `is_active`, editing öre/bp/text/timestamps) AFTER build → the prior snapshot is
   byte-for-byte unchanged (copy-by-value, no live reference); `Object.isFrozen(snap)` at
   the intended-immutable level; a direct write to the snapshot does not take effect; the
   builder never mutates its input row.
2. **Field-capture edges** — integer-öre boundaries (`0`, large `Number.MAX_SAFE_INTEGER`)
   copied verbatim & still integer; `vat_rate_bp` boundaries (`0`, `2500`, `10000`);
   `approved_at` NULL (not-approved) vs a timestamp (approved) captured faithfully — the
   builder NEVER approves; `capturedAt` always the injected value; source `updated_at`
   flows to `sourceUpdatedAt` (the version) and is distinct from `capturedAt`.
3. **Dispatcher `buildSnapshotSource`** — each `kind` routes to the matching per-kind
   builder (output deep-equals the direct builder call, frozen); an unknown `kind` hits
   `assertNever` and throws at runtime (fail-loud) — the compile-time guard is exercised
   behaviorally.
4. **`resolve-source.ts` pure error-mapping** — with an in-memory fake client (no DB):
   zero rows (`[]` / `null`) → `TENANT_ACCESS_DENIED`; a returned DB `error` → `SERVER_ERROR`;
   a thrown/rejecting client → `SERVER_ERROR`; a present row → `ok(row)`; the denial message
   never echoes the source id; the resolver selects the right table per kind.

## Deliberately kept at integration (not unitized)

- Real RLS enforcement, cross-tenant zero-rows under the actual `is_tenant_admin` policies,
  and the seeded two-tenant proof remain in `source-ownership.int.test.ts` (correct level —
  they require the live Supabase stack).

## New / modified test files

- `tests/unit/lib/snapshots/build.test.ts` — expanded (immutability per kind + field edges).
- `tests/unit/lib/snapshots/dispatch.test.ts` — new (dispatcher routing + assertNever).
- `tests/unit/server/snapshots/resolve-source.test.ts` — new (pure error-mapping).

## Result

- **Unit suite:** 424 pass / 0 fail (was ~407 baseline; +17 new snapshot units this run).
- **typecheck:** clean. **lint:** clean.
- No existing test weakened; no golden fixture changed; no implementation code changed.
- Integration suite (`test:int`, DB-touching cross-tenant) left untouched — it requires the
  live local Supabase stack and its coverage is the correct level for the RLS half of AC3.

