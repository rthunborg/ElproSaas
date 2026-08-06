---
baseline_commit: NO_VCS
---

# Story 10.6: Tax-Answer Reconciliation — VAT Rounding, Deduction Classification, and Reverse Charge

Status: review

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

- `pnpm exec tsc --noEmit` — PASS.
- `pnpm run lint` — PASS.
- `pnpm run test:unit` — PASS: 1,606 tests, 0 failures, 0 skipped.
- `pnpm run build` — PASS (Next.js production build).
- `pnpm run verify:lockfiles` — PASS.
- `pnpm run verify:service-role-containment` — PASS.
- `pnpm run verify:bundle-containment` — PASS after the production build.
- Migration parse/runtime harnesses — PASS: pglast parse and focused PGlite validator/trigger
  scenarios, including exact policy math, fixed-price reconciliation, sent insertion/transition
  rejection, child immutability, and line/input binding.
- Phase 5 baseline, `pnpm exec vitest run tests/integration/commands/tax-answer-reconciliation.int.test.ts
  tests/integration/commands/tax-answer-acceptance-job.int.test.ts` — PASS in skip-aware mode:
  3 source-contract tests passed and 10 DB-backed tests skipped because the local Supabase stack was
  unreachable.
- Phase 6 targeted rerun, `pnpm exec vitest run
  tests/integration/commands/tax-answer-reconciliation.int.test.ts` — PASS in skip-aware mode:
  3 source-contract tests passed and 9 DB-backed tests skipped. The newly added direct cross-tenant
  RPC case is among the skipped DB cases and therefore remains pending a real local/CI stack run.
- `pnpm exec supabase db reset` — SKIPPED-WITH-REASON / infrastructure failure: Docker Desktop's
  Linux engine pipe was unavailable; no global Docker setting was changed.
- `SUPABASE_TEST_REQUIRED=1 pnpm run test:int` — expected hard FAIL before test discovery because
  the required local Supabase stack was unreachable. This keeps the release gate fail-closed.
- `pnpm exec playwright test tests/e2e/calculations/tax-answer-reconciliation.e2e.spec.ts` —
  SKIPPED-WITH-REASON / setup failure: tenant fixture creation could not reach local Supabase.
- Final money/tax review — PASS: no unresolved Critical, High, or Medium implementation finding.
- Final security/RLS review — PASS-WITH-LIMITATION: no release-blocking Critical/High isolation,
  service-role, storage, or unauthenticated-function finding.

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
- Kept V1 compatibility literal: legacy/null-version snapshots remain readable/renderable and only
  expose stored legacy facts; the adapter does not invent gross, calculated deduction, claim, or
  other V2-derived facts.
- Added the single forward-only additive migration. It backfills only row inclusion, validates
  calculation input and V2 answers, binds both creation RPCs to persisted calculation/line facts,
  blocks invalid direct sent insertion/transitions, and freezes all V2 parent/child facts.
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
- Non-blocking security hardening follow-up: database JSON validators require every canonical key
  but do not reject additional unknown keys. Application parsing strips extras; RLS isolates them,
  but a future migration can make the database payloads closed-key if the owner prioritizes it.
- Release-verification gap: Docker/Supabase was unavailable locally. The empty-DB reset, all 11
  DB-backed integration assertions, and the Story 10.6 Playwright path must execute in CI or on a
  running local stack before release. Required-mode integration correctly failed closed.

### File List

- `_bmad-output/implementation-artifacts/10-6-tax-answer-reconciliation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/test-artifacts/automation-summary.md`
- `src/components/calculations/CalculationEditor.tsx`
- `src/components/calculations/PreQuotePreview.tsx`
- `src/components/calculations/RowEditor.tsx`
- `src/components/calculations/TaxSettingsPanel.tsx`
- `src/features/calculations/action-state.ts`
- `src/features/calculations/actions.ts`
- `src/features/calculations/form-parsing.ts`
- `src/features/calculations/read.ts`
- `src/features/calculations/readiness.ts`
- `src/features/calculations/tax-readiness.ts`
- `src/features/calculations/totals.ts`
- `src/features/quotes/read.ts`
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
- `src/server/commands/quotes/quote-db.ts`
- `src/server/commands/quotes/snapshot-build.ts`
- `src/server/quote-pdf/render.ts`
- `supabase/migrations/20260805120000_tax_answer_reconciliation.sql`
- `tests/e2e/calculations/tax-answer-reconciliation.e2e.spec.ts`
- `tests/e2e/global-setup.ts`
- `tests/factories/tenants.ts`
- `tests/fixtures/golden/acceptance/tax-answer-v2-acceptance-job.json`
- `tests/fixtures/golden/calculations/tax-answer-reconciliation-v2.json`
- `tests/fixtures/golden/lovable/quotes.json`
- `tests/fixtures/golden/money/tax-answer-reconciliation-v2.json`
- `tests/fixtures/golden/quote-pdf/tax-answer-reconciliation-v1-v2.json`
- `tests/fixtures/golden/snapshots/tax-answer-reconciliation-v1-v2.json`
- `tests/integration/commands/tax-answer-acceptance-job.int.test.ts`
- `tests/integration/commands/tax-answer-reconciliation.int.test.ts`
- `tests/unit/features/calculations/calc-golden-pack-coverage.test.ts`
- `tests/unit/features/calculations/form-parsing.test.ts`
- `tests/unit/features/calculations/readiness-inclusion.golden.test.ts`
- `tests/unit/features/calculations/readiness.test.ts`
- `tests/unit/features/calculations/tax-readiness.test.ts`
- `tests/unit/features/calculations/totals.test.ts`
- `tests/unit/fixtures/golden/lovable/comparison-support.ts`
- `tests/unit/fixtures/golden/lovable/lovable-comparison-calc-quote-pdf.test.ts`
- `tests/unit/fixtures/golden/lovable/lovable-comparison-classification-deltas.test.ts`
- `tests/unit/fixtures/golden/lovable/lovable-pack-support.ts`
- `tests/unit/fixtures/golden/lovable/lovable-shape-guard.test.ts`
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
- `tests/unit/server/commands/snapshot-payload-serializers.test.ts`
- `tests/unit/server/commands/tax-input-validation.test.ts`

### Change Log

- 2026-07-29: Story context created; status set to `ready-for-dev`.
- 2026-08-06: Implemented Story 10.6 end-to-end; added the additive migration, canonical tax
  engine, V2 snapshot/PDF/acceptance path, compatibility adapter, validation/readiness/UI changes,
  and full automated evidence. Status set to `review`; Docker-backed gates remain explicitly
  pending execution on available infrastructure.
- 2026-08-06: Phase 6 automation expansion added direct foreign-tenant coverage for both Story 10.6
  quote-version RPCs and recorded fail-closed Docker/Supabase validation evidence.
