---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: 2026-06-30
story_id: 3-4
detected_stack: fullstack
generation_mode: AI generation (sequential)
inputDocuments:
  - _bmad-output/implementation-artifacts/3-4-work-roles-and-optional-manual-articles.md
  - tests/integration/commands/settings-commands.int.test.ts
  - tests/unit/server/commands/settings-validation.test.ts
  - tests/integration/rls/crm-tables-migration-reset.int.test.ts
  - tests/integration/rls/tenant-table-inventory.ts
  - tests/integration/rls/migration-reset.int.test.ts
  - tests/integration/rls/cross-tenant-isolation.rls.test.ts
  - tests/factories/tenants.ts
  - tests/e2e/settings/settings.e2e.spec.ts
  - tests/unit/features/settings/vat-display.test.ts
---

# ATDD Checklist: Story 3.4 — Work Roles And Optional Manual Articles

🔴 **TDD RED PHASE** — failing acceptance scaffolds generated BEFORE implementation.
Every scaffold is gated (`describe.skip` / `test.describe.skip` for Vitest+Playwright;
a dynamic-`require` red-phase gate for the `node --test` pure units) so the green CI
baseline is UNPERTURBED until the Story 3.4 dev phase implements the migration,
commands, and UI. The assertions encode EXPECTED behavior — they are the CONTRACT.

## Preflight & Context

- **Stack:** `fullstack` (Next 16 app + Postgres/Supabase; Vitest integration, `node --test`
  pure units, Playwright e2e — all pre-configured). Prerequisites satisfied; no HALT.
- **Story status:** `ready-for-dev`, clear AC1–AC6.
- **Generation mode:** AI generation, sequential (single session). Recording not needed —
  the UI contract is mirrored 1:1 from the Story 3.3 settings e2e.
- **Patterns mirrored (no new mechanism invented):** Story 3.3 settings command +
  validation tests; Story 3.1 CRM migration-reset + no-supplier-scope guard +
  collection (create/update/archive) command shape + two-tenant factory; the shared H4
  `tenant-table-inventory.ts`; the bp↔percent boundary unit test (for kronor↔öre).

## Generated Files (RED)

| File | Level | Gate | Tests |
| --- | --- | --- | --- |
| `tests/unit/server/commands/pricing-validation.test.ts` | unit (`node --test`) | dynamic-`require` red gate (skips until module exists) | 25 |
| `tests/unit/features/pricing/money-display.test.ts` | unit (`node --test`) | dynamic-`require` red gate | 13 |
| `tests/integration/commands/pricing-commands.int.test.ts` | integration (Vitest, local stack) | `describe.skip` + `notYetImplemented()` stubs | 14 |
| `tests/integration/rls/pricing-tables-migration-reset.int.test.ts` | integration (Vitest) | `describe.skip` | 10 |
| `tests/integration/rls/pricing-rls-enrollment.int.test.ts` | integration (Vitest) | `describe.skip` | 10 |
| `tests/e2e/pricing/pricing.e2e.spec.ts` | e2e (Playwright) | `test.describe.skip` | 9 |

Verified green-baseline-safe: `pnpm typecheck` clean, `pnpm lint` clean (0 problems),
`pnpm test:unit` → 306 pass / 38 skip / **0 fail** (the 38 includes the new 38 pricing
units skipping with reason "RED PHASE: … not implemented yet"), `vitest run` on the 3
new int files → **34 skipped, 0 failed**.

## Acceptance Criteria Coverage

- **AC1 (migration: tenant-owned tables, öre bigint, lifecycle, RLS, grants, NO
  unique(tenant_id)):** `pricing-tables-migration-reset.int.test.ts` — tables exist;
  NOT NULL `tenant_id` FK → `tenants` ON DELETE CASCADE; `is_active`/`created_at`/
  `updated_at` + `set_updated_at` trigger; RLS enable+force; SELECT/INSERT/UPDATE
  policies, NO DELETE; GRANTs (authenticated SIU, anon-DML-empty); **COLLECTION shape —
  NO `unique(tenant_id)`** explicitly asserted.
- **AC2 (work roles: cost/sell öre rates, validation, audit, no calculation):**
  `pricing-validation.test.ts` (`isOreAmount` + `validateUpsertWorkRole` — rejects
  float/negative/NaN/Infinity/overflow/locale-comma/decimal-string → VALIDATION_FAILED;
  accepts non-negative integer öre); `pricing-commands.int.test.ts` (create/update/
  archive collection, EXACTLY ONE audit row with NO rate/name in metadata, soft archive,
  bad rate never persisted); migration-reset (bigint type + `>= 0` CHECK). No VAT/ROT/
  total assertion — Epic 4 owns it.
- **AC3 (articles: manual/minimal, NO supplier scope):** migration-reset no-supplier
  column-name guard (`/supplier|vendor|sync|import|external|api|fortnox|edi|mapping/i`)
  over both pricing tables; `pricing-validation.test.ts` article validator strips every
  supplier-ish key from the validated shape; command int test proves supplier keys are
  dropped, never written; e2e asserts NO supplier control in the article editor.
- **AC4 (cross-tenant RLS + H4):** `pricing-rls-enrollment.int.test.ts` —
  assert-the-mechanism cross-tenant SELECT (zero rows), INSERT-spoof (42501 WITH CHECK),
  UPDATE ("rls-invisible": zero-rows + independent BYPASSRLS unchanged re-read), DELETE
  ("privilege" 42501), anon-DML-empty; the H4-enrollment + migration-reset-enumeration
  EXTENSION steps are documented as the green-phase wiring contract.
- **AC5 (UI /settings/pricing):** `pricing.e2e.spec.ts` — force-dynamic screen renders
  work-role + article editors; negative/float rate → field-associated error
  (`aria-invalid`/`aria-describedby`) + preserved input; valid role/article round-trips
  (kronor display, öre stored); route auth (anon → /login); nav stays EXACTLY seven (no
  new top-nav item); Inställningar hub links to Prissättning; plus the kronor↔öre pure
  boundary unit (`money-display.test.ts`).
- **AC6 (snapshot-friendly shape):** covered implicitly — the migration-reset test pins
  the stable stored shape (source id + display name/name + öre value + timestamps +
  tenant ownership). NO snapshot table / freeze / recompute is tested (Story 3.5 /
  Epic 4-6 own it) — deliberately N/A for this story.

## Load-Bearing Contracts Pinned (per the delegation brief)

1. **INTEGER öre money** — `cost_rate_ore`/`sell_rate_ore`/`unit_price_ore` are bigint
   integer öre; `isOreAmount` rejects floats, negatives, overflow, NaN/Infinity, and
   locale-comma ("850,00") + decimal-string inputs → VALIDATION_FAILED on each; DB
   `bigint` column type + non-negative CHECK asserted. NO VAT/ROT/total tested. ✅
2. **HARD no-supplier-scope** — schema-shape column-name guard asserts work_roles +
   articles carry NO `supplier|credential|api_key|api|sync|import|external|fortnox|edi|
   mapping|vendor` column (mirrors CRM); validator strips supplier keys; UI shows none. ✅
3. **Collection (NOT singleton)** — many-per-tenant; NO `unique(tenant_id)` asserted;
   create/update/archive command + two-tenant factory pattern (not singleton-upsert). ✅
4. **H4 RLS** — both tables enrolled (cross-tenant + anon-DML seams);
   assert-the-mechanism negatives (42501 + independent BYPASSRLS re-read; fresh-uuid
   parent/tenant spoof); migration-reset exact-policy enumeration EXTENDED (not
   loosened) is documented as the green-phase step. ✅
5. **Green baseline unperturbed** — all scaffolds gated skip; verified above. ✅

## Next Steps (TDD Green Phase — Story 3.4 dev)

1. **Migration** `supabase/migrations/<ts>_work_roles_and_articles.sql` (mirror the 3.3
   settings migration minus `unique(tenant_id)`): 2 tables, öre bigint + `>= 0` CHECKs,
   `is_active`, `tenant_id` FK cascade, `set_updated_at` trigger, RLS enable+force, 6
   policies (SELECT/INSERT/UPDATE × 2), GRANTs (authenticated SIU; service_role DML;
   anon none). → un-skip `pricing-tables-migration-reset.int.test.ts`.
2. **Pure validators** `src/server/commands/pricing/validation.ts` (`isOreAmount`,
   `validateUpsertWorkRole`/`validateUpsertArticle`/`validateArchive`). → delete the
   red-`require` gate in `pricing-validation.test.ts`, switch to a top-level import.
3. **Commands** `src/server/commands/pricing/work-roles.ts` + `articles.ts`
   (`upsertWorkRole`/`archiveWorkRole`/`upsertArticle`/`archiveArticle` via the
   envelope; ownership pre-check; audit `{ targetId }` only). → replace the
   `notYetImplemented()` stubs + local readback with real imports + factory helpers,
   un-skip `pricing-commands.int.test.ts`.
4. **H4 enrollment** (Task 3.1-3.3): add `work_roles`,`articles` to `TENANT_TABLES` +
   every per-table metadata switch; add `adminInsertWorkRole`/`adminInsertArticle` +
   `tenantBWorkRoleId`/`tenantBArticleId`; seed Tenant B rows in the cross-tenant
   suite's `beforeAll`; EXTEND `migration-reset.int.test.ts` exact-policy enumeration
   (+6, `articles.*` first) + the no-DELETE group. → the live parameterized suites then
   cover the two tables; un-skip / retire `pricing-rls-enrollment.int.test.ts` (its
   contract is enforced live), and scratch-verify the H4 gate bites (drop one table →
   gate fails → restore).
5. **UI** `src/app/(app)/settings/pricing/page.tsx` (force-dynamic) +
   `src/components/pricing/**` + `src/features/pricing/{read,actions,money-display}.ts`;
   ADD the Prissättning link to the `/settings` hub. → delete the red gate in
   `money-display.test.ts`; un-skip `pricing.e2e.spec.ts`.
6. Run the full CI gate sequence in order (typecheck → lint → test:unit → build →
   supabase reset → test:int → test:e2e). All un-skipped scaffolds should go GREEN.

## Key Risks / Assumptions

- **Money bound:** `isOreAmount`'s overflow ceiling is left as the dev's documented bound
  (<= MAX_SAFE_INTEGER or a tighter realistic cap); the boundary-symmetry test pins
  inclusivity without hard-coding the magnitude (Open Question 2 in the story).
- **Lifecycle:** scaffolds assume the `is_active boolean` lifecycle (the story's chosen
  representation), not `archived_at`. If dev picks `archived_at`, adjust the lifecycle
  column assertions + archive-readback accordingly (Open Question 3).
- **anon-path e2e/int:** `pricing-rls-enrollment.int.test.ts`'s anon block uses an
  authed-client placeholder; the GREEN phase wires the real anon fixture via the
  parameterized `anon-path-isolation.rls.test.ts` (the canonical anon seam).
- **Articles IN scope** per owner decision 2026-06-18 (Open Question 1) — scaffolds
  include articles; cleanly removable if the owner defers.

## Recommended Next Workflow

`dev-story` (implement Story 3.4) → then `bmad-testarch-trace` / `automate` to confirm
coverage and un-skip.
