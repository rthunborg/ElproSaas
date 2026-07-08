# Phase A Acceptance Gate Report

> **Phase A · Internal Pilot MVP · docs + a `tests/unit/**` validator.** This is the **final Phase A
> acceptance-gate report** — the consolidation control point that (1) summarizes **every Phase A gate**
> as `pass` / `fail` / `skipped-with-reason`, reconciled 1:1 with the real CI gate chain; (2) **confirms
> no deferred module leaked into implemented scope** (a scan driven by the real deny-list, proven to
> trip on a seeded token); and (3) lists **unresolved stop conditions with named decision owners** and
> blocks real-pilot use where required. It writes no product `src/**` code, no schema, no migration
> script, no nav item, and mutates no production data — it produces readiness evidence, not new product
> behavior. Its companions are the [migration runbook](./migration-runbook.md) (per-workflow source /
> treatment / fallback / backfill / cutover table), the
> [legacy-record classification register](./legacy-record-classification.md) (the four-bucket
> record-group decisions), and the [pilot fallback / cutover / sign-off register](./pilot-fallback-cutover.md)
> (per-workflow rollback layer + the sign-off register §4). This report **builds on** those and
> **references** their rows — it does not restate them.
>
> **Provenance:** authored by the Epic-9 Phase-A-acceptance-gate-report story. This one-time provenance
> line is the only plan-position reference; the durable body below references **architecture §16
> (Migration And Coexistence)**, **§19 (CI And Quality Gates)**, and **§24 (Open Architecture
> Questions)**, never "Epic N / Story X-Y" (evergreen-doc anchoring, R-922).

## 1. How To Read This Report

- **§2** is the **gate summary** — every Phase A gate as a row with a `pass` / `fail` /
  `skipped-with-reason` status, each row citing which CI job/step runs it. It is reconciled 1:1 with
  the real CI gate chain (`.github/workflows/ci.yml`) and the architecture §19 ten-stage list. The
  gate-honesty validator (`tests/unit/docs/acceptance-gate-report-validators.test.ts`) reads this
  section LIVE and FAILS on a false-green (a mandatory gate reported `pass` that did not run, or
  `skipped` with no reason, or a mandatory gate absent).
- **§3** is the **skipped-gates discipline** for THIS docs+validator story's own PR — which product
  gates apply, which are `skipped-with-reason`, and why (the same honesty discipline this report
  authors, applied to itself — practice what the report preaches).
- **§4** is the **scope confirmation** — the deferred-module deny-list, the confirmation that the
  implemented surface (7 nav items, 24 tenant-owned tables, the limited `Filer` index) carries NONE of
  them, and the note that the scope-scan validator drives the real deny-list live and proves the scan
  trips on a seeded token.
- **§5** is the **security / money / migration evidence consolidation** — the standing harness
  evidence the gate summary rests on, referenced (not re-run).
- **§6** is the **readiness / stop-conditions** section — every unresolved stop condition with a NAMED
  decision owner, marked whether it blocks real-pilot use, reconciled 1:1 with the
  [sign-off register](./pilot-fallback-cutover.md) §4 blocking rows. The demo track stays explicitly
  non-blocking.
- **§7** is the PII hygiene statement + verification self-check.

**Scope discipline.** This report is a decision/evidence artifact. It **records** the gate outcomes,
the scope confirmation, and the readiness residuals — it does not fabricate a `pass` for a gate that
failed, does not default-mark an owner-pending stop condition `signed-off`, and does not smuggle a
deferred module into scope. Any required Phase A gate actually FAILING, or a deferred module found in
implemented scope, is a **STOP** — the report must record the failure/leak, never paper over it.

## 2. Gate Summary (every Phase A gate — `pass` / `fail` / `skipped-with-reason`)

The gate list is read LIVE from the real sources — the CI gate chain (`.github/workflows/ci.yml`), the
`package.json` scripts (`test:unit` / `test:int` / `test:e2e` / `verify:*`), and the architecture §19
ten-stage recommendation — not a memorized copy that drifts. Every row cites the CI **job** and
**step** that runs it. Status values are exactly one of **`pass`**, **`fail`**, or
**`skipped-with-reason`**.

**How to read a status.** A `pass` means the gate ran green in CI on the merge commit for the story
that owns the surface. A `skipped-with-reason` means the gate does not apply to a given story's diff
(e.g. a docs-only story touches no product code, so the migration-reset / integration / RLS-storage /
e2e gates are N/A) — the reason is mandatory. A `fail` means the gate ran and did NOT pass — a `fail`
here is a real STOP (§6). **No mandatory gate may be reported `pass` if it did not actually run; a
mandatory gate `skipped` WITHOUT a reason FAILS this report** (R-909, the evidence-honesty teeth,
enforced by the validator).

### 2.1 `verify` job — architecture §19 stages 1-5 + 10 (runs on every PR and push to `main`)

| Gate | Status | CI job / step | Notes |
| --- | --- | --- | --- |
| Clean install (`pnpm install --frozen-lockfile`) | `pass` | `verify` job · step "Install dependencies" | Frozen-lockfile install from the committed `pnpm-lock.yaml`; a drifted lockfile fails here (architecture §19 stage 1). |
| Lockfile verify (`verify:lockfiles`) | `pass` | `verify` job · step "Verify lockfiles (single package manager)" | Single-package-manager guard (`scripts/verify/check-lockfiles.mjs`) — no stray npm/yarn lockfile. |
| Dependency audit (`pnpm audit --audit-level=high`) | `pass` | `verify` job · step "Audit dependencies (blocking, high severity)" | Blocking on HIGH/CRITICAL advisories against the installed tree (owner decision 2026-07-03 — blocking gate). A red run here on an untouched branch means a new upstream advisory, fixed by a dependency bump, never by weakening the threshold. |
| Service-role source containment (`verify:service-role-containment`) | `pass` | `verify` job · step "Verify service-role containment (no client-path leakage)" | Source-level grep (`scripts/verify/check-service-role-containment.mjs`) — this app uses NO service-role key on client paths (anon + RLS). |
| Typecheck (`pnpm typecheck`) | `pass` | `verify` job · step "Typecheck" | `tsc --noEmit` — architecture §19 stage 2. Applies to this story (the validator is TypeScript). |
| Lint (`pnpm lint`) | `pass` | `verify` job · step "Lint" | `eslint` — architecture §19 stage 3. Applies to this story. |
| Unit tests (`pnpm test:unit`) | `pass` | `verify` job · step "Unit tests (pure logic, node --test)" | The `node --test` pure-logic gate (glob `tests/unit/**/*.test.ts`) — architecture §19 stage 4. This includes the golden-master comparisons and the fixture-privacy / docs-invariant checks that run INSIDE the unit gate (see §2.4). This story ADDS the acceptance-gate-report validators here. |
| Build (`pnpm build`) | `pass` | `verify` job · step "Build" | `next build` — architecture §19 stage 5. Applies to this story. |
| Built-bundle service-role containment (`verify:bundle-containment`) | `pass` | `verify` job · step "Verify built-bundle service-role containment (no leakage in .next)" | The authoritative built-bundle grep over `.next` (runs AFTER build — order load-bearing; architecture §19 stage 10). A clean build yields zero hits (no service-role key). |

### 2.2 `db` job — architecture §19 stages 6 + 8 (gated behind `verify`, local Supabase stack only)

| Gate | Status | CI job / step | Notes |
| --- | --- | --- | --- |
| Migration reset from empty DB (`supabase db reset`) | `pass` | `db` job · steps "Start local Supabase stack" + "Migration reset (empty DB → migrate → seed)" | Empty DB → apply the committed migrations → seed — architecture §19 stage 6. Includes the per-table RLS policy enumeration and the H4 table-inventory gate (the standing contract that fails CI when a tenant-owned table is not enrolled — all **twenty-four** tenant-owned tables enrolled in `TENANT_TABLES`). `SUPABASE_TEST_REQUIRED=1` makes a missing stack a HARD failure so this gate can never silently false-green. |
| Integration + RLS / storage negative tests (`pnpm test:int`) | `pass` | `db` job · step "Integration + RLS negative tests (local stack)" | The DB-backed command-integration + cross-tenant RLS-negative + anon-path + storage-object isolation suites — architecture §19 stages 7 + 8. Runs against the LOCAL Supabase CLI stack only (never a shared dev/staging/prod project). |

### 2.3 `e2e` job — browser E2E (gated behind `verify`, local stack only)

| Gate | Status | CI job / step | Notes |
| --- | --- | --- | --- |
| Browser E2E (`pnpm test:e2e`) | `pass` | `e2e` job · steps "Install Playwright browser" + "Migration reset" + "E2E tests (Playwright)" | The Playwright webServer builds + starts the app against the local stack, seeds the two-tenant fixture, and drives the real browser journeys. Runs in parallel with `db` (each boots its own local stack). |

### 2.4 Gates that run INSIDE the unit gate (architecture §19 stage 9 + the fixture-privacy checks)

These do not have their own CI step — they are `node --test` files under `tests/unit/**` that run as
part of `pnpm test:unit` (the "Unit tests" step of the `verify` job). Reported here so the gate summary
enumerates them explicitly (they are the architecture §19 stage 9 golden-master + the fixture-privacy
layer).

| Gate | Status | CI job / step | Notes |
| --- | --- | --- | --- |
| Golden-master comparisons (money / calc / quote-PDF text / accept→job) | `pass` | `verify` job · step "Unit tests (pure logic, node --test)" (runs inside `test:unit`) | The `@/lib/money` golden pack, the calc golden pack, the quote-PDF text-extraction golden, and the accept→job golden — architecture §19 stage 9. Golden-pinned pending owner sign-off (`requiresSignOff` framing threads through every snapshot; see §5). No golden is authored by this story — it REFERENCES them. |
| Fixture-privacy / anonymization checks | `pass` | `verify` job · step "Unit tests (pure logic, node --test)" (runs inside `test:unit`) | The anonymized-fixture scanner + the whole-directory `docs/migration/**` PII scan (personnummer / orgnr / email / phone / secret) — the fixture-privacy layer of architecture §19 stage 10. This report is authored under `docs/migration/**` and is proven clean by that scan (§7). |

## 3. Skipped-Gates-With-Reasons Discipline (this story's own PR)

This story is a **docs + `tests/unit/**` validator** PR. It writes NO product `src/**` code, NO schema,
NO migration, NO server command, NO UI, NO nav item. The gate posture for THIS PR — applying the same
honesty discipline this report authors:

- **Typecheck / Lint / Unit tests / Build — APPLY and must pass.** The validator is TypeScript under
  `tests/unit/**` and runs in the unit gate; the report doc is scanned by the unit-gate PII scan.
  These are real green runs, not over-claimed.
- **Migration reset (`supabase db reset`) — `skipped-with-reason`.** No schema, no migration file
  (`supabase/migrations/**` untouched) — there is nothing to reset. Reported `skipped-with-reason`,
  never claimed as a passing product run.
- **Integration + RLS / storage negatives (`pnpm test:int`) — `skipped-with-reason`.** No server
  command, no tenant-owned table, no storage path touched — no DB-backed behavior to exercise.
- **Browser E2E (`pnpm test:e2e`) — `skipped-with-reason`.** No UI, no route, no user journey changed.

**The convention this section encodes (R-909).** A mandatory gate that a story legitimately skips MUST
carry its reason. A mandatory gate reported `pass` that did not run, OR `skipped` with no reason, is the
false-green failure the validator catches. NEVER over-claim a green run that was not needed. In the
consolidated §2 gate summary above, any story that legitimately skipped a product gate would likewise
record its reason — a docs-only Epic-9 story skips the product gates the same way this PR does.

## 4. Scope Confirmation — No Deferred Module In Implemented Scope

### 4.1 The deferred-module deny-list

The Phase A boundary forbids these deferred modules from the implemented surface — no production table,
route, nav item, command, or UI for any of them (architecture §20 "Deferred-scope schema creep";
architecture §21 documents them as future SEAMS only, not Phase A surface):

Fortnox · supplier APIs · AI jobs · HR · rentals · assets / QR · DoU automation · tender / FKU RAG ·
full RBAC · customer portal · public privileged endpoints · broad admin analytics · broad document
center.

The machine-checkable half of this list lives in the real deny-list module
(`src/features/files/deferred-categories.ts`, `FORBIDDEN_DEFERRED_CATEGORIES` = `fortnox`, `supplier`,
`asset`, `rental`, `hr`, `dou`, `upphandling`). The scope-scan validator imports that deny-list **LIVE**
(never a hardcoded copy that drifts) and drives the scan against BOTH a clean surface (positive path
passes) AND a seeded-token surface (negative path fires) — so the guard is proven reachable, not
structurally-unreachable machinery. The deny-list module itself is NOT scanned as a violation (it holds
the forbidden tokens by design).

### 4.2 The implemented surface carries NONE of them

Anchored to the REAL evidence (live counts, not memory):

- **Exactly SEVEN nav items** (`src/components/app-shell/nav-items.ts`): Dashboard, Kunder, Kalkyler,
  Offerter, Jobb/Order, Filer, Inställningar. No deferred-module nav item (no Fortnox, no field-worker
  "Pilotstöd/Migrering", no supplier, no analytics dashboard). The nav is the single source of truth
  for the shell — a deferred module cannot appear as a route or placeholder without appearing here.
- **Exactly TWENTY-FOUR tenant-owned tables** (`TENANT_TABLES` in
  `tests/integration/rls/tenant-table-inventory.ts`): the foundation tables (tenants,
  tenant_memberships, audit_events) + CRM (customers, facilities, contacts) + settings
  (company_settings, quote_terms) + pricing (work_roles, articles) + calc (calculations,
  calculation_sections, calculation_rows) + files (files, file_links) + quotes (tenant_counters,
  quotes, quote_versions, quote_version_lines, quote_version_attachments, quote_events) + acceptance /
  job (quote_acceptances, jobs, job_events). No Fortnox mapping table, no supplier table, no asset /
  rental / HR / DoU / tender table.
- **The limited `Filer` index** — a flat Phase-A file list over the seven owner categories, NOT a
  broad document center (R-816). The 8.5 guardrail (`tests/unit/guardrails/file-index-non-scope.test.ts`)
  keeps a document-center / cross-module-analytics surface token out of the file-index sources.
- **No public privileged endpoints, no service-role client paths** (§5) — the AC2 Security clause. No
  broad admin analytics module (audit is append-only traceability, not analytics — architecture §20).

**Confirmation:** the implemented surface (routes / nav / schema / commands) carries **none** of the
deny-list categories. The doc records this confirmation; the scope-scan validator PROVES it — it drives
the real deny-list live over a modeled surface, passes on the clean surface, and FAILS on a seeded
`fortnox` / `supplier` / … token (a positive test, not a mere omission).

## 5. Security / Money / Migration Evidence Consolidation

The gate summary (§2) rests on the standing evidence harnesses. This section REFERENCES them (it does
not re-run or re-implement them) so the report is a single consolidation surface.

### 5.1 Security evidence (architecture §20 security-risks table)

- **Cross-tenant RLS negatives + the H4 table-inventory gate.** Every one of the twenty-four
  tenant-owned tables is enrolled in `TENANT_TABLES`; the H4 gate fails CI when a tenant-owned table is
  not enrolled (the standing Epics 3-9 contract) — so a new tenant table cannot ship without a
  cross-tenant negative.
- **Anon-path isolation suite.** Every enrolled table is covered for anonymous SELECT / INSERT / UPDATE
  / DELETE — anon is denied at the privilege layer before any row matches.
- **Storage-object isolation matrix.** Cross-tenant list / read / sign, path-spoof, anon, and
  expired-URL negatives on the private bucket (server-derived paths, tenant-owned metadata, signed-URL
  command checks — architecture §20 "Storage path spoofing").
- **Service-role containment — source AND built bundle.** This app uses NO service-role key on app
  paths (anon + RLS); the source grep (`verify:service-role-containment`) and the built-bundle grep
  over `.next` (`verify:bundle-containment`) both yield zero hits.
- **Immutability lock families.** The sent-quote-version lock (`QV409`), the accepted-reference lock
  (`AR704`), and the locked-file lock (`FL823`) enforce that mutable customer commitments are immutable
  except through an audited correction (architecture §20 "Mutable customer commitments").

**Confirmation (AC2 Security clause):** NO public privileged endpoints, NO service-role client paths, NO
broad admin analytics module, and NO deferred-scope activation before pilot use.

### 5.2 Money / tax / quote-lifecycle + migration evidence

- **Golden packs.** The `@/lib/money` golden pack, the calc golden pack, the quote-PDF
  text-extraction golden, and the accept→job golden pin the money/tax/quote-lifecycle behavior. The
  rounding / VAT / ROT / grön engine is an **UNAPPROVED placeholder** pending owner sign-off — the
  `requiresSignOff` framing threads through every snapshot / golden so a deduction is never rendered
  approved / legally-final. No golden or fixture is authored by this report; it REFERENCES them.
- **Golden-example origin discipline.** The concrete real golden-example selection (`8.2`) is
  owner-pending (`öppen (möte)`). No old-Lovable oracle number is fabricated (AGENTS.md — Lovable is a
  behavioral oracle only). Golden examples are forthcoming / owner-gated, never concrete captured
  values.
- **Old-app fallback + fixture coverage before cutover.** The [migration runbook](./migration-runbook.md)
  (per-workflow fallback), the anonymized Lovable fixtures, the golden-master comparison harness, and
  the [pilot fallback / cutover / sign-off register](./pilot-fallback-cutover.md) together provide the
  Lovable-fallback-until-gates-pass coverage (architecture §16). Cutover is per-workflow, never
  whole-company.

## 6. Readiness / Stop Conditions (named owners; blocks real-pilot where required)

Every unresolved stop condition is listed below with a **named decision owner** (owner / accounting /
legal / security) and marked whether it **blocks real-pilot use**. This list is reconciled **1:1** with
the [sign-off register](./pilot-fallback-cutover.md) §4 `blocking` rows (the single source of truth for
what is `blocking`, verified there live against `owner-signoff-questions.md`) — it does not fork a
divergent status list. An owner-pending item (`öppen (möte)` / `partial (möte)`) stays **`blocking`**;
it is never default-marked `signed-off`.

**Two tracks, never conflated (owner decision 2026-07-03).** Every item below is **`blocking` for the
real-pilot track** and **non-blocking for the demo track** (disposable, obviously-fake demo data,
entered fresh, nothing migrated — `docs/process/demo-environment.md`). Re-open the split only if
real-customer use is proposed.

### 6.1 Money / tax / accounting-and-legal blockers (from sign-off register §4.1)

| Stop condition | Blocks real-pilot? | Demo track | Decision owner | Owning ID(s) | Notes |
| --- | --- | --- | --- | --- | --- |
| VAT rate | **Yes — blocking** | Non-blocking | Accounting | `A.2` (öppen (möte)) | The VAT RATE is `möte`-open; the display rule is decided. `UNRESOLVED_VAT` surfaces as a warning meanwhile. Blocks real-pilot accounting-finality. |
| ROT (rates / caps / basis) | **Yes — blocking** | Non-blocking | Accounting | `B.1-B.4` (öppen (möte)) | Rates / caps / basis are `möte`-open; eligibility is decided (private only). Blocks real-pilot. |
| grön teknik (rates / caps / schablon) | **Yes — blocking** | Non-blocking | Accounting | `C.1-C.3` (öppen (möte)) | Rates / caps / schablon are `möte`-open. Blocks real-pilot. |
| rounding | **Yes — blocking** | Non-blocking | Accounting | `A.1` (öppen (möte)) | Line-level round-half-away is a golden-pinned UNAPPROVED placeholder; document-level rounding is a STOP. Blocks real-pilot. |
| tax wording (estimate-vs-promised + disclaimer) | **Yes — blocking / parked** | Non-blocking | Legal + Accounting | `A20` / `A21` / `A22` (parked) | Customer-facing reduction wording + disclaimer — parked for full-release, blocks real-pilot; never a demo blocker. |

### 6.2 Migration / job-model owner blockers (from sign-off register §4.2)

| Stop condition | Blocks real-pilot? | Demo track | Decision owner | Owning ID | Notes |
| --- | --- | --- | --- | --- | --- |
| Migration klassning (real-record selection) | **Yes — blocking** | Non-blocking | Owner | `8.1` (öppen (möte)) | The concrete real-record selection per live/archive bucket is owner-pending. Real export/import is a hard STOP (migration runbook §6). |
| Facit-exempel (golden-example selection) | **Yes — blocking** | Non-blocking | Owner | `8.2` (öppen (möte)) | Which quotes/calculations become golden-master examples is owner-pending; no Lovable oracle number is fabricated. |
| Job model — structure | **Yes — blocking** | Non-blocking | Owner | `7.1` (partial (möte)) | The job name is answered ("Jobb"); the structure is owner-pending. |
| Job model — first-job-card fields | **Yes — blocking** | Non-blocking | Owner | `7.3` (öppen (möte)) | Required fields on the first job card are owner-pending. |

### 6.3 Demo-vs-real-pilot re-score residuals (folded from the deferred-work ledger, reconciled with sign-off register §4.1)

These are `signed-off` for the demo track but carry a **real-pilot re-score** with a named owner. They
are already recorded in the sign-off register §4.1; this report reconciles them, it does not re-defer
them.

| Re-score / stop item | Blocks real-pilot? | Demo track | Decision owner | Notes |
| --- | --- | --- | --- | --- |
| Acceptance-evidence UPLOAD lifecycle gate (unwired end-to-end) | Re-score for real-pilot (epic-8 **High**) | Non-blocking | Owner | A `7.4`-locked acceptance can still take new `acceptance_evidence` links — the "wrong-lifecycle rejected" clause is unmet for the acceptance-owner path. Owner-accepted under demo-data-only; wire a lifecycle/lock gate if real-customer evidence use is proposed. Not wired here (docs + validator). |
| Upload MIME is client-declared, not byte-sniffed | Re-score for real-pilot (R-817) | Non-blocking | Security | Cleared as not a reachable exploit under demo-data-only (closed allow-list, private bucket); add magic-byte sniffing when a final file-type policy is set / real uploads flow. |
| Locked-evidence retention / hard-delete (no object-reclamation path) | **Yes — blocking (legal STOP)** | Non-blocking | Legal | Locked customer evidence has no object-reclamation path (archive-over-delete; a tenant delete leaves orphaned objects — a GDPR/retention gap). A legal-sign-off-gated STOP for real-pilot (R-818). |
| Required-file readiness is a documented placeholder | Re-score for real-pilot (R-513) | Non-blocking | Owner | The calc→required-file check is NOT wired (`REQUIRED_FILES_DEFERRED`); required-file handling is manual in the pilot. A live seam, not wired here. |
| Zero-frozen `accepted_price_ore` skips the adjusted-price reason gate | Re-score for real-pilot | Non-blocking | Owner | A zero-frozen accepted price (default 0) silently skips the adjusted-price reason gate; backstop the frozen commitment gross as > 0 at mark-sent, or guard the zero-frozen case, before real quotes flow. |
| Evidence file-OR-reference has no DB XOR | Re-score for real-pilot | Non-blocking | Owner | Evidence exclusivity is a prose OR-convention, no DB CHECK; a both-present row is defensively dual-displayed. The DB XOR is deferred. |
| Terms send-time `approved_at` marker | Re-score for real-pilot | Non-blocking | Owner + Legal | No compile/runtime marker forces a future "mark sent" to check terms `approved_at` before send; flipping `requires_sign_off` / `TAX_SIGN_OFF_REQUIRED` from a warning to a hard blocker is a real-pilot re-score. |

**Reconciliation note.** Every `blocking` question ID in the sign-off register §4 (`A.1` / `A.2` /
`B.1-B.4` / `C.1-C.3` / `7.1` / `7.3` / `8.1` / `8.2`) appears above with a named owner. The
readiness-reconciliation validator reads the register LIVE and FAILS if a register-blocking ID is absent
from this section (the R-917 no-drift discipline extended to this report). The readiness references above
use only real `READINESS_CODES` members (`UNRESOLVED_VAT`, `TAX_SIGN_OFF_REQUIRED`,
`REQUIRED_FILES_DEFERRED`) — never a fictional code.

## 7. PII / Privacy Hygiene + Verification Self-Check

### PII hygiene (epic blocker, R-901/R-902/R-914)

**Zero real PII in this report.** Every example is structural / synthetic — no real name, email, phone,
address, personnummer, org number, secret, or raw customer value appears. Any identifier referenced is a
**module / column / gate name** (e.g. `accepted_price_ore`, `verify:bundle-containment`), never a value.
Illustrative personnummer/orgnr placeholders, where ever needed, use obviously-fake masked forms
(`YYYYMMDD-XXXX`, `XXXXXX-XXXX`) kept non-10-digit or clearly masked so the standing bare-10-digit orgnr
scan (R-914) does not false-positive. This report references gates + goldens, not raw öre values. The
PII scan proving this file clean runs over the whole `docs/migration/**` tree in the acceptance-gate
validator.

### Verification self-check (docs review, AC1/AC2/AC3)

Re-read as the implementation lead deciding pilot readiness:

- **Every Phase A gate is a row in §2 with a `pass` / `fail` / `skipped-with-reason` status, each
  citing its CI job/step, reconciled 1:1 with the real CI gate chain.** ✔ (AC1)
- **No mandatory gate is reported `pass` without running, and no gate is `skipped` without a reason** —
  the gate-honesty validator enforces this and FIRES on a seeded false-green. ✔ (AC1, R-909)
- **This story's own PR states which product gates are `skipped-with-reason` and why** — §3. ✔
- **The scope confirmation enumerates the deny-list and confirms the implemented surface (7 nav, 24
  tables, limited index) carries none of it; the scan trips on a seeded token.** ✔ (AC2, R-910)
- **Every unresolved stop condition carries a named decision owner and is marked real-pilot-blocking,
  reconciled 1:1 with the sign-off register §4.** ✔ (AC3, R-920)
- **The demo track is explicitly non-blocking** — §6. ✔
- **Zero real PII; readiness codes referenced are real members of the exported union.** ✔ (R-901/R-902)

## 8. References

- Architecture §16 (Migration And Coexistence) — coexistence model, asset locations,
  cutover-by-workflow, Lovable-is-oracle-not-blueprint.
- Architecture §19 (CI And Quality Gates) — the recommended ten-stage gate list the §2 summary
  reconciles 1:1 with the real `.github/workflows/ci.yml` chain; "docs-only PRs may run lighter checks
  but must state skipped product gates" — the exact §3 discipline.
- Architecture §20 (Security Risks And Mitigations) — the §5.1 security-evidence source (service-role
  leakage, tenant spoofing, RLS gaps, storage-path spoofing, public privileged endpoints, immutable
  commitments, deferred-scope creep, audit-not-analytics).
- Architecture §24 (Open Architecture Questions) — the architecture-side mirror of the §6 readiness
  items (quote numbering DECIDED, rounding, VAT/ROT/grön, acceptance evidence, required files, job
  terminology, legacy migration).
- Companion: [migration-runbook.md](./migration-runbook.md) — per-workflow source / treatment /
  fallback / backfill / cutover table + the scope-unclear → STOP protocol.
- Companion: [legacy-record-classification.md](./legacy-record-classification.md) — the four-bucket
  record-group register.
- Companion: [pilot-fallback-cutover.md](./pilot-fallback-cutover.md) — the per-workflow rollback layer
  + the sign-off register §4 (the §6 readiness list reconciles 1:1 against §4).
- `.github/workflows/ci.yml` + `package.json` — the real CI gate chain + the `test:unit` / `test:int`
  / `test:e2e` / `verify:*` scripts the §2 summary reads LIVE.
- `src/features/files/deferred-categories.ts` — the `FORBIDDEN_DEFERRED_CATEGORIES` deny-list the §4
  scope scan imports live (never a hardcoded copy; never scanned as a violation).
- `src/components/app-shell/nav-items.ts` — the seven-item nav the §4 confirmation anchors to.
- `tests/integration/rls/tenant-table-inventory.ts` — the twenty-four-table `TENANT_TABLES` boundary.
- `src/features/calculations/readiness.ts` — the real `READINESS_CODES` union (authoritative for any
  readiness-code reference).
- `docs/process/demo-environment.md` — demo-data-only posture; the demo-vs-real-pilot split.
- `_bmad-output/implementation-artifacts/deferred-work.md` — the pilot-readiness residuals folded into
  §6.3 (acceptance-evidence upload lifecycle gate, R-817, R-818, R-513, zero-frozen accepted price,
  evidence-XOR, terms send-time marker).
