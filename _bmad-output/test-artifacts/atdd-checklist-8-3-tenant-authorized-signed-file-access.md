---
stepsCompleted:
  [
    'step-01-preflight-and-context',
    'step-02-generation-mode',
    'step-03-test-strategy',
    'step-04-generate-tests',
    'step-05-validate-and-complete',
  ]
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-07-07'
workflowType: 'testarch-atdd'
inputDocuments:
  - _bmad-output/implementation-artifacts/8-3-tenant-authorized-signed-file-access.md
  - _bmad-output/test-artifacts/test-design-epic-8.md
  - _bmad-output/test-artifacts/atdd-checklist-8-2.md
  - _bmad/tea/config.yaml
  - src/server/commands/files/files.ts
  - src/server/storage/signed-access.ts
  - src/features/jobs/evidence-preview-state.ts
  - src/features/jobs/actions.ts
  - src/features/files/actions.ts
  - src/features/files/read.ts
  - src/components/files/EntityFilePanel.tsx
  - src/components/jobs/JobEvidenceLink.tsx
  - tests/integration/commands/file-signed-access.int.test.ts
  - tests/unit/features/files/upload-action-state.test.ts
  - tests/e2e/files/entity-file-panel.e2e.spec.ts
  - tests/factories/tenants.ts
---

# ATDD Checklist - Epic 8, Story 8.3: Tenant-Authorized Signed File Access

**Date:** 2026-07-07
**Author:** Rasmus
**Detected stack:** fullstack (Next.js/React 19 + Supabase; `test_stack_type: auto`)
**Generation mode:** AI generation (sequential, single-agent). The security-critical funnel is
ALREADY proven at INT (8.1); 8.3 adds a pure decision module (`node --test` units), a
refresh-reauthorization INT matrix on the SAME command, and the preview/download E2E UX. No
browser recording needed — E2E authored from the established `signIn`/`waitForHydrated` +
`getByTestId` fixture contract (mirrors the 8.2 panel E2E).
**Primary Test Level:** Pure `node:test` units (the expiry/refresh decision) + DB-backed INT
(`SUPABASE_TEST_REQUIRED=1`, the refresh reauthorization on the proven command) + Playwright E2E
(the per-file preview UX + no-raw-path DOM guarantee).

---

## Story Summary

Story 8.3 is **Wave 2's tenant-admin preview/download UX** on top of the `createSignedFileAccess`
signing command that shipped GREEN in 8.1. It adds, for EACH own-tenant file listed in the 8.2
`EntityFilePanel`, a per-file preview/download affordance that mints a SHORT-LIVED signed URL
through the ONE existing funnel — plus the expiry→refresh loop where an expired link re-runs the
FULL authorization check (membership → ownership → lifecycle) rather than re-issuing a cached URL.

**As a** tenant admin
**I want** to preview/download my tenant's private files through short-lived links that
re-authorize on expiry
**So that** files stay private (never a public bucket, never a client-controlled path) while
remaining usable — and a cross-tenant / expired / wrong-lifecycle attempt is denied with a
generic, user-safe error that never reveals whether another tenant's file exists.

**This story does NOT rebuild the funnel (R-814 STOP).** `createSignedFileAccess`, the
storage-plane negative matrix, and the env-configurable TTL are DONE and PROVEN. 8.3 is UX + the
refresh loop + keeping the negative matrix green through a NEW entry point (`previewEntityFileAction`).

---

## Acceptance Criteria

1. **AC1** — Metadata-first authorization funnel BEFORE any signed URL: membership → file-metadata
   ownership (under RLS) → lifecycle state, via the EXISTING `createSignedFileAccess` command (no
   competing signing path — R-814 STOP); the UI never renders/accepts a raw `bucket_id`/`object_path`
   (the signed URL is the ONLY storage handle the client sees — R-804/R-810).
2. **AC2** — Expiry→refresh re-runs the FULL authorization check: an expired/about-to-expire link
   retried through the normal UI performs a FRESH full auth (membership + ownership + lifecycle —
   NOT a bare re-sign); a file whose lifecycle changed to archived/deleted (or whose ownership is no
   longer visible) between the first sign and the retry is NOT re-signed — the retry denies with the
   generic file-access error (R-806).
3. **AC3** — Full storage negative matrix denied with generic user-safe errors: cross-tenant
   sign/list/read, path-spoof, malformed-segment, anonymous, expired-URL all denied; a cross-tenant/
   non-existent `file_id` both surface `TENANT_ACCESS_DENIED`, a wrong-lifecycle OWNED file surfaces
   `FILE_ACCESS_DENIED` — no existence disclosure (R-809), no raw storage error across the boundary
   (R-805/R-809).

---

## Test Strategy (AC → level → priority)

| AC | Risk | Scenario | Level | Priority | Scaffold |
| --- | --- | --- | --- | --- | --- |
| AC1/AC2 | R-806/R-810 | `isSignedUrlExpired` branch table (null / past / future / exactly-at-boundary) | Unit | P0 | `signed-access-state.test.ts` |
| AC2 | R-806 | `shouldReauthorize` — idle/error/stale-success → offer re-open; fresh-success → do NOT re-sign | Unit | P1 | `signed-access-state.test.ts` |
| AC1/AC3 | R-809/R-810 | `SIGNED_ACCESS_INITIAL` pristine; success carries url (no code); error carries code (NO url) | Unit | P1 | `signed-access-state.test.ts` |
| AC2 | R-806 | A file ARCHIVED between first sign and retry → NOT re-signed (`FILE_ACCESS_DENIED`) — the real teeth | Integration | P0 | `file-signed-access-refresh.int.test.ts` |
| AC2 | R-806 | Sign the SAME eligible file twice (fixed clock) → two valid results, identical deterministic `expiresAt` | Integration | P1 | `file-signed-access-refresh.int.test.ts` |
| AC3 | R-809 | Foreign / non-existent `file_id` on the retry → `TENANT_ACCESS_DENIED`, identical shape, no url | Integration | P0 | `file-signed-access-refresh.int.test.ts` |
| AC1 | R-810 | SUCCESS projection carries ONLY `{ targetId, signedUrl, expiresAt }` — never `object_path`/`bucket_id` | Integration | P1 | `file-signed-access-refresh.int.test.ts` |
| AC1 | R-810 | NO raw `object_path`/`bucket_id` text ever in the panel DOM (empty or populated list) | E2E | P1 | `entity-file-preview.e2e.spec.ts` |
| AC1 | R-811 | Clicking a listed file's preview mints a time-limited link (`target=_blank`, `rel=noopener`, "tidsbegränsad") | E2E | P1 | `entity-file-preview.e2e.spec.ts` |
| AC3 | R-809/R-811 | A denied/wrong-lifecycle preview → generic `role="alert"` error, no raw path, no existence leak | E2E | P1 | `entity-file-preview.e2e.spec.ts` |
| AC2 | R-806 | An expired link offers a re-open control that re-authorizes (never reuses the stale URL) | E2E | P1 | `entity-file-preview.e2e.spec.ts` (`test.fixme` — needs low-TTL/clock seam) |

**Duplicate-coverage avoidance (coverage-inversion check — retro R-8.1 Phase 7):** the signing
AUTHORIZATION matrix (anon/cross-tenant/wrong-lifecycle/spoof/expired) is proven ONLY at INT
(`file-signed-access.int.test.ts` — 8.1, KEEP GREEN); the refresh REAUTHORIZATION teeth at INT
(`file-signed-access-refresh.int.test.ts` — new); the expiry/refresh DECISION at Unit (pure); the
UX STRUCTURE + no-raw-path at E2E. **E2E NEVER re-proves the server gate**, and the negative-test
targets still point at the SAME `createSignedFileAccess` command the new `previewEntityFileAction`
calls (verified: the action wires straight to `runCommand(createSignedFileAccess, …)`, so the
existing negatives cover the live surface).

**Why the action layer is NOT INT-tested:** `previewEntityFileAction` wraps
`createSupabaseServerClient()` (per-request cookie-bound; not injectable), so its guarantees are
proven at the COMMAND layer (the funnel it calls) + the E2E DOM (no raw path). This mirrors how
8.2 proved the upload action's contract at command + E2E, not at an action-layer INT.

---

## Failing Tests Created (RED Phase)

### Unit Tests (node:test, pure — 11 tests, 1 file)

**File:** `tests/unit/features/files/signed-access-state.test.ts`

- ✅ **[8.3-UNIT-01a][P1] `SIGNED_ACCESS_INITIAL` is a pristine, idle, url-free starting shape**
- ✅ **[8.3-UNIT-01b][P1/R-810] a success state carries `signedUrl` + `expiresAt` (no code/formError)**
- ✅ **[8.3-UNIT-01c][P1/R-809] an error state carries `code` + `formError` and NEVER a `signedUrl`**
- ✅ **[8.3-UNIT-01d][P0/R-806] `isSignedUrlExpired`: a null expiry is treated as expired**
- ✅ **[8.3-UNIT-01e][P0/R-806] `isSignedUrlExpired`: a PAST expiry is expired**
- ✅ **[8.3-UNIT-01f][P0/R-806] `isSignedUrlExpired`: a FUTURE expiry is NOT expired**
- ✅ **[8.3-UNIT-01g][P0/R-806] `isSignedUrlExpired`: EXACTLY at the expiry instant is expired**
- ✅ **[8.3-UNIT-01h][P1/AC2] `shouldReauthorize`: an idle state offers re-authorize**
- ✅ **[8.3-UNIT-01i][P1/AC2] `shouldReauthorize`: a success with a still-valid url does NOT re-sign**
- ✅ **[8.3-UNIT-01j][P1/AC2/R-806] `shouldReauthorize`: a success whose url EXPIRED offers re-authorize**
- ✅ **[8.3-UNIT-01k][P1/AC2] `shouldReauthorize`: an error state offers re-authorize (retry)**
  - **Status:** RED — `@/features/files/signed-access-state` does not exist yet (Task 1.1/1.2).
  - **Verifies:** AC1/AC2 the pure expiry/refresh DECISION + the mirrored signed-preview state shape;
    the coverage-shape lesson (the decision lives in a pure `.ts`, never a `.tsx`).

### Integration Tests (Vitest, DB-backed — `file-signed-access-refresh.int.test.ts`)

**File:** `tests/integration/commands/file-signed-access-refresh.int.test.ts` (5 tests)

- ✅ **[8.3-INT-01a][P0/AC2/R-806] a file ARCHIVED between the first sign and the retry is NOT re-signed (`FILE_ACCESS_DENIED`)**
  - The real AC2 teeth — proves the refresh re-runs the FULL lifecycle gate, not a bare re-sign.
- ✅ **[8.3-INT-01b][P1/AC2] signing the SAME eligible file twice re-authorizes (two valid results, identical deterministic `expiresAt`)**
- ✅ **[8.3-INT-01c][P0/AC3/R-809] a FOREIGN `file_id` on the retry denies with the SAME generic shape (`TENANT_ACCESS_DENIED`, no url)**
- ✅ **[8.3-INT-01d][P0/R-809] a NON-EXISTENT `file_id` on the retry denies with the SAME shape as the foreign case**
- ✅ **[8.3-INT-01e][P1/R-810] the SUCCESS projection carries ONLY `{ targetId, signedUrl, expiresAt }` — never `object_path`/`bucket_id`**
  - **Status:** The command (`createSignedFileAccess`) is GREEN from 8.1 — these are NEW behavioral
    assertions 8.3 must keep green through its new entry point. They red-fail LOUD if the archive-on-
    retry re-sign discipline or the no-raw-path projection ever regresses. Require the LOCAL Supabase
    stack + Storage (`SUPABASE_TEST_REQUIRED=1`); skip visibly when unreachable.
  - **Verifies:** AC2/AC3/R-806/R-809/R-810 — refresh = a genuine full re-authorization, not a
    cached re-issue.

### E2E Tests (Playwright — `entity-file-preview.e2e.spec.ts`)

**File:** `tests/e2e/files/entity-file-preview.e2e.spec.ts` (4 tests)

- ✅ **[8.3-E2E-01][P1/AC1/R-810] NO raw `object_path`/`bucket_id` text ever appears in the panel DOM**
- ✅ **[8.3-E2E-02][P1/AC1] clicking a listed file's preview mints a time-limited signed link**
- ✅ **[8.3-E2E-03][P1/AC3/R-811] a denied/wrong-lifecycle preview surfaces a generic `role="alert"` error with NO raw path**
- ✅ **[8.3-E2E-04][P1/AC2/R-806] an expired link offers a re-open control that re-authorizes (never reuses the stale URL)** (`test.fixme` — needs a low-TTL E2E env or a deterministic clock seam; Task 3.2)
  - **Status:** RED — `previewEntityFileAction` + the panel's per-file preview affordance + its
    preview data-testids not wired yet (Tasks 2/3). Red-fails at DOM (missing `file-preview-button`/
    `file-preview-link`/`file-preview-error` testids) until Tasks 2/3 land.
  - **Verifies:** AC1/AC2/AC3/R-806/R-810/R-811 — the preview/download UX + the no-raw-path
    guarantee + the expiry→refresh re-open control.

---

## Data Factories (REUSE — do NOT reinvent)

Reuse the existing `tests/factories/tenants.ts` helpers; the refresh INT scaffold adds only a tiny
local `adminSetLifecycle` (an `adminQuery` UPDATE of `files.lifecycle_state`) to simulate a
mid-flight archive — promote it to `tests/factories/tenants.ts` if a second suite needs it.

- `createTwoTenantFixture` / `makeAuthedServerClient` / `cleanupFixture` — the two-tenant harness.
- `adminInsertFile` — seed own-tenant + tenant-B files (server-shaped `{tenant}/…` object_path).
- `adminUploadStorageObject` — plant a REAL object at the file's server-derived path so the sign
  has an object to sign (the happy/refresh path needs a reachable object).
- `adminQuery` (`tests/factories/admin-sql.ts`) — read `object_path` (BYPASSRLS) + flip lifecycle.
- Reachability: `isLocalStackReachable`/`isLocalStorageReachable` (`tests/support/test-env.ts`);
  `skipUnlessStack`/`skipUnlessStorage` (`tests/support/stack-gate.ts`).

No raw customer file committed; the object bytes are TEST-TIME generated (`TextEncoder`), and E2E
fixture names use `crypto.randomUUID()` (NOT `Date.now()` — the epic-3 flake lesson). The PII/
secret+ORGNR golden scan stays green (R-819).

---

## Mock / Seam Requirements

- **INT refresh seam (8.3-INT-01a):** the lifecycle-change-mid-flight is simulated by
  `adminSetLifecycle(fileId, "archived")` (a BYPASSRLS UPDATE) between the first sign and the
  retry — no proxy/mocking needed; the command's own lifecycle gate does the denying. The clock is
  the deterministic `fixedClock` (as in the 8.1 base matrix).
- **E2E preview-success driver (8.3-E2E-02):** needs at least ONE own-tenant file listed in the
  panel (from the 8.2 upload path, GREEN, or a factory seed). If the E2E fixture panel has no
  listed file yet, seed one OR mark that test `test.fixme` rather than making it flaky.
- **E2E denial driver (8.3-E2E-03):** a deterministic denial (a foreign id submitted, or a file
  archived after listing) is a Task-3 seam; the scaffold asserts the DOM contract when the error
  region is present and defers the trigger with a guarded `if (await …count())`.
- **E2E expiry driver (8.3-E2E-04):** forcing a real client-side expiry needs a low
  `SUPABASE_SIGNED_URL_TTL_SECONDS` in the E2E env + a bounded wait, OR a deterministic clock seam
  (Task 3.2). Authored as `test.fixme` until that driver lands — never a flaky sleep.

---

## Required data-testid Attributes (Task 3 — for E2E stability)

The 8.2 canonical panel testids MUST stay stable (do not break the 8.2 upload E2E). Add NEW
preview testids, namespaced by the SAME `tid(...)` suffix helper (+ the `file_id` or list index so
multiple files stay individually addressable):

- `file-preview-button` — the per-row "Öppna fil" preview/download submit (per listed file).
- `file-preview-link` — the time-limited signed `<a … target="_blank" rel="noopener noreferrer">`
  ("Öppna fil (tidsbegränsad länk)"), rendered on success.
- `file-preview-error` — the generic `role="alert"` preview-error region (denied/wrong-lifecycle).
- `file-preview-reopen` — the "Länken har gått ut — öppna igen" re-authorize control (AC2 expiry).

There must be **NO** `file-object-path-input` / `file-bucket-input` (asserted absent — R-810), and
no raw `object_path`/`bucket_id` text in the panel DOM.

**Implementation sketch (mirror `JobEvidenceLink`'s form-per-file button — the THIRD reuse):**

```tsx
<form action={previewAction}>
  <input type="hidden" name="file_id" value={f.fileId} />
  <button type="submit" disabled={pending} data-testid={tid(`file-preview-button-${f.fileId}`)}>
    {pending ? "Öppnar…" : "Öppna fil"}
  </button>
</form>
{state.status === "success" && state.signedUrl && !expired && (
  <a data-testid={tid(`file-preview-link-${f.fileId}`)} href={state.signedUrl}
     target="_blank" rel="noopener noreferrer">Öppna fil (tidsbegränsad länk)</a>
)}
{expired && (
  <button data-testid={tid(`file-preview-reopen-${f.fileId}`)} type="submit" form={…}>
    Länken har gått ut — öppna igen
  </button>
)}
{state.status === "error" && (
  <p role="alert" data-testid={tid(`file-preview-error-${f.fileId}`)}>{state.formError}</p>
)}
```

---

## Implementation Checklist (RED → GREEN)

### Task 1 — pure signed-access-state + expiry/refresh decision module

- [ ] Create `src/features/files/signed-access-state.ts`: `SignedAccessState` (mirror
      `JobEvidencePreviewState` VERBATIM — `status`/`code`/`formError`/`signedUrl`/`expiresAt`) +
      `SIGNED_ACCESS_INITIAL`; `isSignedUrlExpired(expiresAt, nowIso)` (valid strictly BEFORE expiry;
      null → expired); `shouldReauthorize(state, nowIso)`. Document the Task-1.3 boundary in the
      header (the helper NEVER re-signs / caches; the command re-checks lifecycle every call).
- [ ] Run: `pnpm run test:unit -- tests/unit/features/files/signed-access-state.test.ts` → GREEN.

### Task 2 — `previewEntityFileAction` (feature layer, reuse the envelope)

- [ ] Add `previewEntityFileAction(prev, formData)` to `src/features/files/actions.ts`
      (`"use server"`), MIRRORING `previewJobEvidenceAction`: read `file_id`; call
      `runCommand(createSignedFileAccess, { client: createSupabaseServerClient(), input: { file_id } })`
      on the anon-key RLS client (NEVER service-role). Map `ok → { status:"success", signedUrl, expiresAt }`;
      failure → `{ status:"error", code, formError }`. NO new command, NO `ttlSeconds`, NO signed URL in
      any log. The action carries ONLY `file_id` (never `owner_type`/`object_path`/`bucket_id`).

### Task 3 — extend `EntityFilePanel` with the per-file preview affordance

- [ ] Extend `src/components/files/EntityFilePanel.tsx`: per-row preview form → `previewEntityFileAction`
      (mirror `JobEvidenceLink`); success → the time-limited `<a … target="_blank" rel="noopener">`;
      error → `role="alert"`; pending → disabled "Öppnar…"; expired (via `isSignedUrlExpired`) → the
      "öppna igen" re-open control that RE-SUBMITS (fresh full auth — never reuse the stale URL). Add
      the NEW preview data-testids; keep the 8.2 canonical testids + `testIdSuffix` namespacing stable.
      Do NOT `router.refresh` on preview; do NOT touch the upload form / four upload error states.
- [ ] Run: `pnpm run test:e2e -- entity-file-preview` → the preview UX tests GREEN (seed a listed
      file for 8.3-E2E-02; wire the expiry driver for 8.3-E2E-04 or keep it `test.fixme`).

### Task 4 — refresh-reauthorization INT (keep the 8.1 matrices green)

- [ ] Run: `SUPABASE_TEST_REQUIRED=1 pnpm run test:int -- file-signed-access-refresh` → the 5
      refresh cases GREEN (the command is already built — these should pass once the local stack is up).
- [ ] Confirm `file-signed-access.int.test.ts` + `storage-object-isolation.rls.test.ts` STAY GREEN
      under `SUPABASE_TEST_REQUIRED=1` (coverage-inversion check — the negatives still target the
      command the preview action calls).

### Task 6 — non-regression guards (do NOT weaken)

- [ ] The 8.1 authorization matrix, the storage-isolation matrix, the migration-reset policy
      enumeration, the 8.2 upload INT/E2E, and the service-role containment guards (source + built
      bundle) MUST stay green — the preview path is anon+RLS-client / server-command ONLY.
- [ ] Do NOT change the TTL contract (`SUPABASE_SIGNED_URL_TTL_SECONDS`, 300s default, 24h MAX);
      do NOT pass an explicit `ttlSeconds` from the preview path (the `??`-bypass, deferred-work §8-1
      iter-3); leave `readiness.ts`, `nav-items.ts`, and the `/files` `PagePlaceholder` stub unchanged.

**Estimated effort:** ~1–1.5 dev-days (pure module + action + panel affordance + wiring; the command
+ storage matrices already exist).

---

## Running Tests

```bash
# The pure unit for the signed-access state + expiry/refresh decision
pnpm run test:unit -- tests/unit/features/files/signed-access-state.test.ts

# The DB-backed refresh-reauthorization INT (forces the storage-negative class to run)
SUPABASE_TEST_REQUIRED=1 pnpm run test:int -- file-signed-access-refresh.int.test.ts
# Keep the 8.1 base matrices green alongside it:
SUPABASE_TEST_REQUIRED=1 pnpm run test:int -- file-signed-access storage-object-isolation

# The preview/download panel E2E
pnpm run test:e2e -- entity-file-preview

# Full gates (as CI runs them)
pnpm run typecheck && pnpm run test:unit && pnpm run test:int && pnpm run test:e2e
```

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

- ✅ All scaffolds written and failing for the RIGHT reason (the unit fails on the missing
  `signed-access-state` module; the E2E red-fails on the not-yet-wired preview affordance/testids).
- ✅ Reuse-first: the refresh INT extends the PROVEN `createSignedFileAccess` (R-814 — no competing
  funnel); the state module mirrors `evidence-preview-state.ts` VERBATIM (its THIRD reuse).
- ✅ Coverage-inversion check done: the negatives still target the command the new
  `previewEntityFileAction` calls.
- ✅ data-testid + seam requirements documented; each red test mapped to its Task.

### GREEN Phase (DEV — next)

Work Task 1 → 2 → 3, running the mapped test after each. The refresh INT (Task 4) should go green as
soon as the local stack is up (the command already exists). Minimal implementation, reuse the named
8.1/7.3 surfaces — prefer fixing the code, not the test (the 8.2 ATDD scaffolds drove impl green with
only two mechanical fixes; hold that discipline).

### REFACTOR Phase (after GREEN)

None required beyond keeping the shared signed-preview state family consistent. Do NOT destructively
refactor the job-evidence or quote-PDF preview; the pure module is the third parallel instance by
design.

---

## Test Execution Evidence

### Initial Test Run (RED Phase Verification)

**Unit (`pnpm run test:unit -- tests/unit/features/files/signed-access-state.test.ts`):**

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  'C:\ElproSaas\src\features\files\signed-access-state'
  imported from …/tests/unit/features/files/signed-access-state.test.ts
ℹ tests 1  ℹ pass 0  ℹ fail 1  → ✅ RED verified (missing Task-1 module, not a test bug)
```

**Typecheck (`npx tsc --noEmit`)** reports EXACTLY the expected not-yet-built symbol and nothing else
on the new files:

```
tests/unit/features/files/signed-access-state.test.ts(50,8): error TS2307:
  Cannot find module '@/features/files/signed-access-state' or its corresponding type declarations.
```

The INT + E2E scaffolds typecheck CLEAN (they import only existing surfaces — `createSignedFileAccess`,
the factories, Playwright). They red-fail at RUNTIME: the INT refresh assertions require the local
Supabase stack + Storage (skip visibly otherwise); the E2E red-fails at DOM on the not-yet-wired
`file-preview-*` testids until Tasks 2/3 land — the standard red-phase state for this repo's committed
scaffolds (as `entity-file-panel.e2e.spec.ts` sat red before 8.2 dev).

**Summary:**

- New test files: 3 (1 unit, 1 INT, 1 E2E) → 11 unit assertions + 5 INT + 4 E2E scaffolds.
- Passing: 0 (expected). Failing/red: all (expected). Status: ✅ RED phase verified.

---

## Notes

- **R-814 STOP respected:** no second signing path / file store / public-URL affordance is
  introduced. The refresh INT drives the SAME `createSignedFileAccess` command; the pure state module
  is the THIRD instance of the signed-preview state family (job-evidence + quote-PDF already exist).
- **Deferred-work bounds honored:** the preview action carries ONLY `file_id` (own-tenant bound by the
  command's ownership gate — the epic-6 residual is NOT widened); no explicit `ttlSeconds` (the §8-1
  iter-3 `??`-bypass stays closed); the 8.2→8.4 acceptance-evidence-upload LOCK is NOT touched (8.3 is
  read/preview only, adds no write path); the storage exact-policy-enumeration guardrail stays a
  future pass (the behavioral matrix stays green, not weakened).
- **The one intended typecheck error** clears as Task 1 lands its `signed-access-state.ts` — mirroring
  how 8.2's units sat red on the missing `upload-policy`/`upload-error-classifier` modules.
- **E2E `test.fixme`** on the expiry re-open trigger (8.3-E2E-04) is intentional: author the
  deterministic driver (low-TTL env or clock seam) during Task 3.2 rather than shipping a flaky sleep.

---

**Generated by BMad TEA Agent** — 2026-07-07
