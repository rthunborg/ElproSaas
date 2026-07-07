---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-04c-aggregate'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-07-06'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/7-1-acceptance-evidence-capture-for-sent-quote-versions.md'
  - '_bmad-output/test-artifacts/test-design-epic-7.md'
  - '_bmad/tea/config.yaml'
  - 'src/server/commands/quotes/mark-sent.ts'
  - 'src/server/commands/command-errors.ts'
  - 'src/server/commands/files/validation.ts'
  - 'src/server/commands/files/file-db.ts'
  - 'src/lib/money/ore.ts'
  - 'tests/integration/commands/mark-quote-version-sent.int.test.ts'
  - 'tests/integration/commands/file-link-ownership.int.test.ts'
  - 'tests/integration/rls/quote-tables-migration-reset.int.test.ts'
  - 'tests/integration/rls/tenant-table-inventory.ts'
  - 'tests/unit/features/quotes/send-gate.test.ts'
  - 'tests/unit/guardrails/quote-non-scope.test.ts'
  - 'tests/e2e/quotes/quote-sent-lock.e2e.spec.ts'
---

# ATDD Checklist: Story 7.1 — Acceptance Evidence Capture For Sent Quote Versions

**TDD phase:** RED (failing/skipped acceptance scaffolds authored BEFORE implementation).
**Story:** `_bmad-output/implementation-artifacts/7-1-acceptance-evidence-capture-for-sent-quote-versions.md`
**Author:** Rasmus
**Primary Test Level:** Integration (the sent-state gate, the server-side adjusted-price gate, the
öre-persistence + audit hygiene, the migration-reset schema contract, and the evidence-link
activation are the load-bearing deliverables; Unit for the pure adjusted-price/reason decision;
E2E for the form UX + a11y mirror only; the guardrail scan is a `node --test` route-presence check).
**Stack:** fullstack (Next.js 16 + Supabase). Runners: `node --test` (unit fast gate + guardrail
scan), Vitest (INT/RLS, local Supabase stack), Playwright (E2E, CI-gated).
**Generation mode:** AI generation (backend/DB-heavy — migration + command + error-code + owner-type
activation; clear ACs finalized against the landed Epic 6 state machine). No live browser recording —
the E2E scaffold reuses the existing 6.2/6.4 two-tenant fixture pattern. Execution mode resolved to
SEQUENTIAL (no subagent/agent-team runtime available in this harness) — scaffolds authored directly
and inline (mirrors the 6.4 precedent).

## Story Summary

As a tenant admin, I want to record off-system acceptance for a specific SENT quote version —
capturing channel, accepted timestamp, admin user, evidence file/reference, accepted price in öre,
notes, and planned dates, with adjusted-price gating — so that customer-commitment evidence is
preserved (immutably, tenant-scoped, audited) before a job/order is created. 7.1 lands the SCHEMA
(`quote_acceptances`/`jobs`/`job_events`) + the acceptance-capture SURFACE (command + pure delta
module + form). It does NOT build the transaction (7.2's `accept_quote_and_create_job` RPC) or the
accepted-immutability lock (7.4). Persistence shape resolved to (a): 7.1 persists `quote_acceptances`
via an own-tenant RLS-client INSERT (a single-row write, NOT the RPC).

## Acceptance Criteria

1. **AC1** — Acceptance-capture form for a sent quote version captures channel, accepted timestamp,
   admin user (server-derived), evidence file/reference, accepted price in öre, notes, and planned
   start/end dates; NO customer portal or public acceptance endpoint.
2. **AC2** — An accepted price ≠ the sent quote total REQUIRES an explicit adjustment reason/evidence
   (re-validated server-side; the client cannot bypass) AND the delta (computed with `@/lib/money`,
   in öre) is shown before confirmation.
3. **AC3** — A draft/accepted/rejected/expired/superseded/cross-tenant quote version is REJECTED:
   a non-sent state ⇒ a stable lifecycle rejection (user-safe, no exact-status leak); a cross-tenant/
   foreign id ⇒ `TENANT_ACCESS_DENIED` (no existence disclosure).
4. **AC4** — The new commitment tables (`quote_acceptances`/`jobs`/`job_events`) are isolated +
   enrolled: direct `tenant_id`, composite same-tenant parent FKs, enable+FORCE RLS with own-tenant
   `is_tenant_admin` policies (SELECT/INSERT/UPDATE, no DELETE), `anon → nothing`, öre columns as
   `bigint CHECK >= 0`, enrolled in `TENANT_TABLES` (H4 green); NO field-worker/schedule/time-material/
   deviation/ÄTA/analytics/invoice/Fortnox table or column.
5. **AC5** — Accepted price + source sent total stored in integer öre (`bigint`, canonical guards);
   a SINGLE `audit_events` row with allow-listed metadata (NO raw accepted price / customer PII).
6. **AC6** — Evidence link ACTIVATES the `quote_acceptance` owner type + `acceptance_evidence` purpose
   on the EXISTING 8.1 file model (a foreign file id ⇒ `TENANT_ACCESS_DENIED`; cross-tenant + anon
   access rejected via the 8.1 signed-access funnel); NO competing evidence model (R-814).

## Red-phase mechanism per runner

BMAD's canonical `test.skip()` red-phase idiom is adapted to each runner so the fast gate stays
GREEN (visible SKIP, never a failing red build) until each Task lands:

- **`node --test`** (unit, `acceptance-price.test.ts`): per-case `test("...", { skip: "ATDD red
  phase ..." }, () => {...})`. Assertions reference the not-yet-existent `computeAcceptanceDelta`
  via a `declare` placeholder (deleted when the real `src/features/quotes/acceptance-price.ts`
  lands). Verified: 7 tests, 7 skipped, 0 fail.
- **`node --test`** (guardrail, `acceptance-non-scope.test.ts`): runs LIVE from the red phase (the
  assertions are TRUE TODAY and must STAY true) — it is the standing guardrail 7.1's implementation
  must not violate. Verified: 2 tests, 2 pass, 0 fail.
- **Vitest** (INT/RLS): whole-suite `describe.skip("... [ATDD red phase — Story 7.1 not
  implemented]")` per describe block (the command `captureQuoteAcceptance`, the `quote_acceptances`
  table + migration, and the `quote_acceptance` owner activation do not exist yet). Bodies carry the
  real proof outline + `expect.fail(...)` sentinels so a stray un-skip fails LOUD rather than passing
  vacuously; the migration-reset scaffold carries the real introspection queries behind the `.skip`.
- **Playwright** (E2E): `test.describe.skip("... [ATDD red phase — Story 7.1 not implemented]")`
  header (mirrors the 6.4 no-lingering-red-header discipline — clear the header when green).

## Acceptance-criteria coverage

| Test ID | Level (runner) | AC | P | Red-phase scaffold file |
| --- | --- | --- | --- | --- |
| 7.1-UNIT-01 | Unit (`node --test`) | AC2 | P0 | `tests/unit/features/quotes/acceptance-price.test.ts` |
| 7.1-UNIT-02 | Unit (`node --test`) | AC2 | P2 | `tests/unit/features/quotes/acceptance-price.test.ts` |
| 7.1-INT-01 | Integration (Vitest) | AC4/AC5 | P0 | `tests/integration/rls/acceptance-tables-migration-reset.int.test.ts` |
| 7.1-INT-02 | Integration (Vitest) | AC3 | P0 | `tests/integration/commands/capture-quote-acceptance.int.test.ts` |
| 7.1-INT-03 | Integration (Vitest) | AC2 | P0 | `tests/integration/commands/capture-quote-acceptance.int.test.ts` |
| 7.1-INT-04 | Integration (Vitest) | AC6 | P0 | `tests/integration/commands/acceptance-evidence-link.int.test.ts` |
| 7.1-INT-05 | Integration (Vitest) | AC5 | P1 | `tests/integration/commands/capture-quote-acceptance.int.test.ts` |
| 7.1-RLS-01 | RLS (Vitest) | AC4 | P0 | *(inventory-enrolled — see note below)* |
| 7.1-RLS-02 | RLS (Vitest) | AC4 | P0 | *(inventory-enrolled — H4 gate)* |
| 7.1-E2E-01 | E2E (Playwright) | AC1 | P1 | `tests/e2e/quotes/quote-acceptance-capture.e2e.spec.ts` |
| 7.1-E2E-02 | E2E (Playwright) | AC2 | P1 | `tests/e2e/quotes/quote-acceptance-capture.e2e.spec.ts` |
| 7.1-E2E-03 | E2E (Playwright) | AC1/AC2 | P2 | `tests/e2e/quotes/quote-acceptance-capture.e2e.spec.ts` |
| 7.x-E2E-01 | Guardrail (`node --test`) | AC1 | P1 | `tests/unit/guardrails/acceptance-non-scope.test.ts` |
| 7.x-UNIT-01 | Unit (fixture privacy scan) | — | P0 | *(golden PII/ORGNR scan — extended in green; see note)* |

- **AC2 (adjusted-price gate):** 7.1-UNIT-01/02 (the pure delta + reason-required decision, öre-based,
  canonical guards, boundaries) + 7.1-INT-03 (server re-validation: adjusted price w/o reason ⇒
  rejected; w/ reason ⇒ accepted + delta captured) + 7.1-E2E-02 (the UI mirror).
- **AC3 (sent-state + cross-tenant gate):** 7.1-INT-02 (one negative per non-sent state — draft/
  accepted/rejected/expired/superseded — + cross-tenant ⇒ `TENANT_ACCESS_DENIED`; matrix finalized
  vs landed Epic 6).
- **AC4 (isolation + schema):** 7.1-INT-01 (migration-reset schema contract) + 7.1-RLS-01/02 (via
  `TENANT_TABLES` enrollment — see the enrollment note).
- **AC5 (öre + audit):** 7.1-INT-05 (öre persistence + single `{ targetId }` audit, no price/PII leak).
- **AC6 (evidence-link activation):** 7.1-INT-04 (own-tenant link OK; foreign file/owner id ⇒
  `TENANT_ACCESS_DENIED`; cross-tenant + anon file access via the signed-access funnel; external ref
  path; no competing model).
- **AC1 (form + no public surface):** 7.1-E2E-01 (form fields + sent-only gating) + 7.1-E2E-03 (a11y)
  + 7.x-E2E-01 (the hard proof: NO public acceptance/portal/webhook/cron surface).

### 7.1-RLS-01/02 — enrollment, NOT hand-written ad-hoc tests (intentional)

Per testability note 1 and the five-epic precedent, cross-tenant + anon isolation for the three new
tables is proven by ENROLLING them in the shared `TENANT_TABLES` inventory
(`tests/integration/rls/tenant-table-inventory.ts`), NOT by hand-writing a standalone RLS file. NO
new RLS scaffold is authored here. GREEN-PHASE obligations for 7.1-RLS-01/02 (Task 2):

1. Append `"quote_acceptances"`, `"jobs"`, `"job_events"` to `TENANT_TABLES` WITH both metadata seams
   (cross-tenant: `spoofedRowFor`/`tenantBFilter`/`hijackMutationFor`; anon: `anonRowFor`/
   `anonFilterFor`/`anonMutationFor`). Spoof child INSERTs carry a Tenant-B parent id (acceptance →
   version/quote; job → acceptance; job_event → job) so the composite FKs bind them to Tenant B.
   `updateDenialKind` = RLS-invisibility (authenticated INSERT/UPDATE grant, like every business
   table). Keep öre values < 10 digits (the orgnr-scan boundary, R-717); NO PII in spoof/anon rows.
2. `quote_events` is ALREADY enrolled (Epic 6) — do NOT re-add it; the shared suites already cover it.
3. Confirm the H4 inventory gate (`rls-inventory-gate.int.test.ts`) is GREEN with the three new tables
   enrolled — an unenrolled tenant-owned table fails CI BY DESIGN (that failure is 7.1-RLS-02).
4. `job_events` (an event table) enrolls like any other table — the epic-8 retro flags event tables as
   easy to forget.

## Deliberately NOT authored here (belongs to `dev-story`, not ATDD red-phase scaffolds)

- **The `TENANT_TABLES` enrollment itself** (Task 2) — it is a green-phase source edit, not a runnable
  scaffold; the shared cross-tenant/anon/H4 suites already exist and light up on enrollment.
- **The `migration-reset.int.test.ts` exact-policy-enumeration EXTENSION** — the three new tables ×
  SELECT/INSERT/UPDATE are added to the exact expected set in green (never loosened to a superset);
  `acceptance-tables-migration-reset.int.test.ts` pins the acceptance half independently.
- **7.x-UNIT-01 (fixture privacy scan)** — the standing golden PII/secret + ORGNR scan is EXTENDED to
  any acceptance/job fixture in green (öre values < 10 digits, no personnummer/orgnr/name/email/phone/
  address, no clock in a golden). It is a control extension over the existing scan, not a new scaffold.
- **The command-layer cross-tenant negative wiring** — the `TENANT_ACCESS_DENIED` case in
  7.1-INT-02 needs the REAL `captureQuoteAcceptance` command; its outline is authored, the sentinel is
  replaced in green.

## Fixtures / infrastructure the GREEN phase must add (referenced, not yet created)

- **`src/features/quotes/acceptance-price.ts`** — the PURE `computeAcceptanceDelta` /
  `reasonRequiredForDelta` decision over `@/lib/money` (`isOreAmount`/`ORE_AMOUNT_MAX`/integer öre
  arithmetic; NO ad-hoc delta). NOT inside a `"use client"` component (the coverage-shape lesson).
  Un-skips 7.1-UNIT-01/02; delete the `declare` placeholder + import the real symbol. (Align the
  export names/shape to the module you author; the test's `AcceptanceDeltaResult` shape is indicative.)
- **The additive migration** `supabase/migrations/2026070*_acceptance_to_job_model.sql` (next unused
  timestamp AFTER `20260708120000`) — `quote_acceptances`/`jobs`/`job_events` with tenant ownership,
  composite same-tenant FKs, immutable source refs, öre `bigint CHECK >= 0`, uniqueness backstops
  (`unique (quote_version_id)`, `unique (quote_acceptance_id)`, `unique (id, tenant_id)`), reused
  `set_updated_at`, enable+FORCE RLS + 3 own-tenant policies per table (no DELETE), GRANTs (anon
  NOTHING), indexes. NO 7.2 RPC, NO 7.4 immutability trigger, NO deferred-module table/column. Mirror
  `20260705120000_quote_version_model.sql` verbatim. Un-skips 7.1-INT-01 (+ EXTEND
  `migration-reset.int.test.ts` in lockstep).
- **`captureQuoteAcceptance`** command (`src/server/commands/quotes/accept.ts` + `validation.ts`/
  `quote-db.ts` additions) + register in `index.ts`; pattern EXACTLY on `mark-sent.ts` (envelope,
  ownership → `quote_versions`, load real status → reject non-sent, load frozen source sent total →
  compute delta → reject adjusted-w/o-reason, own-tenant RLS INSERT of `quote_acceptances`, injected
  clock for the command instant + explicit `accepted_at` input, `{ targetId }` audit). Un-skips
  7.1-INT-02/03/05; delete the `expect.fail(...)` sentinels + uncomment the real command calls.
- **Evidence-link activation:** add `"quote_acceptance"` to `ACTIVE_OWNER_TYPES`
  (`src/server/commands/files/validation.ts`); register `quote_acceptance → quote_acceptances` in
  `ownerTableFor` (`src/server/commands/files/file-db.ts`); wire `createFileLink({ owner_type:
  "quote_acceptance", purpose: "acceptance_evidence" })` for an uploaded evidence file (a single link
  on capture — `file_links` has no dedupe; document the accept-single choice), external reference →
  `quote_acceptances.evidence_reference`. Un-skips 7.1-INT-04.
- **A `quote_acceptances` factory + readback helper** in `tests/factories/tenants.ts` (additive:
  `adminInsertQuoteAcceptance` / `adminSelectQuoteAcceptanceRow`, bigint öre → STRING on readback) and
  the two-tenant sent-fixture driver reuse (`seedQuoteVersion` + the real `markQuoteVersionSent`).
- **Acceptance-capture form** replacing the `quote-acceptance-placeholder` in
  `src/components/quotes/QuoteDetailView.tsx:399-405` (render on a SENT version only) + a `"use server"`
  action in `src/features/quotes/actions.ts` (+ an `*-action-state.ts`) + the `data-testid`s below.
  Un-skips 7.1-E2E-01/02/03; clear the red-phase header.
- **E2E `global-setup.ts`:** expose a SENT version as accept-able (the fixture already seeds a sent
  v1); add the acceptance-form testids to `QuoteDetailView`.

## Required data-testid attributes (E2E UI contract for the GREEN phase)

### QuoteDetailView (acceptance form — NEW for 7.1, replaces the placeholder on a SENT version)

- `acceptance-form` — the form container (present ONLY on a sent version).
- `acceptance-channel`, `acceptance-accepted-at`, `acceptance-evidence-reference`,
  `acceptance-price-ore`, `acceptance-notes`, `acceptance-planned-start`, `acceptance-planned-end` —
  the captured fields (Swedish comma öre input for the price; reuse `money-input.ts`).
- `acceptance-price-delta` — the delta display, shown when the entered price ≠ the sent total.
- `acceptance-adjustment-reason` — the REQUIRED reason field, revealed when the delta ≠ 0.
- `acceptance-confirm` — the confirm affordance (disabled until a required reason is entered).
- `acceptance-status` — the `role="status"`/`role="alert"` banner announcing acceptance success/
  failure (text-not-color; focus moves here on completion).
- There is NO admin-user input field — the admin user is server-derived (asserted `toHaveCount(0)`).

## Implementation Checklist (map each failing test to the tasks that make it pass)

### 7.1-UNIT-01/02 — adjusted-price decision (`tests/unit/features/quotes/acceptance-price.test.ts`)

- [ ] Author `src/features/quotes/acceptance-price.ts`: `computeAcceptanceDelta(acceptedPriceOre,
      sourceSentTotalOre)` over `@/lib/money` (`isOreAmount`/`ORE_AMOUNT_MAX`; integer öre delta);
      `reasonRequired = deltaOre !== 0`. Pure, no DB, no clock.
- [ ] Delete the `declare function computeAcceptanceDelta` placeholder; import the real symbol.
- [ ] Remove the `{ skip: ... }` from each case (align the result shape to the authored module).
- [ ] Run: `pnpm run test:unit` (or the single-file `node --test` command below).

### 7.1-INT-01 — migration-reset (`tests/integration/rls/acceptance-tables-migration-reset.int.test.ts`)

- [ ] Add the additive migration (see Fixtures). Remove the `describe.skip`; re-label "green".
- [ ] EXTEND `tests/integration/rls/migration-reset.int.test.ts`: add the 3 tables × SELECT/INSERT/
      UPDATE to the EXACT expected policy set + the exists/RLS-forced checks (keep it exact).
- [ ] Run after `supabase db reset` + POLL `/auth/v1/health` to 200: `pnpm run test:int`.

### 7.1-INT-02/03/05 — capture command (`tests/integration/commands/capture-quote-acceptance.int.test.ts`)

- [ ] Author `captureQuoteAcceptance` + register it; add the write-error mapper branches (23505 on the
      `unique (quote_version_id)` → `VALIDATION_FAILED` for 7.1; reserve idempotency codes for 7.2).
- [ ] Add the `quote_acceptances` factory + readback helper; fill in `seedSentVersion` via the real
      `markQuoteVersionSent` path.
- [ ] Import `captureQuoteAcceptance` + `runCommand`; replace the `expect.fail(...)` sentinels with the
      real command calls + uncomment the readback assertions; remove the `describe.skip`.
- [ ] Run after `supabase db reset` + `/auth/v1/health` 200: `pnpm run test:int`.

### 7.1-INT-04 — evidence link (`tests/integration/commands/acceptance-evidence-link.int.test.ts`)

- [ ] Activate the `quote_acceptance` owner type (validation.ts + file-db.ts); wire `createFileLink`.
- [ ] Import `createFileLink` + `runCommand`; replace the sentinels with real calls + readbacks;
      remove the `describe.skip`. Run: `pnpm run test:int`.

### 7.1-E2E-01/02/03 — acceptance form (`tests/e2e/quotes/quote-acceptance-capture.e2e.spec.ts`)

- [ ] Replace the `quote-acceptance-placeholder` with the acceptance form + the testids above + the
      `"use server"` action (revalidate `/quotes/[id]` AND the version subroute); fill in
      `openSentVersion` via the 6.2/6.4 signIn/waitForHydrated helpers.
- [ ] Extend `global-setup.ts` (a sent version exposed as accept-able).
- [ ] Remove the `test.describe.skip(...)` headers (clear the red-phase header when green).
- [ ] Run: `pnpm run test:e2e`.

### 7.x-E2E-01 — guardrail (`tests/unit/guardrails/acceptance-non-scope.test.ts`) — ALREADY GREEN

- [ ] Keep it GREEN as the form/command land (no public acceptance/portal/webhook/cron route/token).
- [ ] **Reconcile the 6.2 guardrail** (`tests/unit/guardrails/quote-non-scope.test.ts`): it currently
      forbids `acceptQuote`/`createJob` tokens in `src/server/commands/quotes`. 7.1 legitimately adds
      the acceptance command there — narrow the 6.2 forbidden-token set to the still-out-of-scope items
      (`createJob` stays out until 7.2/7.3; email/portal/public stay out) so the sanctioned 7.1
      surface passes. (See the Notes section — this is a REQUIRED green-phase edit.)

## Running Tests

```bash
# Unit (fast gate) — adjusted-price decision + guardrail scan
node --experimental-strip-types --import ./tests/support/register.mjs --test "tests/unit/features/quotes/acceptance-price.test.ts" "tests/unit/guardrails/acceptance-non-scope.test.ts"
pnpm run test:unit

# Integration (local Supabase; after `supabase db reset` + /auth/v1/health 200 poll)
pnpm run test:int
npx vitest run tests/integration/rls/acceptance-tables-migration-reset.int.test.ts tests/integration/commands/capture-quote-acceptance.int.test.ts tests/integration/commands/acceptance-evidence-link.int.test.ts

# E2E (CI-gated; global-setup seeds the two-tenant quote fixture)
pnpm run test:e2e
npx playwright test tests/e2e/quotes/quote-acceptance-capture.e2e.spec.ts
```

## Red-phase verification evidence

- `node --test` on the two unit files → `tests 9 / pass 2 / fail 0 / skipped 7` (7 skipped = the
  adjusted-price red-phase cases; 2 pass = the guardrail scan, correctly proving NO public acceptance
  surface exists today). Fast gate stays green.
- `npx tsc --noEmit` → 0 errors across all six new scaffold files (type-clean red phase; the `declare`
  placeholder + commented green-phase imports/assertions keep it compiling).
- `npx vitest list <the 3 INT/RLS scaffolds>` → exit 0, no active tests listed (whole-`describe.skip`
  — collects without executing the not-yet-existent command/table/owner activation).
- `npx playwright test tests/e2e/quotes/quote-acceptance-capture.e2e.spec.ts --list` → parses; the
  module-scope gitignored `fixture.json` load errors locally IDENTICALLY to the existing 6.2/6.4
  specs (confirmed: `quote-sent-lock.e2e.spec.ts` shows the same `ENOENT` on `.auth/fixture.json`;
  seeded by global-setup in CI) — not a scaffold defect.

## Notes / key risks & assumptions

- **The canonical 7.1 correctness properties are the SENT-STATE gate (AC3) + the SERVER-SIDE
  adjusted-price gate (AC2).** 7.1-INT-02 (one negative per non-sent state + cross-tenant) and
  7.1-INT-03 (adjusted price w/o reason ⇒ rejected server-side) are the load-bearing INT proofs — a
  test that only proves the UI reveals a reason field is NOT evidence (the client cannot bypass;
  testability note 7). The sent-eligibility matrix is FINALIZED against the landed Epic 6 state
  machine (2026-07-06) — assert against the frozen artifacts, not a re-derivation.
- **REQUIRED green-phase reconciliation of the 6.2 guardrail.** `tests/unit/guardrails/
  quote-non-scope.test.ts` asserts `acceptQuote` and `createJob` are ABSENT from
  `src/server/commands/quotes`. Story 7.1 legitimately introduces the acceptance command in that
  directory. The green phase MUST narrow that guardrail's forbidden-token set (keep `createJob`/
  email/portal/public forbidden; permit the sanctioned acceptance command) or it will fail-loud the
  moment 7.1's command lands. This is called out in both the guardrail scaffold header and the
  implementation checklist so the epic trace treats it as an Epic-7 obligation.
- **7.1 does NOT transition the version's status** (that is 7.2's `sent → accepted` flip) and MUST NOT
  write any `quote_versions` column as part of capture — capture writes only `quote_acceptances`.
  Modifying the sent-lock trigger is a design-drift STOP (testability note 6).
- **Persistence shape (a) chosen.** 7.1 persists `quote_acceptances` via a plain own-tenant RLS INSERT
  (a single-row write — ADR-A009's RPC is for the multi-record 7.2 transaction). `accepted_at` is an
  EXPLICIT input field (H1 determinism); the command clock anchors only the command instant.
- **Idempotency codes stay reserved for 7.2.** A duplicate-capture attempt against an already-accepted
  version is naturally caught by the sent-state gate (an accepted version is not `sent`). 7.1 surfaces
  a `unique (quote_version_id)` collision (23505) as `VALIDATION_FAILED`; do NOT add
  `ACCEPTANCE_ALREADY_RECORDED` unless a 7.1 test forces it (prefer leaving it for 7.2).
- **`file_links` has no dedupe uniqueness (8.1 deferral).** 7.1 does a SINGLE link on capture (no
  idempotent retry), so accept-single is the tested, documented choice; a re-link would create a
  second row, which 7.1 does not exercise (testability note 8).
- **Fixture privacy (R-717):** any acceptance/job fixture keeps öre < 10 digits (orgnr-scan boundary),
  NO PII (personnummer/orgnr/name/email/phone/address), NO clock in a golden. The standing golden scan
  is extended to acceptance fixtures in green (7.x-UNIT-01).
- **Demo-data-only accept stands** (owner 2026-07-03): the adjusted-price policy + accepted-evidence
  channel set are conservative dev defaults (R-713). STOP → `needs-human` if the adjustment policy,
  channel set, or correction semantics materially differ from these, if the delta representation must
  be treated as production-approved (Sign-Off Q8), or if real customer quote data is needed for a
  golden. Not a blocker under demo-data-only.
- **Deferred to 7.2/7.4 (recorded, not built here):** once a version can be `accepted` (7.2), the
  new-version/PDF affordances on `QuoteDetailView` must be gated off `accepted` — 7.1 does not reach
  that (it does not flip the status); noted for the epic trace.

## Next steps (recommended workflow)

1. `dev-story` (green phase): implement Tasks 1–7, un-skip each scaffold in priority order (UNIT →
   INT → E2E), delete every `declare` placeholder / `expect.fail` sentinel / red-phase header, and
   perform the two REQUIRED reconciliations (the 6.2 guardrail token set; the `migration-reset`
   exact-policy enumeration).
2. Enroll the three tables in `TENANT_TABLES` (7.1-RLS-01/02) and extend the fixture-privacy scan
   (7.x-UNIT-01) during dev-story.
3. Run the FULL CI gate in order (typecheck → lint → test:unit → build → test:int → test:e2e); verify
   every scaffold flips GREEN (or is a documented, justified skip). Clear ALL red-phase headers.
4. `automate` to expand coverage after green (if selected for 7.1).
