---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-tests']
lastStep: 'step-03-generate-tests'
lastSaved: '2026-06-29'
inputDocuments:
  - _bmad-output/implementation-artifacts/2-3-server-command-envelope-and-minimal-audit-events.md
  - _bmad-output/test-artifacts/test-design-epic-2.md
  - supabase/migrations/20260629121136_audit_events.sql
  - src/server/commands/envelope-core.ts
  - src/server/commands/audit-metadata.ts
  - src/server/commands/correlation.ts
  - tests/factories/audit-events.ts
---

# Test Automation Expansion — Story 2.3 (Server Command Envelope & Minimal Audit Events)

## Mode & Stack

- **Mode:** BMad-Integrated (story 2.3 + test-design-epic-2 loaded).
- **Detected stack:** backend/fullstack — pure TS command-envelope layer (`node --test`) over a DB-backed audit substrate (Vitest + local Supabase).
- **Framework:** present — dual runner (`pnpm run test:unit` = `node --test`; `pnpm run test:int` = Vitest). No framework HALT.
- **Baseline:** 88 unit + 80 DB-backed integration tests, all green (verified after a clean `supabase db reset`).

## Existing coverage (do NOT duplicate)

- Envelope gate ordering + stable codes (unit `envelope-core.test.ts`); DB-backed failure modes per gate incl. R-004 client-tenant-id spoof.
- Happy-path field-by-field audit-row assertion (AC1/AC3/AC6); append-only app-path + privileged-path denial (R-009); cross-tenant enrollment in the data-driven `TABLES` array.
- Anon SELECT/INSERT denial + anon NO-EXECUTE on `record_audit_event` (R-003); DEFINER search-path hijack negative + control (R-006).
- Metadata sanitizer primary allow-list proofs (R-010); clock determinism (R-011).

## Genuine coverage GAPS targeted (new tests — pure-logic, no DB)

| # | Gap | Level | Priority | Rationale |
|---|-----|-------|----------|-----------|
| G1 | `resolveCorrelationId` had ZERO unit coverage | Unit | P1 | Authority-surface primitive every command uses (one id per invocation → `audit_events.correlation_id`). Branches untested: inbound passthrough, empty/null/undefined → fresh UUID, per-call uniqueness. |
| G2 | Metadata sanitizer per-field validator BOUNDARIES | Unit | P1 (R-010) | Primary suite proved "drops a planted secret" but not the exact bounds: 128-char keep / 129 drop, control-char rejection INSIDE an allow-listed key (a leaked `.env` smuggled under `reason`), `targetVersion` float/NaN/Infinity/unsafe-int/non-number rejection, non-object inputs → `{}`, prototype-pollution keys ignored. |
| G3 | Envelope-core AUDIT-ROW composition branches | Unit | P1 (AC3/AC6) | Audit write was only observed as count (1 / 0). The default `buildAuditFields` fallback (`targetType ?? ''`, null id, `{}`), the builder-override path, the per-field stamping (tenant/actor/command/event_type/correlation/created_at), and the recordAudit-throws → SERVER_ERROR fail-closed path were unasserted. |

## Justification for scope

Selective. Story 2.3 already carries a thorough AC-level matrix (failure modes, audit fields, append-only, cross-tenant, anon, DEFINER hijack, determinism). The expansion closes three **pure-logic** gaps — a fully-untested primitive (G1), sanitizer boundary branches (G2), and audit-row composition branches (G3) — each a distinct guarantee with no current proof, without re-asserting any covered property. All new tests are pure (`node --test`, no DB), fast, and deterministic.

## New test files (23 tests added)

- `tests/unit/server/commands/correlation.test.ts` (6) — G1: inbound passthrough (incl. UUID-shaped), empty/null/undefined → fresh UUID, per-call uniqueness.
- `tests/unit/server/commands/audit-metadata-edges.test.ts` (9) — G2: 128/129 length boundary, empty-string drop, control-char-in-safe-key drop, non-string drop, `targetVersion` numeric validation, mixed-payload single-pass, non-object → `{}`, prototype-pollution ignored.
- `tests/unit/server/commands/envelope-core-edges.test.ts` (8) — G3: default + override audit-row fields, tenant/actor/command/event_type/correlation/created_at stamping, audit-write-throws → SERVER_ERROR, non-auditable execute-still-runs, short-circuit before body.

## Verification

- `pnpm run test:unit`: **111 pass** (was 88; +23). No regression.
- `pnpm typecheck`: clean (test files enrolled). `pnpm lint`: clean. `pnpm run verify:service-role-containment`: green (new files confined to `tests/**`).
- `pnpm run test:int` after a clean `supabase db reset`: **80 pass** (unchanged — no integration tests added).

## Finding surfaced (pre-existing latent defect, NOT introduced here)

The `audit_events_append_only` `BEFORE UPDATE OR DELETE` trigger also fires on the `tenant_id` `on delete cascade` path. `cleanupFixture` deletes tenant rows expecting the FK cascade to remove their audit rows, but the trigger raises `restrict_violation` and BLOCKS the cascade — so fixture teardown silently fails (logged as a warning, not a hard error) and audit rows accumulate across runs. Because some DB-backed audit tests use HARD-CODED correlation ids, a non-reset DB eventually shows >1 row for a "unique" id and `envelope-audit-write.int.test.ts` fails on a stale-row collision. A clean `supabase db reset` is green; CI (which resets) is unaffected. Recommended fix (owner: a follow-up): let the append-only trigger permit cascade deletes (e.g. skip the raise when `tg_op = 'DELETE'` under a cascading tenant delete) OR have `cleanupFixture` privileged-delete `audit_events` before the tenant. Not in this story's automation scope; surfaced for triage.

---

## (Historical) Test Automation Expansion — Story 2.2 (Tenant Membership Schema, RLS Helpers, Two-Tenant Fixtures)

## Mode & Stack

- **Mode:** BMad-Integrated (story 2.2 + test-design-epic-2 loaded).
- **Detected stack:** backend (DB-backed RLS/helper layer over local Supabase; Vitest runner).
- **Framework:** present — `vitest.config.ts`, `tests/support/global-setup.ts`, `tests/factories/**`. `pnpm run test:int` runs against the LOCAL Supabase stack (reset first). No framework HALT.
- **Baseline:** 70 unit + 35 DB-backed integration/RLS tests, all green (verified: `test:int` = 6 files / 35 tests pass against local stack).

## Existing coverage (do NOT duplicate)

- Cross-tenant SELECT/INSERT/UPDATE/DELETE denied on `tenants` + `tenant_memberships` (authenticated app path).
- Self-grant / self-escalation denied; role/status CHECK-constraint bite.
- SECURITY DEFINER search-path hijack negative + control + review-note marker.
- Migration-reset object presence (tables, helpers, SECDEF+empty search_path, CHECKs, RLS enabled+forced, NOT NULL, exactly-two-SELECT-policies).
- Per-worker factory isolation + forward-compat handle shape.
- Resolver AC1-AC4 (active→tenant; orphan/disabled→TENANT_MEMBERSHIP_REQUIRED; anon→UNAUTHENTICATED; forged tenant_id ignored).

## Genuine coverage GAPS targeted (new tests)

| # | Gap | Level | Priority | Rationale (isolation/RLS/helper guarantee not yet proven) |
|---|-----|-------|----------|-----------------------------------------------------------|
| G1 | `anon` (unauthenticated) raw-table read/write isolation | INT/RLS | P0 | The `anon → NOTHING` GRANT + no policy is asserted only indirectly via resolver `UNAUTHENTICATED`; no test drives `makeAnonServerClient()` directly at `tenants`/`tenant_memberships` proving zero rows + denied writes. |
| G2 | `anon` cannot EXECUTE the RLS helpers (membership-probing oracle) | INT/RLS | P0 | `REVOKE EXECUTE … FROM public; GRANT … TO authenticated, service_role` is load-bearing least-privilege; untested. An anon-callable helper would be a cross-tenant existence oracle. |
| G3 | Helper semantics: `invited`/`disabled` member denied; `is_active_tenant_member` vs `is_tenant_admin` divergence on a non-active member | INT/RLS | P0 | Helpers are the authority behind every policy. Only the resolver-level disabled case is tested; the helpers themselves are never exercised across the active/invited/disabled axis, nor is the role-clause path proven. |
| G4 | FK `on delete cascade` (tenant delete + auth-user delete remove memberships; no dangling authorization rows) | INT | P1 | Cascade is load-bearing for cleanup and the "no dangling authorization rows" invariant; entirely untested. |
| G5 | Within-tenant read SCOPE of `tenant_memberships_select_own`: an admin reads a SECOND membership in their OWN tenant but still ZERO of Tenant B's | INT/RLS | P1 | The positive within-tenant breadth of the SELECT policy (admin sees co-members of own tenant) is unverified; only the self-row read is covered. Confirms the policy does not over- or under-scope. |
| G6 | DB-backed `selectPreferredMembership` active-first ACROSS tenants (Task 7.2 real scenario) | INT | P1 | The UNIQUE(tenant_id,user_id) constraint makes multi-row only reachable across tenants. A user `disabled` in tenant X + `active` in tenant Y must resolve to Y. Covered only by a unit fake; no DB-backed proof of the actual cross-tenant selection. |

## Justification for scope

Selective. The existing suite is strong on the four-verb cross-tenant matrix for the authenticated path. The new tests close the **anonymous-path**, **helper-level**, **cascade**, **within-tenant-breadth**, and **cross-tenant-preferred-selection** gaps — each a distinct tenant-isolation/RLS guarantee with no current proof — without re-asserting any covered property. All new tests are DB-backed against the local stack, parallel-safe (per-call fixtures + unique ids), and skip cleanly when the stack is unreachable (matching the existing pattern).

## New test files (24 tests added)

- `tests/integration/rls/anon-path-isolation.rls.test.ts` (10) — G1/G2: anon-key no-session SELECT/INSERT/UPDATE/DELETE denied on both tables; anon cannot EXECUTE either RLS helper (verified: `42501 permission denied for function`).
- `tests/integration/rls/helper-semantics.rls.test.ts` (9) — G3: `is_active_tenant_member` / `is_tenant_admin` across active/invited/disabled + cross-tenant + no-membership; the two predicates' Phase-A agreement.
- `tests/integration/rls/membership-integrity.int.test.ts` (5) — G4 FK on-delete-cascade (tenant + auth-user); G5 within-tenant SELECT breadth with no cross-tenant leak; G6 DB-backed active-first resolution across tenants (+ disabled-in-both → denied).

## Verification

- `pnpm run test:int` (local stack, `SUPABASE_TEST_REQUIRED=1`): 9 files / **59 tests pass** (was 35; +24).
- `pnpm run test:unit`: 70 pass (no regression).
- `pnpm typecheck`: clean (tests/integration re-enrolled). `pnpm lint`: clean.

## Finding surfaced (not a defect; stronger than assumed)

The migration grants table SELECT only to `authenticated`, NOT `anon`. So an anonymous SELECT is denied at the privilege layer (`42501 permission denied`) before RLS — a STRONGER guarantee than an RLS empty-set. The G1 SELECT assertions were written to accept "denied OR zero rows" (matching the suite's existing write-path convention) to encode this faithfully.
