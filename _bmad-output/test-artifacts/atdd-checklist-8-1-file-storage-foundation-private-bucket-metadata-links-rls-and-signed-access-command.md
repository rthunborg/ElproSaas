---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-04c-aggregate
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-07-04'
workflowType: testarch-atdd
storyId: 8-1-file-storage-foundation-private-bucket-metadata-links-rls-and-signed-access-command
tddPhase: RED
inputDocuments:
  - _bmad-output/implementation-artifacts/8-1-file-storage-foundation-private-bucket-metadata-links-rls-and-signed-access-command.md
  - _bmad-output/test-artifacts/test-design-epic-8.md
  - _bmad-output/test-artifacts/atdd-checklist-5-1-tenant-owned-calculation-schema-and-server-commands.md
  - _bmad/tea/config.yaml
  - tests/integration/rls/tenant-table-inventory.ts
  - tests/integration/rls/migration-reset.int.test.ts
  - tests/integration/rls/calc-tables-migration-reset.int.test.ts
  - tests/integration/commands/calculation-commands.int.test.ts
  - tests/integration/commands/calculation-parent-ownership.int.test.ts
  - tests/unit/server/commands/calc-validation.test.ts
  - tests/factories/tenants.ts
  - tests/factories/audit-events.ts
  - tests/support/test-env.ts
  - tests/support/stack-gate.ts
  - src/server/commands/envelope.ts
  - src/server/commands/command-errors.ts
  - supabase/config.toml
  - .env.example
---

# ATDD Checklist: Story 8.1 — File Storage Foundation (Private Bucket, Metadata, Links, RLS, Signed-Access Command)

**Role:** Master Test Architect · **Mode:** Create · **TDD Phase:** RED (failing scaffolds before implementation)
**Generated:** 2026-07-04

---

## Step 1 — Preflight & Context

**Stack detection (`test_stack_type: auto`):** the load-bearing surface of Story 8.1 is the
Postgres schema + RLS layer (`files`/`file_links`, direct `tenant_id`, composite same-tenant FK,
lifecycle/owner-type/purpose CHECKs), a **second storage plane** (`storage.objects` RLS scoped by a
server-derived tenant path prefix), the server-command envelope (`createSignedFileAccess` /
`createFileLink`), a narrow atomic RPC (ADR-A009), and pure path/lifecycle helpers — a **backend**
(database/RLS + storage-plane + server-command) story. There is NO UI in 8.1 (`nav-items.ts` stays
unchanged; the upload UI/file panels are 8.2+, the `/files` index is 8.5). Per the backend path the
ATDD output is **integration / RLS-negative / storage-negative / migration-reset / pure-helper**
scaffolds, NOT Playwright E2E. The skill's frontend API/E2E subagent split is therefore not
applicable; scaffolds were generated **sequentially and directly** (the documented backend
resolution — the same convention Stories 2.2–5.1 used).

**Prerequisite reality (the gating fact — by design, no HALT):** Story 8.1 inherits a COMPLETE
foundation — Vitest 4.1.9 + the `node --test` unit runner, the local Supabase stack + loopback-gated
BYPASSRLS factories, the command envelope (`defineCommand`/`runCommand`) with its `ownership` gate +
`verifyOwnership` (zero rows ⇒ `TENANT_ACCESS_DENIED`), the injectable `CommandClock`, the
append-only `audit_events` + `writeAuditEvent`, the H4 RLS inventory gate (`TENANT_TABLES` +
`assertNever` seams), the `is_tenant_admin` / `set_updated_at` helpers, and the
`skipUnlessStack`/`isLocalStackReachable` gating — all EXIST and are green in `main`. What does NOT
exist yet is the Story 8.1 DEV work: the `file_storage_foundation` migration (Task 2), the
`tenant-files` private bucket + `storage.objects` RLS (Tasks 1/3), the `create_file_with_link` RPC
(Task 6), the `src/server/storage/*` helpers + `src/server/commands/files/*` commands (Tasks 4/5),
the `FILE_ACCESS_DENIED` command code (Task 5.4), the file factory seeds + the
`isLocalStorageReachable`/`skipUnlessStorage` storage probe (Tasks 7/8.6), and the `TENANT_TABLES`
enrollment (Task 7). The ATDD phase therefore does NOT write the migration, the RPC, the commands,
`src/**`, or the harness extensions; it writes **failing acceptance scaffolds** that the dev phase
un-skips and greens.

**Inputs loaded:** the 8.1 story file (AC1–AC8, Tasks 1–10, Open Questions 1–3), `test-design-epic-8.md`
(risks R-801..R-819; P0 set for 8.1), the Story 5.1 ATDD checklist (the near-identical
backend-schema+command+RPC red-phase convention to match), the inherited harness
(`tenant-table-inventory.ts` six-helper metadata + `assertNever` + H4 gate STANDING CONTRACT,
`test-env.ts`/`stack-gate.ts` reachability+skip helpers, `migration-reset.int.test.ts` exact-policy
enumeration, `calc-tables-migration-reset.int.test.ts` construction template, the calc command +
parent-ownership INT scaffolds, `calc-validation.test.ts` pure-`node --test` template), the
`tenants.ts`/`audit-events.ts` factories, `envelope.ts`, `command-errors.ts` (confirming
`FILE_ACCESS_DENIED` is NOT yet a code — a dev Task 5.4 edit), `supabase/config.toml` (the commented
bucket placeholder at lines 133–137), `.env.example` (the `SUPABASE_SIGNED_URL_TTL_SECONDS`
contract at line 42).

**Knowledge fragments (conceptual, applied):** data-factories (additive file seed helpers +
storage-object seed, per-run unique ids, concrete Tenant-B targets — no vacuous non-existent-id
denials), test-quality (assert-the-mechanism; no `expect(true).toBe(true)`; no vacuous
empty-set/null disjunctions), test-levels-framework (RLS-negative vs storage-negative vs INT-command
vs migration-reset vs pure-helper discipline; no duplicate coverage), test-priorities-matrix (P0/P1),
test-healing-patterns. (TEA Playwright-utils fragments are not materially applicable — no browser
surface in this story.)

---

## Step 2 — Generation Mode

**Mode: AI generation** (clear ACs; standard DB/RLS isolation, both-side ownership, constraint,
migration-reset, command-envelope, atomic-rollback, storage-plane isolation, and pure-helper
scenarios). Recording mode **skipped** — backend story, no UI to record. The skill's parallel
API/E2E subagent dispatch presumes a frontend runner + live browser; for this backend/pre-feature
story scaffolds were generated **sequentially and directly** (the documented sequential resolution
path), honoring the red-phase contract.

---

## Step 3 — Test Strategy (AC → level → priority)

Test-level discipline (no duplicate coverage):

- **Cross-tenant + anon SELECT/INSERT/UPDATE isolation of `files`/`file_links` (AC2)** is NOT a new
  parallel suite — it is carried by ENROLLING `files`/`file_links` in the SHARED `TENANT_TABLES`
  inventory (`tenant-table-inventory.ts`) with BOTH metadata seams (all six `switch (table)`
  helpers). The existing data-driven `cross-tenant-isolation.rls.test.ts` +
  `anon-path-isolation.rls.test.ts` + the H4 gate (`rls-inventory-gate.int.test.ts`) then cover the
  two tables automatically. This enrollment is a **DEV-phase** edit (Task 7), because the
  `assertNever` exhaustiveness guard + the live `introspectTenantOwnedTables` require the tables to
  EXIST; doing it in the ATDD phase (before the migration lands) would turn the green H4 gate +
  negative suites RED for the wrong reason. The ATDD deliverable for this AC is therefore the
  **checklist contract + the dev-phase enrollment recipe below**, not a duplicated suite.
- **Migration-reset schema proof** (both tables exist; direct-tenant FK cascade; `files` composite
  target `(id, tenant_id)` + `unique (bucket_id, object_path)`; `file_links.file_id` COMPOSITE
  same-tenant FK; lifecycle/owner-type/purpose CHECKs; `size_bytes` bigint CHECK; reused
  `set_updated_at` trigger; RLS forced; SELECT/INSERT/UPDATE-only policies; GRANTs; no-broad-file-index
  guardrail; private-bucket asserts) is a NEW dedicated INT scaffold
  (`file-tables-migration-reset.int.test.ts`).
- **Signing authorization funnel** (happy sign; anon; cross-tenant file; non-existent = same shape;
  archived/deleted lifecycle gate; audit-row hygiene) is a NEW DB-backed INT scaffold
  (`file-signed-access.int.test.ts`).
- **Both-side link ownership + atomic rollback** (foreign file; foreign owner; happy; deferred
  owner_type; R-807 rollback via independent BYPASSRLS re-read) is a NEW DB-backed INT scaffold
  (`file-link-ownership.int.test.ts`).
- **Storage-plane negatives (the NEW class, R-805/R-806)** (Tenant-A cannot list/read/sign a
  Tenant-B object; path spoof; malformed non-uuid segment; anon denied; expired-URL) is a NEW
  dedicated storage-negative scaffold (`storage-object-isolation.rls.test.ts`), gated on the NEW
  storage-reachability probe (Task 8.6) so it never false-greens when the DB is up but Storage is down.
- **Pure storage helpers** (`deriveObjectPath` tenant-first + traversal/control-char sanitization;
  lifecycle-access-eligibility archived/deleted rejection) are a NEW `node --test` UNIT scaffold — the
  fast gate on every PR (the coverage-shape lesson: keep these decisions in pure `.ts`).

| AC | Scenario | Level | Priority | Test ID | Risk | Status here |
| --- | --- | --- | --- | --- | --- | --- |
| AC1 | `files`+`file_links` exist post-reset; direct `tenant_id` NOT NULL FK→tenants ON DELETE CASCADE | INT (migration-reset) | P0 | 8.1-INT-01 | R-801 | **Scaffolded (gated)** |
| AC1 | `files` composite `(id,tenant_id)` target + `unique (bucket_id, object_path)`; `file_links.file_id` COMPOSITE same-tenant FK→files(id,tenant_id) ON DELETE CASCADE (no bare `file_id` FK) | INT (migration-reset) | P0 | 8.1-INT-01 | R-802 | **Scaffolded (gated)** |
| AC1 | lifecycle_state / owner_type (Phase A closed union, NO deferred type) / purpose CHECKs; `size_bytes` bigint CHECK (null or >=0) | INT (migration-reset) | P0 | 8.1-INT-01 | R-801 | **Scaffolded (gated)** |
| AC1 | timestamps + REUSED `set_updated_at` trigger on both tables; NO broad file-index / document-center table | INT (migration-reset) | P0 | 8.1-INT-01 | R-801 | **Scaffolded (gated)** |
| AC2 | Cross-tenant SELECT/INSERT/UPDATE on `files`/`file_links` denied (rls-invisible + BYPASSRLS re-read) | RLS | P0 | 8.1-RLS-02 | R-801 | **Enrollment recipe (dev Task 7)** |
| AC3 | FOREIGN file id → TENANT_ACCESS_DENIED (envelope ownership gate, before execute) | INT (command) | P0 | 8.1-INT-02 | R-802 | **Scaffolded (gated)** |
| AC3 | FOREIGN owner id → TENANT_ACCESS_DENIED (owner-side own-tenant RLS SELECT, in execute) | INT (command) | P0 | 8.1-INT-02 | R-802 | **Scaffolded (gated)** |
| AC3 | own file + own owner SUCCEEDS + EXACTLY ONE `file.linked` audit row (allow-listed metadata) | INT (command) | P0/P1 | 8.1-INT-02 | R-801 | **Scaffolded (gated)** |
| AC3 | deferred owner_type (`quote_version`) rejected as not-yet-available | INT (command) | P0 | 8.1-INT-02 | R-814 | **Scaffolded (gated)** |
| AC4 | `tenant-files` bucket exists + `public = false`; NO public bucket | INT (migration-reset) | P0 | 8.1-INT-01 | R-803 | **Scaffolded (gated)** |
| AC4 | `deriveObjectPath` tenant-first invariant + traversal/control-char/embedded-slash sanitization; tenantId verbatim | UNIT (node --test) | P0 | 8.1-UNIT-01 | R-803,R-810 | **Scaffolded (gated)** |
| AC5 | happy own-tenant sign → signedUrl + expiresAt | INT (command) | P0 | 8.1-INT-03 | R-804 | **Scaffolded (gated)** |
| AC5 | anon sign → UNAUTHENTICATED; cross-tenant file → TENANT_ACCESS_DENIED; non-existent = SAME shape (no disclosure) | INT (command) | P0 | 8.1-INT-03 | R-804,R-809 | **Scaffolded (gated)** |
| AC5 | archived/deleted lifecycle → FILE_ACCESS_DENIED, before any createSignedUrl (metadata-first); pure eligibility helper rejects archived/deleted | INT (command) + UNIT | P0 | 8.1-INT-03, 8.1-UNIT-02 | R-804,R-810 | **Scaffolded (gated)** |
| AC5 | successful sign writes ONE `file.signed_access.created` audit row — NO path/bucket/URL/PII in metadata | INT (command) | P0 | 8.1-INT-03 | R-801 | **Scaffolded (gated)** |
| AC6 | Tenant-A cannot list/read/sign a Tenant-B `storage.objects` path; PATH SPOOF denied; malformed non-uuid segment denied; anon denied | RLS (storage-negative) | P0 | 8.1-RLS-01 | R-805 | **Scaffolded (gated)** |
| AC6 | expired signed URL no longer authorizes (low TTL) | RLS (storage-negative) | P0 | 8.1-RLS-01 | R-806 | **Scaffolded (gated)** |
| AC7 | atomic metadata+link RPC: mid-flow failure rolls back FULLY — no `files` orphan, no `file_links` row (BYPASSRLS re-read = zero) | INT (command) | P0 | 8.1-INT-04 | R-807 | **Scaffolded (gated)** |
| AC8 | `files`/`file_links` enrolled in `TENANT_TABLES`; H4 gate green | INT (gate) | P0 | 8.1-RLS-02 | R-801 | **Enrollment recipe (dev Task 7)** |
| AC8 | anon SELECT/INSERT/UPDATE on both tables denied (42501) | RLS | P0 | 8.1-RLS-02 | R-801 | **Enrollment recipe (dev Task 7)** |
| AC8 | per-table GRANTs (authed SELECT/INSERT/UPDATE; service_role DML; anon none) + RLS forced + `is_tenant_admin` policies | INT (migration-reset) | P0 | 8.1-INT-01 | R-801 | **Scaffolded (gated)** |
| AC8 | file audit events written through the EXISTING `audit_events` with allow-listed metadata (no path/PII/contents) | INT (command) | P0 | 8.1-INT-02/03 | R-801 | **Scaffolded (gated)** |

**Red-phase requirement confirmed:** every scenario asserts EXPECTED behavior (no
`expect(true).toBe(true)`); every command negative asserts the typed `CommandErrorCode`
(`TENANT_ACCESS_DENIED` / `FILE_ACCESS_DENIED` / `VALIDATION_FAILED` / `UNAUTHENTICATED`); the
cross-tenant vs not-found shape is asserted IDENTICAL (no existence disclosure — R-809); the
storage negatives assert the DENIAL MECHANISM (no signed URL / no bytes / empty listing), never a
vacuous disjunction; the atomic-rollback negative asserts ZERO leftover rows via an independent
BYPASSRLS re-read (no partial commit — R-807); the migration-reset schema/CHECK/policy asserts pin
the exact contract. All scaffolds are designed to FAIL before the Story 8.1 dev migration + RPC +
commands + storage config + helpers exist, and are kept `describe.skip` / `node --test` `{ skip: true }`
so they cannot false-red CI before then.

---

## Step 4 / 4C — Generated Scaffolds (RED PHASE)

**Placement (architecture §3/§22):** command scaffolds under `tests/integration/commands/`;
migration-reset + storage-negative scaffolds under `tests/integration/rls/`; pure helpers under
`tests/unit/server/storage/` — all already enrolled in `typecheck` and the respective runners. Tests
are NOT scattered in UI modules.

**Runner/skip idiom:** the skill's Playwright `test.skip()` red-phase idiom maps to this project's
established `describe.skip(...)` convention for Vitest INT/RLS files and the `test(name, { skip: true }, …)`
option for the `node --test` unit file. Each scaffold imports the EXISTING factories + envelope +
support gating (so it type-checks today) and declares the not-yet-built commands / storage helpers /
factory seeds / storage probe via a LOCAL `notYetImplemented()` placeholder that THROWS — so a
mistakenly un-skipped run fails LOUD rather than green-by-accident. The dev phase swaps the
placeholders for real imports and removes the skips.

### Files created

| File | Level | Suite state | Gating |
| --- | --- | --- | --- |
| `tests/unit/server/storage/object-path.test.ts` | UNIT (`node --test`) — `deriveObjectPath` tenant-first invariant + traversal/control-char/embedded-slash sanitization + tenantId-verbatim; `isAccessEligibleLifecycle` admits draft/linked/locked, rejects archived/deleted | `{ skip: true }` (6 tests) | Dev Task 4.1 / 8.8 (`@/server/storage/object-path` + lifecycle helper). |
| `tests/integration/rls/file-tables-migration-reset.int.test.ts` | INT (migration-reset) — both tables exist / direct-tenant FK cascade / `files` composite target + `unique (bucket_id, object_path)` / `file_links.file_id` composite same-tenant FK (no bare FK) / lifecycle+owner_type+purpose CHECKs / `size_bytes` bigint CHECK / timestamps+trigger / RLS forced / SELECT-INSERT-UPDATE-only policies / GRANTs / no-broad-file-index / private-bucket + no-public-bucket | `describe.skip` (16 tests) | Dev Tasks 1–2 (the `file_storage_foundation` migration + private bucket). |
| `tests/integration/commands/file-signed-access.int.test.ts` | INT (command) — happy sign + one audit row (clean metadata) / anon → UNAUTHENTICATED / cross-tenant + non-existent → TENANT_ACCESS_DENIED (same shape) / archived → FILE_ACCESS_DENIED (metadata-first, no URL) | `describe.skip` (7 tests) | Dev Tasks 2/4/5/7 (`createSignedFileAccess`, storage helper, `FILE_ACCESS_DENIED`, `adminInsertFile`). |
| `tests/integration/commands/file-link-ownership.int.test.ts` | INT (command) — foreign file / foreign owner → TENANT_ACCESS_DENIED / happy + one `file.linked` audit row / deferred owner_type rejected / atomic rollback (BYPASSRLS re-read = zero files + zero links) | `describe.skip` (5 tests) | Dev Tasks 2/5/6/7 (`createFileLink`, `create_file_with_link` RPC, `adminInsertFile`). |
| `tests/integration/rls/storage-object-isolation.rls.test.ts` | RLS (NEW storage-negative class) — Tenant-A cannot list/read/sign a Tenant-B object / path spoof denied / malformed non-uuid segment denied / anon denied / expired-URL (low TTL) | `describe.skip` (6 tests) | Dev Tasks 1/3/4/8.6 (bucket + `storage.objects` RLS + storage helper + `isLocalStorageReachable`/`skipUnlessStorage` + object-seed factory). |

**Verified state:** `pnpm typecheck` clean; `pnpm lint` clean (the single pre-existing warning is in
the unrelated `tests/unit/lib/money/vat.test.ts`); a targeted Vitest run reports **4 files skipped /
34 tests skipped** (0 failed, 0 errored); the `node --test` unit scaffold reports **6 skipped / 0
fail**. The scaffolds compile and register as red-phase pending without perturbing the green baseline.

### NOT created here (deliberate — see Step 3 rationale)

- **No new cross-tenant or anon RLS suite for `files`/`file_links`.** Those are DATA-DRIVEN over the
  shared `TENANT_TABLES` inventory. Enrolling the two tables is a DEV-phase edit (Task 7), not an
  ATDD scaffold, because the `assertNever` exhaustiveness guard + the live H4 introspection require
  the tables to exist; pre-enrolling now would turn the green H4 gate + negative suites red for the
  wrong reason.
- **No migration, no private-bucket config, no `storage.objects` RLS, no atomic RPC, no
  `src/server/storage/**`, no `src/server/commands/files/**`, no `FILE_ACCESS_DENIED` code, no
  factory seed bodies (`adminInsertFile`/`adminUploadStorageObject`), no `isLocalStorageReachable`/
  `skipUnlessStorage` probe, no `TENANT_TABLES` edit, no `migration-reset.int.test.ts` extension, no
  `config.toml`/`.env`/dependency change** — all DEV-phase / gated work. `nav-items.ts` untouched;
  `src/features/calculations/readiness.ts` untouched (the `REQUIRED_FILES_DEFERRED` warning stays in
  place — this story lands the FOUNDATION only).

### Dev-phase H4 enrollment recipe (Task 7 — pin so the hand-off is mechanical)

In `tests/integration/rls/tenant-table-inventory.ts`:
1. Add `"files"` and `"file_links"` to `TENANT_TABLES`.
2. Add a matching branch in ALL SIX `switch (table)` helpers — `spoofedRowFor`, `tenantBFilter`,
   `hijackMutationFor` (cross-tenant seam) AND `anonRowFor`, `anonFilterFor`, `anonMutationFor`
   (anon seam). The `assertNever(table)` default makes a missing branch a `pnpm typecheck` error by
   design — enrollment without metadata fails the typecheck.
3. Set `updateDenialKind = "rls-invisible"` for BOTH tables (authenticated HAS insert/update grant —
   the cross-tenant UPDATE denial is USING-invisibility: zero rows + BYPASSRLS-unchanged re-read, not
   a `42501`, the same case the calc/CRM tables use).
4. Spoofed/anon INSERT rows use FRESH `crypto.randomUUID()` ids (so denial is the privilege layer,
   never a `23505` PK collision). The `files` spoof carries Tenant B's `tenant_id` + a fresh
   `object_path`. The `file_links` spoof carries a Tenant-B `file_id` parent + a valid
   owner_type/purpose (per Task 7.2).
5. Add `tenantBFileId` / `tenantBFileLinkId` to `InventoryContext` (optional; seeded by the
   cross-tenant suite, omitted by the anon suite) and `adminInsertFile` / `adminInsertFileLink` seed
   helpers to `tests/factories/tenants.ts` (BYPASSRLS superuser path, mirror `adminInsertCalculation`)
   so the cross-tenant negatives target a CONCRETE Tenant-B row, never a vacuous non-existent id.
6. The H4 gate (`rls-inventory-gate.int.test.ts`) will FAIL-LOUD on the two new tables the moment the
   migration lands and BEFORE enrollment — the EXPECTED "register the table" signal, not a bug (esp.
   the ANON seam — the easiest-to-forget obligation). After steps 1–5 it goes green; the data-driven
   cross-tenant + anon suites then cover the two tables automatically.

### Dev-phase `migration-reset.int.test.ts` extension (Task 8.2 — GUARANTEED break, by design)

The EXISTING `tests/integration/rls/migration-reset.int.test.ts` asserts the COMPLETE policy set as
an EXACT enumeration. The `files`/`file_links` SELECT/INSERT/UPDATE policies (and the new
`storage.objects` policies) break it — this WILL fail-loud when the migration lands (the same signal
Stories 3.1/5.1 hit). EXTEND it (do NOT weaken to a loose superset): add the two tables ×
SELECT/INSERT/UPDATE to the expected EXACT set, add the `storage.objects` SELECT/INSERT/UPDATE
policies, and add the two tables to the exists + RLS-enabled-and-forced checks, keeping the
"no DELETE policy anywhere on the new tables" invariant satisfied. The new
`file-tables-migration-reset.int.test.ts` scaffold already pins the `public`-schema half of this
contract; `storage-object-isolation.rls.test.ts` pins the `storage.objects` behavior half.

### Dev-phase storage-reachability probe (Task 8.6 — the retro-note R-2 gap)

`storage-object-isolation.rls.test.ts` gates on a DEDICATED `isLocalStorageReachable()` +
`skipUnlessStorage(ctx, storageUp)` (currently a `notYetImplemented()` placeholder). The dev phase
adds `isLocalStorageReachable()` to `tests/support/test-env.ts` (probe the storage health/list
endpoint, e.g. `GET {url}/storage/v1/bucket`) and `skipUnlessStorage` to `tests/support/stack-gate.ts`
(mirror `skipUnlessStack`: VISIBLE skip locally, HARD failure under `SUPABASE_TEST_REQUIRED=1`), then
imports them + `adminUploadStorageObject` (BYPASSRLS object-seed factory) and drops the placeholder +
`.skip`. Without this, the storage suite would false-green when the DB is up but Storage is down.

**TDD red-phase compliance check (Step 4C validation):**

- [x] All new INT/RLS suites use `describe.skip`; the unit tests use `node --test` `{ skip: true }` —
      none can fail CI before the dev migration + RPC + commands + storage config + helpers exist.
- [x] All assertions encode expected behavior — no `expect(true).toBe(true)` placeholders.
- [x] All command negatives assert the typed MECHANISM (`TENANT_ACCESS_DENIED` / `FILE_ACCESS_DENIED`
      / `UNAUTHENTICATED` / `VALIDATION_FAILED`); cross-tenant vs not-found asserted IDENTICAL shape;
      the storage negatives assert no-signed-URL / no-bytes / empty-listing; the atomic-rollback
      negative asserts zero leftover rows via a BYPASSRLS re-read — no vacuous disjunction anywhere.
- [x] All scaffolds are expected-to-fail (the migration, bucket, RPC, commands, storage helpers,
      `FILE_ACCESS_DENIED`, factory seeds, and storage probe do not exist yet).
- [x] Each not-yet-built surface is a LOUD `notYetImplemented()` throw, not a hollow green stub.
- [x] `pnpm typecheck` + `pnpm lint` clean; targeted Vitest run = 4 files / 34 tests skipped;
      `node --test` unit run = 6 skipped, 0 failed/errored.

---

## Acceptance Criteria Coverage Summary

- **AC1** (schema reset; direct `tenant_id` FK cascade; composite `(id,tenant_id)` target +
  `unique(bucket_id,object_path)`; composite same-tenant `file_links.file_id` FK; lifecycle/owner_type/
  purpose CHECKs; `size_bytes`; NO broad file-index table): `file-tables-migration-reset.int.test.ts`
  (gated).
- **AC2** (cross-tenant DB isolation — read/link/update/archive/delete denied, generic denial):
  carried by the Task-7 `TENANT_TABLES` enrollment (recipe above); the data-driven cross-tenant +
  anon suites cover it once the tables exist + are enrolled.
- **AC3** (both-side link ownership — foreign file OR foreign owner → `TENANT_ACCESS_DENIED`; deferred
  owner_type rejected): `file-link-ownership.int.test.ts` (gated).
- **AC4** (private bucket + server-derived paths; no public bucket / no client-controlled path):
  the private-bucket + no-public-bucket asserts in `file-tables-migration-reset.int.test.ts` +
  `deriveObjectPath` tenant-first/sanitization in `object-path.test.ts` (both gated).
- **AC5** (signing funnel — membership + ownership + lifecycle BEFORE the signed URL; anon/cross-tenant/
  spoof rejected with generic user-safe errors): `file-signed-access.int.test.ts` (gated) +
  `isAccessEligibleLifecycle` in `object-path.test.ts` (gated).
- **AC6** (storage-plane negatives — cross-tenant list/read/sign + path spoof denied by
  `storage.objects` RLS; expired URL rejected): `storage-object-isolation.rls.test.ts` (gated, the NEW
  storage-negative class + storage-reachability probe).
- **AC7** (atomic metadata+link RPC — full rollback on mid-flow failure, no orphan/dangling row):
  the rollback assertion in `file-link-ownership.int.test.ts` (gated), proving zero leftover
  `files`/`file_links` via an independent BYPASSRLS re-read.
- **AC8** (enrollment + audit + no-secrets — `files`/`file_links` in `TENANT_TABLES`, H4 gate green;
  signed-access-created / link-created events via the EXISTING `audit_events` with allow-listed
  metadata only): the GRANT/RLS/policy half + audit-hygiene asserts are in the migration-reset +
  command scaffolds (gated); the enrollment + gate-green half is the Task-7 dev recipe (the gate
  fails-loud until enrolled — the STANDING CONTRACT).

---

## Step 5 — Validation & Completion

**Validation checklist:**

- [x] Prerequisites assessed; the inherited foundation (runner/stack/factories/envelope/clock/audit/
      H4 gate/unit runner/reachability+skip helpers) confirmed present — only the Story 8.1 migration
      + bucket + `storage.objects` RLS + RPC + commands + `FILE_ACCESS_DENIED` + storage helpers +
      factory seeds + storage probe are absent, so scaffolds are gated on the dev phase (no HALT, no
      invented runner, no migration written here).
- [x] Test files created in the architecture-aligned tree (`tests/integration/commands/`,
      `tests/integration/rls/`, `tests/unit/server/storage/`), not scattered in UI modules (§22).
- [x] Checklist maps every AC (1–8) to a level + priority + test ID + risk + current status.
- [x] All tests designed to fail before implementation (red phase) and kept skipped.
- [x] No browser/CLI sessions opened (backend story); no orphaned browsers.
- [x] Checklist stored under `{test_artifacts}/` (this file); scaffolds under `tests/`.
- [x] **No migration, no bucket config, no `storage.objects` RLS, no atomic RPC, no `src/**`, no
      `FILE_ACCESS_DENIED` edit, no `config.toml`/`.env`/dependency, no `TENANT_TABLES` edit, no
      `migration-reset.int.test.ts` extension, no storage-probe body, no `nav-items.ts`/`readiness.ts`
      change.** Verified — all are DEV-phase/gated.
- [x] Gate sweep on the scaffolds: `pnpm typecheck` clean, `pnpm lint` clean, targeted Vitest run =
      4 files / 34 tests skipped, `node --test` unit = 6 skipped, 0 failed/errored (green baseline
      unperturbed).

**Out of ATDD scope (dev-phase / other-story work — intentionally NOT scaffolded here):**

- The `file_storage_foundation` migration, the private `tenant-files` bucket + `storage.objects` RLS,
  the `create_file_with_link` RPC (ADR-A009), the `createSignedFileAccess`/`createFileLink` commands +
  pure validators, the `src/server/storage/*` helpers, the `FILE_ACCESS_DENIED` code, and the file
  factory seeds (Story 8.1 dev Tasks 1–6) — the scaffolds' green-phase counterparts.
- `TENANT_TABLES` enrollment of the two tables + the six metadata branches + `updateDenialKind`
  (dev Task 7; recipe pinned above) — must be a dev edit because of the `assertNever` typecheck guard
  + live H4 introspection.
- The `isLocalStorageReachable()` + `skipUnlessStorage()` storage-reachability probe +
  `adminUploadStorageObject` object-seed factory (dev Task 8.6; the retro-note R-2 gap — pinned above).
- Extending the existing `migration-reset.int.test.ts` exact-policy enumeration (dev Task 8.2; the
  break is GUARANTEED and pinned above).
- The fixture PII/secret scan extension (dev Task 9); the `.env.example` TTL wording tidy (optional,
  dev Task); upload UI / entity file panels / MIME-size UX (8.2), preview/download UX + full storage
  matrix polish (8.3), attachment locks (8.4), the `/files` index (8.5), quote PDF generation (6.3).

**Key assumptions / risks:**

- **Command / input shapes** (`createSignedFileAccess({ file_id })` → `{ signedUrl, expiresAt }` on
  `result.data`; `createFileLink({ file_id, owner_type, owner_id, purpose })`;
  `eventType: "file.signed_access.created"` / `"file.linked"`) are the SCAFFOLD'S assumed contract,
  drawn from story Task 5 + architecture §5. If the dev phase chooses different literals, the
  assertion strings / input keys are the only edit — the behavior contract (metadata-first ownership,
  lifecycle gate, one audit row, typed generic codes, both-side ownership, full atomic rollback,
  storage-plane isolation) is unchanged.
- **`FILE_ACCESS_DENIED` does NOT exist in `command-errors.ts` yet** — the archived-lifecycle
  assertion pins that dev Task 5.4 adds it (per Open Question 2's default: `TENANT_ACCESS_DENIED` for
  cross-tenant/ownership; `FILE_ACCESS_DENIED` for a lifecycle rejection on an OWNED file). Either way
  the cross-tenant vs not-found shape stays IDENTICAL (no disclosure). If the owner elects to reuse
  `TENANT_ACCESS_DENIED` for the lifecycle case, only that one assertion's expected code changes.
- **Storage helper module names** (`@/server/storage/object-path`, a lifecycle-eligibility helper) and
  the storage-object seed / probe helper names are the scaffold's assumed surface — the import lines
  are the only edit if the dev phase names them differently; the contract does not move.
- **Atomic-rollback failure injection** — the scaffold pins the ASSERTION contract (zero leftover
  `files` + zero leftover `file_links` via BYPASSRLS re-read); the concrete mid-flow failure trigger
  is left for the dev phase to wire to the final `create_file_with_link` signature (noted inline).
- **Single shared private bucket (`tenant-files`) + `{tenant_id}/…` path prefix** (Open Question 1
  default) is assumed throughout. A per-tenant-bucket decision would change the bucket + storage-RLS
  asserts — a Stop Condition surfaced to the owner, not a silent rewrite.
- **Storage suite requires the Storage service, not just the DB** — the dedicated reachability probe
  is load-bearing; without it the suite false-greens locally. Pinned as dev Task 8.6.

## Next Steps (TDD Green Phase — Story 8.1 dev)

1. **Land the migration + private bucket (Tasks 1–2):** `supabase/migrations/20260704120000_file_storage_foundation.sql`
   + the `[storage.buckets.tenant-files]` config (private) + the belt-and-braces bucket insert;
   `supabase db reset` from empty must succeed → un-skip `file-tables-migration-reset.int.test.ts`.
2. **Add the `storage.objects` RLS (Task 3)** scoped by `bucket_id = 'tenant-files'` + the first
   path-segment `::uuid` cast through `public.is_tenant_admin`.
3. **Land the atomic RPC + storage helpers + commands (Tasks 4–6):** `create_file_with_link`
   (SECURITY INVOKER), `src/server/storage/{object-path,signed-access}.ts` + the lifecycle helper,
   `src/server/commands/files/{validation,index}.ts` + `createSignedFileAccess`/`createFileLink`, and
   `FILE_ACCESS_DENIED` in `command-errors.ts` → swap the `notYetImplemented()` placeholders for real
   `@/server/*` imports, remove the `.skip`/`{ skip }`, make GREEN.
4. **Extend the factories + storage probe (Tasks 7/8.6):** `adminInsertFile`/`adminInsertFileLink` +
   `adminUploadStorageObject` in `tests/factories/tenants.ts`; `isLocalStorageReachable` in
   `tests/support/test-env.ts` + `skipUnlessStorage` in `tests/support/stack-gate.ts` → replace the
   placeholders in the command + storage-isolation scaffolds.
5. **Enroll in the H4 inventory (Task 7):** add the two tables + the six metadata branches +
   `updateDenialKind = "rls-invisible"` to `tenant-table-inventory.ts` (recipe above) → the H4 gate +
   cross-tenant + anon suites go green for the two tables automatically (the gate fails-loud until
   enrolled — expected, esp. the anon seam).
6. **Extend `migration-reset.int.test.ts` (Task 8.2):** add the `files`/`file_links` +
   `storage.objects` policies to the EXACT enumeration + the tables to the exists/RLS checks (the
   GUARANTEED break).
7. **Recommended follow-on workflows:** `*automate` after the schema + commands land to broaden
   coverage; `*trace` at the Epic 8 boundary for the traceability matrix + gate decision (surfacing
   the storage-negative class + storage-reachability probe as the new-this-epic evidence).

---

**Generated by:** BMad TEA Agent — `bmad-testarch-atdd` (Create mode) · TDD RED PHASE
