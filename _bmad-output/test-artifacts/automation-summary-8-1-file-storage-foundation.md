---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-identify-targets
  - step-03-generate-tests
lastStep: step-03-generate-tests
lastSaved: '2026-07-04'
workflowType: testarch-automate
storyId: 8-1-file-storage-foundation-private-bucket-metadata-links-rls-and-signed-access-command
inputDocuments:
  - _bmad-output/implementation-artifacts/8-1-file-storage-foundation-private-bucket-metadata-links-rls-and-signed-access-command.md
  - _bmad-output/test-artifacts/test-design-epic-8.md
  - _bmad-output/test-artifacts/atdd-checklist-8-1-file-storage-foundation-private-bucket-metadata-links-rls-and-signed-access-command.md
  - supabase/migrations/20260704120000_file_storage_foundation.sql
  - src/server/commands/files/files.ts
  - src/server/commands/files/file-db.ts
  - tests/integration/commands/file-link-ownership.int.test.ts
  - tests/integration/commands/file-signed-access.int.test.ts
  - tests/integration/rls/storage-object-isolation.rls.test.ts
  - tests/integration/rls/file-tables-migration-reset.int.test.ts
  - tests/integration/rls/tenant-table-inventory.ts
  - tests/integration/rls/anon-path-isolation.rls.test.ts
  - tests/unit/server/storage/object-path.test.ts
  - tests/unit/server/commands/file-validation.test.ts
---

# Test Automation Expansion — Story 8.1 (File Storage Foundation)

**Role:** Master Test Architect · **Mode:** Create (BMad-Integrated) · **Stack:** backend (DB/RLS/storage/commands, no UI)
**Date:** 2026-07-04

## Step 1 — Preflight & Context

- **Framework present:** Vitest 4.1.9 (DB-backed `tests/integration/**`) + `node --test` (pure `tests/unit/**`) + Playwright (no E2E in this backend story). No HALT.
- **Detected stack:** backend. Playwright/browser exploration N/A — source & schema analysis path.
- **Baseline (pre-expansion):** 388 integration + 870 unit green against the live local Supabase stack (running, all migrations applied). Story implemented and verified; ATDD scaffolds all un-skipped and green.

## Step 2 — Coverage-Gap Analysis (epic P0/P1 for 8.1 vs. what exists)

Mapped the epic test-design P0/P1 coverage plan against the on-disk suites. Already fully covered (no redundant re-assertion added):

- Migration-reset schema/CHECK/policy/GRANT/private-bucket (`file-tables-migration-reset.int.test.ts`, 18 asserts) — R-801/R-802/R-803.
- DB-plane cross-tenant + anon isolation of `files`/`file_links` — carried data-driven by `TENANT_TABLES` enrollment (all six switch branches present) + the shared cross-tenant/anon suites + H4 gate. R-801.
- Signing authorization matrix — anon / cross-tenant / not-found (same shape) / archived lifecycle / clean audit metadata (`file-signed-access.int.test.ts`). R-804/R-809/R-810.
- Link both-side ownership (foreign file, foreign owner) + deferred owner-type + atomic-RPC CHECK-violation rollback (`file-link-ownership.int.test.ts`). R-802/R-807.
- Storage-plane negatives — list/read/sign/path-spoof/malformed-segment/anon/expired-URL (`storage-object-isolation.rls.test.ts`). R-805/R-806.
- Pure helpers — `deriveObjectPath` (tenant-first + traversal/control-char sanitization), `isAccessEligibleLifecycle`, validators (owner-type/purpose closed unions), TTL resolution. R-803/R-810/R-806.

### Genuine gaps identified (both P0-class security properties asserted by the migration but untested)

1. **`create_file_with_link` anon-EXECUTE denial (R-801/R-803).** The RPC does `revoke execute … from public; grant … to authenticated, service_role`. There is a proven `assertAnonExecuteDenied` pattern (used on `record_audit_event`, `is_tenant_admin`, `is_active_tenant_member`) but NO test targeting this RPC. An accidental future `grant … to anon` would hand an unauthenticated caller the entire atomic files+file_links write path.
2. **RPC cross-tenant `p_tenant_id` forge rejection (R-802/R-807).** The RPC is SECURITY INVOKER; the migration comment claims a forged cross-tenant `p_tenant_id` fails the files INSERT WITH CHECK (42501) and rolls back. The existing atomicity test only exercises a CHECK-violation (23514) with the caller's OWN tenant. No test proved an authed Tenant A caller cannot forge a Tenant-B `p_tenant_id` through the RPC — the core write-path defense of R-802.

Both are the exact class of gap the audit/helper RPCs already guard; neither duplicates an existing assertion.

## Step 3 — Tests Added

Added to `tests/integration/commands/file-link-ownership.int.test.ts` (co-located with the RPC atomicity tests; reuses the same two-tenant fixture + BYPASSRLS re-read; added an anon client to `beforeAll`):

- `[P0/R-801/R-803] an ANONYMOUS caller has NO EXECUTE on create_file_with_link (42501, not vacuous)` — asserts the 42501 SQLSTATE explicitly (not a vacuous `!error` disjunction) + a BYPASSRLS re-read proving nothing persisted.
- `[P0/R-802/R-807] an authed Tenant A caller CANNOT forge a Tenant B p_tenant_id through the RPC — denied + no B-side write` — drives the RPC directly under A's authed RLS client with `p_tenant_id = tenantB.id`; asserts the INSERT WITH CHECK denial mechanism + a BYPASSRLS re-read proving no Tenant-B `files` row and no `file_links` row survived (full rollback).

No unit tests added (pure-helper coverage was already complete). No new E2E (backend story). No changes to source, migration, factories, or enrollment.

## Gate Results (post-expansion)

- `pnpm typecheck` — clean.
- `pnpm lint` — clean (0 errors; sole warning pre-existing + unrelated: `tests/unit/lib/money/vat.test.ts`).
- `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` — 39 files / **390 passed** (was 388 → +2).
- `pnpm run test:unit` — 55 suites / **870 passed** (unchanged; no unit additions).

Coverage scope: **selective** — targeted the two remaining P0 write-path/anon-privilege gaps; declined to add redundant tests for already-covered isolation/signing/storage paths.
