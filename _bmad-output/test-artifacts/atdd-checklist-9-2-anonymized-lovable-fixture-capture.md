---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
  - step-05-validate-and-complete
lastStep: step-05-validate-and-complete
lastSaved: '2026-07-07'
workflowType: testarch-atdd
inputDocuments:
  - _bmad-output/implementation-artifacts/9-2-anonymized-lovable-fixture-capture.md
  - _bmad-output/test-artifacts/test-design-epic-9.md
  - _bmad-output/auto-bmad/retro-notes/epic-9.md
  - _bmad-output/project-context.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - tests/unit/lib/money/golden-pack.test.ts
  - tests/fixtures/golden/snapshots/quote-version-source.json
  - tests/fixtures/golden/money/options-tillval.json
  - tests/fixtures/golden/files/file-lock-lifecycle.json
  - src/features/calculations/readiness.ts
  - tests/support/alias-hook.mjs
  - tests/support/register.mjs
---

# ATDD Checklist - Epic 9, Story 9.2: Anonymized Lovable Fixture Capture

**Date:** 2026-07-07
**Author:** Rasmus
**Primary Test Level:** UNIT (pure `node --test`, `pnpm run test:unit`) — GOLDEN-fixture infrastructure over `tests/fixtures/golden/lovable/**`

---

## Story Summary

Story 9.2 introduces the FIRST `tests/fixtures/golden/lovable/**` home + the first real
`old-lovable`/`documented-delta` origin machinery being exercised: anonymized structured fixtures per
business category (CRM / settings-pricing / calculations / quotes / PDFs / acceptance / files /
accepted-quote→job) that PRESERVE business shape while carrying ZERO real PII, a SHARED anonymization
scanner generalized out of the money golden-pack, a local/repeatable capture script, and the unit
tests that wire the whole thing into the CI gate. It is one of only two executable stories in Epic 9
and carries the epic's two dominant hazards: (1) a **privacy leak** and (2) **over-anonymization
destroying business shape** — both epic blockers regardless of numeric score.

**As a** pilot operator
**I want** anonymized Lovable oracle fixtures
**So that** new behavior can be tested against representative legacy examples without leaking customer data.

---

## Generation Mode & Stack

- **Detected stack:** the repo manifest is `fullstack` (Next.js/React + Playwright), but THIS STORY's
  surface is **UNIT-tier only** — test fixtures + a shared scanner + a capture script + `node --test`
  unit suites. There is NO HTTP endpoint and NO browser/page surface, so the generic ATDD workers
  (Worker A = API HTTP, Worker B = E2E browser) do NOT apply. This mirrors the validated Epic-4
  precedent (4.3/4.4 golden-pack stories routed generation to inline `node --test` UNIT/GOLDEN
  scaffolds rather than an HTTP/browser scaffold).
- **Mode:** AI generation (no recording — no UI to record). Step-04 generic API/E2E dispatch is
  explicitly overridden to inline UNIT/GOLDEN scaffolds, consistent with the story's own Task 5.1
  ("9.2 is fixtures + scripts + unit tests only") and Execution note ("9.2 is Unit-tier").
- **Red-gate mechanism:** the fixtures / shared scanner / capture script do NOT exist yet, so each
  suite is gated behind `describe.skip` on a **surface-present probe** (`lovableFixtureDirPresent()`
  / `captureScriptPresent()` / `loadScanner()` — does the fixture dir + a committed fixture + the
  scanner module exist). Mirrors the money-pack's `TAX_SURFACE_PRESENT` gate. The suites SKIP cleanly
  today; when the dev lands the fixtures + scanner + script the probes flip true automatically and the
  UNCHANGED assertions run — no test edit. **Verified:** all four suites report `# SKIP`; the full unit
  baseline is **1259 pass / 0 fail** (UNPERTURBED); `pnpm typecheck` clean; `eslint` clean (0 warnings).
- **RED assertions proven REAL (not vacuous):** temporarily un-skipping the privacy suite with the
  surface absent FAILS the three "scanner/fixtures must exist" assertions with meaningful messages
  AND PASSES the seeded-PII positive control — proving the scan is genuinely fail-closed (it detects
  planted personnummer / orgnr / non-example.test email / secret), not a green-on-nothing shell.

---

## Acceptance Criteria

1. **AC1 — anonymized fixtures preserve business shape; ZERO real PII unless explicitly (machine-readably)
   approved.** Fixtures preserve business shape for all eight categories; real names/emails/phones/
   addresses/personnummer/orgnr/secrets/raw files are removed or replaced; an approved exception carries
   an explicit machine-readable marker. [9.2-SHAPE-01, 9.2-PRIV-02, R-901/R-911]
2. **AC2 — capture scripts are local/test-oriented, documented, repeatable, no global change; a captured
   fixture round-trips through a lightweight golden loader (re-capture reproducibility).** [9.2-REPEAT-01, R-918]
3. **AC3 — privacy checks FAIL on obvious real PII/secret patterns.** A whole-fixture-set anonymization
   scan (personnummer / orgnr 10-digit / non-example.test email / secret/password/api_key / SE phone /
   street-address heuristic) over the DATA payload of EVERY committed fixture, wired into the unit gate
   so a seeded real PII/secret fails CI. [9.2-PRIV-01, R-901/R-914]

**Non-AC hard constraint (epic blocker):** ZERO real PII in any committed fixture / capture-script
log / prompt / committed script. Anonymize AT SOURCE; the committed-fixture scan is the CI backstop.

---

## Failing Tests Created (RED Phase)

> Levels are **UNIT** and **GOLDEN-fixture-infra**. There are NO API or E2E tests — the surface is
> fixtures + a pure scanner + a pure capture-script anonymizer. All four suites live under
> `tests/unit/fixtures/golden/lovable/**` (inside the `tests/unit/**` runner glob — R-904 runner-glob
> trap avoided) and import the shared `lovable-pack-support` helper.

### Shared support — `tests/unit/fixtures/golden/lovable/lovable-pack-support.ts`

Not a test file — the SINGLE authority the four suites import: the `GOLDEN_LOVABLE_DIR` path, the
glob backstop (`listLovableFixtureFiles`), the `loadScanner()` probe, the three-way `origin` union,
the REAL `ReadinessCode` member list + the FICTIONAL-code ban list, and the AC1 category list.

### Privacy scan — `tests/unit/fixtures/golden/lovable/lovable-privacy-scan.test.ts` (AC3, epic blocker)

Gated by `describe.skip` until the shared scanner + fixtures land.

- ✅ **9.2-PRIV-01a — shared scanner module exists (extracted, not copy-pasted)** (Task 1.2)
  - **Status:** RED — the shared scanner module does not exist yet.
  - **Verifies:** the dev extracted golden-pack.test.ts:379-418 into ONE shared module exporting a
    per-class authority (`assertNoPii(...)` OR `scanFixtureData(...) -> { violations }`).
- ✅ **9.2-PRIV-01b — no real PII/secret in ANY committed lovable fixture DATA payload** (R-901, epic blocker)
  - **Status:** RED — no committed fixture exists yet.
  - **Verifies:** every committed fixture carries a `_doc`/`_comment` prose string (scanned SEPARATELY);
    its stripped DATA payload trips NONE of personnummer/orgnr/email/secret/phone/address.
- ✅ **9.2-PRIV-01c — every glob-discovered fixture is covered by the scan (no silent-miss escape)** (Task 1.4)
  - **Status:** RED — glob backstop discovers 0 fixtures yet.
  - **Verifies:** the directory-glob set is scanned; if the dev ships an explicit manifest it must not
    MISS any glob-discovered file (a bare hardcoded list a future fixture escapes is the silent-miss trap).
- ✅ **9.2-PRIV-01d — POSITIVE CONTROL: seeded PII trips the scan (fail-closed proof)** (Task 1.5, R-901)
  - **Status:** GREEN-on-seed (this assertion PASSES today — it is the positive control that proves the
    scan detects planted PII). Seeded personnummer/orgnr/email/secret are constructed INLINE (never
    written to a `lovable/**` fixture) and each MUST be detected; the shared scanner must also throw/report.

### Shape / schema guard — `tests/unit/fixtures/golden/lovable/lovable-shape-guard.test.ts` (AC1, R-911)

Gated by `describe.skip` until fixtures land.

- ✅ **9.2-SHAPE-01a — every AC1 category represented by a STRUCTURED shape match (not a substring token)** (R-921)
  - **Status:** RED — no category fixtures yet.
  - **Verifies:** each of the eight AC1 categories has a representing fixture declaring `category:<name>`;
    a category with no fixture FAILS (over-thin pack = R-911). NOT a `raw.includes(token)` match (R-921).
- ✅ **9.2-SHAPE-01b — per-category load-bearing structure present (R-911 over-anonymization guard)**
  - **Status:** RED — fixtures absent.
  - **Verifies:** each category fixture carries its load-bearing keys (CRM `customer_type`; settings
    `companySettings`; calc `rows`; quotes `lines`; PDFs `mustNotAppear`; acceptance `acceptedPriceOre`;
    files `fileLinks`; job `jobSource`). Dropping the very structure 9.3 needs FAILS loud.
- ✅ **9.2-SHAPE-01c — a PDF-shape fixture carries a NON-EMPTY `mustNotAppear`** (6.3 leakage discipline)
  - **Status:** RED — no PDF fixture yet.
  - **Verifies:** a hidden row / unselected option leakage negative assertion is non-empty (an empty
    `mustNotAppear` guards nothing).
- ✅ **9.2-SHAPE-01d — every case has valid origin + non-empty note; all three origins exercised**
  - **Status:** RED — no cases yet.
  - **Verifies:** the three-way `origin` union is genuinely USED (>=1 each of old-lovable / new-expected /
    documented-delta), every case has a non-empty `note`.
- ✅ **9.2-SHAPE-01e — documented-delta divergent value is number OR classification-code** (R-913 widening)
  - **Status:** RED — no documented-delta cases yet.
  - **Verifies:** the epic-9 retro widening — a documented-delta's divergent old value may be a number OR
    a classification code (VAT posture / ReadinessCode label), NOT forced to a bare number.
- ✅ **9.2-SHAPE-01f — every readiness/warning code is a REAL member; NO fictional code** (R-903)
  - **Status:** RED — no fixtures yet.
  - **Verifies:** any readiness code in a fixture is a member of the REAL union
    (`src/features/calculations/readiness.ts`); the fictional `REQUIRES_SIGN_OFF`/
    `DEDUCTION_ESTIMATE_UNAPPROVED` codes are BANNED from `lovable/**` (9.2 must not propagate the R-903 trap).
- ✅ **9.2-SHAPE-01g — every öre integer < 10 digits (orgnr-scan false-positive guard)** (R-914)
  - **Status:** RED — no fixtures yet.
  - **Verifies:** no fixture integer >= 1,000,000,000 (would trip the `\b\d{10}\b` orgnr scan as a spurious leak).

### Loader round-trip — `tests/unit/fixtures/golden/lovable/lovable-loader-roundtrip.test.ts` (AC2, 9.2-REPEAT-01)

Gated by `describe.skip` until fixtures land.

- ✅ **9.2-REPEAT-01a — every committed fixture parses via the lightweight loader**
  - **Status:** RED. **Verifies:** the `JSON.parse(readFileSync(...))` loader (money-pack `readJson` pattern)
    parses every fixture (no unparseable fixture).
- ✅ **9.2-REPEAT-01b — round-trip is STABLE (parse → serialize → re-parse is deep-equal)**
  - **Status:** RED. **Verifies:** the parsed shape is the fixed point of re-serialization (re-capture reproducibility).
- ✅ **9.2-REPEAT-01c — committed fixture equals its canonical 2-space serialization (deterministic re-capture)**
  - **Status:** RED. **Verifies:** the on-disk bytes ARE the canonical pretty-print, so a deterministic
    capture re-run produces byte-identical output — the AC2 "repeatable" obligation.

### Capture-script contract — `tests/unit/fixtures/golden/lovable/lovable-capture-script.test.ts` (AC2, R-901/R-919)

Gated by `describe.skip` until the capture script lands.

- ✅ **9.x-PATH-01 / R-919 — the script lives ONLY in an approved location** (`scripts/migration/**` or a
  colocated helper), off the app runtime path (never `src/**`).
  - **Status:** RED — script absent.
- ✅ **9.2-PRIV-02 — anonymize AT SOURCE: a SYNTHETIC record's anonymized output contains NO PII shape** (R-901)
  - **Status:** RED — the pure `anonymizeRecord` export does not exist yet.
  - **Verifies:** driving the script's pure anonymizer on a SYNTHETIC (never real) record yields output
    where emails → `*@example.test`, personnummer/orgnr → masked non-matching placeholders, phone/address →
    non-matching synthetic, secrets → DROPPED. The story's input is synthetic/representative data (Stop
    Condition — no real Lovable pull), so this proves the PIPELINE without any owner-gated real-data export.
- ✅ **9.2-REPEAT-01 (script) — DETERMINISTIC: same input → byte-identical output across two runs** (AC2)
  - **Status:** RED. **Verifies:** seeded/fixed replacements (not random each run).
- ✅ **9.2-PRIV-02 (purity) — the anonymizer does not mutate its input in place** (no raw echo defense)
  - **Status:** RED.

---

## Data Factories Created

None. This is a fixture/scanner/script-infra story — no DB, no `@faker-js/faker`. The seeded-PII
positive control constructs its planted values INLINE (never written to a `lovable/**` fixture — that
would trip the real scan). The capture-script tests drive SYNTHETIC (obviously-fake) inputs, never a
real Lovable pull (owner-gated Stop Condition).

---

## Fixtures Created (RED scaffolds reference these; the DEV authors the JSON in the green phase)

The RED suites reference — but do NOT author — the anonymized JSON fixtures. The dev creates them in
`tests/fixtures/golden/lovable/**` in the green phase (Task 2), one per AC1 category, each:

- carrying `category:<name>` + the category's load-bearing keys (see 9.2-SHAPE-01b);
- three-way `origin` + non-empty `note` + a `_doc`/`_comment` prose string the scanner strips;
- exercising all three origin labels via `new-expected` cases + SYNTHETIC-representative `documented-delta`
  cases (clearly marked synthetic in the note) — NEVER a fabricated real Lovable oracle NUMBER;
- öre integers < 10 digits (orgnr-scan safe);
- readiness codes drawn ONLY from the REAL union;
- ZERO real PII; a private-customer CRM fixture MAY carry a `personnummer` FIELD but with an
  obviously-fake masked (non-`\d{6}-\d{4}`) placeholder (owner decision 2026-06-18);
- the PDF fixture carrying a non-empty `mustNotAppear`;
- the files fixture carrying link/type/purpose metadata ONLY — NEVER a raw file blob.

---

## Mock Requirements

None. No external service, no network, no DB, no clock. The capture-script tests must drive a PURE
anonymizer with NO network/global change (the script is local/test-oriented — 9.2 must not connect to
real Lovable).

---

## Required data-testid Attributes

None. This story adds no UI/route.

---

## Implementation Checklist (maps each RED suite to the dev's green-phase tasks)

### Shared scanner + fixture home (Tasks 1.1–1.5) → satisfies 9.2-PRIV-01a/b/c/d

- [ ] Create `tests/fixtures/golden/lovable/`.
- [ ] Extract golden-pack.test.ts:379-418 into a SHARED scanner module (Task 1.2 — pick ONE home;
      the scaffold expects `tests/support/anonymization-scan.ts` via `@/tests-support/...`, OR update
      `SCANNER_MODULE` in `lovable-pack-support.ts` if colocated). Export `assertNoPii(obj, label)` OR
      `scanFixtureData(obj) -> { violations }` (per-class authority). Keep the money-pack scan passing.
- [ ] Port the EXACT regex set (Task 1.3) — do not loosen.
- [ ] Wire the scan over EVERY `lovable/**` fixture DATA payload via an EXPLICIT manifest AND the
      directory-glob backstop (`LOVABLE_FIXTURE_MANIFEST` export if used).
- [ ] The seeded-PII positive control (9.2-PRIV-01d) already passes — keep the scanner fail-closed.

### Anonymized fixtures per category (Task 2) → satisfies 9.2-SHAPE-01a–g + 9.2-REPEAT-01a/b/c

- [ ] Author one fixture per AC1 category with `category:<name>` + the load-bearing keys; three-way
      origin exercised; real ReadinessCode members only; öre < 10 digits; non-empty PDF `mustNotAppear`;
      files metadata only (no blob); private-customer masked personnummer placeholder.
- [ ] Write each fixture as its canonical 2-space serialization (deterministic re-capture).

### Capture script (Task 3) → satisfies 9.x-PATH-01 + 9.2-PRIV-02 + 9.2-REPEAT-01(script)

- [ ] Create the capture script under `scripts/migration/**` (or the colocated helper) with a documented
      header + README/usage note. Export a PURE, deterministic `anonymizeRecord` the tests import
      (update the `loadAnonymizer` specifiers in `lovable-capture-script.test.ts` to the chosen path).
- [ ] Anonymize AT SOURCE (map real→synthetic before any write; log counts/ids only, never raw values).
      INPUT is synthetic/representative data — do NOT connect to real Lovable (owner-gated Stop Condition).

### Loader round-trip (Task 4.2) → satisfies 9.2-REPEAT-01a/b/c

- [ ] Reuse the money-pack `readJson` loader; ensure every fixture round-trips stably.

### P2 hardening (Task 4.3, optional) — orgnr scan scoped to string leaves

- [ ] Optionally scope the `ORGNR` scan to string-typed leaves / exclude numeric öre keys (do NOT loosen
      the regex). If it balloons complexity, record it deferred with reason (the öre-<10-digit rule is the
      current mitigation, enforced by 9.2-SHAPE-01g).

### Verify + scope sweep (Task 5)

- [ ] `pnpm run test:unit` all green (the four suites' gates flip true and pass). Existing golden pins stay green.
- [ ] Scope sweep: no tenant table, no migration, no `src/**` app-code change, no dependency, no `.env`,
      no nav item, no deferred-module surface, no real customer data export.
- [ ] PR gate posture: typecheck/lint/unit/build apply; migration-reset/DB-integration/RLS/storage-negative
      gates SKIPPED-WITH-REASON (no schema, no tenant table, no command).

**Estimated Effort:** ~6–10 h (scanner extraction + eight category fixtures + capture script + green-phase wiring).

---

## Running Tests

```bash
# Full pure-logic unit suite (part of `pnpm test`)
pnpm run test:unit

# Only the Story 9.2 lovable-pack scaffolds
node --experimental-strip-types --import ./tests/support/register.mjs --test "tests/unit/fixtures/golden/lovable/**/*.test.ts"
```

RED confirmation (current): all four suites report `# SKIP` (surface absent); the full unit baseline
stays green (**1259 pass / 0 fail**). The seeded-PII positive control is the one assertion that runs
GREEN today (proving fail-closed detection).

---

## Red-Green-Refactor Workflow

### RED Phase (Complete) ✅

- ✅ Four UNIT suites + one shared support module authored under `tests/unit/fixtures/golden/lovable/**`
  (inside the `tests/unit/**` glob — R-904 avoided). Each suite gated behind `describe.skip` on a
  surface-present probe; HARD assertions (not self-disabling `describe.skip` preconditions).
- ✅ The exact money-pack regex set pinned; the seeded-PII positive control proves fail-closed detection.
- ✅ The three-way origin + `number|classification-code` widening (R-913), the fictional-ReadinessCode
  ban (R-903), the structured-category match (R-921), the öre-<10-digit guard (R-914), the non-empty
  PDF `mustNotAppear` (6.3), and the anonymize-at-source / deterministic-capture contracts all encoded.
- ✅ Verified: 4 suites SKIP; full baseline 1259 pass / 0 fail UNPERTURBED; `pnpm typecheck` clean;
  `eslint` clean (0 warnings); un-skipping proves the RED assertions fail meaningfully (non-vacuous).

### GREEN Phase (DEV — Next Steps)

1. Create the fixture home + extract the shared scanner + author the eight category fixtures + the
   capture script (Tasks 1–3). The surface probes flip true automatically; the UNCHANGED assertions run.
2. If the dev chooses a different scanner/script path, update `SCANNER_MODULE` in the support module and
   the `loadAnonymizer` specifiers in the capture-script suite — do NOT edit the assertions (they ARE the contract).
3. Run the CI gate sequence (story Task 5.3–5.4).

### REFACTOR Phase

Keep exactly ONE anonymization-scan authority (the shared module) consumed by both the money pack and
the lovable pack; do not fork a looser copy. One numeric authority per category (reference existing
fixtures, do not re-pin).

---

## Notes

- **Epic blockers (non-negotiable, regardless of numeric score):** (R-901/R-902) ZERO real PII in any
  committed fixture/script/log/prompt — anonymize at source, the scan is the CI backstop; (R-911) the
  fixtures must preserve business shape (over-anonymization destroying the 9.3 oracle is a blocker).
- **Stop Conditions (needs-human):** STOP if (a) anonymization cannot preserve a category's required
  shape (R-911); (b) raw customer files or real PII are requested for a fixture; (c) a REAL Lovable
  export/import or the real-capture record SELECTION is requested (owner-gated Sign-Off 8.1/8.2 `möte`);
  or (d) a new dependency/migration/product-schema change appears necessary. None encountered authoring
  the scaffolds (fixtures + scripts + unit tests only).
- **Do NOT touch (owned elsewhere):** `snapshots/quote-version-source.json`'s fictional codes (9.3's
  alignment job — the shape-guard BANS them from `lovable/**` but does not edit the existing fixture),
  `owner-signoff-questions.md`, the deferred-work ledger, the Epic-3 test-design.
- **Never fabricate a real Lovable oracle number** (AGENTS.md behavioral-oracle policy) — documented-delta
  cases in the green phase are SYNTHETIC-representative, clearly marked, until the owner selects real examples.
- **Gate posture for the PR:** typecheck/lint/unit/build apply and must pass; migration-reset /
  DB-integration / RLS / storage-negative gates are NOT applicable (no schema, no tenant table, no
  command) — mark SKIPPED-WITH-REASON.

---

**Generated by BMad TEA Agent** — 2026-07-07
