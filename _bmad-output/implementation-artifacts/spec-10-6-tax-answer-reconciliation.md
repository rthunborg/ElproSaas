---
title: "Tax Answer Reconciliation"
type: feature
created: "2026-08-31"
status: review
review_loop_iteration: 3
followup_review_recommended: false
baseline_revision: "aab9fc0e38ae022d009967f3ebcd2a93e7ca723b"
legacy_source: "legacy-v024-10-6-tax-answer-reconciliation.md"
context: []
warnings:
  - "Adopted from the pre-v0.30 Auto-BMAD story/review artifact; legacy review counters remain state evidence only."
  - "Round 3 of 3 follow-up convergence is verified; no further automatic review round is permitted."
deferred:
  - severity: resolved
    summary: "ADR-B008 / Story 10.8 owns review provenance, authority, and atomic audit."
  - severity: resolved
    summary: "ADR-B008 / Story 10.9 owns stale-PDF validity and attachment carry-forward."
---


# Story 10.6: Tax-Answer Reconciliation — VAT Rounding, Deduction Classification, and Reverse Charge

Status: review

> **Corrective review (2026-08-31; Round 3 and hosted CI verified 2026-09-01):** the three review deferrals are approved and implemented in Stories 10.8/10.9: provenance/authority/audit, stale-PDF validity, and version attachment carry-forward. ADR-B008's separate server-only HMAC byte-attestation boundary now covers both PDF activation and final send. Local verification and hosted verify/database/Playwright CI are green; Story 10.6 remains in review only for post-merge remote-demo provisioning. Physical Storage-byte reclamation and legal retention remain explicitly deferred to Story 31.7/E31 and are not claimed as implemented.

<!-- Created 2026-07-29 from the ratified owner/accountant answers. -->

## Story

As the company owner who must issue legally correct quotes and invoices,
I want the money engine to match the accountant's ratified rules rather than our provisional assumptions,
so that a real ROT/grön-teknik quote is correct the first time it leaves the system.

## Story Context

This is a **correctness reconciliation**, not a net-new module. The accountant answers dated
2026-07-26 ratified most Phase A assumptions but superseded shipped behavior in three material
places: VAT is currently rounded per line, row visibility is currently entangled with economic
inclusion assumptions, and reverse-charge construction VAT is not modeled. The shipped deduction
engine also still contains provisional profiles and an inert quote-snapshot seam.

Story 10.6 deepens the already-active `calculations`, `quotes`, CRM, settings, and PDF surfaces. It
does not activate a manifest module, add navigation, or create a new tenant table. The corrected
rules apply only while computing a **new** calculation/quote version. Historical sent and accepted
records remain frozen.

**Origin:** `docs/discovery/phase-b-accountant-answers-2026-07-26.md`, incorporated into
`architecture-phase-b.md` §12A and test strategy §16.6.

**Dependency:** Epic 4 money/VAT/tax primitives and the shared Epic 6 quote snapshot builder.

**Impact:** Money **HIGH**. Security/RLS: no new trust boundary and no new table; additive columns on
existing RLS-protected tables retain their existing policies. Migration: **yes**, additive only.

## ⚑ SCOPE BOUNDARY — RATIFIED TAX RULES ON EXISTING CALCULATION/QUOTE SURFACES ONLY

- In scope: pure money/tax rules, calculation inputs and summaries, additive fields on existing
  calculation/quote/customer-facing snapshot tables, shared quote-version creation, deterministic
  PDF output, readiness, migration/reset coverage, and re-derived money/tax/snapshot/PDF goldens.
- Out of scope: e-invoice/Peppol serialization, Skatteverket submission, customer portal or online
  acceptance, BankID, bookkeeping integrations, Fortnox export, the Phase C customer-facing legal
  disclaimer program (`A22-tax`), and any AI flow.
- `PayableRounding=None` remains the default. Do not add a whole-krona payable-rounding UI in this
  story. A future implementation must represent öresavrundning as a separate document amount
  (Peppol BT-114), never by changing lines or VAT.
- The Lovable fixtures remain historical oracle evidence. Record intentional parity deltas; do not
  rewrite captured `old-lovable` values to make the new engine appear identical.

## ⚑ STOP CONDITION — SENT/ACCEPTED COMMITMENTS NEVER RECOMPUTE

Stop and report `needs-human` if an implementation would:

- update, backfill, or recompute a sent quote version, its frozen children, or its stored PDF;
- recompute an accepted price or mutate an existing acceptance/job source amount;
- weaken the sent-version trigger family to make new fields writable;
- infer reverse charge from customer type, organisation number, or a 0% rate;
- introduce a fourth rounding rule or collapse the three ratified rounding primitives;
- add a new tenant-owned table, dependency, module activation, or Phase C surface.

## ⚑ SETTLED IMPLEMENTATION DECISIONS (DO NOT RE-LITIGATE DURING DEV)

1. **Three named rounding authorities stay separate.**
   - Line net: existing half-away-from-zero rounding to whole öre.
   - VAT: round once per document VAT category after summing rounded line nets.
   - Tax claim: discard öre and produce whole SEK. Never call the line/VAT rounding helper here.
2. **Canonical row mapping.**
   - Keep the existing `is_hidden` column; `VisibleToCustomer = !is_hidden`. Do not add a redundant
     visibility column.
   - Add `included_in_invoice_total` as the sole economic-inclusion input consumed by totals.
   - Add the exact closed `DeductionClassification` domain from AC2.
   - Backfill `included_in_invoice_total` once from the legacy optional-selection state. Thereafter,
     option commands may update selection and inclusion coherently, but totals do not derive
     inclusion from visibility.
3. **VAT category identity is `(VatType, rateBp)`.** Rate alone never identifies reverse charge.
   Reverse-charge categories charge zero seller VAT, but remain distinct from an ordinary zero-rate
   category. A future Peppol AE projection may serialize rate/tax as zero without erasing the domain
   type.
4. **Category VAT is the document authority.** If deduction computation needs VAT attributable to
   eligible labor/material, allocate the already-rounded category VAT to classification buckets
   proportionally by net basis, using largest remainder and a canonical classification-key
   tie-break. Allocate to buckets before rows so splitting a row within one classification cannot
   change its tax basis. Bucket allocations must sum exactly to category VAT.
5. **Reverse charge uses an explicit per-document choice in this story.** A verified-customer
   default is an allowed future convenience, not required here. Capture the buyer VAT registration
   number as explicit document input; do not derive it from `org_nr`. Missing buyer VAT number on a
   reverse-charge document is a blocking readiness error.
6. **Tax policy is one immutable, typed, time-versioned system registry**, not scattered numeric
   constants and not a tenant table. Each profile has an id, `validFrom`, and nullable `validTo`;
   windows are `[validFrom, validTo)`. Resolution fails loud on gaps, overlaps, invalid dates, or no
   match. New snapshots capture the selected profile id, window, resolving date, and values by
   value.
7. **Date authority is product-specific.** ROT resolves by each expected/actual customer payment
   date; green technology resolves by the installation's final-payment date. Invoice date,
   snapshot time, and payment date are not interchangeable.
8. **ROT and green may coexist only on disjoint classified work.** Replace the current global
   ROT×green document block with a no-double-use invariant: one row/basis part has exactly one
   deduction classification. The same work/installation part can never feed both schemes.
9. **Person allocations are explicit frozen data, not a count-only hint.** The pure engine receives
   ordered PII-free person slots with customer-declared remaining allowances. It allocates the
   whole-SEK claim deterministically, respects per-person and combined limits, distributes residual
   SEK in stable slot order, and fails if declared capacity cannot cover the claim. Names and
   personnummer never enter `src/lib/money`.
10. **Snapshot schema is versioned.** Legacy/null tax-rule version means the Phase A frozen shape;
    new versions carry the ratified shape. Readers and PDF reconstruction support both without
    recomputing either. The shared `buildFreshQuoteSnapshot()` path remains the only authority for
    initial creation and re-versioning.

## Acceptance Criteria

### AC1 — VAT rounds per VAT category at document level, not per line

**Given** the current engine rounds VAT per line and sums rounded line VAT  
**When** a document total is computed  
**Then** each line net first rounds to whole öre, taxable net is grouped and summed by
`(VatType, rateBp)`, VAT is computed and rounded once for each group, and document VAT is the exact
sum of those category amounts  
**And** two economically identical documents differing only in same-classification line splitting
produce identical net, VAT, gross, deduction basis, deduction, and payable totals  
**And** all affected golden fixtures are re-derived from the new authority rather than hand-patched.

### AC2 — Visibility, invoice inclusion, and deduction classification are independent

**Given** a calculation row can be hidden, billable, and tax-eligible independently  
**When** any one property changes  
**Then** neither of the other properties changes implicitly  
**And** every row carries:

- `VisibleToCustomer` (represented by existing `is_hidden`);
- `IncludedInInvoiceTotal`;
- `DeductionClassification` in the closed set:
  `NONE`, `ROT_LABOR`, `GREEN_SOLAR_LABOR`, `GREEN_SOLAR_MATERIAL`,
  `GREEN_STORAGE_LABOR`, `GREEN_STORAGE_MATERIAL`, `GREEN_CHARGING_LABOR`,
  `GREEN_CHARGING_MATERIAL`.

**And** hidden-but-billable rows remain in the invoice total, while only eligible classifications
enter a deduction basis  
**And** a row with `IncludedInInvoiceTotal=false` contributes to neither invoice/VAT totals nor any
deduction basis, even if it carries an eligible classification  
**And** material never enters ROT; travel, vehicle/machine, administration, and unresolved mixed
costs enter neither ROT nor green (`NONE`)  
**And** the customer document can hide detail labels while still showing reconciling summaries for
labor, material, other, VAT, deduction, and amount payable.

### AC3 — Construction reverse charge is a VAT type, never inferred from 0%

**Given** construction-sector reverse charge applies only after an explicit applicability decision  
**When** the user selects `REVERSE_CHARGE_CONSTRUCTION` for a document/category  
**Then** it remains distinct from `STANDARD_VAT_25` even though seller-charged VAT is zero  
**And** company/customer type, `org_nr`, and a numeric zero rate never activate it  
**And** a reverse-charge document cannot become ready without an explicitly captured buyer VAT
registration number  
**And** the customer-facing PDF prints that number and the exact text
`Omvänd betalningsskyldighet`, does not imply that VAT was charged, and still reconciles mixed
standard/reverse-charge categories independently  
**And** material supplied as part of the selected construction service may follow that service's
reverse-charge type, while a plain goods sale is not silently reclassified.

### AC4 — Claims truncate to whole SEK and rules/caps resolve by date

**Given** a ROT or green claim may contain öre before the submission boundary  
**When** the claim amount is finalized  
**Then** öre are discarded downward (never rounded to nearest), the deduction applied to payable is
an exact multiple of 100 öre, and any per-person allocations are whole SEK summing exactly to the
document deduction  
**And** ROT enforces both the 50,000 SEK per-person ROT cap and the representable 75,000 SEK combined
ROT+RUT cap against customer-declared remaining allowances  
**And** the green 50,000 SEK per-person allowance remains separate from the ROT/RUT ceiling  
**And** profiles carry `validFrom`/`validTo`, resolve fail-loud by the relevant date, and are frozen
onto each new quote version  
**And** ROT uses the customer's payment date, not invoice/snapshot date, while green uses final
payment date  
**And** ROT basis is eligible labor including the reconciled VAT actually allocated to that labor,
not a hard-coded `× 1.25`.

### AC5 — Green 97% schablon is explicit, fixed-price-only, and category-aware

**Given** actual eligible costs are the default green basis  
**When** green technology is estimated  
**Then** `ACTUAL_ELIGIBLE_COSTS` is used unless the user explicitly selects the 97% method and
confirms a genuine fixed-price total contract  
**And** invalid 97% use is rejected rather than silently downgraded  
**And** solar, storage, and charging bases are split before applying 15%, 50%, and 50% respectively  
**And** a fixed-price mixed project provides an explicit reconciling category split; the engine
does not guess it  
**And** no row/basis part supports both ROT and green.

## Tasks / Subtasks

- [x] **Task 1 — Replace provisional tax constants with the canonical versioned policy/domain authority (AC4, AC5)**
  - [x] Define one exported `VatType`, `DeductionClassification`, green-category/basis-method, and
    tax-profile domain; import it across money, calculation, snapshot, and PDF code instead of
    copying closed unions.
  - [x] Encode the ratified profiles as immutable versioned records: standard VAT 25%; ROT 30%,
    50,000 SEK/person, 75,000 SEK combined ROT+RUT; green solar 15%, storage 50%, charging 50%,
    50,000 SEK/person; default actual costs; fixed-price share 97%.
  - [x] Add pure `[validFrom, validTo)` resolution with typed failures for overlap, gap, invalid date,
    and no matching profile; take dates as injected inputs and never read the clock.
  - [x] Add a separately named whole-SEK claim truncation primitive and deterministic capped
    whole-SEK person allocation. Preserve `lineNetOre`, `sumOre`, overflow guards, and formatting.

- [x] **Task 2 — Make document/category VAT the single calculation authority (AC1, AC3, AC4)**
  - [x] Replace the `lineVatOre`/`sumVatOre` document-total path with a pure category aggregator
    keyed by `(VatType, rateBp)`.
  - [x] Keep line-net rounding unchanged; sum rounded line nets, round VAT once per category, and
    sum the category VAT amounts.
  - [x] Model reverse charge as a distinct category with zero seller-charged VAT and typed
    metadata; never branch from `rateBp === 0`.
  - [x] Treat missing standard-VAT rate as an incomplete typed input at the quote boundary, not as
    an ordinary 0% category; drafts may remain incomplete but a new customer version may not.
  - [x] Allocate reconciled category VAT to deduction-classification buckets by proportional
    largest remainder with canonical-key tie-break; prove exact reconciliation and split invariance.
  - [x] Remove/update stale comments and exports that describe per-line VAT as the final policy.

- [x] **Task 3 — Persist and edit the independent calculation/tax inputs (AC2, AC3, AC4, AC5)**
  - [x] Add one forward-only migration; never edit the historical calculation/quote/lock
    migrations.
  - [x] Extend existing calculation rows with checked/backfilled
    `included_in_invoice_total`, `deduction_classification`, and `vat_type`; keep `is_hidden` as the
    visibility storage field.
  - [x] Extend the existing calculation/document state with validated buyer VAT number, relevant
    payment/final-payment date, PII-free person allowance slots, deduction choice, green basis
    method, and explicit fixed-price category split. Prefer a typed checked snapshot payload on the
    existing calculation header over a new table.
  - [x] Update every explicit read/write allow-list, form parser, validator, row command, row editor,
    totals summary, and pre-quote preview. Server validation is authoritative; client controls are
    UX only.
  - [x] Treat `included_in_invoice_total` as the totals authority. Preserve option-selection UX by
    writing selection and inclusion coherently, not by deriving totals from `is_hidden`.
  - [x] Reject impossible classifications and incomplete inputs. Default new/unclassified rows to
    `NONE`, standard VAT, and included; never auto-classify from row label or customer type.
  - [x] Keep new controls keyboard-operable, correctly labelled, and paired with field-level errors
    plus an announced readiness summary; do not rely on color alone.

- [x] **Task 4 — Rebuild deduction estimates from classified document facts (AC2, AC4, AC5)**
  - [x] Derive ROT only from `ROT_LABOR` net plus its allocated actual VAT; never include material,
    travel, machinery, administration, or a hard-coded gross multiplier.
  - [x] Derive each green category from its matching labor/material classes including allocated
    VAT; apply the category rate after category splitting.
  - [x] Apply customer-declared per-person remaining allowances, ROT and combined caps, claim
    truncation, and exact person allocation. Replace the current flat-cap/count-only behavior.
  - [x] Permit disjoint ROT and green work on one document; reject any double-fed work part.
  - [x] Preserve pure deterministic typed results, PII-free engine inputs, copy-by-value assumption
    snapshots, and integer-öre overflow protection.

- [x] **Task 5 — Freeze the reconciled result on every new quote version (all ACs)**
  - [x] Extend the typed quote snapshot/line allow-lists with snapshot-schema/tax-rule version,
    category VAT breakdown, independent row properties, resolved policy window/date, basis method,
    calculated/claim deduction, person allocation, and reverse-charge buyer metadata.
  - [x] Keep `buildFreshQuoteSnapshot()` as the shared authority for both initial quote creation and
    `createNewQuoteVersion`; do not add a second calculation path.
  - [x] Set `accepted_price_ore` from the reconciled payable result. Acceptance/job code continues
    consuming that frozen value and performs no tax recomputation.
  - [x] Extend both quote-creation RPC implementations and all explicit DB projections/payload
    serializers in the additive migration.
  - [x] Redefine the latest parent sent-lock function so every new customer-visible/tax snapshot
    field is protected. Retain the child parent-status lock and prove a new child field cannot
    mutate after send.
  - [x] Leave existing rows nullable/legacy-versioned. Do not data-backfill historical tax values;
    support the legacy frozen shape through an explicit compatibility adapter.

- [x] **Task 6 — Render an honest, deterministic customer document (AC2, AC3)**
  - [x] Extend the snapshot-only PDF view model; the renderer must not query mutable
    calculation/customer/settings data or perform tax arithmetic.
  - [x] Render reconciling labor/material/other/VAT/deduction/payable summaries while continuing to
    suppress hidden row labels/descriptions and all cost/margin/internal-note fields.
  - [x] On reverse charge, render buyer VAT number and exact wording
    `Omvänd betalningsskyldighet`; replace any label that incorrectly implies charged VAT.
  - [x] Preserve deterministic server rendering, explicit `sv-SE`, pinned `pdf-lib`, injected
    timestamp, and existing PDF storage/retry behavior.
  - [x] Keep legacy snapshots renderable without recalculating them under the new rules.

- [x] **Task 7 — Readiness and failure honesty (AC2–AC5)**
  - [x] Extend the centralized readiness rule table for missing buyer VAT number, missing resolving
    date/profile, invalid classification, insufficient person allowance, incomplete category split,
    and invalid fixed-price schablon use.
  - [x] Reuse/export `READINESS_CODES`; do not put fictional warning strings in fixtures.
  - [x] Keep estimates explicitly preliminary and customer-declared where allowance/applicability
    cannot be verified. This does not implement the deferred full legal disclaimer program.

- [x] **Task 8 — Tests, goldens, and standing-control repair (all ACs)**
  - [x] Pure unit tests (`node --test`): line-net behavior unchanged; split invariance; mixed VAT
    categories/types; rate-zero non-inference; VAT allocation reconciliation; every deduction
    classification; property independence; `.99` claim truncation; exact/capped person allocation;
    valid-window boundaries/gaps/overlaps; ROT payment-year vs invoice-year; green final-payment
    year; actual-cost default; valid/invalid 97%; category split; and no double feed.
  - [x] Snapshot/PDF unit goldens: new-version category facts, legacy compatibility, buyer VAT
    number/exact reverse-charge wording, zero charged VAT, reconciling summaries, and non-empty
    hidden/internal `mustNotAppear` negatives.
  - [x] DB-backed Vitest integration: additive schema/checks/backfill; both quote creation paths;
    parent/child sent-lock rejection for new fields; historical sent/accepted values unchanged;
    PDF source-of-truth; acceptance/job consumption of frozen payable; and a non-vacuous
    cross-tenant negative over every newly projected field.
  - [x] Playwright E2E: explicit reverse-charge choice/readiness/PDF path and independent
    visibility/inclusion/classification behavior at the user boundary.
  - [x] Re-derive every affected money, calculation, quote-snapshot, and PDF fixture from the new
    authority. Keep new numeric golden values below 1,000,000,000 öre to avoid the known bare
    10-digit ORGNR false positive; retain LF pinning.
  - [x] Convert the touched `TAX_SURFACE_PRESENT` / `VAT_SURFACE_PRESENT` self-skipping gates to hard
    assertions; no `describe.skip`, `test.skip`, stale RED-PHASE banner, hollow assertion, or magic
    substring/category-count proof may claim AC coverage.
  - [x] Align the touched quote snapshot warning fixtures to real `READINESS_CODES` and use a
    structured coverage manifest (derived count + matched keys).
  - [x] Run typecheck, lint, full `test:unit`, build, containment checks, local empty-DB migration
    reset, full `test:int`, and relevant E2E. Do not weaken or reorder CI.

## Dev Notes

### Current implementation → required change → preserve

| Area | Current state that conflicts | Change here | Preserve |
| --- | --- | --- | --- |
| `src/lib/money/ore.ts` | Comments still treat document VAT as unresolved | Add/host the distinct claim-truncation seam and update stale policy text | Line-net rounding, `sumOre`, integer safety, formatter |
| `src/lib/money/vat.ts` | `lineVatOre` + `sumVatOre` makes per-line VAT the total | Category aggregator keyed by `(VatType, rateBp)` | Basis-point validation, pure typed results |
| `src/lib/money/tax.ts` | Provisional flat profiles, generic green 20%, round-to-öre claim, count-only person seam, global mix block | Versioned profiles, classified bases, whole-SEK claims/allocations, product dates/categories | Pure/injected inputs, no PII, typed failures |
| `src/features/calculations/totals.ts` | Hidden rows count; option selection controls inclusion; VAT is composable per row/section | Explicit inclusion/classification/type; whole-document VAT authority | Pure totals module and source öre |
| `src/server/commands/quotes/snapshot-build.ts` | Shared seam exists, but deduction is hardcoded `0` and assumptions are scalar/inert | Build/capture the reconciled result once for both creation paths | Shared path, fresh source capture for new version |
| `src/lib/quote-snapshot/**` | No tax schema version/category facts/type/classification | Extend allow-listed frozen contract | Deep freeze, injected capture instant, no internal cost |
| `src/lib/quote-pdf/view-model.ts`, `src/server/quote-pdf/render.ts` | Scalar VAT and generic “incl. moms”; no reverse-charge disclosure | Snapshot-derived summaries and exact reverse-charge output | No mutable reads/math, deterministic render |
| sent-lock migration/function | Parent lock compares an explicit known-column tuple | Add every new parent snapshot field to the tuple | Fail-closed `QV409` family and child lock |

### Data and migration contract

- Create one new timestamped additive migration under `supabase/migrations/**`; old migrations are
  production history and must not be edited.
- No new tenant table: manifest status, nav, H4 `TENANT_TABLES`, and exact-policy inventory remain
  unchanged. Existing table RLS/GRANTs remain the access authority.
- New DB columns use snake_case with CHECK constraints matching the canonical TypeScript domains.
  Any JSON snapshot field has a typed parser/validator and explicit schema version; a free-form blob
  is not acceptable.
- Legacy rows remain readable. Backfill only the safe mechanical row-inclusion default; never
  backfill tax answers, buyer VAT numbers, new quote-version totals, sent rows, or accepted records.
- The sent-lock function enumerates protected columns. Missing a new parent field from its tuple is
  a release-blocking immutability defect.

### Reuse — do not fork

- `lineNetOre`, `sumOre`, `isOreAmount`, `isVatRateBp`, and `formatOreAsKronor`.
- `buildFreshQuoteSnapshot()` for both initial create and re-version.
- `buildQuoteVersionSnapshot()` copy-by-value/deep-freeze discipline.
- The quote PDF snapshot-only view-model boundary and deterministic renderer.
- `READINESS_CODES` and centralized readiness classification.
- Existing command envelope/RLS client/error mapping; no service-role path.
- One canonical domain export for VAT types and deduction classifications. Do not reproduce the
  current hand-copied quote/money unions.

### Primary source files

- Money/tax: `src/lib/money/{ore,vat,tax,index}.ts`.
- Calculations: `src/features/calculations/{totals,read,form-parsing,readiness}.ts`,
  `src/server/commands/calculations/{validation,rows}.ts`,
  `src/components/calculations/{CalculationEditor,SectionEditor,RowEditor,TotalsSummary,PreQuotePreview}.tsx`.
- Quote freeze/read: `src/lib/quote-snapshot/{types,build}.ts`,
  `src/server/commands/quotes/{snapshot-build,quote-db,quotes,new-version,generate-pdf}.ts`,
  `src/features/quotes/{read,view-model}.ts`.
- PDF: `src/lib/quote-pdf/view-model.ts`, `src/server/quote-pdf/render.ts`.
- Migration precedent (read only): calculation model, quote-version model, sent lock, and
  new-version migrations dated 2026-07-02 through 2026-07-08.

The lists above are a change map, not permission to modify every file. Follow the existing explicit
projection/allow-list call graph and touch only consumers that compile or behaviorally require the
new fields.

### Testing contract

| ID family | Level | Minimum proof |
| --- | --- | --- |
| `10.6-UNIT-01..06` | `node --test` | Category VAT/split invariance; classification independence; claim/date/caps; green basis; reverse-charge type |
| `10.6-GOLDEN-01..04` | `node --test` | Money/calc/snapshot/PDF re-derived truth + structured non-vacuity |
| `10.6-INT-01..05` | Vitest + local Supabase | Migration/RPC parity, new-field sent locks, historical immutability, PDF and acceptance source-of-truth |
| `10.6-E2E-01..02` | Playwright | Explicit reverse-charge readiness/PDF and independent row-property UX |

Pure business logic belongs in the repository's `node --test` lane. Use Vitest only for the
database-backed command/RLS/migration boundary and Playwright for browser behavior. Fix dates and
inject clocks; tests whose title says isolation, immutability, or split invariance must assert the
seeded values that prove it.

### Previous-story, retro, and deferred-work intelligence

- Story 10.4 established the two-runner discipline and exposed a recurring false-green class:
  assertions must prove seeded facts, not merely array/result shape. Apply that standard to every
  numeric and lock test here.
- Epic 10's retro makes **unskip-or-delete** and mechanical non-vacuity a hard gate. A self-disabled
  tax/VAT golden is not coverage.
- The deferred ledger's flat `persons` seam is owned here: replace count-only capture with enforced
  per-person/combined caps and exact allocation.
- Touched money closed unions must gain a canonical source/drift proof; do not add another hand
  copy.
- The odd legacy VAT/tax assumption-result discriminant is adjacent but not an AC. Preserve it
  intentionally unless the new implementation requires a coherent migration; do not perform an
  unrelated cosmetic rewrite.
- Touched quote fixtures must replace fictional warning codes with `READINESS_CODES`.
- Keep golden JSON LF-pinned and below the known 10-digit money/ORGNR scanner collision.

### Technology and dependency constraints

Current relevant stack: TypeScript 5.9.3, Next.js 16.2.11, React 19.2.4, Vitest 4.1.9,
Playwright 1.61.x, and exact-pinned `pdf-lib` 1.17.1. This story needs no new package and no version
change.

### Official technical/legal source checks (verified 2026-07-29)

- Peppol/EN 16931 VAT category basis and category VAT:
  [BR-S-08](https://docs.peppol.eu/poac/eu/pint-eu/trn-invoice/rule/BR-S-08/),
  [BR-CO-17](https://docs.peppol.eu/poac/eu/pint-eu/trn-invoice/rule/BR-CO-17/), and
  [active November 2025 rules](https://docs.peppol.eu/poacc/billing/3.0/rules/ubl-tc434/).
- Skatteverket ROT:
  [how ROT works](https://www.skatteverket.se/privat/fastigheterochbostad/rotarbeteochrutarbete/safungerarrotavdraget.4.5947400c11f47f7f9dd80004014.html),
  [business guidance](https://www.skatteverket.se/foretag/skatterochavdrag/rotochrut/safungerarrotavdraget.4.2ef18e6a125660db8b080002709.html),
  and [SFS 2009:194](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2009194-om-forfarandet-vid-skattereduktion_sfs-2009-194/).
- Skatteverket green technology:
  [how it works](https://www.skatteverket.se/privat/fastigheterochbostad/gronteknik/safungerarskattereduktionenforgronteknik.4.676f4884175c97df4192870.html),
  [approved work](https://www.skatteverket.se/foretag/skatterochavdrag/gronteknik/godkandaarbeten.106.676f4884175c97df4192b03.html),
  and [SFS 2020:1066](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-20201066-om-forfarandet-vid-skattereduktion_sfs-2020-1066/).
- Skatteverket construction reverse charge:
  [applicability](https://www.skatteverket.se/foretag/moms/sarskildamomsregler/byggverksamhet/omvandskattskyldighetinombyggsektorn.4.47eb30f51122b1aaad28000545.html),
  [covered services](https://www.skatteverket.se/foretag/moms/sarskildamomsregler/byggverksamhet/omvandskattskyldighetinombyggsektorn/tjanstersomomfattasavomvandskattskyldighet.4.19b9f599116a9e8ef36800022231.html),
  and [invoice requirements](https://www.skatteverket.se/foretag/moms/sarskildamomsregler/byggverksamhet/omvandbetalningsskyldighetinombyggsektorn/avdragsrattfaktureringochredovisning.4.19b9f599116a9e8ef36800022270.html).

These sources clarify two implementation traps: ROT and green can coexist on separate classified
work even though the same part cannot support both; and reverse-charge AE serialization may carry
zero rate/tax while its domain identity remains distinct from ordinary zero-rated VAT.

### References

- [Source: `_bmad-output/planning-artifacts/epics-phase-b.md` — Story 10.6, AC1–AC5, impact and stop condition]
- [Source: `_bmad-output/planning-artifacts/architecture-phase-b.md` — §12A.1–12A.7, §16.6, §18, §24]
- [Source: `_bmad-output/planning-artifacts/prd-phase-b.md` — FR117, NFR49, NFR55, §14 exclusions]
- [Source: `docs/discovery/phase-b-accountant-answers-2026-07-26.md` — A.1–A.2, B.1–B.4, C.1–C.3, D/2.2]
- [Source: `_bmad-output/project-context.md` — Money/Tax/Quote Rules, testing, golden hygiene, sent locks]
- [Source: `_bmad-output/auto-bmad/retro-notes/epic-10.md` — two-runner and unskip/non-vacuity lessons]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — person-cap seam, closed-union drift, golden self-disable, warning-code and scanner residuals]
- [Source: `_bmad-output/implementation-artifacts/10-4-pipeline-surfacing-and-dashboard-read-model.md` — prior-story test/review lessons]
- [Source: `src/lib/money/**`, `src/features/calculations/totals.ts`, `src/server/commands/quotes/snapshot-build.ts`, `src/lib/quote-snapshot/**`, `src/lib/quote-pdf/view-model.ts`, `src/server/quote-pdf/render.ts` — current implementation seams]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

> **Historical / superseded evidence:** the counts and PASS statements in this record predate the approved HMAC-attestation reconciliation. They are retained as review history only; current verification is recorded in **Current Verification Evidence** and must not be inferred from this section.

- `pnpm run typecheck` — PASS.
- `pnpm run lint` — PASS, zero warnings.
- `pnpm run test:unit` — PASS: 1,642 tests, 0 failures, 0 skipped.
- `pnpm run build` — PASS (Next.js 16.2.11 production build).
- Current-diff focused consistency suite — PASS: 47/47.
- `pnpm run verify:lockfiles` — PASS.
- `pnpm run verify:service-role-containment` — PASS.
- `pnpm run verify:bundle-containment` — PASS after the production build.
- `pnpm exec supabase db reset --local` — PASS from an empty local database through the complete
  migration chain, including the terminating legacy-VAT backfill/finalization path.
- `SUPABASE_TEST_REQUIRED=1 pnpm exec vitest run
  tests/integration/commands/tax-answer-reconciliation.int.test.ts` — PASS: 17/17 required
  Story 10.6 assertions, 0 skipped, including five sanctioned VAT identities, duplicate/oversize
  negatives, V1 recovery, quarantine/remediation, sent locks, and cross-tenant RPC denial.
- `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` — PASS: 77/77 files and 817/817 tests, 0 failures,
  0 skipped. Shared historical quote fixtures now carry complete, reconciled V2 facts.
- Focused acceptance evidence — PASS: acceptance-to-job 2/2 and acceptance golden 1/1.
- Focused frozen compatibility/PDF evidence — PASS: 21/21; preview review-token evidence — PASS:
  16/16.
- `pnpm exec playwright test tests/e2e/calculations/tax-answer-reconciliation.e2e.spec.ts` — PASS:
  2/2 real-browser journeys, including quote creation, PDF generation, reverse-charge disclosure,
  and independent row properties.
- `pnpm exec supabase db lint --local` — PASS (exit 0); only advisory volatility and retained
  compatibility-parameter warnings were reported.
- Final independent money/tax review — PASS: no unresolved release-blocking SEK, VAT, ROT,
  grön-teknik, snapshot, or acceptance finding.
- Final security/RLS review — PASS-WITH-LIMITATION: no release-blocking Critical/High isolation,
  service-role, storage, or unauthenticated-function finding.
- Iteration-5 final verification — PASS: `npm run typecheck`; `npm run lint`; full unit 94 suites,
  1,653/1,653 tests; clean local Supabase reset; strict warning-level DB lint with `results: []`;
  Story integration 25/25; full required integration/RLS 77/77 files and 825/825 tests; Story E2E
  2/2; production build; and lockfile, service-role, and post-build bundle containment.

### Completion Notes List

- Added one canonical exported money/tax domain and immutable time-versioned policy registry. The
  pure engine now owns document-category VAT, largest-remainder VAT allocation, whole-SEK claim
  truncation, stable ordered person allocation, exact caps, date resolution, fixed-price 97%
  validation, and disjoint ROT/green classification.
- Made visibility, invoice inclusion, deduction classification, and VAT type independent row
  properties across persistence, server validation, read models, form parsing, UI controls,
  totals, preview, and readiness. Impossible row-type/classification pairs fail at both command and
  database boundaries.
- Added explicit reverse-charge construction VAT with buyer-VAT readiness and exact customer PDF
  wording. A numeric zero rate or customer/company metadata never activates reverse charge.
- Added the canonical V2 quote tax snapshot and category/summary facts to the single shared fresh
  snapshot path. Initial creation and re-versioning freeze the same result; V2 acceptance/job
  source totals consume frozen `payableOre` without tax recomputation.
- Kept V1 compatibility literal: legacy/null-version snapshots remain readable and expose only
  stored legacy facts; the adapter does not invent gross, calculated deduction, claim, or other
  V2-derived facts. Existing V1 drafts are explicitly unsendable and the user-facing recovery flow
  creates a fresh V2 from current authoritative calculation/tax inputs without mutating the V1 row.
- Added the single forward-only additive migration. It backfills only provable canonical legacy VAT
  pairs, quarantines ambiguous zero/unsupported values for explicit remediation, loops bounded
  batches to a completion assertion, validates closed input/V2-answer shapes and row/person limits,
  binds both creation RPCs to persisted calculation/line facts, blocks invalid sent transitions,
  and freezes all V2 parent/child facts.
- Added a server-verified SHA-256 review proof over every quote-relevant calculation, customer,
  terms, row, source, and policy fact. Preview uses the projected quote-capture date; confirmation
  fails closed if any reviewed source changes before the frozen V2 snapshot is created.
- Added a keyboard-operable, order-preserving allowance editor for up to 50 canonical `PERSON_n`
  slots. Fresh writes stay PII-free, while the frozen compatibility adapter preserves bounded
  historical allocation order/amounts without returning or rendering raw legacy identifiers.
- Added/re-derived structured money, calculation, snapshot, PDF, and acceptance-to-job goldens;
  repaired the touched self-skipping standing controls; and routed all new Story 10.6 fixtures
  through the shared PII scanner.
- Added `10.6-INT-12`, a direct authenticated Tenant B regression for both redefined quote-version
  RPCs. It asserts rejection and an exact before/after Tenant A quote/version/line/event/counter plus
  frozen-parent readback, covering the SECURITY INVOKER + RLS boundary without duplicating UI or
  pure-money tests.
- Recorded the intentional Lovable parity delta: Story 10.6 document-category VAT may differ by one
  öre from the historical per-line oracle. Captured old values remain unchanged.
- Accepted architecture limitation: the inherited `SECURITY INVOKER` design requires same-tenant
  quote-table grants. A same-tenant authenticated caller can construct a fully valid input-bound V2
  draft and can perform valid lifecycle transitions directly, bypassing command audit/event
  provenance. Inconsistent math, non-draft inserts, cross-tenant access, and post-send mutation are
  still blocked. Closing this safely requires an owner-approved privilege/API redesign, not a casual
  `SECURITY DEFINER` switch.
- Non-blocking test-hardening follow-ups: add a genuine pre-migration upgrade fixture for the
  backfill/quarantine path, application-command coverage for V1 recovery, and command-level
  review-token parity/staleness coverage. Current SQL/RPC, helper, UI, and pure digest tests cover
  the shipped behavior; these follow-ups reduce future projection-drift risk.
- Optional compatibility alignment follow-up: the V1-draft UI hides presentation edits and PDF
  generation, while inherited same-tenant server paths still permit those non-send operations.
  Sending remains blocked at the database boundary and this does not alter the frozen commitment.
- Resolved all 13 non-deferred iteration-3 review findings. Green-category calculations now
  preserve exact rational shares and truncate once at the scheme/document claim boundary; mixed
  allowance capacity, reverse-charge/deduction posture, inactive scheme facts, and economic summary
  categories fail closed across canonical input, frozen-answer compatibility, and SQL validation.
- Hardened V2 lifecycle and concurrency boundaries: child inserts are creation-transaction-only,
  successor creation locks and revalidates the authoritative latest version, row/section moves use
  a deterministic lock protocol, and SQL enforces canonical buyer-VAT posture, ISO resolving dates,
  and sorted rule-version ids. Quote capture now uses one DST-aware Europe/Stockholm business date.
- Corrected V2 PDF VAT presentation to derive from frozen categories and omit the misleading tenant
  standard-rate scalar. Iteration-3 verification is green: focused consistency 47/47, Story INT
  17/17, full required integration/RLS 77/77 files and 817/817 tests, Story E2E 2/2, full unit
  1,642/1,642, fresh database reset, database lint (advisories only), typecheck, lint, build,
  lockfile, service-role containment, and bundle containment.
- Corrected all 19 iteration-4 review findings: successful in-page calculation/tax edits now refresh
  server-rendered review proofs; proof-less list quote creation is blocked; the calculation-page
  creation path remains no-attachment-only; optional selection/inclusion, quarantined VAT
  remediation, row-type classification, inactive tax fields, legacy allowance aliases, preview
  digest/date gating, applicable-policy review hashing, frozen-field digest projection, failed line
  totals, reverse-charge PDF category labels, document VAT form parsing, and specific readiness
  blockers now fail closed or preserve explicit owner intent. Iteration-4 verification is green:
  typecheck, lint, focused 158-test regression, full unit 1,642/1,642, fresh local Supabase reset,
  Story integration 17/17, full required integration/RLS 77/77 files and 817/817 tests, Story E2E
  2/2, production build, lockfile/service-role/bundle containment, DB lint exit 0 with retained
  Story 10.6 advisories only, review-finding accounting, post-fix verifier, and diff hygiene.
- Corrected all 16 iteration-5 review findings. The 97% green fixed-price method now requires a
  persisted, canonical `fixedPriceRowIds` scope; the scoped included green rows reconcile exactly to
  `fixedPriceOre` and its category split, while unrelated ROT/NONE rows may coexist only outside the
  scope and no row can fund both schemes.
- Made reviewed-preview proof mandatory and transaction-bound. Both creation RPCs lock and bind the
  authoritative source version, calculation rows and derived line economics, quote/customer/company/
  terms/attachment facts, readiness projection, capture date, and calculation status before freezing
  V2 snapshots. Successor lineage, insert phantoms, singleton sources, attachment lifecycle, null
  supersede, base/option splits, and sign-off posture fail closed.
- Aligned TypeScript and SQL for exact-rational green allocation, canonical `PERSON_1..50` slots,
  source-row persistence, and the 1/1/222 öre boundary. Repaired coherent option/VAT transitions,
  rollover refresh, controlled tax-settings resynchronization, reverse-charge conflicts, applicable
  policy resolution, proof inputs, truthful inclusion presentation, and Swedish PDF green labels.
- Retained the already-approved same-tenant `SECURITY INVOKER` limitation: a direct caller with the
  inherited quote-table authority can fabricate human-review/warning provenance while still being
  constrained by all structural, economic, lineage, lifecycle, tenant, and RLS invariants. Persisted
  or HMAC-backed review authority remains an owner-level API redesign outside Story 10.6.
- Iteration-5 verification is green: clean reset; warning-clean strict DB lint; Story integration
  25/25; full required integration/RLS 77/77 files and 825/825 tests; Story E2E 2/2; full unit
  1,653/1,653; typecheck; zero-warning lint; production build; lockfile, service-role, and post-build
  bundle containment.

### File List

- `_bmad-output/implementation-artifacts/10-6-tax-answer-reconciliation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/automation-summary.md`
- `src/app/(app)/calculations/[calculationId]/page.tsx`
- `src/components/calculations/CalculationEditor.tsx`
- `src/components/calculations/PreQuotePreview.tsx`
- `src/components/calculations/RowEditor.tsx`
- `src/components/calculations/SectionEditor.tsx`
- `src/components/calculations/TaxSettingsPanel.tsx`
- `src/components/quotes/QuoteDetailView.tsx`
- `src/features/calculations/action-state.ts`
- `src/features/calculations/actions.ts`
- `src/features/calculations/allowance-editor.ts`
- `src/features/calculations/form-parsing.ts`
- `src/features/calculations/limits.ts`
- `src/features/calculations/pre-quote-review.ts`
- `src/features/calculations/read.ts`
- `src/features/calculations/readiness.ts`
- `src/features/calculations/row-option-transition.ts`
- `src/features/calculations/row-vat-transition.ts`
- `src/features/calculations/tax-readiness.ts`
- `src/features/calculations/tax-settings-ui.ts`
- `src/features/calculations/totals.ts`
- `src/features/quotes/actions.ts`
- `src/features/quotes/follow-up-dates.ts`
- `src/features/quotes/read.ts`
- `src/lib/datetime/business-date.ts`
- `src/lib/money/domain.ts`
- `src/lib/money/index.ts`
- `src/lib/money/ore.ts`
- `src/lib/money/tax-answer.ts`
- `src/lib/money/tax-input.ts`
- `src/lib/money/tax-policy.ts`
- `src/lib/money/vat.ts`
- `src/lib/quote-pdf/index.ts`
- `src/lib/quote-pdf/view-model.ts`
- `src/lib/quote-snapshot/build.ts`
- `src/lib/quote-snapshot/index.ts`
- `src/lib/quote-snapshot/tax-compat.ts`
- `src/lib/quote-snapshot/types.ts`
- `src/server/commands/calculations/calc-db.ts`
- `src/server/commands/calculations/calculations.ts`
- `src/server/commands/calculations/rows.ts`
- `src/server/commands/calculations/validation.ts`
- `src/server/commands/quotes/accept-and-create-job.ts`
- `src/server/commands/quotes/accept.ts`
- `src/server/commands/quotes/generate-pdf.ts`
- `src/server/commands/quotes/new-version.ts`
- `src/server/commands/quotes/quote-db.ts`
- `src/server/commands/quotes/quotes.ts`
- `src/server/commands/quotes/review-token.ts`
- `src/server/commands/quotes/snapshot-build.ts`
- `src/server/commands/quotes/validation.ts`
- `src/server/quote-pdf/render.ts`
- `supabase/migrations/20260805120000_tax_answer_reconciliation.sql`
- `tests/e2e/calculations/tax-answer-reconciliation.e2e.spec.ts`
- `tests/e2e/global-setup.ts`
- `tests/factories/tenants.ts`
- `tests/support/quote-review-proof.ts`
- `tests/fixtures/golden/acceptance/tax-answer-v2-acceptance-job.json`
- `tests/fixtures/golden/calculations/tax-answer-reconciliation-v2.json`
- `tests/fixtures/golden/lovable/quotes.json`
- `tests/fixtures/golden/money/tax-answer-reconciliation-v2.json`
- `tests/fixtures/golden/quote-pdf/tax-answer-reconciliation-v1-v2.json`
- `tests/fixtures/golden/snapshots/tax-answer-reconciliation-v1-v2.json`
- `tests/integration/commands/tax-answer-acceptance-job.int.test.ts`
- `tests/integration/commands/tax-answer-reconciliation.int.test.ts`
- `tests/integration/commands/create-new-quote-version.int.test.ts`
- `tests/integration/commands/file-upload.int.test.ts`
- `tests/integration/commands/generate-quote-pdf-determinism.int.test.ts`
- `tests/integration/commands/generate-quote-pdf-retry-consistency.int.test.ts`
- `tests/integration/commands/generate-quote-pdf-source-of-truth.int.test.ts`
- `tests/integration/commands/generate-quote-pdf-storage-privacy.int.test.ts`
- `tests/integration/commands/mark-quote-version-sent.int.test.ts`
- `tests/integration/commands/quote-version.int.test.ts`
- `tests/integration/components/legacy-draft-recovery.test.ts`
- `tests/integration/rls/cross-tenant-isolation.rls.test.ts`
- `tests/unit/features/calculations/allowance-editor.test.ts`
- `tests/unit/features/calculations/calc-golden-pack-coverage.test.ts`
- `tests/unit/features/calculations/calc-golden-pack.test.ts`
- `tests/unit/features/calculations/form-parsing.test.ts`
- `tests/unit/features/calculations/limits.test.ts`
- `tests/unit/features/calculations/pre-quote-review.test.ts`
- `tests/unit/features/calculations/readiness-inclusion.golden.test.ts`
- `tests/unit/features/calculations/readiness.test.ts`
- `tests/unit/features/calculations/row-option-transition.test.ts`
- `tests/unit/features/calculations/row-vat-transition.test.ts`
- `tests/unit/features/calculations/tax-readiness.test.ts`
- `tests/unit/features/calculations/tax-settings-ui.test.ts`
- `tests/unit/features/calculations/totals.test.ts`
- `tests/unit/features/quotes/send-gate.test.ts`
- `tests/unit/fixtures/golden/lovable/comparison-support.ts`
- `tests/unit/fixtures/golden/lovable/lovable-comparison-calc-quote-pdf.test.ts`
- `tests/unit/fixtures/golden/lovable/lovable-comparison-classification-deltas.test.ts`
- `tests/unit/fixtures/golden/lovable/lovable-pack-support.ts`
- `tests/unit/fixtures/golden/lovable/lovable-shape-guard.test.ts`
- `tests/unit/lib/datetime/business-date.test.ts`
- `tests/unit/lib/money/tax-answer-reconciliation.atdd.test.ts`
- `tests/unit/lib/money/tax-answer-reconciliation.golden.atdd.test.ts`
- `tests/unit/lib/money/tax-policy.test.ts`
- `tests/unit/lib/money/tax.golden.test.ts`
- `tests/unit/lib/money/tax.test.ts`
- `tests/unit/lib/money/vat.golden.test.ts`
- `tests/unit/lib/money/vat.test.ts`
- `tests/unit/lib/quote-pdf/tax-answer-v2.test.ts`
- `tests/unit/lib/quote-snapshot/build.test.ts`
- `tests/unit/lib/quote-snapshot/tax-compat.test.ts`
- `tests/unit/server/commands/calculation-row-limit-command.test.ts`
- `tests/unit/server/commands/calc-validation.test.ts`
- `tests/unit/server/commands/extract-new-version-result.test.ts`
- `tests/unit/server/commands/quote-review-token.test.ts`
- `tests/unit/server/commands/quote-validation.test.ts`
- `tests/unit/server/commands/snapshot-payload-serializers.test.ts`
- `tests/unit/server/commands/tax-input-validation.test.ts`
- `tests/unit/server/quote-pdf/render.test.ts`

### Change Log

- 2026-07-29: Story context created; status set to `ready-for-dev`.
- 2026-08-06: Implemented Story 10.6 end-to-end; added the additive migration, canonical tax
  engine, V2 snapshot/PDF/acceptance path, compatibility adapter, validation/readiness/UI changes,
  and full automated evidence. Status set to `review`; Docker-backed gates remain explicitly
  pending execution on available infrastructure.
- 2026-08-06: Phase 6 automation expansion added direct foreign-tenant coverage for both Story 10.6
  quote-version RPCs and recorded fail-closed Docker/Supabase validation evidence.
- 2026-08-07: Completed review remediation for all 23 iteration-2 findings: terminating
  quarantine-first VAT backfill, explicit V1 recovery, frozen-policy compatibility, five-identity
  VAT coherence, bounded rows/allocations, server-verified preview proof, 50-person authoring, and
  complete V2 integration fixtures. Empty-DB, required integration, E2E, static, build, and
  containment gates are green; status remains `review` for the Phase 9 completion gate.
- 2026-08-18: Completed review remediation for all 13 non-deferred iteration-3 findings: one-boundary
  green-claim truncation, strict tax-input/frozen-answer posture, V2 child and successor lifecycle
  locks, Stockholm legal-date resolution, category-derived PDF VAT presentation, canonical SQL
  validators, and row/section concurrency serialization. Full required regression evidence is green;
  status remains `review` for the Phase 9 completion gate.
- 2026-08-18: Completed review remediation for all 19 iteration-4 findings: refreshed preview
  proofs after editor/tax mutations, blocked proof-less list quote creation, kept calculation-page
  quote creation no-attachment-only, hardened row VAT/classification/inclusion edits, narrowed
  active tax controls, allocated green claims without sequential cap drift, and refined review-token,
  PDF, parser, and readiness semantics. Full iteration-4 gates are green: typecheck, lint, focused
  regression, full unit, fresh Supabase reset, Story/full integration, Story E2E, build,
  containment, DB lint, review accounting, post-fix verifier, and diff hygiene.
- 2026-08-18: Completed review remediation for all 16 iteration-5 findings: persisted explicit green
  fixed-price row scope, mandatory transaction-bound review proof, authoritative successor/source
  lineage, exact TypeScript/SQL allocation parity, canonical allocation slots, synchronized editor
  transitions, rollover/policy-proof handling, and truthful preview/PDF presentation. Clean reset,
  strict DB lint, Story/full integration, Story E2E, full unit, static, build, and containment gates
  are green; status remains `review` for the Phase 9 completion gate.

### Review Findings

- [x] [Review][Decision][High] The 97% method has no authoritative fixed-price contract scope — AC5 requires a genuine fixed-price total contract, but the input proves only that green-category splits sum to `fixedPriceOre` and the answer binds that amount to the green-classified subset; billed NONE/ROT/other rows may either be unrelated work or costs inside the fixed installation, so requiring document gross would also conflict with sanctioned disjoint ROT+green coexistence. Recommended: fix: define and persist the fixed-price contract scope; until then reject 97% whenever included billed amounts fall outside the declared green split rather than silently treating a partial subtotal as the total contract price.
- [x] [Review][Patch][High] Tax-setting saves bypass the option selection/inclusion transition contract [src/components/calculations/RowEditor.tsx:486] — The row editor submits ordinary updates for tax-only edits, while command validation rejects selection/inclusion transitions unless the dedicated transition intent is present; an option row cannot reliably save the coherent selection/inclusion state required by AC1.
- [x] [Review][Patch][High] Reviewed-preview proof is optional and checked outside the version-creation transaction [src/server/commands/quotes/snapshot-build.ts:260] — Validation accepts a null proof pair, and a supplied proof is checked through separate reads before the RPC; AC1's required reviewed-state gate can therefore be bypassed or become stale before the snapshot is frozen.
- [x] [Review][Patch][High] Quarantined VAT pairs cannot be repaired atomically in the row editor [src/server/commands/calculations/form-parsing.ts:500] — The parser suppresses an unchanged persisted rate while the command requires VAT type and rate to transition together, so changing the type of a quarantined incompatible pair is rejected instead of producing the coherent pair required by AC2.
- [x] [Review][Patch][High] Frozen V2 allocation slots still accept name-like identifiers [supabase/migrations/20260818090000_story_10_6_tax_answer_reconciliation.sql:750] — The persistence validator permits broad free-form slot identifiers and the compatibility reader remaps them, so customer-identifying text can still enter canonical allocation slots contrary to AC4's non-PII slot contract.
- [x] [Review][Patch][High] The create-new-version RPC omits command-equivalent lineage guards [supabase/migrations/20260818090000_story_10_6_tax_answer_reconciliation.sql:2789] — Direct authenticated invocation can create from a draft that is not the latest quote version or bind calculation input outside the source quote's validated lineage, bypassing the versioning invariants required by AC1 and AC6.
- [x] [Review][Patch][High] SQL and TypeScript reconcile green category claims differently [supabase/migrations/20260818090000_story_10_6_tax_answer_reconciliation.sql:923] — TypeScript allocates the claim with exact rational numerators, but SQL reweights already-rounded category calculations; valid canonical splits such as 1/1/222 öre can be rejected at the persistence boundary, violating AC5's one deterministic reconciliation contract.
- [x] [Review][Patch][Med] A mounted preview becomes permanently stale after the Stockholm date rolls over [src/components/quotes/PreQuotePreview.tsx:120] — Capture-date expiry is derived from the initial preview payload and only disables creation; the component does not refresh or recapture, so AC1's create flow cannot recover without a full remount.
- [x] [Review][Patch][Med] Tax settings do not resynchronize from refreshed canonical props [src/components/calculations/TaxSettingsPanel.tsx:100] — Local state and uncontrolled inputs are initialized once, so `router.refresh()` or scheme toggles can leave displayed basis and allowance values different from the persisted answer required by AC3 and AC5.
- [x] [Review][Patch][Med] The form permits reverse charge together with ROT or green deduction [src/components/calculations/TaxSettingsPanel.tsx:138] — No cross-field UI validation blocks the prohibited combination before submit, leaving AC2's fail-loud rule to surface only as a generic server failure.
- [x] [Review][Patch][Med] Editor totals and VAT transitions pin the 2026 policy constant [src/lib/calculations/totals.ts:113] — These paths use `TAX_POLICY_2026` instead of resolving by capture date, so the displayed and transitioned answer can diverge from the versioned policy registry required by AC2 and AC6.
- [x] [Review][Patch][Med] Quote PDFs expose internal green-tax enum values [src/server/quote-pdf/render.ts:290] — Basis and category values are rendered as raw implementation tokens rather than customer-facing Swedish labels, contrary to AC7's truthful customer-facing tax presentation.
- [x] [Review][Patch][Med] Review tokens omit row facts that change derived readiness warnings [src/server/commands/quotes/review-token.ts:107] — Unit cost and source kind affect frozen-source and cost-basis warnings but are absent from the reviewed digest, allowing AC1-relevant preview meaning to change without invalidating the proof.
- [x] [Review][Patch][Med] Review tokens omit payment and final-invoice policy facts [src/server/commands/quotes/review-token.ts:87] — The digest resolves only quote-capture policy while ROT payment-date and green final-invoice policy versions remain outside the proof, so AC1 can freeze an answer that was not the one reviewed.
- [x] [Review][Patch][Med] Preview and PDF labels conceal independent invoice inclusion [src/server/quote-pdf/render.ts:226] — The preview does not disclose per-row inclusion and the PDF labels a subtotal as selected options even though it sums included options, misrepresenting the two independent AC1 states.
- [x] [Review][Patch][Med] Inactive deduction allowance controls remain editable and are silently discarded [src/components/calculations/TaxSettingsPanel.tsx:211] — ROT and green allowance fields are rendered regardless of active scheme while parsing drops inactive values, so the UI suggests an economic input was saved when AC3/AC5 persistence ignores it.

- [x] [Review][Decision][High] Tax-policy rollover has no safe validity horizon or multi-policy database contract — `TAX_POLICY_2026.validTo=null` applies the 2026 profile indefinitely, while the SQL validator hard-codes `SE-TAX-2026-v1` and an exact single-version set; a later policy therefore requires mutating the old window or is rejected when VAT/ROT/green resolve to different versions. Recommended: fix: establish an owner-approved finite ratified horizon and update the validator to accept the canonical set of independently resolved version ids while still failing gaps and unknown ids. Sources: Blind Hunter primary; Blind Hunter secondary.
- [x] [Review][Decision][High] Document-level VAT choice is ambiguous for mixed and non-reverse categories — the equality guard is authoritative only for reverse charge, so a `ZERO_RATED` or `REDUCED_VAT` document choice can freeze standard-VAT categories, while requiring every row to equal the document choice would contradict AC3's sanctioned mixed standard/reverse supplies. Recommended: fix: preserve mixed-category support, narrow the document field to an explicit reverse-charge applicability choice, require it iff any reverse category exists, and remove or reject meaningless zero/reduced document states. Sources: Blind Hunter primary; Edge Case Hunter primary; Blind Hunter secondary.
- [x] [Review][Decision][Med] One-shot table rewrite and immediate constraint validation need an explicit deployment posture — the migration updates all `calculation_rows` and immediately validates new `NOT NULL`/CHECK constraints, so lock duration and write disruption depend on live-table scale. Recommended: fix: stage nullable columns, batched backfill, and `NOT VALID`/later validation unless measured production row counts demonstrate that the one-shot migration fits the approved lock budget. Sources: Blind Hunter primary; Blind Hunter secondary.
- [x] [Review][Patch][High] VAT type/rate pairs and legacy backfill can encode contradictory tax facts [src/lib/money/tax-policy.ts:291] — non-zero arbitrary rates are accepted for standard, reduced, and reverse-charge types, and the migration labels every legacy rate `STANDARD_VAT_25`; enforce the closed policy-backed pairs at TypeScript/command/DB boundaries and derive or explicitly remediate legacy types. Sources: Blind Hunter primary; Blind Hunter secondary.
- [x] [Review][Patch][High] Tax settings silently discard valid allowance slots after the second person [src/components/calculations/TaxSettingsPanel.tsx:84] — the canonical input supports up to 50 ordered slots, but the form renders and reconstructs only `PERSON_1`/`PERSON_2`, dropping or renaming later/custom slots on save. Sources: Blind Hunter primary; Edge Case Hunter primary; Acceptance Auditor primary; Blind Hunter secondary; Edge Case Hunter secondary.
- [x] [Review][Patch][High] PII-free slot identifiers are not enforced before persistence and PDF rendering [src/lib/money/tax-input.ts:69] — values resembling names or personal numbers pass the guard and are later printed in customer PDFs; accept only the neutral canonical slot-id shape at every write/read boundary. Sources: Blind Hunter primary.
- [x] [Review][Patch][High] Exported reconciled totals authority hard-codes every deduction to zero [src/lib/money/tax-policy.ts:500] — `computeReconciledDocumentTotals()` always returns zero deduction and gross-as-payable even for eligible ROT/green rows, while the AC1 test exercises only `NONE` classifications and masks the defect. Sources: Acceptance Auditor primary.
- [x] [Review][Patch][High] Preview VAT policy resolves from deduction dates instead of quote-capture date [src/features/calculations/tax-readiness.ts:59] — ROT/green payment dates and a hard-coded 2026 fallback select preview VAT policy, while the frozen snapshot uses `capturedAt`, allowing readiness and the committed quote to disagree. Sources: Blind Hunter primary; Edge Case Hunter secondary; Acceptance Auditor secondary.
- [x] [Review][Patch][High] Optional-row writes override the independent invoice-inclusion property [src/server/commands/calculations/rows.ts:164] — create/update paths derive or preserve inclusion from option-selection transitions, so explicit billable state is silently changed and mandatory rows can remain excluded; validate and persist selection and inclusion independently. Sources: Blind Hunter secondary; Edge Case Hunter secondary; Acceptance Auditor secondary.
- [x] [Review][Patch][High] Lovable golden rewrites historical oracle evidence [tests/fixtures/golden/lovable/quotes.json:48] — the patch changes the captured `oldLovableWouldGive` value and redefines its note to preserve an artificial delta; restore the historical side unchanged and record the new engine result separately. Sources: Acceptance Auditor primary.
- [x] [Review][Patch][Med] V2 compatibility parser does not verify category VAT arithmetic [src/lib/quote-snapshot/tax-compat.ts:205] — a non-reverse category passes when `net+vat=gross` even if `vatOre` disagrees with `netOre×rateBp`; recompute expected category VAT and enforce type/rate coherence at the read/PDF boundary. Sources: Blind Hunter primary; Edge Case Hunter primary.
- [x] [Review][Patch][Med] V2 compatibility parser accepts impossible policy provenance [src/lib/quote-snapshot/tax-compat.ts:87] — inverted windows, resolving dates outside the window, and unrelated rule-version ids pass; validate window ordering/containment and the exact canonical referenced-version set. Sources: Blind Hunter primary; Edge Case Hunter primary.
- [x] [Review][Patch][Med] Quote confirmation remains actionable for blocked, stale, or already-successful previews [src/components/calculations/PreQuotePreview.tsx:390] — the button is gated only by pending state, has no reviewed-revision guard, and can be clicked again after success before navigation; invalidate stale previews and disable on readiness failure, missing answer, pending, or success. Sources: Blind Hunter primary; Edge Case Hunter primary; Blind Hunter secondary.
- [x] [Review][Patch][Med] Fresh snapshot emits duplicate monetary truths without equality validation [src/lib/quote-snapshot/build.ts:233] — canonical V2 totals are validated, but duplicate `netOre`, `vatOre`, `grossOre`, and `deductionOre` inputs can contradict them; remove the duplicates or require exact equality before persistence. Sources: Blind Hunter primary; Edge Case Hunter primary.
- [x] [Review][Patch][Med] Database tax-input validator accepts non-calendar dates [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:208] — regex-only checks admit dates such as `2026-02-31` that the TypeScript domain rejects; use a round-tripping calendar-date check in the database validator. Sources: Acceptance Auditor primary; Blind Hunter secondary.
- [x] [Review][Patch][Med] Database V2 JSON validators accept unknown free-form keys [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:174] — presence-only `?&` checks leave calculation and quote snapshots open-ended despite the typed payload contract; reject unknown keys at each object level as well as requiring canonical keys. Sources: Acceptance Auditor primary.
- [x] [Review][Patch][Med] Reverse-charge E2E asserts enum names that the PDF never renders [tests/e2e/calculations/tax-answer-reconciliation.e2e.spec.ts:177] — the test expects `STANDARD_VAT_25` and `REVERSE_CHARGE_CONSTRUCTION`, while the PDF correctly localizes those labels; assert the rendered Swedish wording and exact reverse-charge disclosure. Sources: Acceptance Auditor primary.
- [x] [Review][Patch][Med] Excluded-row overflow creates a readiness/RPC contradiction [src/components/calculations/CalculationEditor.tsx:131] — readiness ignores a line-net overflow on an economically excluded row while quote creation validates and rejects it, leaving an enabled action that cannot succeed; align the boundaries on whether excluded rows must be computable. Sources: Edge Case Hunter primary.
- [x] [Review][Patch][Med] Quote RPC JSON arrays have no defensive size bounds [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:808] — an authenticated caller can submit thousands of categories and lines into nested validation scans and monopolize database CPU; cap arrays to the supported calculation limits before nested reconciliation. Sources: Edge Case Hunter primary.
- [x] [Review][Defer][High] Same-tenant direct quote RPC authority can create internally inconsistent commitments [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:1956] — deferred, pre-existing SECURITY INVOKER/table-grant architecture requiring the already-identified owner-approved privilege/API redesign; Sources: Blind Hunter primary.
- [x] [Review][Decision][High] Legacy VAT values cannot be safely classified by the staged backfill — zero may mean zero-rated, exempt, reverse charge, or incomplete legacy data, while unsupported historical rates can roll back every batch and strand later rows. Sources: Blind Hunter primary; Edge Case Hunter primary. Recommended: fix: backfill only provable canonical pairs, quarantine zero and unsupported rates, and require explicit remediation instead of inferring a legal VAT type.
- [x] [Review][Decision][High] Existing V1 drafts have no release disposition before the new send lock strands them — the migration makes historical drafts unsendable without an inventory, conversion path, expiry policy, or user-facing recovery flow. Sources: Blind Hunter secondary. Recommended: fix: inventory existing V1 drafts and choose an explicit safe-send compatibility or re-version/conversion path, with user messaging and an upgrade regression test.
- [x] [Review][Patch][High] Staged legacy-row backfill is defined but never executed or finalized [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:1365] — repo-to-demo deployment leaves historical row facts null, `NOT VALID` checks can reject ordinary updates during the window, null inclusion changes legacy totals, and no loop, completion assertion, constraint validation, or upgrade test closes the transition. Sources: Blind Hunter primary; Edge Case Hunter primary; Blind Hunter secondary; Acceptance Auditor secondary.
- [x] [Review][Patch][High] Preview still uses calculation revision time instead of quote-capture time [src/components/calculations/CalculationEditor.tsx:161] — `header.updated_at` can cross a policy boundary differently from the command clock's `capturedAt`, so reviewed readiness and the frozen quote can select different policy facts. Sources: Blind Hunter primary; Edge Case Hunter primary; Blind Hunter secondary; Edge Case Hunter secondary; Acceptance Auditor secondary.
- [x] [Review][Patch][High] Preview staleness has no server-verified reviewed snapshot [src/components/calculations/PreQuotePreview.tsx:79] — the client compares only the header timestamp and submits only `calculation_id`; child row, section, customer, or tax mutations can therefore be recomputed into content the user never approved. Sources: Edge Case Hunter primary; Blind Hunter secondary; Edge Case Hunter secondary.
- [x] [Review][Patch][High] Allowance editor cannot author a third person [src/components/calculations/TaxSettingsPanel.tsx:88] — new calculations render exactly two slots with no keyboard-operable add/remove control despite the canonical 50-slot contract, blocking valid multi-owner allowance input. Sources: Blind Hunter primary; Edge Case Hunter primary; Acceptance Auditor primary; Blind Hunter secondary; Edge Case Hunter secondary; Acceptance Auditor secondary.
- [x] [Review][Patch][High] Allowance-slot compatibility is both lossy and PII-unsafe [src/lib/money/domain.ts:82] — accepted compatibility ids can contain names or personal-number-like strings that are printed in PDFs, while the form reconstructs only ordered `PERSON_n` slots and can drop or reorder those accepted facts on unrelated saves; restrict fresh ids to opaque canonical slots and safely migrate/preserve legacy ordering without rendering raw identifiers. Sources: Blind Hunter primary; Edge Case Hunter primary; Acceptance Auditor primary; Blind Hunter secondary; Edge Case Hunter secondary.
- [x] [Review][Patch][High] Frozen V2 snapshots are re-authorized against the current policy registry [src/lib/quote-snapshot/tax-compat.ts:145] — registry equality checks make historical copy-by-value commitments unreadable after a policy correction, retirement, or refactor; validate frozen structure and internal arithmetic without consulting today's registry values. Sources: Blind Hunter primary.
- [x] [Review][Patch][High] VAT pair/posture contract remains incoherent across domain, commands, and SQL [src/lib/money/tax-policy.ts:301] — fresh standard VAT can still pair with 0%, omitted or one-sided command updates are not validated as an effective pair, the document type remains broader than its supported posture, and the database caps categories by four enum values instead of the sanctioned `(VatType, rateBp)` identities. Sources: Blind Hunter primary; Edge Case Hunter primary; Acceptance Auditor primary; Blind Hunter secondary; Edge Case Hunter secondary.
- [x] [Review][Patch][High] Backfill mutation helper is executable by PUBLIC [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:1378] — the unsanctioned unauthenticated function can initiate bulk row updates, and a null batch size removes the intended bound; revoke PUBLIC execution, grant only the deployment role, and reject invalid batch sizes. Sources: Blind Hunter primary; Edge Case Hunter primary; Blind Hunter secondary; Acceptance Auditor secondary.
- [x] [Review][Patch][High] Required DB integration fixtures retain the rejected open-ended policy window [tests/integration/commands/tax-answer-reconciliation.int.test.ts:114] — valid V2 fixtures still use `validTo:null` while the migration requires `2027-01-01`, so a live Supabase run fails during baseline setup before exercising the mandatory AC cases. Sources: Acceptance Auditor primary.
- [x] [Review][Patch][High] Canonical quote answer omits customer eligibility posture [src/lib/money/tax-answer.ts:327] — deduction choice and classified rows can apply private-only ROT/green treatment to company, BRF, or public customers because the server snapshot path never supplies or verifies eligibility. Sources: Blind Hunter secondary.
- [x] [Review][Patch][High] Send validation consults mutable calculation tax input after the draft was frozen [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:1850] — editing calculation settings after quote creation can make an otherwise valid immutable draft permanently unsendable; validate the frozen quote facts or freeze the exact source input with the draft. Sources: Blind Hunter secondary.
- [x] [Review][Patch][High] Option-selection UX no longer makes a selected option economically included [src/server/commands/calculations/rows.ts:267] — the independent fields are written without the settled option-intent behavior, so selecting a legacy excluded option leaves it outside invoice, VAT, and deduction totals. Sources: Acceptance Auditor secondary.
- [x] [Review][Patch][Med] Exported reconciled-payable helper estimates deductions without complete tax context [src/lib/money/tax-policy.ts:514] — it accepts only rows yet subtracts ROT/green using implicit 2026 dates, choice, basis method, and capacity, producing payable values that can contradict the canonical V2 answer; keep it VAT-only or require the full input authority. Sources: Blind Hunter primary; Acceptance Auditor primary; Acceptance Auditor secondary.
- [x] [Review][Patch][Med] Compatibility VAT arithmetic loses precision near the supported money ceiling [src/lib/quote-snapshot/tax-compat.ts:253] — JavaScript `number` multiplication can reject a valid frozen category or accept an off-by-one result; reuse the BigInt-backed canonical rounding authority. Sources: Blind Hunter primary; Edge Case Hunter primary; Edge Case Hunter secondary.
- [x] [Review][Patch][Med] TypeScript V2 parser does not validate frozen deduction bases and policy math [src/lib/quote-snapshot/tax-compat.ts:274] — it verifies aggregate sums but not classification-to-basis binding or calculated/claim amounts from frozen rates, leaving the read/PDF boundary weaker than SQL. Sources: Blind Hunter primary.
- [x] [Review][Patch][Med] VAT coherence is hard-coded to the 2026 profile before policy resolution [src/lib/money/tax-policy.ts:313] — a later resolved policy with a changed standard rate is rejected by the old constant, so the frozen VAT policy is not authoritative. Sources: Blind Hunter primary.
- [x] [Review][Patch][Med] Calculation row creation and quote RPC disagree on the 500-line limit [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:889] — the application can create a valid 501-row calculation that readiness accepts but persistence rejects; enforce the same bound at row creation or remove the mismatch. Sources: Edge Case Hunter primary.
- [x] [Review][Patch][Med] Person-allocation arrays remain unbounded inside quote validation [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:603] — authenticated payloads can force thousands of nested scans before rejection despite the canonical 50-person limit; reject oversized ROT and green allocations before iteration. Sources: Edge Case Hunter primary.
- [x] [Review][Patch][Med] Nested V2 tax objects still accept unknown keys [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:41] — iteration-1 closure covers roots and selected children but policy, category, summary, deduction, and allocation objects remain open-ended; enforce exact keys at every nested typed boundary. Sources: Edge Case Hunter primary; Acceptance Auditor primary.
- [x] [Review][Patch][Med] Buyer VAT number remains frozen after reverse charge is deselected [src/lib/money/tax-input.ts:173] — standard-VAT inputs retain and duplicate an unnecessary tax identifier; normalize it to null unless the reverse-charge posture requires it. Sources: Blind Hunter secondary.
- [x] [Review][Patch][Med] V1 snapshot builder invents tax-answer scalars unavailable in legacy data [src/lib/quote-snapshot/build.ts:312] — fallback calculated deduction, claim, payable, net, and gross values violate literal V1 compatibility and conflict with the database branch requiring new fields to remain null. Sources: Blind Hunter secondary.
- [x] [Review][Decision][Med] Green claim truncation occurs independently for solar, storage, and charging, so category partitioning can change the whole-SEK claim — the engine truncates each category before summing, while AC4 names one finalized claim boundary and AC5 only requires category-specific rates. Recommended: fix: sum the exact rational green-category claims first and truncate once at the scheme/document claim boundary, retaining category calculations without independently whole-SEK-truncating each category. Sources: Blind Hunter primary.
- [x] [Review][Patch][High] V2 child snapshots remain appendable after atomic quote creation [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:2342] — the trigger freezes only UPDATE/DELETE, so tenant-authorized INSERT can append lines or attachments after review; lines may still reconcile at send and attachments are not reconciled there. Restrict V2 child INSERT to the atomic creation RPC/transaction or verify a frozen child digest before PDF generation and send. Sources: Blind Hunter primary; Edge Case Hunter primary.
- [x] [Review][Patch][High] The legacy allowance alias can fund both ROT and green in one mixed quote [src/lib/money/tax-input.ts:101] — `remainingAllowanceOre` satisfies both scheme-presence checks and is then exposed independently to both allocators, allowing the same declared capacity to be consumed twice. Require distinct ROT/combined and green allowances for `ROT_AND_GREEN`; keep the alias only for explicit one-scheme compatibility. Sources: Blind Hunter primary.
- [x] [Review][Patch][High] Private-customer deductions can coexist with construction reverse charge [src/lib/money/tax-answer.ts:338] — reverse-charge applicability and private-only deduction eligibility are validated independently, so the same frozen document can treat the buyer as both a private deduction beneficiary and a VAT-registered construction-service buyer. Reject that cross-field posture in the engine, compatibility reader, SQL validator, and RPC negatives. Sources: Blind Hunter primary.
- [x] [Review][Patch][High] Quote-capture policy dates use UTC instead of the Swedish business date [src/server/commands/quotes/snapshot-build.ts:191] — preview, snapshot, and SQL RPC validation slice/cast UTC, so captures between Stockholm and UTC midnight can resolve and freeze the wrong legal policy day. Use one Europe/Stockholm business-date authority consistently in preview, command, and database validation. Sources: Blind Hunter secondary; Edge Case Hunter primary.
- [x] [Review][Patch][High] V2 reverse-charge PDFs still print the tenant's standard VAT rate [src/server/quote-pdf/render.ts:311] — snapshot assumptions always freeze the company standard rate, and the renderer prints it even when no frozen category charges that rate, contradicting the category authority and reverse-charge disclosure. Derive the displayed VAT summary from frozen categories and omit the scalar standard-rate claim for pure reverse-charge/non-standard documents. Sources: Acceptance Auditor primary.
- [x] [Review][Patch][High] A terminal accepted quote can gain a successor draft through a race [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:2656] — the new-version RPC locks the quote row but does not lock and revalidate the latest version's terminal status, so acceptance after the command precheck can interleave before draft creation. Lock and revalidate the authoritative latest parent version inside the RPC before inserting. Sources: Edge Case Hunter primary.
- [x] [Review][Patch][Med] Canonical tax input preserves inactive or contradictory scheme facts [src/lib/money/tax-input.ts:179] — `NONE` can retain dates, allowances, and green inputs, while `ACTUAL_ELIGIBLE_COSTS` can freeze mismatched fixed-price totals/splits or `genuineFixedPrice=true` that the engine silently ignores. Normalize or reject fields by deduction choice and basis method at both TypeScript and SQL boundaries. Sources: Blind Hunter primary.
- [x] [Review][Patch][Med] Canonical answer rows can omit their economic summary category [src/lib/money/tax-policy.ts:254] — the public row shape makes `summaryCategory` optional and silently maps an ordinary `NONE` labor/material row to `other`, corrupting the frozen labor/material/other reconciliation. Require the category for canonical answers or fail closed when it cannot be inferred from an authoritative row type. Sources: Blind Hunter primary.
- [x] [Review][Patch][Med] The SQL tax-input validator permits invalid buyer-VAT/document-posture pairs [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:254] — it accepts reverse charge with JSON null and standard VAT with a retained buyer number, unlike the canonical TypeScript parser, allowing direct RLS writes to persist drafts the application later rejects or normalizes. Enforce the same required/cleared invariant in SQL. Sources: Blind Hunter primary; Blind Hunter secondary.
- [x] [Review][Patch][Med] Frozen policy resolving dates are not required to be canonical ISO dates in SQL [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:58] — substring-to-`make_date` validation accepts values such as `2026/02/03`, creating a database/application parser mismatch. Require `YYYY-MM-DD` and round-trip the parsed date before window comparison. Sources: Blind Hunter secondary.
- [x] [Review][Patch][Med] SQL accepts non-canonical `taxRuleVersions` ordering that TypeScript rejects [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:461] — the database checks distinct membership but not sorted order, so persistence can succeed for a payload that later fails the compatibility reader and joined version scalar. Require the exact sorted-distinct expected array. Sources: Edge Case Hunter primary.
- [x] [Review][Patch][Med] Calculation-row limit enforcement races with concurrent section moves [supabase/migrations/20260805120000_tax_answer_reconciliation.sql:1675] — the row trigger reads a section's calculation before locking the section, so an interleaving move can make the insert count the old parent while landing under the new parent and exceed the 500-row bound. Lock the section before resolving its parent and serialize all affected calculation rows consistently. Sources: Edge Case Hunter primary.
- [x] [Review][Defer][Low] PDF policy-window wording treats exclusive `validTo` as inclusive [src/server/quote-pdf/render.ts:275] — deferred, customer documents say the rule is valid “till” the exclusive boundary date, overstating the frozen window by one day; render the inclusive previous date or state that validity ends before `validTo`. Sources: Blind Hunter primary; Edge Case Hunter primary.
- [x] [Review][Patch][High] In-page calculation edits can leave the preview proof attesting to an older server snapshot while the preview body renders mutable client state [src/components/calculations/CalculationEditor.tsx:65] — `previewQuoteCaptureDate` and `reviewedSnapshotDigest` are immutable server props, but readiness and preview rows are recomputed from client `sections` and `header.tax_input_snapshot`; invalidate or refresh the proof whenever in-page rows, sections, customer facts, or tax input change. Sources: Blind Hunter secondary.
- [x] [Review][Patch][High] Tax-setting saves do not refresh the route or push updated tax input back into the calculation editor [src/components/calculations/TaxSettingsPanel.tsx:83] — the form saves through `useActionState`, while the surrounding readiness report, preview, and review-token inputs keep using stale tax facts until a full reload; refresh/revalidate the client view after a successful tax-input save. Sources: Blind Hunter secondary.
- [x] [Review][Patch][High] The list-page quote creation action still accepts a proof-less `calculation_id` path [src/features/quotes/actions.ts:762] — `createQuoteVersionFromCalculationAction()` calls the shared command with no reviewed digest/date pair, bypassing the preview sign-off contract introduced for tax-answer reconciliation; route quote creation through the reviewed path or explicitly block proof-less creation for this surface. Sources: Blind Hunter primary.
- [x] [Review][Patch][High] Attachment-sensitive review proofs cannot be represented by the calculation page [src/app/(app)/calculations/[calculationId]/page.tsx:196] — the page hardcodes `attachments: []` into the reviewed digest even though snapshot creation can include selected attachment IDs, so attachment-covered quote creation is either unreviewed or fails digest comparison; make attachment selection part of the review proof or exclude attachment selection from this creation path consistently. Sources: Blind Hunter primary.
- [x] [Review][Patch][High] Optional row selection and invoice inclusion still diverge on create/update boundaries [src/server/commands/calculations/rows.ts:181] — a newly created optional row can default to `included_in_invoice_total=true` while `is_selected=false`, and update reconciliation overwrites an explicitly submitted inclusion value when selection also changes; preserve the independent inclusion fact while enforcing the settled option-intent behavior. Sources: Blind Hunter primary; Blind Hunter secondary.
- [x] [Review][Patch][High] Quarantined legacy VAT rows can be implicitly remediated by unrelated row edits [src/components/calculations/RowEditor.tsx:408] — the form defaults missing `vat_type` to `STANDARD_VAT_25`, and the command clears `tax_reconciliation_required` whenever both VAT fields are present, so an unrelated edit can turn ambiguous legacy VAT into standard 25% without an explicit remediation decision. Sources: Blind Hunter secondary.
- [x] [Review][Patch][High] Legacy allowance aliases can still be duplicated into separate ROT and green balances in the UI [src/components/calculations/TaxSettingsPanel.tsx:205] — `remainingAllowanceOre` is used as the fallback default for both ROT and green fields on mixed-deduction saves, allowing a single compatibility balance to become two independent scheme allowances; force explicit re-entry or one-scheme compatibility instead. Sources: Acceptance Auditor primary.
- [x] [Review][Patch][Med] The confirmation button is enabled before a preview review digest has been captured [src/components/calculations/PreQuotePreview.tsx:99] — `reviewedDigest=null` is not treated as disabled or stale, so the hidden `reviewed_snapshot_digest` submits an empty string and the first confirmation attempt fails server-side instead of being blocked until review. Sources: Blind Hunter primary.
- [x] [Review][Patch][Med] The tax settings panel shows and submits inactive ROT/green/fixed-price fields that the parser silently clears when the deduction choice changes [src/components/calculations/TaxSettingsPanel.tsx:158] — changing deduction posture can discard dates, allowance slots, or fixed-price split data without an explicit destructive affordance; hide/disable inactive controls or require an intentional reset. Sources: Blind Hunter primary.
- [x] [Review][Patch][Med] Changing row type can silently clear an existing deduction classification before submit [src/components/calculations/RowEditor.tsx:200] — the options are derived from the currently selected row type and fall back to `NONE` when the current classification is incompatible, so a row-type edit can erase tax classification without explicit confirmation. Sources: Blind Hunter primary.
- [x] [Review][Patch][Med] Green category claim attribution still uses rounded/intermediate category amounts rather than the exact rational allocation authority [src/lib/money/tax-policy.ts:326] — `claimByCategory` is apportioned from `calculatedByCategory`, and the exported estimate helper caps categories sequentially, so per-category green claims can drift from the approved exact-rational allocation near cap or rounding boundaries. Sources: Blind Hunter primary; Blind Hunter secondary.
- [x] [Review][Patch][Med] Snapshot creation feeds failed row line totals into the tax answer as zero [src/server/commands/quotes/snapshot-build.ts:287] — rows whose individual line total failed are stored as `null` for line snapshots but become `0` in the V2 tax-answer input, allowing excluded or optional invalid economics to freeze inconsistently; reject or represent failed row totals consistently. Sources: Blind Hunter primary.
- [x] [Review][Patch][Med] A reviewed preview left open across the Stockholm business-date boundary remains enabled until submit [src/components/calculations/PreQuotePreview.tsx:101] — client staleness only compares the digest, while server validation also rejects when `reviewed_quote_capture_date` no longer matches the current business date; disable or warn when the capture date expires. Sources: Blind Hunter secondary.
- [x] [Review][Patch][Med] Review tokens hash the entire tax policy registry instead of only the applicable policy facts [src/server/commands/quotes/review-token.ts:105] — adding an unrelated future policy window invalidates open previews even when the reviewed calculation and applicable policy for the capture date are unchanged; hash the resolved policy/material facts used by the quote. Sources: Blind Hunter secondary.
- [x] [Review][Patch][Med] Review tokens include non-frozen internal row facts [src/server/commands/quotes/review-token.ts:32] — `unitCostOre` and `sourceKind` participate in the digest even though those values are not copied into the frozen quote, so internal cost/source churn can invalidate a reviewed preview without a customer-visible quote change. Sources: Blind Hunter secondary.
- [x] [Review][Patch][Med] Reverse-charge PDF VAT categories still append a percentage to the customer-facing label [src/server/quote-pdf/render.ts:250] — the preview omits the percentage for reverse charge, but the PDF renders every category as `${category.label} (${category.ratePercent} %)`, which can imply charged VAT despite the reverse-charge disclosure; special-case reverse charge in the PDF category line. Sources: Acceptance Auditor secondary.
- [x] [Review][Patch][Low] Tax-readiness failures for customer ineligibility or excessive deduction claims are mapped to a row-classification blocker [src/features/calculations/tax-readiness.ts:37] — the UI can point the user toward row classification when the repair is customer posture or claim sizing; preserve a more specific blocker code. Sources: Blind Hunter primary.
- [x] [Review][Patch][Low] Form parsing accepts row-only VAT types as document VAT posture values [src/features/calculations/form-parsing.ts:195] — `document_vat_type` is checked against every `VAT_TYPES` member even though the canonical document posture accepts only standard VAT or reverse charge, causing stale/forged reduced or zero-rated document states to fail later as generic command errors. Sources: Blind Hunter primary; Blind Hunter secondary.
- [x] [Review][Patch][Low] The reverse-charge buyer VAT field is cleared by a one-way session flag [src/components/calculations/TaxSettingsPanel.tsx:92] — toggling away from reverse charge and back in one edit session always blanks the persisted buyer VAT number, forcing re-entry and making accidental empty submissions more likely. Sources: Blind Hunter secondary.

## Review Triage Log

### 2026-08-31 — Review pass

- intent_gap: 0
- bad_spec: 0
- patch: 5 (high 1, medium 2, low 2)
- defer: 3 (high 2, medium 1, low 0)
- reject: 20 (high 4, medium 11, low 5)
- addressed_findings:
  - `[high]` `[patch]` Preserve an omitted create-row inclusion field through validation and derive optional-row invoice inclusion from explicit option selection, preventing optional-unselected rows from defaulting into totals.
  - `[medium]` `[patch]` Map fixed-price row-scope and fixed-price scope-mismatch failures to the fixed-price allocation blocker instead of generic VAT guidance.
  - `[medium]` `[patch]` Exercise optional-row selection and invoice-inclusion transitions through the real calculation row command and database persistence path.
  - `[low]` `[patch]` Revoke default `PUBLIC`/`anon` execute on the new Story 10.6 calendar helper and grant only `authenticated` and `service_role`.
  - `[low]` `[patch]` Render the real fixed-price tax-settings authoring branch and pin its allocation and row-scope controls.
  - `[high]` `[defer]` Preserve the existing same-tenant review-RPC security safeguards while deferring the review-provenance authority redesign; direct invocation cannot be made browser-click authoritative without a persisted or privileged boundary.
  - `[high]` `[defer]` Record the pre-existing stale-PDF-after-draft-edit lifecycle risk for explicit invalidation/regeneration work.
  - `[medium]` `[defer]` Record the pre-existing successor attachment-retention UI gap.
  - `[reject]` The remaining twenty candidates were dismissed after deduplication because the cited consequence was disproved by current guards, the behavior was an intentional settled story decision, the path was stale/nonexistent, the observation was non-actionable, or the change belonged to unrelated workflow tooling rather than the Story 10.6 product surface.

## Auto Run Result

> **Historical / superseded auto-run record:** do not treat the verification counts in this record as current evidence after Stories 10.8/10.9's HMAC-attestation design change. Current evidence is recorded after this historical record.

- Summary: Completed a fresh whole-story convergence review from baseline `aab9fc0e38ae022d009967f3ebcd2a93e7ca723b`, reconciled security, architecture, intent, edge-case, and verification evidence, patched five in-scope findings, and retained three explicit follow-ups without weakening critical safeguards.
- Files changed: calculation row validation/transition command logic; tax-readiness blocker mapping and copy; Story 10.6 migration function grants; focused unit, command-integration, and rendered fixed-price authoring tests; this finished story artifact.
- Findings: `intent_gap=0`, `bad_spec=0`, `patch=5 (high 1, medium 2, low 2)`, `defer=3 (high 2, medium 1)`, `reject=20 (high 4, medium 11, low 5)`.
- Follow-up review: recommended (`true`) because the weighted patch score is 8 and a high-severity patch was required.
- Historical verification: Supabase reset succeeded with the then-current 10.8/10.9 migrations; focused RLS/migration tests passed 175/175; command/provenance/lock tests passed 125/125; PDF/tax/attachment tests passed 65/65; and database lint was clean. Changed focused units passed 107/107; changed-file ESLint was clean across 69 files; TypeScript, Next build, lockfile/source-containment/bundle-containment, and `git diff --check` were clean.
- Post-HALT bounded repair verification: normalized nullable option facts to omission at the create-command/helper boundary and reconciled the legacy validation expectation with command-owned inclusion defaults. The three exact affected Node test files passed 33/33, preserving explicit evidence that mandatory rows start included and optional-unselected rows start excluded; `pnpm exec tsc --noEmit --pretty false` passed.
- Cross-model layer: the original external CLI attempt failed before delegate execution because
  PowerShell parsed `< NUL`; after the Windows command transport was fixed and regenerated, a
  context-free Luna/xhigh leaf review ran through native subagent routing and returned no findings.
- Residual risk: the three frontmatter deferrals above remain visible. The previously documented genuine pre-migration fixture limitation remains non-blocking evidence rather than a newly reopened task.

## Current Verification Evidence

- **IN — local database and migration evidence:** local Supabase reset completed successfully twice with the current migrations and seed. Real replay against an already-migrated database passes for both the 10.8 and 10.9 migrations. Focused migration/authority/PDF/audit contracts passed 48/48, the parallel-safe rollback contract passed 7/7, and the required full integration/RLS suite passed 85 files / 905 tests.
- **IN — changed surface:** complete changed integration surface passed: 28 unique files / 388 tests. Changed unit surface passed, and the full unit suite passed 94 suites / 1,673 tests. `supabase db lint --local --level error --fail-on error` was clean.
- **IN — static and containment gates:** TypeScript, changed-file ESLint, Next build, lockfile guard, service-role source/bundle containment, HMAC secret/bundle containment, tenant-table inventory (27), and `git diff --check` passed.
- **Hosted browser gate:** GitHub Actions run [33495807115](https://github.com/rthunborg/ElproSaas/actions/runs/33495807115) passed verify, empty-DB reset plus the 85-file/905-test integration/RLS suite, and Playwright (121 passed, 1 skipped); the Playwright report uploaded successfully. Local Playwright was deliberately **NOT RUN** inside Codex because it would require a persistent app server. The prohibited Auto-BMAD self-test and broad wrappers were not run.
- **Pending external gate:** remote demo Vault/Vercel secret provisioning is not attested. Per the demo process, migrations flow to demo only after merge; no pre-merge demo mutation was attempted.
- **Round 3 of 3 — final automatic convergence:** fixed the explicit 10.9 final-send byte-HMAC gap, the linked/locked late-first-upload gap, and forged audit-actor attribution at the shared 10.8 boundary. It also removed a CI-parallel deadlock from the test-only forced-audit harness by replacing per-case trigger DDL with a seed-installed correlation trigger plus control-table DML. Final evidence is green: fresh reset, both real follow-up migration replays, focused DB/grant/behavior files (48/48), rollback 7/7, all 28 changed integration files 388/388, full integration/RLS 85 files/905 tests, TypeScript, full ESLint, Next build, full unit (94 suites / 1,673 tests), DB lint, lock/source/bundle/HMAC containment, diff hygiene, and hosted Playwright. No fourth automatic review is permitted; any new concern requires human triage.
- **Still not run/claimed:** local Playwright inside Codex and remote demo Vault/Vercel provisioning. Hosted Playwright is green. Story 10.6 remains `review`, not done, only for the deliberate post-merge remote-demo gate.
