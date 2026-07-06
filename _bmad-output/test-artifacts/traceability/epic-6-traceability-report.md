---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-07-06'
workflowType: testarch-trace
gateType: epic
epicNum: 6
decisionMode: deterministic
coverageBasis: acceptance_criteria
oracleConfidence: high
oracleResolutionMode: formal_requirements
externalPointerStatus: not_used
tempCoverageMatrixPath: 'scratchpad/tea-trace-coverage-matrix-epic6.json'
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-6.md (17 risks R-601..R-618; 11 high-priority ≥6; 10 non-negotiable epic blockers; P0-P3 test IDs)
  - _bmad-output/planning-artifacts/epics.md (Epic 6, Stories 6.1-6.5)
  - _bmad-output/implementation-artifacts/6-1..6-5 story files (all Status: review; tasks complete; review findings resolved/deferred-Low)
  - supabase/migrations/20260705120000_quote_version_model.sql (6 quote tables + RLS + create RPC + tenant_counters)
  - supabase/migrations/20260706120000_quote_pdf_render_state.sql (pdf_status column + event-type widening)
  - supabase/migrations/20260707120000_quote_version_sent_lock.sql (sent-lock + child-lock + append-only triggers + mark_sent RPC)
  - supabase/migrations/20260708120000_quote_new_version.sql (create_new_quote_version + mark_quote_version_lifecycle RPCs)
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES: all 6 quote tables enrolled with cross-tenant + anon-path metadata)
  - tests/integration/commands/{quote-version,update-draft-quote-version,generate-quote-pdf-*,mark-quote-version-sent,create-new-quote-version}.int.test.ts
  - tests/integration/rls/quote-tables-migration-reset.int.test.ts
  - tests/unit/{features,components,lib,server}/quotes|quote-pdf|quote-snapshot/** ; tests/e2e/quotes/**
  - src/server/commands/quotes/** ; src/features/quotes/** ; src/lib/quote-pdf/** ; src/lib/quote-snapshot/**
  - src/server/commands/command-errors.ts (QUOTE_VERSION_NOT_DRAFT + QUOTE_VERSION_LOCKED in the union)
  - .github/workflows/ci.yml (pnpm audit --audit-level=high blocking gate — R-617 resolved)
---

# Traceability Report — Epic 6: Quote Versions, PDF, And Lifecycle

**Date:** 2026-07-06
**Author:** Rasmus (via BMad TEA — Master Test Architect)
**Gate Type:** Epic-level (Phase 4, epic boundary)
**Decision Mode:** Deterministic (rule-based: P0 100% / P1 ≥90% PASS · 80–89% CONCERNS / overall ≥80%)
**Coverage Oracle:** formal requirements (Epic 6 acceptance criteria + the 17-risk / 10-blocker Epic 6
test design) — **high confidence** (formal, non-synthetic; active in-source test cases present, verified
against the real migrations, RLS inventory, RPC/trigger definitions, and test source — not merely the
story records)

---

## Gate Decision: PASS

**Rationale:** P0 coverage is 100% (23/23 epic P0 requirement groups) and P1 coverage is ~92% (11/12
FULL; the one non-FULL item is the intentionally-unauthored visual-snapshot secondary golden that the
test design itself says must never gate), so overall coverage is ~97% (34/35 mapped requirements FULL) —
above every deterministic threshold (P0 100% required, P1 ≥90% PASS target, overall ≥80%). All eleven
high-priority risks (score ≥6: R-601, R-602, R-603, R-604, R-605, R-606, R-607, R-608, R-609, R-611,
R-615) are mitigated and proven by real, in-source, active tests, and **every one of the ten
Non-Negotiable epic blockers** in the Epic 6 test design is met and verified against the actual
migrations, RLS inventory, RPC/trigger definitions, and test source:

1. **Every new quote table (incl. `tenant_counters`) has direct `tenant_id` + enable+force RLS +
   own-tenant policies + `anon → none` + `TENANT_TABLES` enrollment (H4 green)** — verified: all six
   tables (`tenant_counters`, `quotes`, `quote_versions`, `quote_version_lines`,
   `quote_version_attachments`, `quote_events`) are enrolled in `tenant-table-inventory.ts` (lines
   143-148) with all four metadata seams (cross-tenant spoof/filter, cross-tenant mutation, anon row,
   anon mutation — the four `switch(table)` blocks), so the shared cross-tenant + anon suites + the H4
   inventory gate cover them automatically (`6.1-RLS-01/02`). The `20260705120000` migration carries the
   enable+force RLS + own-tenant `is_tenant_admin` policies + no-anon GRANTs.
2. **No cross-tenant calculation/attachment/version id accepted** — verified: composite same-tenant FKs
   at the DB + command-layer `verifyOwnership` re-validation; `quote-version.int.test.ts` 6.1-INT-02
   spoofs a foreign calc id AND a foreign attachment/file id → `TENANT_ACCESS_DENIED` with no orphaned
   quote/version/number.
3. **Sent versions immutable at the DATABASE (trigger/constraint), not just command/UI; command mutation
   ⇒ `QUOTE_VERSION_LOCKED`** — verified at BOTH layers: `mark-quote-version-sent.int.test.ts` 6.4-INT-02
   (command → exact `QUOTE_VERSION_LOCKED`, message leak-free) AND 6.4-INT-03 (a DIRECT own-tenant
   authenticated UPDATE of `intro_text`/`base_total_ore` on a sent row is rejected by the
   `enforce_quote_version_sent_lock()` trigger via SQLSTATE `QV409`, while the EXEMPT `pdf_status`/
   `pdf_file_id`/`pdf_generated_at` columns stay mutable). The trigger is fail-closed by construction
   (exempt allow-list; everything else — incl. identity/`quote_id` — locked-by-default) with a
   legal-transition guard (a `sent→draft` reversal RAISES).
4. **PDF reads snapshot tables only — regenerate-after-mutation proof green** — verified:
   `generate-quote-pdf-source-of-truth.int.test.ts` 6.3-INT-01 creates a version, generates the PDF,
   mutates every mutable source (`customers`/`company_settings`/`quote_terms`/`calculation_*`/
   `work_roles`/`articles`), regenerates, and asserts the extracted PDF text is UNCHANGED; the pure
   `buildQuotePdfViewModel` input surface is provably snapshot-only.
5. **Quote numbers allocated server-side, race-safe, tenant-scoped, inside the RPC transaction** —
   verified: `quote-version.int.test.ts` 6.1-INT-05 drives concurrent creations with `Promise.all`
   (sleep-free) → unique tenant-scoped numbers inside the `create_quote_version_from_calculation` RPC
   txn, tenant B independent; 6.5 shares the per-quote number and increments `version_number` under the
   parent-quote `FOR UPDATE` lock (distinct numbers 2, 3 under concurrency).
6. **Blocking readiness gates mark-sent; tax content framed estimate + `requiresSignOff`, never
   legally-final** — verified: the send gate (`src/features/quotes/send-gate.ts`) consumes the SAME 5.4
   `classifyReadiness` blocker classification (no fork); `send-gate.test.ts` 6.4-UNIT-01 pins
   blockers-block/warnings-don't (incl. `TAX_SIGN_OFF_REQUIRED`/`requires_sign_off` demo-data accept);
   6.4-INT-04 pins the rejected blocked send.
7. **v2 creation and lifecycle events leave prior sent versions byte-unchanged** — verified:
   `create-new-quote-version.int.test.ts` 6.5-INT-02 reads v1 before/after v2 creation and after a
   standalone lifecycle event; deep-equal on the frozen columns (only the sanctioned `status`→superseded
   flip + one appended event); the `quote_events_append_only` trigger blocks any prior-event mutation.
8. **No internal notes / cost / margin data in customer-visible snapshot fields or PDF output** —
   verified: `quote_version_lines` carries no cost/margin/internal columns by data model; the second belt
   is `toCustomerVisibleLine` (6.2-UNIT-01) and the pure `buildQuotePdfViewModel` type surface
   (6.3-UNIT-01), both driven with internal fields at the SOURCE and asserting absence in the output.
9. **No real PII/secret in any quote/PDF fixture or committed artifact (CI scan green)** — verified:
   `quote-snapshot/golden-pack.test.ts` 6.x-UNIT-01 runs the extended PII/secret scan (personnummer,
   orgnr, non-test email, secret/password/api_key/bearer/service_role, phone) over the snapshot fixture,
   and enforces every öre value < 10 digits to avoid the orgnr false-positive trap; the PDF text golden
   pack carries the same discipline. Fixtures are anonymized shape-only.
10. **R-617 (`pnpm audit` hard mechanism) resolved — NOT a fifth silent carry** — verified: the CI
    workflow (`.github/workflows/ci.yml:71-72`) carries a blocking `pnpm audit --audit-level=high` step
    (owner decision 2026-07-03: high/critical fail the build, moderate/low logged). This is the resolved
    hard mechanism the Epic 5 retro demanded — reported explicitly in this gate, not carried silently.

All five stories (6.1–6.5) are `Status: review` with every task complete and every code-review finding
resolved or explicitly deferred at Low severity. The story dev records report the full CI gate sequence
green at each story: **unit 658→1016 `node --test` pass (0 fail, 0 skip)** across the epic (929 after 6.2,
979 after 6.4, **1016 after 6.5**), INT ~477→**520 pass** (48 files), E2E ~66→**74 pass** (Playwright,
CI-gated `SUPABASE_TEST_REQUIRED=1`), with `typecheck`/`lint`/`build`/`verify:service-role-containment`/
`verify:bundle-containment`/`verify:lockfiles` all green. There are **no active `.skip`/`.only`/`fixme`/
`notYetImplemented`** in any Epic 6 test (the single skip-scan match is a comment-line in a spec header
explaining the red-phase clearing discipline). No P0/P1 gap and no open high-priority (≥6) risk is
unmitigated. The remaining items — the two Med review findings on 6.3 (hidden-row render) and 6.4
(`status`-reversal + `quote_id` re-parent trigger holes) were **RESOLVED with patches + new INT
negatives** during the story runs; the residual Low deferrals and the standing demo-data-only accept
(R-610) are **surfaced-for-decision items, not coverage gaps**.

---

## Coverage Summary

- **Total requirements mapped:** 35 (5 stories × epic-relevant AC/risk/heuristic groups)
- **Fully covered (FULL):** 34 (~97%)
- **Partial / Unit-only / None:** 1 (the P1 visual-snapshot SECONDARY golden 6.3-GOLDEN-02, deliberately
  not authored — a stability check the test design mandates must never gate; the PRIMARY text-extraction
  golden 6.3-GOLDEN-01 is the covering contract)
- **P0 coverage:** 100% (23/23) — every SEC (six-table isolation, cross-tenant source ids, private PDF
  access) / DATA (snapshot freeze, race-safe numbering, sent immutability at both layers, PDF
  source-of-truth, prior-version preservation) / BUS (readiness-gates-send, internal-exclusion, fixture
  privacy) critical criterion
- **P1 coverage:** ~92% (11/12 FULL) — above the 90% PASS target
- **P2 coverage:** ~100% (a11y/keyboard E2E, lifecycle-edge INT, timeline-selection UNIT, docs) ·
  **P3 coverage:** covered at the documented/exploratory level
- **High-priority risks (score ≥6):** 11/11 mitigated + test-proven (R-601, R-602, R-603, R-604, R-605,
  R-606, R-607, R-608, R-609, R-611, R-615)

**Test inventory discovered** (all active — no skip/only/fixme in executable Epic 6 code):

- **UNIT** (`node --test`): `tests/unit/lib/quote-snapshot/{build,build-edges,golden-pack,golden-v1-v2}.test.ts`,
  `tests/unit/lib/quote-pdf/{view-model,pdf-text-golden}.test.ts`,
  `tests/unit/features/quotes/{timeline,view-model,send-gate,lifecycle-transition}.test.ts`,
  `tests/unit/components/quotes/status.test.ts`, `tests/unit/guardrails/quote-non-scope.test.ts`,
  `tests/unit/server/quote-pdf/render.test.ts`, and the command-validator/mapper/serializer units under
  `tests/unit/server/commands/**`
- **INT** (Vitest/DB) under `tests/integration/commands/`: `quote-version.int.test.ts`,
  `update-draft-quote-version.int.test.ts`, `generate-quote-pdf-{source-of-truth,storage-privacy,
  determinism,retry-consistency}.int.test.ts`, `mark-quote-version-sent.int.test.ts`,
  `create-new-quote-version.int.test.ts`
- **RLS / migration** under `tests/integration/rls/`: `quote-tables-migration-reset.int.test.ts`
  (per-table policy enumeration + deferred-table absence), the shared data-driven cross-tenant + anon
  suites reading `tenant-table-inventory.ts` (6 quote tables enrolled), the H4 inventory gate, and the
  `migration-reset.int.test.ts` trigger/function/RPC presence + empty-search_path assertions
- **E2E** (Playwright) under `tests/e2e/quotes/`: `quotes.e2e.spec.ts` (detail/timeline/draft-edit),
  `quote-pdf-states.e2e.spec.ts`, `quote-sent-lock.e2e.spec.ts`, `quote-new-version.e2e.spec.ts`
- **GOLDEN fixtures:** `tests/fixtures/golden/snapshots/{quote-version-source,quote-version-v1-v2}.json`,
  `tests/fixtures/golden/quote-pdf/quote-pdf-source.json` (anonymized, origin-labelled, PII-scanned)

**Local run confirmation (from the story/automation records, verified against in-source test presence):**
`pnpm run test:unit` → 1016 pass / 0 fail / 0 skip after 6.5; `pnpm run test:int` → 520 pass across 48
files (the single INT flake — `storage-object-isolation.rls.test.ts`, a pre-existing signed-URL-expiry
TIMING test unrelated to Epic 6 — passes on isolated re-run, not a regression); `pnpm run test:e2e` → 74
pass; `typecheck`/`lint`/`build`/`verify:*` all green; INT/RLS ran under `SUPABASE_TEST_REQUIRED=1` after
`supabase db reset` + `/auth/v1/health` 200 poll (the Kong→GoTrue 502 false-green trap avoided).

---

## Traceability Matrix

Coverage legend: **FULL** = criterion covered at the appropriate level(s) with mechanism-asserting tests;
test IDs cite the covering file. All IDs below were verified present in-source (file existence +
enrollment + no active skip + real behavioral assertion) at trace time.

### Story 6.1 — Quote Snapshot Schema And Server-Side Version Creation

| AC / Requirement | Risk | Priority | Coverage | Covering tests (verified) |
| --- | --- | --- | --- | --- |
| AC1 Migration reset creates 6 quote tables (incl. `tenant_counters`) with tenant ownership, composite same-tenant parent FKs, lifecycle/immutable fields, enable+force RLS + own-tenant policies + `anon → none` + `TENANT_TABLES` enrollment (H4 green); NO Fortnox/invoice/portal/external-mapping tables | R-601 | P0 | FULL | `quote-tables-migration-reset.int.test.ts` 6.1-INT-01 (per-table policy enumeration; deferred-table absence via exact-list + name-shape regex); migration `20260705120000` (enable+force RLS + composite FKs + öre CHECK); `tenant-table-inventory.ts` (6 tables enrolled) |
| AC1 Cross-tenant read/write + anon-path rejected on every new quote table; H4 gate green | R-601 | P0 | FULL | `tenant-table-inventory.ts` 6.1-RLS-01/02 (6 tables enrolled with all 4 metadata seams; cross-tenant + anon + H4 gate data-driven) |
| AC2 `createQuoteVersionFromCalculation` rejects a foreign calculation id AND a foreign attachment/file id ⇒ `TENANT_ACCESS_DENIED`, no orphaned quote/version/number | R-602 | P0 | FULL | `quote-version.int.test.ts` 6.1-INT-02 (both spoofs → `TENANT_ACCESS_DENIED`); composite same-tenant FK backstop at DB |
| AC2 Snapshot captures the full §11 checklist (customer/facility/contact display, FULL company identity, terms + sign-off state verbatim, line/section model, totals, VAT/tax assumptions, attachment metadata, warnings, source calc refs) | R-603 | P0 | FULL | `quote-version.int.test.ts` 6.1-INT-03 (field-completeness); `quote-snapshot/build.test.ts` + `golden-pack.test.ts` 6.1-GOLDEN-01 (content pin) |
| AC2 Behavioral freeze — mutate calc rows/pricing/settings/terms/CRM AFTER creation ⇒ snapshot byte-unchanged | R-603 | P0 | FULL | `quote-version.int.test.ts` 6.1-INT-04 (mutate-every-source-after-capture; byte-unchanged; not field-exists) |
| AC3 Concurrent version creation allocates unique tenant-scoped quote numbers inside the RPC txn; tenant B independent | R-604 | P0 | FULL | `quote-version.int.test.ts` 6.1-INT-05 (`Promise.all`, sleep-free; unique + tenant-scoped) |
| AC2 Snapshot builders pure — copy-by-value, `Object.freeze`, injected `capturedAt`, capture-not-compute | R-603 | P0 | FULL | `quote-snapshot/build.test.ts` + `build-edges.test.ts` 6.1-UNIT-01 (post-build mutation throws; no clock read; totals from engine state) |
| AC2 Snapshot content golden pack (options/tillval, hidden rows, ROT/grön warnings, attachment sets), origin-labelled | R-603, R-615 | P0 | FULL | `quote-snapshot/golden-pack.test.ts` 6.1-GOLDEN-01 (under `tests/unit/**`; anonymized; PII scan) |
| Öre discipline on new quote money columns — canonical `isOreAmount`/`ORE_AMOUNT_MAX`, bigint + `CHECK >= 0` | R-603 | P1 | FULL | `quote-snapshot` unit + migration `20260705120000` (`*_ore bigint CHECK >= 0`) 6.1-UNIT-02 |
| Audit events written for version creation — allow-listed `{ targetId }` metadata | R-608 | P1 | FULL | `quote-version.int.test.ts` 6.1-INT-06 (audit metadata `{ targetId }` only) |
| Fixture/artifact privacy — PII/secret scan over quote snapshot fixtures | R-615 | P0 | FULL | `quote-snapshot/golden-pack.test.ts` 6.x-UNIT-01 (personnummer/orgnr/email/secret/phone scan; öre < 10 digits) |

### Story 6.2 — Draft Quote Version Review And Timeline UX

| AC / Requirement | Risk | Priority | Coverage | Covering tests (verified) |
| --- | --- | --- | --- | --- |
| AC1 Quote detail: lifecycle header + version timeline (TEXT status badges) + selected-version immutable snapshot (parties/lines/totals/VAT/terms/attachments/PDF status/acceptance placeholder/files/events); money read VERBATIM from the frozen rows; foreign id → generic not-found | R-616 | P1 | FULL | `quotes.e2e.spec.ts` 6.2-E2E-01 (detail regions); `read.ts` snapshot-only reads; `status.test.ts` (text-not-color); `timeline.test.ts` 6.2-UNIT-02 |
| Customer-visible view-model EXCLUDES internal notes + cost/margin by construction | R-607 | P0 | FULL | `quotes/view-model.test.ts` 6.2-UNIT-01 (driven with internal fields at the SOURCE, asserted absent) |
| AC2/AC3 Draft edit updates ONLY the draft + sent-becomes-immutable warning; sent/accepted read-only with a new-version affordance; draft-only scope re-asserted below the UI (`QUOTE_VERSION_NOT_DRAFT`), foreign id → `TENANT_ACCESS_DENIED` | R-616, R-605 | P1 | FULL | `quotes.e2e.spec.ts` 6.2-E2E-02; `update-draft-quote-version.int.test.ts` (draft accepts; sent/accepted → `QUOTE_VERSION_NOT_DRAFT` byte-unchanged; foreign → `TENANT_ACCESS_DENIED`) |
| No email-send / customer-portal / public-acceptance route or surface | — | P1 | FULL | `quote-non-scope.test.ts` 6.2-E2E-03 (route/surface presence scan) |
| Keyboard/a11y — timeline focusable, `aria-current`, text-not-color badges | R-616 | P2 | FULL | `quotes.e2e.spec.ts` 6.2-E2E-04; `status.test.ts` |
| Timeline ordering + current-version selection extracted + unit-pinned | R-616 | P2 | FULL | `quotes/timeline.test.ts` 6.2-UNIT-02 |

### Story 6.3 — Quote PDF Generation From Snapshot

| AC / Requirement | Risk | Priority | Coverage | Covering tests (verified) |
| --- | --- | --- | --- | --- |
| AC1 PDF source-of-truth: generation reads ONLY the snapshot tables; mutating customers/settings/terms/calc/work-roles/articles after snapshot ⇒ regenerated PDF text UNCHANGED | R-606 | P0 | FULL | `generate-quote-pdf-source-of-truth.int.test.ts` 6.3-INT-01 (the canonical Epic-6 negative, behavioral) |
| AC1 `QuotePdfViewModel` built solely from snapshot rows; snapshot values verbatim via the single formatter; internal fields excluded | R-606, R-607 | P0 | FULL | `quote-pdf/view-model.test.ts` 6.3-UNIT-01 (leakage-by-construction; single öre→kronor formatter); hidden-row exclusion locked in the golden `mustNotAppear` (review fix) |
| AC1 PDF text-extraction golden (PRIMARY): totals, VAT/tax blocks incl. non-final ROT/grön framing, terms, attachments, warnings match the snapshot | R-606, R-610 | P0 | FULL | `quote-pdf/pdf-text-golden.test.ts` 6.3-GOLDEN-01 (pdfjs-dist text extraction; framing pinned; real `ReadinessCode` union) |
| AC3 PDF stored via the 8.1 foundation (private bucket, server-derived path) with files/file_links (`quote_version`/`quote_pdf`) + quote_event + audit; cross-tenant + anon access rejected; no public URL | R-611 | P0 | FULL | `generate-quote-pdf-storage-privacy.int.test.ts` 6.3-INT-02 (metadata + link + event; cross-tenant + anon rejected) |
| AC2 Repeated-render stability: same snapshot rendered twice ⇒ byte/text-comparable (pinned renderer/fonts/locale, injected timestamp) | R-612 | P1 | FULL | `generate-quote-pdf-determinism.int.test.ts` 6.3-INT-03 (pdf-lib 1.17.1 pinned, base-14 Helvetica, sv-SE, injected instant) |
| AC2 Retry regenerates from the same snapshot without changing customer-visible data; mid-pipeline failure leaves a consistent, retryable state (`pdf_status='failed'`) | R-613 | P1 | FULL | `generate-quote-pdf-retry-consistency.int.test.ts` 6.3-INT-04 (verified-compensated fault) |
| AC2 PDF states visible + accessible (not_generated/generating/generated/failed/retry/preview/download); keyboard + a11y fallback | R-613 | P1 | FULL | `quote-pdf-states.e2e.spec.ts` 6.3-E2E-01/02 (states + accessible controls) |
| Visual snapshot (SECONDARY) stability check | R-612 | P1 | NOT AUTHORED (sanctioned) | 6.3-GOLDEN-02 deliberately NOT authored — the test design classes it a stability-only P1 check that must NEVER gate; the PRIMARY 6.3-GOLDEN-01 text golden is the covering contract |

### Story 6.4 — Mark Quote Version Sent And Enforce Immutability

| AC / Requirement | Risk | Priority | Coverage | Covering tests (verified) |
| --- | --- | --- | --- | --- |
| AC1 Mark-sent records sent timestamp (explicit RPC parameter, injected clock), channel/reference, a `quote_events 'sent'` row, an audit row (`{ targetId }`), `status='sent'` via the narrow SECURITY INVOKER RPC | R-608 | P0 | FULL | `mark-quote-version-sent.int.test.ts` 6.4-INT-01; RPC `mark_quote_version_sent` (empty search_path, revoke-public/grant-authenticated) |
| AC2 Command immutability: post-send mutation via command ⇒ `QUOTE_VERSION_LOCKED` (distinct from `QUOTE_VERSION_NOT_DRAFT`), message leak-free | R-605 | P0 | FULL | `mark-quote-version-sent.int.test.ts` 6.4-INT-02 (exact code; no update/select/status/QV409 leak) |
| AC2 DB immutability: a DIRECT own-tenant authenticated UPDATE of a customer-visible/line/attachment column on a sent version ⇒ rejected by the trigger; EXEMPT `pdf_status`/`pdf_file_id`/`pdf_generated_at` STILL mutable; `sent→draft` reversal + `quote_id` re-parent rejected | R-605 | P0 | FULL | `mark-quote-version-sent.int.test.ts` 6.4-INT-03 (trigger reject + exempt-mutable + the two review-added negatives); triggers `enforce_quote_version_sent_lock`/`enforce_quote_version_child_sent_lock`/`quote_events_append_only` (QV409) |
| AC1 A draft failing a BLOCKING readiness check cannot be marked sent (the SAME 5.4 classifier — no fork) | R-608 | P0 | FULL | `send-gate.test.ts` 6.4-UNIT-01 (blockers-block/warnings-don't); `mark-quote-version-sent.int.test.ts` 6.4-INT-04 (rejected blocked send) |
| AC3 Cross-tenant send/mutation rejected by RLS + command validation; no cross-tenant existence leak | R-601, R-605 | P0 | FULL | `mark-quote-version-sent.int.test.ts` 6.4-RLS-01 (foreign version id → `TENANT_ACCESS_DENIED`; cross-tenant mutation rejected) |
| AC2 UI explains the lifecycle rule + offers "create new version"; the "Mark sent" button flips a draft to a read-only sent version | R-616 | P1 | FULL | `quote-sent-lock.e2e.spec.ts` 6.4-E2E-01 (read-only messaging + affordance + flip + immutability note) |
| Documented intentional delta vs Lovable's mutable quote versions | — | P2 | FULL | 6.4-DOCS-01 recorded in the `20260707120000` migration header (oracle delta register) |

### Story 6.5 — New Quote Version After Customer-Visible Changes

| AC / Requirement | Risk | Priority | Coverage | Covering tests (verified) |
| --- | --- | --- | --- | --- |
| AC1 A customer-visible change on a SENT version ⇒ a NEW DRAFT version via the narrow RPC with an explicit parent-quote relationship (`quote_id` matches, `version_number = parent+1`, SHARED `quote_number`, `status='draft'`, a `quote_events 'created'` row, audit `{ targetId }`); the sent version is NOT edited; a draft-parent is rejected | R-609 | P0 | FULL | `create-new-quote-version.int.test.ts` 6.5-INT-01 (new-version + parent relationship + sent-not-edited + shared number + draft-parent `VALIDATION_FAILED`); RPC `create_new_quote_version` (fresh re-capture via the shared `buildFreshQuoteSnapshot`) |
| AC2 After v2 creation AND each lifecycle event: v1's full snapshot + lines + attachments + PDF metadata + prior events + status history are BYTE-UNCHANGED (only the sanctioned `status`→superseded flip + one appended event) | R-609 | P0 | FULL | `create-new-quote-version.int.test.ts` 6.5-INT-02 (deep-equal on the frozen columns before/after) |
| AC3 Lifecycle state machine: illegal transitions (`sent→draft`, `superseded→sent`, a draft rejected/expired) rejected at BOTH layers (command `VALIDATION_FAILED` + DB QV409→`QUOTE_VERSION_LOCKED`); legal transitions succeed + append the matching event, changing ONLY `status` | R-608, R-609 | P0 | FULL | `create-new-quote-version.int.test.ts` 6.5-INT-03; `lifecycle-transition.test.ts` (the pure closed transition map); the 6.4 sent-lock legal-transition guard + RPC `mark_quote_version_lifecycle` |
| v1/v2 comparison golden — what changed (v2) vs preserved (v1), origin-labelled, real `ReadinessCode` union, PII-scanned | R-609, R-615 | P0 | FULL | `quote-snapshot/golden-v1-v2.test.ts` 6.5-GOLDEN-01 (`quote-version-v1-v2.json`) |
| Cross-tenant new-version / lifecycle rejected by RLS + command validation | R-601, R-609 | P0 | FULL | `create-new-quote-version.int.test.ts` 6.5-RLS (foreign parent version id → `TENANT_ACCESS_DENIED`; via the shared inventory) |
| Timeline preserves prior sent versions (snapshot/PDF metadata/events/status) with latest state clear; the "Skapa ny version" button creates + lands on a new editable draft | R-616 | P1 | FULL | `quote-new-version.e2e.spec.ts` 6.5-E2E-01 (multi-version timeline + activated button) |
| Documented intentional delta vs Lovable (new-version-instead-of-mutate) | — | P3 | FULL | 6.5-DOCS-01 recorded in the `20260708120000` migration header (extends 6.4-DOCS-01) |

### Coverage Heuristics (Step 2/4 blind-spot checks)

| Heuristic | Result |
| --- | --- |
| API endpoint / command coverage | COVERED — every new quote command (`createQuoteVersionFromCalculation`, `updateDraftQuoteVersion`, `generateQuotePdf`, `markQuoteVersionSent`, `createNewQuoteVersion`, `markQuoteVersionLifecycle`) has an INT test; all four narrow RPCs have transactional/rollback INT coverage; no command-without-test gap |
| Auth/authz negative paths | COVERED — cross-tenant read/write negatives on all 6 quote tables (via enrolled `TENANT_TABLES`), anon-path isolation, foreign calc/attachment/version/parent id spoofs → `TENANT_ACCESS_DENIED`; the H4 inventory gate is the compile-exhaustive completeness backstop |
| Error-path (validation/rejection) coverage | COVERED — `QUOTE_VERSION_NOT_DRAFT` (draft-edit scope), `QUOTE_VERSION_LOCKED` (sent immutability at BOTH layers), `VALIDATION_FAILED` (illegal lifecycle transition + blocked send + draft-parent), `TENANT_ACCESS_DENIED` (cross-tenant); the write-error mapper maps QV409/23503/42501/23505/23514/22P02 with no raw pg message leak; retry mid-pipeline fault → `pdf_status='failed'` retryable `SERVER_ERROR` |
| UI journey E2E coverage | COVERED — detail/timeline, draft-edit-only + immutability warning, read-only sent view + new-version affordance, PDF six states + preview/download, mark-sent flip + lock messaging, multi-version timeline — across 4 Playwright specs |
| UI state coverage (loading/empty/validation/error/permission) | COVERED — generic not-found (no cross-tenant existence leak), FAILED state, empty-quote state, PDF not_generated/generating/generated/failed/retry, blocked-send error banner; happy-path-only NOT detected |
| Happy-path-only criteria | NONE detected — every correctness criterion carries a boundary/negative (mutate-after-capture freeze, mutate-source-then-regenerate PDF unchanged, direct-SQL trigger reject, `sent→draft`/`quote_id`-re-parent reject, prior-version byte-preservation, cross-tenant/anon negatives, concurrency numbering) |
| Determinism / clock | COVERED — snapshot + PDF render take injected `capturedAt`/`renderedAt` (`ctx.clock.now()`, no wall-clock; PDF `/CreationDate` set from the injected instant); count/number-asserting tests seed `crypto.randomUUID()`; goldens live under `tests/unit/**` (not the runner-glob vacuous-green trap) |
| Private-file access | COVERED — the PDF is stored in the private `tenant-files` bucket via a server-derived tenant-first path; upload + signing run on the RLS client (no service-role — the containment guard); cross-tenant + anon access rejected; short-lived signed URL, no public URL surface (6.3-INT-02) |

---

## Gaps & Uncovered Requirements

**None that affect the gate.** No P0 acceptance criterion is uncovered, partial, or unit-only where a
higher level is warranted. Every Epic 6 test-design P0/P1 test ID has a corresponding in-source, active
test; every high-priority risk (R-601..R-609, R-611, R-615) has an executable mitigation test proven at
the correct level; and every one of the ten Non-Negotiable epic blockers is met and verified against the
real migration/RPC/trigger/RLS-inventory/test source.

**The single non-FULL mapped item is sanctioned, not a gap:**

- **6.3-GOLDEN-02 visual-snapshot SECONDARY golden — deliberately not authored.** The Epic 6 test design
  itself marks the visual snapshot a P1 stability-only check that "must never gate," with the PRIMARY
  text-extraction golden (6.3-GOLDEN-01, authored + green) as the source-of-truth contract. Not authoring
  the secondary visual golden is the design-sanctioned choice (avoids pixel-diff flakiness becoming the
  gate); the customer-visible PDF content is fully pinned by 6.3-GOLDEN-01 + the 6.3-INT-01
  source-of-truth proof. This is a documented deferral, not missing coverage.

### Documented, sanctioned scope decisions (NOT coverage gaps)

Triaged in-story / in-design as accepted deferrals or resolved review findings; they do not change the
gate:

- **Two Med review findings — RESOLVED during the story runs (not carried):** (a) 6.3 hidden-row render
  (a hidden line printed as a normal PDF line item) → fixed: `render.ts` now filters `line.isHidden` out
  of the rendered line list while totals stay verbatim; the golden `mustNotAppear` locks it. (b) 6.4 two
  sent-lock trigger holes (`sent→draft` reversal disarming the lock; own-tenant `quote_id` re-parent
  slipping past the compared tuple) → fixed: a legal-transition guard + identity/parent columns added to
  BOTH comparison tuples, with two new 6.4-INT-03 negatives. Both are proven closed in-source.
- **Low deferrals (owner-assigned follow-ups, not Epic 6 gate blockers):** `quote_events` is INSERT-able
  by `authenticated` below the RPC (an own-tenant event-log/timeline integrity gap — the app derives
  authorization from `quote_versions.status`, not events; owner: a later quote-events hardening pass /
  RBAC seam); 6.3 PDF metadata persisted via separate non-transactional RLS-client inserts rather than the
  `create_file_with_link` RPC (AC3 permits verified-compensated; `pdf_status='failed'` on any fault;
  owner: reconcile with the Story 8.2 upload path); no `audit_events` row on the failed→retryable PDF
  transition (the task's "(where meaningful)" hedge makes it non-mandatory); 6.5-INT-01 mutates only the
  source calc price at INT while the broader change-list breadth is proven value-level in 6.5-GOLDEN-01;
  6.5-INT-02 re-reads PDF columns only on the v2-creation path, not the standalone-lifecycle path (the
  lifecycle RPC touches only the exempt `status` column). All are Low, pre-existing, behavior-safe.
- **Allocated quote number not threaded into the frozen composite snapshot JSON [Med → deferred]:** the
  raw integer `quote_number` is persisted on the row (the persisted truth); the §24 DISPLAY format is an
  open logged owner question; threading into the frozen JSON is a later 6.x follow-up. No AC break.

### Standing residual — demo-data-only tax/terms accept (R-610), surfaced for gate visibility

Per owner decision 2026-07-03 (recorded in MEMORY), the MVP runs on **demo data only**, so the engine's
UNAPPROVED ROT/grön/VAT tax/terms placeholders ship with `requires_sign_off=true` + non-final framing.
The snapshot captures them, the quote detail displays them, and the PDF renders them — all with the
non-final "estimate / requires sign-off" framing, never as a legally-final document. The framing TESTS
stay (6.3-GOLDEN-01 pins the framing); the owner/accounting/legal sign-off SESSION is a **post-MVP entry
condition for real-customer use**. **Re-score R-610 to a blocker immediately if real-customer use is
proposed before sign-off.** This is a documented, dated accept — not a coverage gap.

---

## High-Priority Risk → Mitigation Verification (score ≥6)

| Risk | Mitigation proven by |
| --- | --- |
| R-601 new quote-table isolation gap | 6 tables enrolled in `TENANT_TABLES` (4 metadata seams each) → 6.1-RLS-01/02 cross-tenant + anon + H4 gate; migration `20260705120000` enable+force RLS + own-tenant policies + `anon → none`; `quote-tables-migration-reset` 6.1-INT-01 reset + deferred-table absence |
| R-602 cross-tenant source id accepted | Composite same-tenant FKs at DB; command re-validates calc + attachment ownership under RLS; `quote-version.int.test.ts` 6.1-INT-02 (foreign calc AND foreign attachment/file id) → `TENANT_ACCESS_DENIED` |
| R-603 snapshot incomplete / live-referencing | `quote-version.int.test.ts` 6.1-INT-04 (mutate-every-source-after-capture ⇒ byte-unchanged); 6.1-INT-03 (§11 field completeness); `quote-snapshot/build.test.ts` 6.1-UNIT-01 (pure copy-by-value + freeze + injected clock); 6.1-GOLDEN-01 content pin |
| R-604 quote number race/collision | `quote-version.int.test.ts` 6.1-INT-05 (`Promise.all` concurrency ⇒ unique tenant-scoped inside the RPC txn); 6.5 shares per-quote number + increments version_number under the parent-quote `FOR UPDATE` lock; `(quote_id, version_number)` unique backstop |
| R-605 sent-immutability bypass | BOTH layers: 6.4-INT-02 (command ⇒ `QUOTE_VERSION_LOCKED`) AND 6.4-INT-03 (direct own-tenant UPDATE ⇒ trigger QV409 reject; exempt PDF columns still mutable; `sent→draft` reversal + `quote_id` re-parent rejected); child-lock + append-only triggers |
| R-606 PDF reads mutable data | `generate-quote-pdf-source-of-truth.int.test.ts` 6.3-INT-01 (mutate-every-source-then-regenerate ⇒ PDF text unchanged); `quote-pdf/view-model.test.ts` 6.3-UNIT-01 (snapshot-only input surface) |
| R-607 internal content leaks | `view-model.test.ts` 6.2-UNIT-01 + `quote-pdf/view-model.test.ts` 6.3-UNIT-01 (internal fields at the SOURCE, absent in output); `quote_version_lines` has no cost/margin/internal columns by data model |
| R-608 send bypasses readiness / unclear sent semantics | `send-gate.ts` reuses the 5.4 `classifyReadiness` (no fork); `send-gate.test.ts` 6.4-UNIT-01 + `mark-quote-version-sent.int.test.ts` 6.4-INT-01/04 (sent timestamp/channel/reference/event/audit; blocked send rejected) |
| R-609 new version / lifecycle events mutate prior versions | `create-new-quote-version.int.test.ts` 6.5-INT-02 (v1 byte-unchanged after v2 + each lifecycle event; only sanctioned status flip + appended event); 6.5-GOLDEN-01 v1/v2 comparison; append-only event trigger |
| R-611 quote-PDF private-file access gap | `generate-quote-pdf-storage-privacy.int.test.ts` 6.3-INT-02 (private bucket, server-derived path, files/file_links `quote_version`/`quote_pdf`, cross-tenant + anon rejected, no public URL); upload + signing on the RLS client (no service-role) |
| R-615 fixture/artifact PII leak | `quote-snapshot/golden-pack.test.ts` + `quote-pdf/pdf-text-golden.test.ts` 6.x-UNIT-01 (personnummer/orgnr/email/secret/phone scan; öre < 10 digits; anonymized shape-only) |

**Medium/Low risks:** R-612 (PDF nondeterminism) covered by 6.3-INT-03 (pinned renderer/fonts/sv-SE
locale/injected instant); R-613 (partial write / retry) by 6.3-INT-04 + 6.3-E2E-01; R-614 (8.1
sequencing) satisfied — 8.1 landed before Epic 6 (`20260704120000`); R-616 (timeline truthfulness) by the
E2E specs + `timeline.test.ts`/`status.test.ts`; R-610 (demo-data-only tax wording) is a documented,
dated accept surfaced above; R-617 (`pnpm audit`) RESOLVED (blocking CI gate); R-618 (PDF perf) a
documented residual (no Phase A SLA).

---

## Non-Negotiable Epic Blockers (test-design gate) — all MET

| Blocker | Status | Proven by (verified in-source) |
| --- | --- | --- |
| Every new quote table: direct `tenant_id` + enable+force RLS + own-tenant policies + `anon → none` + `TENANT_TABLES` enrollment (H4 green) | MET | migration `20260705120000`; `tenant-table-inventory.ts:143-148` (6 tables, 4 metadata seams); 6.1-RLS-01/02 |
| No cross-tenant calculation/attachment/version id accepted | MET | composite same-tenant FKs; 6.1-INT-02; 6.4-RLS-01; 6.5-RLS |
| Sent versions immutable at the DATABASE (trigger/constraint), not just command/UI; command ⇒ `QUOTE_VERSION_LOCKED` | MET | `enforce_quote_version_sent_lock`/child-lock triggers (QV409); 6.4-INT-02 (command) + 6.4-INT-03 (direct SQL + reversal + re-parent) |
| PDF reads snapshot tables only — regenerate-after-mutation proof green | MET | 6.3-INT-01 (mutate-source-then-regenerate ⇒ PDF text unchanged) |
| Quote numbers allocated server-side, race-safe, tenant-scoped, inside the RPC transaction | MET | 6.1-INT-05 (`Promise.all` concurrency); the RPC counter lock + 6.5 parent-quote `FOR UPDATE` |
| Blocking readiness gates mark-sent; tax content framed estimate + `requiresSignOff`, never legally-final | MET | `send-gate.ts` reuses 5.4 classifier; 6.4-UNIT-01 + 6.4-INT-04; framing pinned (6.3-GOLDEN-01) |
| v2 creation and lifecycle events leave prior sent versions byte-unchanged | MET | 6.5-INT-02; 6.5-GOLDEN-01; append-only event trigger |
| No internal notes / cost / margin data in customer-visible snapshot fields or PDF output | MET | 6.2-UNIT-01 + 6.3-UNIT-01; data model carries no such columns |
| No real PII/secret in any quote/PDF fixture or committed artifact (CI scan green) | MET | 6.x-UNIT-01 extended PII scan over snapshot + PDF fixtures |
| R-617 resolved: audit-gate PR landed OR dated owner-accept — not a fifth silent carry | MET | `.github/workflows/ci.yml:71-72` blocking `pnpm audit --audit-level=high` (owner decision 2026-07-03) |

---

## Gate Criteria Evaluation (deterministic)

| Criterion | Required | Actual | Status |
| --- | --- | --- | --- |
| P0 coverage | 100% | 100% (23/23) | MET |
| P1 coverage | ≥90% (PASS), 80–89% (CONCERNS) | ~92% (11/12 FULL; the 1 non-FULL is the sanctioned never-gate visual golden) | MET |
| Overall coverage | ≥80% | ~97% (34/35) | MET |
| High-risk (≥6) mitigations | 100% complete/waived | 11/11 complete + test-proven | MET |
| 6 quote tables enrolled + isolation proven | yes | proven (6.1-RLS-01/02, H4 gate) | MET |
| No cross-tenant source/version id accepted | yes | proven (6.1-INT-02, 6.4-RLS-01, 6.5-RLS) | MET |
| Sent immutability at BOTH layers (command + DB trigger) | yes | proven (6.4-INT-02 + 6.4-INT-03) | MET |
| PDF source-of-truth (snapshot only) | yes | proven (6.3-INT-01) | MET |
| Race-safe tenant-scoped numbering inside the RPC txn | yes | proven (6.1-INT-05) | MET |
| Prior-version byte-preservation on v2 + lifecycle | yes | proven (6.5-INT-02) | MET |
| Readiness gates send; tax not legally-final | yes | proven (6.4-UNIT-01/INT-04; framing pinned) | MET |
| No internal leakage; no real PII/secret in fixtures | yes | proven (6.2/6.3-UNIT-01; 6.x-UNIT-01) | MET |
| R-617 (`pnpm audit`) resolved, reported in-gate | yes | blocking CI gate present | MET |
| Epic 6 suite green | 100% pass | 1016 unit / 520 int / 74 e2e pass; no active skip/only/fixme; the 1 int flake is a pre-existing unrelated timing test (passes on re-run) | MET |

→ **Decision Rule matched:** P0 = 100% AND overall ≥ 80% AND P1 ≥ 90% ⇒ **PASS**. Oracle is formal (not
synthetic), high confidence, active test cases present ⇒ no confidence-overlay downgrade. **Gate: PASS.**

---

## Next Actions

- **PASS — epic may proceed.** No remediation required for the gate. All five stories (6.1–6.5) are in
  `review` with tasks complete, all code-review findings resolved or deferred at Low, and the full quote
  suite green. Proceed to the epic-boundary NFR + test-review + retro, then epic close.
- **R-610 demo-data-only accept (dated, surface-for-visibility — NOT a gate blocker):** the tax/terms
  wording ships as UNAPPROVED placeholders with `requires_sign_off` + non-final framing (owner decision
  2026-07-03; MVP demo-data-only). **Re-score to a blocker and reinstate the owner/accounting/legal
  sign-off session immediately if real-customer use is proposed.** Keep the framing tests.
- **Low deferrals routed to owner follow-ups (non-gating):** (1) `quote_events` INSERT-forgeability below
  the RPC → a later quote-events hardening pass / RBAC seam; (2) the 6.3 PDF metadata non-transactional
  inserts + no failed-transition audit row → reconcile with the Story 8.2 general-upload path; (3) the
  allocated quote number not threaded into the frozen snapshot JSON + the §24 display format → a later 6.x
  follow-up; (4) the two Low 6.5 test-completeness gaps (INT change-list breadth; PDF-metadata re-read on
  the standalone-lifecycle branch) → tighten opportunistically (behavior is safe).
- **Sprint/state hygiene (non-gating, orchestrator note):** `sprint-status.yaml` shows `epic-6:
  in-progress` with all five stories `review`; align `epic-6` to `review` (then `done` at epic close)
  once the epic-boundary NFR/test-review/retro complete.
- **Residual (documented):** PDF render performance / generation at scale untested (R-618) — pilot-sized,
  no Phase A SLA; deferred per the test design.

---

**Generated by:** BMad TEA Agent — Test Architect Module
**Workflow:** `bmad-testarch-trace` (v5.0 step-file architecture)
**Phase 1 (coverage matrix) + Phase 2 (gate decision):** complete

---

## Gate Decision Summary

🚨 **GATE DECISION: PASS**

📊 Coverage Analysis:
- P0 Coverage: 100% (Required: 100%) → MET
- P1 Coverage: ~92% (PASS target: 90%, minimum: 80%) → MET
- Overall Coverage: ~97% (Minimum: 80%) → MET

✅ Decision Rationale: P0 coverage is 100% (23/23 requirement groups), P1 coverage is ~92% (11/12 FULL —
the one non-FULL item is the intentionally-unauthored visual-snapshot SECONDARY golden the test design
mandates must never gate), and overall coverage is ~97% (34/35). All 11 high-priority risks (≥6) are
mitigated + test-proven, and all 10 non-negotiable epic blockers are met and verified against the real
migrations, RLS inventory, RPC/trigger definitions, and test source (not merely the story records). The
Epic 6 suite is green (1016 unit / 520 int / 74 e2e; no active skip/only/fixme; the single int flake is a
pre-existing unrelated signed-URL-expiry timing test that passes on re-run). The two Med review findings
(6.3 hidden-row render; 6.4 `status`-reversal + `quote_id`-re-parent trigger holes) were RESOLVED with
patches + new INT negatives during the story runs. R-617 (`pnpm audit`) is resolved as a blocking CI gate.

⚠️ Critical Gaps: 0

📝 Recommended Actions: (1) proceed to the epic-boundary NFR + test-review + retro, then epic close;
(2) keep R-610 (demo-data-only tax/terms accept) visible — re-score to a blocker + reinstate the sign-off
session if real-customer use is proposed; (3) route the Low deferrals (quote_events INSERT-forgeability;
PDF-metadata transactionality/audit; quote-number-in-snapshot + §24 display; two 6.5 test-completeness
gaps) to their owner follow-ups; (4) align the stale `epic-6: in-progress` sprint-status entry.

✅ GATE: PASS — Epic 6 coverage meets standards; the epic may proceed to the epic-boundary gates and Epic 7.
