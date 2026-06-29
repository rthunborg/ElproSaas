---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-04c-aggregate
lastStep: step-04c-aggregate
lastSaved: '2026-06-29'
workflowType: testarch-atdd
mode: create
tddPhase: RED (coverage-closing; mostly green-on-current-stack per ATDD "asserts existing behavior ⇒ may be green")
designLevel: epic
epicNum: 2
scaffoldSource: _bmad-output/test-artifacts/test-design-epic-2-foundation-consolidated.md
gapsScaffolded: [G-1, G-4 (INT slice), G-5, G-6, G-7]
gapsDeferred: [G-2 (Playwright), G-3 (Playwright), G-4 (layout-render half, Playwright), G-8 (P3), G-9 (P3)]
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-2-foundation-consolidated.md
  - _bmad-output/test-artifacts/traceability/epic-2-traceability-report.md
  - src/server/auth/resolve-tenant-context.ts
  - src/server/commands/envelope.ts
  - src/server/commands/envelope-core.ts
  - src/server/commands/audit.ts
  - src/server/commands/audit-metadata.ts
  - supabase/migrations/20260629121136_audit_events.sql
  - supabase/migrations/20260625122433_tenant_foundation.sql
  - tests/factories/tenants.ts
  - tests/factories/audit-events.ts
  - tests/integration/rls/tenant-table-inventory.ts
  - tests/integration/server/auth/resolve-tenant-context.int.test.ts
  - tests/integration/commands/envelope-failure-modes.int.test.ts
  - tests/integration/commands/envelope-audit-write.int.test.ts
  - tests/integration/rls/anon-path-isolation.rls.test.ts
---

# ATDD Checklist: Epic 2 Foundation — ON-CURRENT-STACK Coverage-Gap Scaffolds

**Date:** 2026-06-29
**Author:** Rasmus (BMAD TEA — ATDD)
**Source spec:** `_bmad-output/test-artifacts/test-design-epic-2-foundation-consolidated.md` (ranked gap list G-1..G-9)
**Stack:** Backend-flavored — Vitest `*.int.test.ts` / `*.rls.test.ts` against the LOCAL Supabase stack, reusing the two-tenant factories. NO new framework introduced (Playwright remains deferred). Generation mode: **AI generation** (clear ACs from the consolidated design; no browser recording).

> This checklist closes the **ON-CURRENT-STACK** ranked gaps. It does NOT overwrite any per-story
> ATDD checklist. The **PLAYWRIGHT-BLOCKED** gaps (G-2 UI display, G-3 route-redirect, G-4 layout-render
> half) are intentionally NOT scaffolded and are noted below as awaiting the browser runner.

---

## Generation Mode & Test Strategy (steps 2-3)

- **Mode:** AI generation. Backend project surface → no browser recording; the gaps are DB/RLS/command-envelope
  behaviors with clear acceptance criteria in the consolidated design.
- **Levels selected:** INT (Vitest server-command integration against the live stack) and RLS (cross-tenant/anon
  DB negatives) — matching the repo's existing dual-runner conventions. No E2E (Playwright-blocked, deferred).
- **Red-phase discipline:** where a scaffold asserts behavior that ALREADY EXISTS it is green immediately
  (a coverage-closing test) per the ATDD "asserts existing behavior ⇒ may be green" rule; where it depends on
  something not yet present it is gated green-by-skip via the repo-native `describe.skip` with a clear TODO.
  Every assertion is by MECHANISM (exact SQLSTATE / typed `Result` code), never a vacuous empty set.

---

## Scaffolds Generated (RED phase — coverage-closing)

| Gap | Priority | File | Tests | Phase status |
| --- | --- | --- | --- | --- |
| **G-1** | P1 (gate-flipper) | `tests/integration/commands/disabled-membership-no-access.int.test.ts` | 6 (invited+disabled × resolver/RLS/envelope) | **runnable-green** (proves the flip) |
| **G-4** (INT slice) | P2 | `tests/integration/commands/server-error-vs-no-access.int.test.ts` | 2 (resolver + envelope) | **runnable-green** |
| **G-5** | P2 | `tests/integration/rls/audit-anon-mutation-enrollment.rls.test.ts` | 4 (2 structural + 2 live) | **runnable-green** |
| **G-6** | P2 | `tests/integration/commands/audit-actor-on-delete-set-null.int.test.ts` | 1 runnable + 1 gated-skip | **runnable-green (current behavior) + gated-skip (intended)** |
| **G-7** | P2 | `tests/integration/commands/audit-metadata-hygiene-e2e.int.test.ts` | 1 | **runnable-green** |

**Fixture capability added (minimal, well-scoped, additive B1) in `tests/factories/tenants.ts`:**

- `seedMembership({ tenant, user, status, role? })` + `NON_ACTIVE_MEMBERSHIP_STATUSES = ['invited','disabled']`
  — the live disabled/invited-membership fixture capability G-1 explicitly required (so G-1 is genuinely
  runnable, not a vacuous skip).
- `deleteAuthUser(userId)` — focused single-actor delete (throws on real error) needed by G-6.

---

## Per-Gap Detail

### G-1 (P1, the gate-flipper) — DB-backed disabled/inactive-membership → no-access — RUNNABLE-GREEN ✅

- **What it proves:** a LIVE `disabled` AND a LIVE `invited` `tenant_memberships` row both resolve to
  `TENANT_MEMBERSHIP_REQUIRED` at the resolver, read ZERO tenant rows under RLS (active-only USING clause),
  and are rejected at the envelope membership gate with **no audit row** — distinct from the no-membership
  orphan case (row EXISTS here, proving the resolver keys on `status='active'`, not row existence; R-004).
- **Data-driven** over every non-active status the schema CHECK admits, so a future status that must also deny
  (or a regression letting one through) is caught.
- **Coverage flip:** promotes **P1-2 PARTIAL → FULL** → epic **P1 80% → 90%** → deterministic gate
  **CONCERNS → PASS**. Proven green in isolation (6/6).

### G-4 (P2, INT slice only) — SERVER_ERROR-vs-no-access taxonomy — RUNNABLE-GREEN ✅

- **What it proves:** a transient membership-read I/O error (real authed session; one injected fault on JUST
  the `tenant_memberships` read returning the exact PostgREST `{ data:null, error }` shape an outage produces)
  maps to `SERVER_ERROR` at BOTH the resolver and the envelope — NOT `TENANT_MEMBERSHIP_REQUIRED` /
  `TENANT_ACCESS_DENIED` — with no audit row and no raw SQLSTATE across the boundary (R-014).
- **Faithful, not vacuous:** the auth leg is real live JWT validation; only the membership SELECT is forced to
  fail — the precise input the resolver's `if (activeError)`/`if (anyError)` branches map to SERVER_ERROR.
- **Deferred (Playwright):** the `(app)` layout try/catch → user-safe no-access RENDER half is NOT scaffolded.

### G-5 (P2) — audit_events anon UPDATE/DELETE enrollment completeness — RUNNABLE-GREEN ✅

- **What it proves:** `audit_events` is enrolled in the shared `TENANT_TABLES`; its anon UPDATE/DELETE metadata
  helpers (`anonFilterFor`/`anonMutationFor`) resolve for it (the data-driven anon UPDATE/DELETE seam genuinely
  reaches `audit_events`, not just SELECT/INSERT/EXECUTE); and live anon UPDATE+DELETE on `audit_events` are
  denied by the privilege mechanism (`42501`), driven through the SAME shared-inventory helpers (one source of
  truth). A standing enumeration-completeness guard that bites if a future refactor drops `audit_events`.

### G-6 (P2) — actor_user_id ON DELETE SET NULL — RUNNABLE-GREEN (current) + GATED-SKIP (intended) ⚠️ FINDING

- **Finding (surfaced by scaffolding this gap):** the documented `ON DELETE SET NULL` is **defeated by the
  append-only `BEFORE UPDATE OR DELETE` trigger** (`audit_events_append_only` → `audit_events_block_mutation()`).
  The FK SET NULL is an internal UPDATE of the referencing row; the trigger raises on ANY update, so deleting an
  actor that authored an audit row FAILS with SQLSTATE **23001 (`restrict_violation`)** instead of nulling the
  column. The "audit row survives a deleted actor by nulling the FK" behavior does **not** currently hold —
  actor deletion is blocked entirely whenever the actor has authored an audit row. (The GoTrue admin API masks
  this as an opaque `{}` error; the raw delete surfaces the real SQLSTATE.)
- **Runnable test (green today):** pins the CURRENT behavior — actor delete blocked by the append-only trigger
  (23001), audit row unchanged + actor still attributed. Non-vacuous, executes on the live stack.
- **Gated-skip test (red phase):** the INTENDED behavior (delete nulls `actor_user_id`, preserves the row).
  `describe.skip` with `TODO(G-6)`: un-skip once the append-only enforcement is amended to PERMIT the FK-driven
  SET NULL of ONLY `actor_user_id` while still blocking all other UPDATE/DELETE; at that point the current-behavior
  test should be inverted/removed.

### G-7 (P2) — end-to-end metadata hygiene through a metadata-routing command — RUNNABLE-GREEN ✅

- **What it proves (closing the near-vacuous gap):** a command whose `auditFields` DELIBERATELY forwards
  caller-controlled metadata routes it through `sanitizeAuditMetadata` inside `writeAuditEvent`. Against the
  PERSISTED row (BYPASSRLS re-read): forbidden content (`apiKey`/`serviceRoleKey`/`env`/long-PII `note`/
  control-char `fileContents`) is DROPPED end-to-end, AND the allow-listed `reason` SURVIVES — the survival
  assertion is what makes it non-vacuous (proves metadata genuinely flowed; the sanitizer, not an inert path,
  dropped the forbidden keys). Unlike the prior happy-path no-op command which declared NO `auditFields`.

---

## Deferred (NOT scaffolded — awaiting the browser runner)

| Gap | Reason |
| --- | --- |
| **G-2** UI active-tenant-context display | PLAYWRIGHT-BLOCKED — un-skip `login-and-tenant-context.e2e.spec.ts` after the runner lands. |
| **G-3** anonymous `(app)` route-redirect to `/login` | PLAYWRIGHT-BLOCKED — same un-skip closes it with G-2. |
| **G-4** layout-render-on-throw half | PLAYWRIGHT-BLOCKED — the INT taxonomy slice is closed above; the layout render rides the un-skip. |
| **G-8** introspection-assertion strength (search_path exact; H4 views/transitive-FK) | P3 LOW — out of this on-current-stack P1/P2 pass. |
| **G-9** auth/RLS performance | P3 LOW — `*nfr-assess` when/if brought into scope. |

---

## Verification (step 5)

- `pnpm typecheck` — **clean**.
- `pnpm lint` — **clean** (0 problems).
- `pnpm run test:unit` (`node --test`) — **146 pass / 0 fail / 0 skipped**.
- New scaffolds (clean `supabase db reset`, `SUPABASE_TEST_REQUIRED=1`) — **14 pass / 1 skipped** (the gated G-6
  INTENDED case).
- Full `pnpm run test:int` (clean reset, `SUPABASE_TEST_REQUIRED=1`) — **20 files, 103 pass / 1 skipped**,
  no regressions (was 89 INT; +14 passing +1 gated).
- G-1 in isolation — **6/6 green**, proving the disabled+invited live-membership coverage that flips P1 → 90%.

---

## Next Steps (TDD green phase / follow-on)

1. **G-1 → re-run `*trace`** to confirm the gate flips CONCERNS → PASS (P1 80% → 90%).
2. **G-6 finding → triage** the `ON DELETE SET NULL` vs append-only-trigger contradiction (amend the trigger to
   permit the FK-driven null of only `actor_user_id`, OR correct the migration/architecture docs). Then un-skip
   the gated INTENDED test and invert the current-behavior test.
3. **G-2/G-3/G-4(render) → `*automate`** after the Playwright runner is stood up (un-skip the gated E2E).
4. **G-8/G-9 → on-demand** P3 hardening / `*nfr-assess`.
