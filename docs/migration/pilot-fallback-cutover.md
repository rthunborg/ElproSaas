# Pilot Fallback, Cutover, And Sign-Off Register — Phase A

> **Phase A · Internal Pilot MVP · docs + a `tests/unit/**` checklist validator.** This is the
> pilot **fallback / cutover / rollback control point** plus the **sign-off register**. It writes
> no product `src/**` code, no schema, no migration script, and mutates no production data. It
> documents, **per pilot workflow**, the **old-app fallback**, the **cutover-by-workflow plan**,
> the **manual-backfill risks**, and — the layer new to this control point — the explicit
> **rollback decision points**; and it carries the **sign-off register** that marks every owner /
> accounting / legal decision `signed-off` or **`blocking` real-pilot use**. Its companions are
> the [migration runbook](./migration-runbook.md) (per-workflow source/treatment/fallback/backfill/
> cutover table) and the [legacy-record classification register](./legacy-record-classification.md)
> (the four-bucket record-group decisions). This control point **builds on** those — it does not
> restate their per-workflow rows; it adds the **rollback-decision-point** layer and the register.
>
> **Provenance:** authored by the Epic-9 pilot-fallback-cutover-and-sign-off-register story. This
> one-time provenance line is the only plan-position reference; the durable body below references
> **architecture §16 (Migration And Coexistence)** and **§24 (Open Architecture Questions)**, never
> "Epic N / Story X-Y" (evergreen-doc anchoring, R-922).

## 1. How To Read This Control Point

- **§2** states the fallback / cutover / rollback model and the demo-vs-real-pilot track split.
- **§3** is the per-workflow **rollback layer** — one section per Phase A pilot workflow, each
  carrying its **old-app fallback**, its **cutover-by-workflow plan**, its **manual-backfill risks**
  (cross-referencing the migration runbook §3 rows — not re-invented), and — new here — its explicit
  **rollback decision points**. It also states the **fallback-erosion guard**: a workflow's fallback
  is **not removed while any of its blocking assumptions is open** (NFR21, R-908).
- **§4** is the **sign-off register** — every owner / accounting / legal / security decision marked
  `signed-off` or **`blocking`**, each traced to its owning question ID in the sign-off
  system-of-record, with a decision owner and the affected workflow(s), plus the real-pilot re-score
  residuals folded in from the deferred-work ledger.
- **§5** records the **demo-vs-real-pilot track split** (every blocking item is blocking for the
  real-pilot track and **non-blocking** for the demo track).
- **§6** describes the **executable cutover-block checklist** (the `evaluateCutover(...)` model) that
  makes the register's blocking states operational — a real guard, not a passive doc.
- **§7** is the PII hygiene statement + verification self-check.

**Scope discipline:** cutover **and rollback** are **per-workflow, never whole-company**
(architecture §16). Reverting one workflow to its Lovable fallback must never require reverting the
whole company. No step here exports or imports real customer data — real export/import is a **hard
STOP** requiring owner sign-off (migration runbook §6).

## 2. Fallback / Cutover / Rollback Model

The old Lovable app remains, per architecture §16, the **behavioral oracle** (inspected for
behavioral SHAPE only, never quoted with real values) and the **fallback** for a selected workflow
**until that workflow's pilot acceptance gate passes** (NFR21). It is **not** a code source, **not**
the schema blueprint for the twenty-four tenant-owned tables, and **not** a reason to activate a
deferred module.

The three coexistence phases, applied **one workflow at a time**:

1. **Fallback (default).** The Lovable app is the live system of record for the workflow; the new
   app runs alongside for demo/build-up. The old-app fallback is available for that workflow.
2. **Cutover (per-workflow, gated).** When a workflow's pilot acceptance gate passes AND its
   blocking sign-off items are resolved, that ONE workflow cuts over to the new app. Cutover is
   **by workflow, never whole-company** — there is deliberately **no** "flip the whole company"
   step. Each workflow is gated independently.
3. **Rollback (per-workflow, gated).** A cut-over workflow **reverts to its Lovable fallback** when
   a **rollback decision point** fires (see each §3 workflow). Rollback is **per-workflow, never
   whole-company** — reverting one workflow to fallback must not require reverting any other.

**Fallback-erosion guard (NFR21, R-908).** A workflow's fallback **must not be removed while any of
its blocking assumptions is open**. Removing fallback is gated by the **same** blocking-item state
that gates cutover (§4 register + the §6 checklist enforce both): if a workflow cannot cut over
because a blocking item is open, its fallback likewise cannot be removed.

**The three rollback decision points** (the conditions under which a cut-over workflow reverts to the
Lovable fallback), applied per workflow:

- **A failed pilot acceptance gate** — the workflow's acceptance-gate report does not pass.
- **A newly discovered blocking assumption** — a money/tax/immutability/acceptance/required-file/
  migration-classification decision surfaces as unresolved after cutover.
- **A data-integrity divergence** — the golden-master comparison (architecture §17) catches a
  divergence between old-Lovable-expected and new-expected behavior for that workflow.

## 3. Per-Workflow Rollback Layer

Each workflow below records its **old-app fallback**, **cutover-by-workflow plan**,
**manual-backfill risks** (referencing the migration runbook §3 rows — not re-invented), and the new
**rollback decision points**. All concrete real-record selections remain owner-pending (`8.1`/`8.2`)
and STOP-marked (migration runbook §6). Cutover and rollback are **per-workflow, never
whole-company**.

### 3.1 CRM (customers · facilities · contacts)

- **Old-app fallback:** the Lovable CRM stays the fallback/oracle for customer/facility/contact
  lookup until the CRM workflow's pilot acceptance gate passes (NFR21). Fallback is **not removed**
  while any CRM blocking assumption is open.
- **Cutover-by-workflow plan:** cut CRM over first (it is upstream of every other workflow); the
  pilot operator creates the small demo customer/facility/contact set fresh in the new app. Runbook
  §3.1 carries the source/treatment rows; whole-company customer export is out of scope — a STOP.
- **Manual-backfill risks (runbook §3.1):** a human re-keys customer/facility/contact records by
  hand — a mistyped/omitted personnummer (private ROT depends on it), a facility/contact not linked
  (a quote/job cannot bind to the required facility+contact per owner `1.5`), or a customer TYPE
  mis-set (drives VAT-display posture and ROT eligibility). Re-keying real personnummer is a
  PII-handling action → STOP outside the demo track.
- **Rollback decision points:** CRM reverts to the Lovable fallback if — the CRM acceptance gate
  fails; a blocking assumption on customer TYPE / personnummer handling surfaces (feeds VAT + ROT
  eligibility); or a golden-comparison divergence shows a customer/facility/contact linkage the new
  app resolves differently from the oracle. Reverting CRM is independent — it does not roll back any
  downstream workflow.

### 3.2 Settings / Pricing (company identity · quote terms · VAT default · work roles · articles)

- **Old-app fallback:** Lovable settings/pricing remain the reference/fallback until the pricing
  workflow's gate passes. Fallback is **not removed** while a pricing blocking assumption is open —
  and the tax/VAT numbers are `öppen (möte)` (§4), so this fallback stays for the real-pilot track.
- **Cutover-by-workflow plan:** cut settings/pricing over with CRM (upstream of calculations). Demo
  pricing is entered fresh; real pricing migration waits on the tax working-session sign-off
  (real-pilot blocker, demo-non-blocking). Runbook §3.2 carries the source/treatment rows.
- **Manual-backfill risks (runbook §3.2):** re-entering work-role rates / article unit prices by
  hand risks a kronor↔öre or VAT-basis-point transcription error (integer öre + basis points; a
  wrong-magnitude value is not auto-rejected), a missed logo/terms field, or a VAT default mis-set.
  The tax/VAT numbers themselves are UNAPPROVED placeholders — do not treat any migrated rate as
  accounting-final.
- **Rollback decision points:** pricing reverts to the Lovable fallback if — the pricing acceptance
  gate fails; the tax working session lands rates/rounding that invalidate a migrated placeholder
  (`A.1`/`A.2`/Blocks B/C resolve differently); or a golden-comparison divergence shows a
  price/VAT total the new engine computes differently from the oracle. Reverting pricing is
  independent of CRM and downstream workflows.

### 3.3 Calculations (Kalkyl)

- **Old-app fallback:** Lovable calculations remain the oracle/fallback for a re-quote until the
  calculation workflow gate passes; the golden-master comparison (architecture §17) is the
  correctness-evidence layer. Fallback is **not removed** while a calc blocking assumption is open.
- **Cutover-by-workflow plan:** cut calculations over after CRM + pricing. Demo calcs are built
  fresh; a real calc is re-created (not bulk-imported) so its frozen source snapshots are authored by
  the new builders. Runbook §3.3 carries the source/treatment rows.
- **Manual-backfill risks (runbook §3.3):** re-entering calc rows by hand risks a row-inclusion
  mistake (the frozen inclusion pin: selected tillval + hidden rows COUNT, an unselected option does
  NOT — a human mis-flag changes the total), a null-cost read (unknown cost is "no margin", never a
  fabricated 100% margin), or a pricing-SOURCE snapshot not frozen. Margins/readiness surface as
  WARNINGS via the readiness classifier (`LOW_MARGIN`, `UNRESOLVED_VAT`, `TAX_SIGN_OFF_REQUIRED`,
  `HIDDEN_ROWS_INCLUDED`, `REQUIRED_FILES_DEFERRED`), not blockers.
- **Rollback decision points:** calculations revert to the Lovable fallback if — the calc acceptance
  gate fails; a blocking tax/rounding assumption (`A.1`/`A.2`/Blocks B/C) surfaces such that a
  migrated calc total can no longer claim accounting-finality; or a golden-comparison divergence
  shows a calc total / readiness classification the new engine produces differently from the oracle.
  Reverting calculations does not force reverting the quote workflow already built on earlier calcs.

### 3.4 Quote Versions / PDF / Acceptance

- **Old-app fallback:** an already-sent/accepted Lovable quote stays the authoritative commitment on
  the Lovable fallback (read-only) — the pilot does not re-open or edit an old sent commitment; it
  re-versions forward. Fallback stays until the quote workflow gate passes and is **not removed**
  while a quote/acceptance blocking assumption is open.
- **Cutover-by-workflow plan:** cut the quote workflow over after calculations. Demo quotes are
  created + sent + accepted fresh. A real quote migration is a STOP — sent/accepted commitments carry
  legal/financial weight and their real-record selection is owner-gated (`8.1`). Runbook §3.4 carries
  the source/treatment rows.
- **Manual-backfill risks (runbook §3.4):** re-entering a quote by hand risks a frozen-snapshot
  mismatch (a hand-typed total that disagrees with the calc is a silent divergence the golden
  comparison exists to catch), an acceptance-evidence gap (evidence is a file OR external reference —
  a prose OR-convention, no DB XOR), or a zero-frozen accepted price silently skipping the
  adjusted-price reason gate. The acceptance-evidence UPLOAD lifecycle is a known unwired path (§4).
- **Rollback decision points:** the quote workflow reverts to the Lovable fallback if — the quote
  acceptance gate fails; a blocking acceptance-channel / adjusted-price / sent-lock assumption
  surfaces, or the acceptance-evidence upload lifecycle gate (§4, epic-8 High residual) is needed for
  real-customer evidence; or a golden-comparison divergence shows a quote total / PDF snapshot the new
  version freezes differently from the oracle. Reverting the quote workflow does not roll back CRM,
  pricing, or calculations.

### 3.5 Basic Job / Order

- **Old-app fallback:** completed Lovable jobs stay read-only on the fallback; the pilot creates new
  jobs from new acceptances. Fallback stays until the job workflow gate passes and is **not removed**
  while a job blocking assumption is open — and the job model structure is owner-pending (`7.1`
  `partial (möte)` / `7.3` `öppen (möte)`), so this fallback stays for the real-pilot track.
- **Cutover-by-workflow plan:** cut the job workflow over after the quote workflow, and **only after**
  the owner working session resolves the job model (`7.1`/`7.3`). Demo jobs are auto-created fresh;
  real job migration is a STOP. Runbook §3.5 carries the source/treatment rows.
- **Manual-backfill risks (runbook §3.5):** re-keying a job by hand risks an immutable-source-ref
  mismatch (a job must trace to a real acceptance + version; a hand-created job with no acceptance
  breaks the accept→job idempotency backstop). Because the job model's structure is owner-pending, a
  real backfill is premature. The deferred field-worker project surface must NOT be added (R-907).
- **Rollback decision points:** the job workflow reverts to the Lovable fallback if — the job
  acceptance gate fails; the owner working session resolves the job model (`7.1`/`7.3`) in a shape
  that invalidates the pilot's basic-job structure; or a golden-comparison divergence shows a job
  auto-created from an acceptance differently from the oracle. Reverting the job workflow does not
  roll back the quote workflow that produced the acceptance.

### 3.6 Required Files

- **Old-app fallback:** Lovable file access remains the fallback for a workflow's documents until
  that workflow's gate passes; required-file checking on the calc side is a documented live seam —
  the calc readiness classifier surfaces `REQUIRED_FILES_DEFERRED` because the calc→required-file
  check is not yet wired (R-513), so required-file handling is **manual** in the pilot. Fallback is
  **not removed** while a required-files blocking assumption is open.
- **Cutover-by-workflow plan:** cut required files over alongside their parent workflows; the
  required-file gate stays manual until the calc→file wiring lands. Real customer-file migration is a
  STOP (raw-file privacy + retention, R-818). Runbook §3.6 carries the source/treatment rows.
- **Manual-backfill risks (runbook §3.6):** re-uploading required files by hand risks a wrong
  owner-category link, a MIME/size-policy rejection (a closed allow-list; a real customer file type
  outside it is rejected), and — for real customer files — a raw-file privacy exposure (real files
  are never committed; §7). Upload is demo-data-only (client-declared MIME, no content-sniffing,
  R-817) — re-open on real-customer files.
- **Rollback decision points:** required files reverts to the Lovable fallback if — the required-files
  acceptance gate fails; a blocking retention / locked-evidence assumption surfaces (R-818 locked
  customer evidence has no object-reclamation path — a legal-sign-off STOP), or the acceptance-evidence
  upload lifecycle gate (§4) is needed for real evidence; or a golden-comparison divergence shows a
  file link the new polymorphic join resolves differently from the oracle. Reverting required files
  does not roll back the parent CRM / calc / quote / job workflows.

## 4. Sign-Off Register

Every owner / accounting / legal / security decision that gates real-pilot use is enumerated below as
a **register row**: the AC2 decision item, its status (**`signed-off`** or **`blocking`** real-pilot
use), the owning question ID in the sign-off system-of-record (`owner-signoff-questions.md` — the
single source of truth; this register **references** it and must not fork a divergent copy), the
decision owner, the affected workflow(s), and any real-pilot re-score residual folded in from the
deferred-work ledger.

**Status verified LIVE against `owner-signoff-questions.md`** (not memory): the source-of-record
statuses are `answered` / `partial` / `öppen (möte)` / `answered (scope)` / `answered (möte)`. An
owner-pending item (`öppen (möte)` / `partial (möte)`) stays **`blocking`** — it is never
default-marked `signed-off` to "complete" the register.

### 4.1 AC2 decision items

**Per-ID status coherence (no ID carries two opposite gate statuses).** The SoR reuses bare `A22`
for two distinct facets that resolve to OPPOSITE gate statuses: the **quote-terms text + approver**
facet is `answered` → `signed-off`, while the **customer-facing tax-deduction disclaimer wording**
facet is parked → `blocking`. To keep the register unambiguous — and to let a downstream consumer
keying on "is this ID blocking?" resolve it — the disclaimer-wording facet is carried under the
register-local sub-ID **`A22-tax`**, so bare `A22` (signed-off) and `A22-tax` (blocking) never
collide. The sign-off-register validator asserts this invariant: no single owning ID may appear with
both `signed-off` and `blocking` status.

| Decision item | Status | Owning question ID(s) | Owner | Affected workflow(s) | Notes / real-pilot re-score residual |
| --- | --- | --- | --- | --- | --- |
| Quote numbering | `signed-off` | `4.1` (answered) + architecture §24 (DECIDED) | Owner | Quote Versions | Plain sequential `Offert #<n>`; `quote_number_display` dormant. Decided — not a real-pilot blocker. |
| Sent-event semantics | `signed-off` | `4.2` (answered) | Owner | Quote Versions | "Vi väljer den exakta låsregeln" — the sent-lock rule is a chosen system decision. |
| Acceptance channels | `signed-off` (demo; real-pilot re-score) | `5.3` (answered) + Answered-earlier accept-bevis | Owner + Legal | Quote Versions, Required Files | Manual accept-dialog; all valid + optional file upload. **Re-score for real-pilot:** the acceptance-evidence UPLOAD lifecycle gate is unwired end-to-end (epic-8 **High** — a `7.4`-locked acceptance can still take new evidence links); evidence file-OR-reference has no DB XOR (epic-7). Re-open + wire the lifecycle/lock gate if real-customer evidence use is proposed. |
| Adjusted-price policy | `signed-off` (demo; real-pilot re-score) | `6.1` (answered) | Owner | Quote Versions | Prut / av-/tillkommer accepted; motiveringsfält motivated. **Re-score for real-pilot:** a zero-frozen `accepted_price_ore` (Epic-6 default 0) silently SKIPS the adjusted-price reason gate — backstop the frozen commitment gross as > 0 at mark-sent, or guard the zero-frozen case, before real quotes flow. |
| Required files | `signed-off` (demo; real-pilot re-score) | `5.2` (before send: Nej) + `5.3` (before accept: Nej för pilot) | Owner + Legal | Required Files, Calculations | No required files enforced for demo. **Re-score for real-pilot:** the calc→required-file check is NOT wired (`REQUIRED_FILES_DEFERRED`, R-513 — manual in the pilot); upload MIME is client-declared, not byte-sniffed (R-817); locked-evidence retention / hard-delete for locked customer evidence has no object-reclamation path (R-818 — a **legal-sign-off STOP**). |
| VAT | **`blocking`** real-pilot | `A.2` (answered 2026-07-26 — 25 %; omvänd betalningsskyldighet som egen momstyp) + `2.1` (answered — display) | Accounting | Settings / Pricing, Calculations, Quote Versions | The VAT RATE (`A.2`) is ANSWERED (25 %) but the reverse-charge VAT TYPE is unimplemented (Story 10.6), so this stays blocking until 10.6 lands. The DISPLAY rule (`2.1`: private always incl-VAT, company togglable) is decided. Blocks real-pilot accounting-finality; `UNRESOLVED_VAT` surfaces as a warning meanwhile. |
| ROT | **`blocking`** real-pilot | `B.1-B.4` (answered 2026-07-26 — 30 %, tak 50 000, underlag arbete inkl. moms) + `D.1`/`D.2`/`D.3` (answered — eligibility) | Accounting | Settings / Pricing, Calculations, Quote Versions | Rates/caps/basis are ANSWERED 2026-07-26 (30 %, 50 000, labor incl. VAT, whole-SEK truncation) but NOT yet implemented — Story 10.6 owns the reconciliation, so this stays blocking until then. Eligibility was already decided (only private; BRF not; ROT + grön not mixed). Blocks real-pilot. |
| grön teknik | **`blocking`** real-pilot | `C.1-C.3` (answered 2026-07-26 — 15/50/50, tak 50 000, 97 %-schablon endast fastpris) | Accounting | Settings / Pricing, Calculations, Quote Versions | Rates/caps/schablon are ANSWERED 2026-07-26 (15/50/50, cap 50 000, opt-in 97 % schablon) but NOT yet implemented — Story 10.6 owns it, so this stays blocking until then. |
| rounding | **`blocking`** real-pilot | `A.1` (answered 2026-07-26 — moms per momskategori på DOKUMENTNIVÅ) | Accounting | Settings / Pricing, Calculations, Quote Versions | ANSWERED 2026-07-26: the accountant chose **document-level rounding per VAT category** (Peppol EN 16931 BR-CO-17) — i.e. the shipped line-level default is WRONG, exactly the STOP this row anticipated. Story 10.6 owns the change; stays blocking until it lands. |
| quote terms | `signed-off` (demo; real-pilot re-score) | `A22` (answered — platshållartext räcker för piloten; **facet: quote-terms text + approver**, SoR "Villkorstext + godkännare" row) | Owner + Legal | Settings / Pricing, Quote Versions | Placeholder terms suffice for the pilot; the structural `quote_terms.approved_at` sign-off gate is human-only (edit resets). **Re-score for real-pilot:** real terms text + the send gate flipping `requires_sign_off` / `TAX_SIGN_OFF_REQUIRED` from a warning to a hard blocker (no compile/runtime send-time approvedAt marker exists today — epic-3). |
| tax wording | **`blocking`** real-pilot / parked | `A20` / `A21` / `A22-tax` (parked for full-release; **facet: customer-facing tax-deduction disclaimer wording**, SoR "Parked for full-release" prose bullet) | Legal + Accounting | Quote Versions | Estimate-vs-promised-reduction wording + customer-facing disclaimer — a real-customer-facing decision. Never a demo blocker; parked for full-release, blocks real-pilot. **`A22-tax` is a register-local sub-ID that isolates the disclaimer-wording facet from the answered quote-terms facet (bare `A22`, signed-off above)** — the SoR reuses bare `A22` for both; the two facets carry opposite gate statuses, so they MUST NOT share one owning ID (per-ID status-coherence is asserted by the sign-off-register validator). |

### 4.2 Migration / job-model blocking items (cross-referenced from the system-of-record)

These gate real-pilot cutover of the affected workflows (R-905/R-907). They are the
migration-classification / quote-immutability / acceptance items the §6 checklist keys on.

| Blocking item | Status | Owning question ID | Owner | Affected workflow(s) | Notes |
| --- | --- | --- | --- | --- | --- |
| Migration klassning (real-record selection) | **`blocking`** real-pilot | `8.1` (öppen (möte)) | Owner | ALL workflows whose real records would migrate | The concrete real-record selection per live/archive bucket is owner-pending (migration runbook §6, classification register §5). |
| Facit-exempel (golden-example selection) | **`blocking`** real-pilot | `8.2` (öppen (möte)) | Owner | Calculations, Quote Versions | Which quotes/calculations become golden-master examples is owner-pending; no Lovable oracle number is fabricated (runbook §5). |
| Job model — structure | **`blocking`** real-pilot | `7.1` (partial (möte)) | Owner | Basic Job / Order | The job name is answered ("Jobb"); the structure (jobb / order / arbetsorder / projekt) is owner-pending. |
| Job model — first-job-card fields | **`blocking`** real-pilot | `7.3` (öppen (möte)) | Owner | Basic Job / Order | Required fields on the first job card are owner-pending. |

Every question ID marked `blocking` above is present in the live system-of-record with an
owner-pending status (`öppen (möte)` / `partial (möte)`); the register carries **every** such ID so
the two lists never disagree on what is blocking (R-917 register-drift guard).

## 5. Demo-vs-Real-Pilot Track Split (do NOT conflate the two tracks)

Mirroring the migration runbook §7: the pilot runs on **disposable, obviously-fake demo data through
MVP** (owner decision 2026-07-03; `docs/process/demo-environment.md`). There are **two distinct
tracks — never conflated:**

| | **Demo track** (now, through MVP) | **Real-pilot track** (future, gated) |
| --- | --- | --- |
| Data | Disposable, obviously fake, entered fresh | Real customer data |
| Every §4 blocking item | **Non-blocking** — demo data entered fresh, nothing migrated | **Blocking** — gates cutover + fallback removal |
| Tax/money sign-off (`A.1` / `A.2` / Blocks B/C) | **Non-blocking** (placeholders; `requiresSignOff` framing) | **Blocking** until the owner working session |
| Migration / job-model (`8.1` / `8.2` / `7.1` / `7.3`) | **Non-blocking** (nothing migrated) | **Blocking** until owner clarification |
| Real data export/import | Not applicable (no real data) | **Hard STOP** requiring owner sign-off (runbook §6) |

**Every blocking item in §4 is `blocking` for the real-pilot track and non-blocking for the demo
track** — the tax/money/migration placeholders never gate demo work (owner decision 2026-07-03; the
demo send gate **does not block**). A demo-track cutover with the same open items proceeds; a
real-pilot cutover with any open blocking item does **not**. Re-open this split only if
real-customer use is proposed.

## 6. Executable Cutover-Block Checklist (the OPS/BUS gate — a real guard, not prose)

The register's `blocking` states are made operational by an **executable checklist model**
(`tests/unit/docs/sign-off-checklist-model.ts`, driven by
`tests/unit/docs/sign-off-register-validators.test.ts`). It exports a pure function:

```
evaluateCutover({ workflow, track, openBlockingItems })
  => { cutoverAllowed, fallbackRemovalAllowed, blockedBy }
```

It enforces the two non-negotiable rules (9.4-BLOCK-01, R-905/R-908):

1. **Real-pilot track:** ANY open blocking item HARD-BLOCKS both cutover AND fallback removal for
   that workflow; the block ATTRIBUTES which items stopped it (`blockedBy`) — a traceable block, not
   an opaque `false`.
2. **Demo track:** non-blocking even with the same open items (the two tracks are never conflated).

The acceptance validator **proves the block FIRES** — it seeds an open blocking item on a real-pilot
workflow and asserts cutover is denied (negative path), AND asserts a clean workflow IS cutover-ready
(positive path) — so the guard gates on OPEN items and is **not** a structurally-unreachable dead
guard (the epic-5-ledgered anti-pattern). This is the story's OPS/BUS gate: an irreversible-side-
effect gate on real-pilot cutover, not a passive doc.

## 7. PII / Privacy Hygiene + Verification Self-Check

### PII hygiene (epic blocker, R-901/R-902/R-914)

**Zero real PII in this control point.** Every example is structural/synthetic — no real name,
email, phone, address, personnummer, org number, secret, or raw customer value appears. Any
identifier referenced is a **module/column name** (e.g. `customers.personnummer`,
`accepted_price_ore`), never a value. Illustrative personnummer/orgnr placeholders, where ever
needed, use obviously-fake masked forms (`YYYYMMDD-XXXX`, `XXXXXX-XXXX`) kept non-10-digit or clearly
masked so the standing bare-10-digit orgnr scan (R-914) does not false-positive. Any readiness code
referenced (`REQUIRED_FILES_DEFERRED`, `TAX_SIGN_OFF_REQUIRED`, `UNRESOLVED_VAT`, `LOW_MARGIN`,
`HIDDEN_ROWS_INCLUDED`) is a real member of the exported `READINESS_CODES` union — never a fictional
code. The PII scan proving this file clean runs over the whole `docs/migration/**` tree in the
sign-off-register validator.

### Verification self-check (docs review, AC1/AC2/AC3)

Re-read as a fresh pilot operator:

- **Every pilot workflow (§3.1–§3.6) carries old-app fallback + cutover plan + manual-backfill risks
  + rollback decision points** — six workflows, all four layers present and non-empty. ✔ (AC1)
- **Cutover AND rollback are per-workflow, never whole-company** — §2 and each §3 rollback row. ✔
- **Fallback is not removed while a workflow's blocking assumption is open** — §2 fallback-erosion
  guard, restated per workflow in §3. ✔ (NFR21, R-908)
- **Every AC2 decision item is a register row marked `signed-off` or `blocking`** — §4.1 (eleven
  items). ✔ (AC2)
- **Every blocking question ID in the system-of-record appears in the register** — §4.1/§4.2 carry
  `A.1` / `A.2` / `B.1-B.4` / `C.1-C.3` / `7.1` / `7.3` / `8.1` / `8.2`. ✔ (R-917 no drift)
- **The demo-vs-real-pilot split is recorded; the demo track is non-blocking** — §5. ✔
- **The blocking states are enforced by an executable checklist that FIRES on an open item** —
  §6 + the `evaluateCutover(...)` model. ✔ (AC3, 9.4-BLOCK-01)

## 8. References

- Architecture §16 (Migration And Coexistence) — coexistence model, asset locations,
  cutover-by-workflow, Lovable-is-oracle-not-blueprint (the fallback-until-gates-pass rule).
- Architecture §24 (Open Architecture Questions) — the architecture-side mirror of the sign-off
  items (quote numbering DECIDED, rounding, VAT/ROT/grön, acceptance evidence, accepted-price
  changes, corrections, required files, job terminology, legacy migration).
- Companion: [migration-runbook.md](./migration-runbook.md) — per-workflow source/treatment/
  fallback/backfill/cutover table + the scope-unclear → STOP protocol (this control point builds on
  its §3 rows and adds the rollback + register layers).
- Companion: [legacy-record-classification.md](./legacy-record-classification.md) — the four-bucket
  record-group register.
- `owner-signoff-questions.md` — the sign-off **system-of-record** (this register references it;
  question IDs match the Swedish email 1:1). Not edited here.
- `docs/process/demo-environment.md` — demo-data-only posture; the demo-vs-real-pilot split.
- `project-context.md` — Product Boundary; twenty-four tables; seven nav items; demo-data-only
  decision; Money/Tax/Quote rules; Lovable Oracle Policy.
- `src/features/calculations/readiness.ts` — the real `READINESS_CODES` union (authoritative for any
  readiness-code reference above).
- `_bmad-output/implementation-artifacts/deferred-work.md` — the pilot-readiness residuals folded
  into §4 (acceptance-evidence upload lifecycle gate, R-817, R-818, R-513, zero-frozen accepted
  price, evidence-XOR, terms send-time marker).
