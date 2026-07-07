---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-strategy',
    'step-04-generate-tests',
    'step-04c-aggregate',
  ]
lastStep: 'step-04c-aggregate'
lastSaved: '2026-07-07'
workflowType: 'testarch-atdd'
inputDocuments:
  - _bmad-output/implementation-artifacts/8-2-validated-upload-and-entity-file-panels.md
  - _bmad-output/test-artifacts/test-design-epic-8.md
  - _bmad/tea/config.yaml
  - src/server/commands/files/validation.ts
  - src/server/commands/files/files.ts
  - src/server/commands/quotes/generate-pdf.ts
  - tests/integration/commands/file-link-ownership.int.test.ts
  - tests/integration/commands/generate-quote-pdf-retry-consistency.int.test.ts
  - tests/factories/tenants.ts
  - tests/support/stack-gate.ts
  - tests/support/test-env.ts
  - tests/e2e/crm/customers.e2e.spec.ts
  - tests/e2e/quotes/quote-pdf-states.e2e.spec.ts
---

# ATDD Checklist - Epic 8, Story 8.2: Validated Upload And Entity File Panels

**Date:** 2026-07-07
**Author:** Rasmus
**Primary Test Level:** Integration (DB-backed, `SUPABASE_TEST_REQUIRED=1`) + pure `node:test` units; E2E for the panel UX

---

## Story Summary

Story 8.2 adds the FIRST generic user-facing upload path (choose a file → server-validate
MIME/size/owner/purpose/lifecycle → write a private tenant-first object → persist `files`
+ `file_links` with 6.3's verified-compensated consistency) plus the per-entity file panels.
It generalizes 6.3's proven object-byte upload discipline into a reusable path and reuses
the single 8.1 file model (R-814 STOP — no competing model).

**As a** tenant admin
**I want** to upload files in-context with server-side validation and clear per-error feedback
**So that** each file has a clear owner/purpose/validation-state and no user controls a raw
storage path or bypasses the MIME/size/ownership gate.

---

## Acceptance Criteria

1. **AC1** — Entity file panel shows allowed types/size/owner/purpose; user never controls a
   raw storage path (object path 100% server-derived). (R-803)
2. **AC2** — Server-side upload validation gate: MIME/size/tenant-ownership/owner/purpose/
   lifecycle validated server-side BEFORE usable; a blocked/oversized/foreign-owner/wrong-
   lifecycle request is rejected even when the client is bypassed. (R-808)
3. **AC3** — Four DISTINCT user-safe error states (blocked-type / too-large / network-or-
   server-fail / permission-fail); cross-tenant/permission failures do not disclose whether
   another tenant's file exists (identical generic shape). (R-809, R-811)
4. **AC4** — Storage↔DB compensation: a mid-flow object-write-success / metadata-failure
   leaves a consistent, retryable state with no orphan; compensating cleanup/archive path
   (archive-over-delete). (R-807 storage side)
5. **AC5** — Uploaded own-tenant file becomes attachable: persisted `lifecycle_state='linked'`
   + a `file_links` row bound to the owner (via the shared 8.1 model); the panel lists the
   entity's existing own-tenant links only.

---

## Test Strategy (AC → level → priority)

| AC | Risk | Scenario | Level | Priority | Scaffold |
| --- | --- | --- | --- | --- | --- |
| AC2 | R-808 | MIME allow-list boundaries; size limit boundaries (at/over); policy ≤ config bound | Unit | P0 | `upload-policy.test.ts` |
| AC3 | R-809/R-811 | Four-state error classifier — every branch; cross-tenant → generic PERMISSION | Unit | P0 | `upload-error-classifier.test.ts` |
| AC2 | R-808 | `validateUploadFile` accept/reject: blocked-MIME, oversized, foreign-shape, unknown owner-type, owner↔purpose mismatch; client path/tenant stripped | Unit | P0 | `validate-upload-file.test.ts` |
| AC2/AC5 | R-808/R-814 | Valid upload SUCCEEDS own-tenant (files linked + file_links + object) across all 6 ACTIVE owner types | Integration | P0 | `file-upload.int.test.ts` |
| AC2 | R-808 | Blocked-MIME + oversized rejected VALIDATION_FAILED server-side with client bypassed | Integration | P0 | `file-upload.int.test.ts` |
| AC2 | R-802 | Foreign-owner id → TENANT_ACCESS_DENIED (owner-side, both-side) | Integration | P0 | `file-upload.int.test.ts` |
| AC3 | R-809 | Cross-tenant owner AND non-existent owner → identical generic denial | Integration | P0 | `file-upload.int.test.ts` |
| AC4 | R-807 | Metadata-fail after object write → consistent retryable state, no usable orphan, real retry succeeds | Integration | P1 | `file-upload.int.test.ts` |
| AC1 | R-803/R-811 | Panel shows allowed types/size/owner/purpose; NO raw-path field; existing-files list | E2E | P1 | `entity-file-panel.e2e.spec.ts` |
| AC3 | R-811 | Four distinct `role="alert"` error regions with distinct data-testids (blocked-type drivable) | E2E | P1 | `entity-file-panel.e2e.spec.ts` |

**Generation mode:** AI generation (fullstack, backend-heavy; the security-critical gate +
compensation are DB-backed INT + pure units — no browser recording needed). E2E authored
from the established `signIn`/`waitForHydrated` + `getByTestId` fixture contract.

**Duplicate-coverage avoidance:** the server MIME/size gate + storage↔DB consistency are
proven ONLY at INT/Unit; E2E asserts panel STRUCTURE + error-state a11y, never re-proves the
server gate. PDF/file CONTENT is never asserted in E2E.

---

## Failing Tests Created (RED Phase)

### Unit Tests (node:test, pure — 24 tests across 3 files)

**File:** `tests/unit/server/storage/upload-policy.test.ts` (6 tests)

- ✅ **[8.2-UNIT-01a] isAllowedMimeType accepts pilot allow-list / rejects blocked+garbage**
  - **Status:** RED — `@/server/storage/upload-policy` does not exist yet (Task 1.1).
  - **Verifies:** AC2 conservative MIME allow-list is a closed, non-empty, self-consistent set.
- ✅ **[8.2-UNIT-01b] isWithinSizeLimit boundary (at/over, zero/negative)**
  - **Status:** RED — missing module.
  - **Verifies:** AC3 size gate boundary correctness.
- ✅ **[8.2-UNIT-01c] policy max ≤ config.toml 50MiB bucket bound**
  - **Status:** RED — missing constant.
  - **Verifies:** R-817 the server policy never exceeds the storage outer bound.

**File:** `tests/unit/server/storage/upload-error-classifier.test.ts` (7 tests)

- ✅ **[8.2-UNIT-02a/b] VALIDATION_FAILED disambiguated to BLOCKED_TYPE / TOO_LARGE via pre-check**
  - **Status:** RED — `@/server/storage/upload-error-classifier` does not exist yet (Task 1.2).
  - **Verifies:** AC3 the two validation error states are distinct.
- ✅ **[8.2-UNIT-02c/d] TENANT_ACCESS_DENIED + FILE_ACCESS_DENIED → generic PERMISSION**
  - **Status:** RED — missing module.
  - **Verifies:** R-809 no existence-disclosure (foreign vs not-found collapse to one state).
- ✅ **[8.2-UNIT-02e] SERVER_ERROR → NETWORK_OR_SERVER (retryable, not a denial)**
  - **Status:** RED — missing module.
  - **Verifies:** AC3 transient-vs-permanent discipline.
- ✅ **[8.2-UNIT-02f] every branch yields one of the four states; unknown code degrades safely**
  - **Status:** RED — missing module.
  - **Verifies:** AC3/R-809 exhaustive, safe classification.

**File:** `tests/unit/server/commands/files/validate-upload-file.test.ts` (11 tests)

- ✅ **[8.2-UNIT-03a] valid own-shape input ACCEPTS with narrowed value**
  - **Status:** RED — `validateUploadFile` / `UploadFileInput` not exported from `validation.ts` (Task 2.1).
  - **Verifies:** AC2 the validator narrows a valid input.
- ✅ **[8.2-UNIT-03b/c/d/e] blocked-MIME / oversized / bad-shape / unknown-owner-type → VALIDATION_FAILED**
  - **Status:** RED — missing export.
  - **Verifies:** AC2 reject cases; the deferred-module STOP.
- ✅ **[8.2-UNIT-03f] owner_type↔purpose mismatch rejects; correct pairs accept**
  - **Status:** RED — missing export.
  - **Verifies:** AC2 the coupling rule (Task 2.3).
- ✅ **[8.2-UNIT-03g] client tenant_id/object_path/bucket_id NOT surfaced (server-derived only)**
  - **Status:** RED — missing export.
  - **Verifies:** AC1/R-803 the client never controls the path.

### Integration Tests (Vitest, DB-backed — `file-upload.int.test.ts`)

**File:** `tests/integration/commands/file-upload.int.test.ts` (~16 tests incl. `describe.each` over 6 owner types)

- ✅ **[8.2-INT-01] valid upload SUCCEEDS own-tenant (files linked + file_links row + object) × 6 owner types**
  - **Status:** RED — `uploadFile` not exported from `@/server/commands/files` (Task 3).
  - **Verifies:** AC2/AC5/R-814; closes the 7.3→8.2 `job` owner write-path gap (deferred-work §7-3).
- ✅ **[8.2-INT-03] foreign owner id → TENANT_ACCESS_DENIED × 6 owner types**
  - **Status:** RED — missing command.
  - **Verifies:** R-802 owner-side (both-side).
- ✅ **[8.2-INT-02] blocked-MIME + oversized rejected VALIDATION_FAILED server-side (client bypassed)**
  - **Status:** RED — missing command.
  - **Verifies:** AC2/R-808 the server is the authority.
- ✅ **[8.2-INT-04] cross-tenant AND non-existent owner return the SAME generic denial**
  - **Status:** RED — missing command.
  - **Verifies:** R-809 no existence-disclosure at the upload path.
- ✅ **[8.2-INT-05] metadata-fail after object write → consistent retryable state, no orphan, retry succeeds**
  - **Status:** RED — missing command + compensation helper (Task 3.3/3.4).
  - **Verifies:** AC4/R-807 verified-compensated consistency (archive-over-delete).

### E2E Tests (Playwright — `entity-file-panel.e2e.spec.ts`)

**File:** `tests/e2e/files/entity-file-panel.e2e.spec.ts` (3 tests)

- ✅ **[8.2-E2E-01] panel shows allowed types/size/owner/purpose; NO raw-path field**
  - **Status:** RED — `EntityFilePanel` + its data-testids not wired onto the customer page (Task 5).
  - **Verifies:** AC1/R-803/R-811.
- ✅ **[8.2-E2E-01] panel lists the entity's existing own-tenant linked files**
  - **Status:** RED — missing panel + `readEntityFiles` (Task 4.1/5).
  - **Verifies:** AC5.
- ✅ **[8.2-E2E-02] four distinct role="alert" error regions; blocked-type renders as accessible alert**
  - **Status:** RED — missing panel + error-state regions.
  - **Verifies:** AC3/R-811 (non-color text cue, keyboard-operable).

---

## Data Factories (REUSE / EXTEND — do NOT reinvent)

Reuse the existing `tests/factories/tenants.ts` helpers; **EXTEND** for the upload bytes.

- `createTwoTenantFixture` / `makeAuthedServerClient` / `cleanupFixture` — the two-tenant harness.
- `adminInsertCustomer` / `adminInsertFacility` / `adminInsertContact` / `adminInsertCalculation`
  / `adminInsertQuote` / `adminInsertQuoteVersion` / `adminInsertQuoteAcceptance` / `adminInsertJob`
  — seed own + foreign owner records for every ACTIVE owner type.
- `adminUploadStorageObject` — already present (INT compensation object seeding, if needed).
- **EXTEND (Task 6.4):** the INT scaffold generates valid-PDF / blocked-type / oversized **bytes at
  test time** in-file (`validPdfBytes()` / `blockedTypeBytes()` / `oversizedBytes()`). If dev prefers
  a shared factory, promote them to `tests/factories/tenants.ts` — keep them TEST-TIME generated,
  never committed as customer data (R-819; keep the PII/secret+ORGNR golden scan green).

---

## Mock / Seam Requirements

- **Storage-success / DB-failure seam (8.2-INT-05):** the scaffold wraps the RLS client with a
  `withFailingMetadataInsert` Proxy that fails the `files` metadata insert AFTER a real object
  upload (mirrors the 6.3 `withFailingUpload` proxy in
  `generate-quote-pdf-retry-consistency.int.test.ts`). The exact proxy target depends on the
  Task-3 helper (`upload-object.ts`) — adjust the seam if dev's insert call-shape differs; keep
  the CONSISTENCY assertion unchanged.
- **E2E error-state drivers:** blocked-type is client-drivable (a disallowed extension/mime). The
  too-large / network-or-server / permission states need a Task-7.2 deterministic driver; author
  them as the dev exposes the action-state seam (mark `test.fixme` rather than flaky if not yet
  drivable).

---

## Required data-testid Attributes (Task 5.1 — for E2E stability)

### EntityFilePanel (customer detail page + the other ACTIVE entity pages)

- `entity-file-panel` — the panel root.
- `file-panel-allowed-types` — the allowed-types display string.
- `file-panel-size-limit` — the size-expectation display string.
- `file-panel-owner` — the owning entity name.
- `file-panel-purpose` — the purpose label.
- `file-panel-existing-list` — the existing own-tenant linked-files list region.
- `file-input` — the file `<input>` upload control.
- `file-upload-submit` — the upload submit control.
- `file-error-blocked-type` — `role="alert"` region for BLOCKED_TYPE.
- `file-error-too-large` — `role="alert"` region for TOO_LARGE.
- `file-error-network-or-server` — `role="alert"` region for NETWORK_OR_SERVER.
- `file-error-permission` — `role="alert"` region for PERMISSION.

There must be **NO** `file-object-path-input` / `file-bucket-input` (asserted absent — R-803).

**Implementation example:**

```tsx
<section data-testid="entity-file-panel">
  <p data-testid="file-panel-allowed-types">Tillåtna filtyper: PDF, PNG, JPG</p>
  <p data-testid="file-panel-size-limit">Max storlek: {maxMib} MB</p>
  <input data-testid="file-input" type="file" />
  <button data-testid="file-upload-submit">Ladda upp</button>
  {state.error === "BLOCKED_TYPE" && <div role="alert" data-testid="file-error-blocked-type">…</div>}
</section>
```

---

## Implementation Checklist (RED → GREEN)

### Task 1 — pure upload policy + classifier

- [ ] Create `src/server/storage/upload-policy.ts`: `isAllowedMimeType`, `isWithinSizeLimit`,
      `MAX_UPLOAD_SIZE_BYTES` (≤ 50MiB), `ALLOWED_MIME_TYPES`.
- [ ] Create `src/server/storage/upload-error-classifier.ts`: `classifyUploadError({ code, precheck })`
      → `UploadErrorState`; cross-tenant/foreign/not-found → generic `PERMISSION`.
- [ ] Run: `pnpm run test:unit` → `upload-policy.test.ts` + `upload-error-classifier.test.ts` GREEN.

### Task 2 — `validateUploadFile`

- [ ] Add `validateUploadFile(raw)` + `UploadFileInput` to `src/server/commands/files/validation.ts`
      (reuse `isOwnerType`/`isFilePurpose`/`isUuidLike`; enforce owner↔purpose coupling; strip client path/tenant).
- [ ] Run: `pnpm run test:unit` → `validate-upload-file.test.ts` GREEN.

### Task 3 — `uploadFile` command + shared upload helper

- [ ] Add `uploadFile = defineCommand<UploadFileInput, UploadFileResult>` to `files.ts` (envelope
      ownership verifies the OWNER record; copy `generate-pdf.ts:205-322` ordering verbatim; RLS client only).
- [ ] Extract the shared id-up-front → object-write → verified-compensated-metadata helper
      (`src/server/storage/upload-object.ts`); do NOT change the 8.1 RPC signature (ADR gate).
- [ ] Export `uploadFile` from `src/server/commands/files/index.ts`.
- [ ] Run: `pnpm run test:int` (with `SUPABASE_TEST_REQUIRED=1`) → `file-upload.int.test.ts` GREEN.

### Task 4/5 — read layer + action + panel

- [ ] `src/features/files/read.ts` (`readEntityFiles`, RLS client, no raw object_path to UI).
- [ ] `src/features/files/actions.ts` (`uploadFileAction`, `useActionState`, four-state mapping via the classifier).
- [ ] `src/components/files/EntityFilePanel.tsx` with the data-testids above; wire onto the ACTIVE entity pages.
- [ ] Run: `pnpm run test:e2e` → `entity-file-panel.e2e.spec.ts` GREEN (wire remaining error-state drivers).

**Estimated effort:** ~2–3 dev-days (command + compensation + panel + wiring).

---

## Running Tests

```bash
# All pure units for this story
pnpm run test:unit -- tests/unit/server/storage/upload-policy.test.ts \
  tests/unit/server/storage/upload-error-classifier.test.ts \
  tests/unit/server/commands/files/validate-upload-file.test.ts

# The DB-backed INT suite (forces the storage-negative class to run)
SUPABASE_TEST_REQUIRED=1 pnpm run test:int -- file-upload.int.test.ts

# The panel E2E
pnpm run test:e2e -- entity-file-panel

# Full gates (as CI runs them)
pnpm run typecheck && pnpm run test:unit && pnpm run test:int && pnpm run test:e2e
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

- ✅ All scaffolds written and failing for the RIGHT reason (missing Story-8.2 modules/exports,
  not test bugs).
- ✅ Reuse-first: extends the existing envelope/factories/fixtures; no competing model (R-814).
- ✅ data-testid + seam requirements documented for the dev.
- ✅ Implementation checklist maps each red test to its Task.

**Verification evidence** — see the Test Execution Evidence section (units run and fail on the
missing modules; INT/E2E red-fail at import/DOM on the missing `uploadFile` command + panel).

### GREEN Phase (DEV — next)

Work one task at a time (Task 1 → 2 → 3 → 4/5). Run the mapped test after each; check it off when
GREEN. Minimal implementation, reuse the named 8.1/6.3 surfaces.

### REFACTOR Phase (after GREEN)

Reconcile the shared upload helper so both 8.2 and (optionally, later) 6.3 can call it (deferred-work
§6-3); do not destructively refactor 6.3 in this story. Keep all 8.1 assertions + the service-role
containment guards green.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Command:** `pnpm run test:unit -- <the three new unit files>`

**Result (2026-07-07):** all three unit scaffolds FAIL for the intended reason:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'src/server/storage/upload-policy'
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'src/server/storage/upload-error-classifier'
SyntaxError: '@/server/commands/files/validation' does not provide an export 'validateUploadFile'
ℹ pass 0   ℹ fail (all)   → ✅ RED verified (missing implementation, not a test bug)
```

**Typecheck (`npx tsc --noEmit`)** reports exactly the expected not-yet-built symbols and nothing
else on the new files:

```
file-upload.int.test.ts: '@/server/commands/files' has no exported member 'uploadFile'
validate-upload-file.test.ts: no exported member 'validateUploadFile' / 'UploadFileInput'
upload-error-classifier.test.ts: Cannot find module '@/server/storage/upload-error-classifier'
upload-policy.test.ts: Cannot find module '@/server/storage/upload-policy'
```

INT + E2E scaffolds require the local Supabase stack + built app to execute; they red-fail at
import (`uploadFile`) / DOM (`entity-file-panel` testid) until Tasks 3/5 land — the standard
red-phase state for this repo's committed scaffolds (as `file-link-ownership.int.test.ts` was
before 8.1 dev).

**Summary:**

- New test files: 4 (3 unit, 1 INT, 1 E2E) → `24` unit assertions + `~16` INT + `3` E2E scaffolds.
- Passing: 0 (expected). Failing/red: all (expected). Status: ✅ RED phase verified.

---

## Notes

- The 5 typecheck errors this adds are the intended red-phase signal and will clear as Story 8.2
  dev lands its own tasks — mirroring how 8.1's `file-link-ownership.int.test.ts` sat red before 8.1.
- Deferred-work items addressed by these scaffolds: 7.3→8.2 `job` owner write-path proof
  (8.2-INT-01/03 job branch); 8.1-iter2→8.2 `draft→linked` transition (8.2-INT-01 asserts
  `lifecycle_state='linked'`); 8.1→later archive-over-delete honored in the 8.2-INT-05 orphan
  assertion. `readiness.ts` wiring is intentionally NOT covered (owner-gated; out of scope).
- The E2E's non-blocked error states (too-large / network / permission) need a deterministic driver
  from Task 7.2; author them as `test.fixme` if a driver is not yet available rather than flaky.

---

**Generated by BMad TEA Agent** — 2026-07-07
