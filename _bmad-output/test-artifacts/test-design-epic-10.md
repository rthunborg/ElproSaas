---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-07-19'
workflowType: testarch-test-design
designLevel: epic
epicNum: 10
mode: epic-level
inputDocuments:
  - _bmad-output/planning-artifacts/epics-phase-b.md (Epic 10 §ll.522-696; Cross-Epic Delivery Rules ll.44-54; FR62-65)
  - _bmad-output/planning-artifacts/architecture-phase-b.md (§5 ADR-B003; §6 ADR-B004; §9.1 tables; §11 read-model/entitlement; §14 markQuoteVersionLost; §3.6 field withholding)
  - _bmad-output/planning-artifacts/prd-phase-b.md (FR62-65, FR129-130, FR107; NFR11 carried, NFR47, NFR51; AC-B1a-5/6; §13, §14 Phase C ledger)
  - _bmad-output/implementation-artifacts/sprint-status.yaml (Phase B wave order; OWNER-GATE WATCHLIST N-4)
  - _bmad-output/test-artifacts/test-design-epic-6.md (house style + inherited immutability/isolation harness)
  - src/server/commands/quotes/lifecycle.ts; src/features/quotes/lifecycle.ts (existing lifecycle command + state machine)
  - src/features/files/deferred-categories.ts (deny-list to be manifest-derived)
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES — 24-table Phase A set; H4 gate)
  - supabase/migrations/20260705120000_quote_version_model.sql + 20260707120000_quote_version_sent_lock.sql
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
---

# Test Design: Epic 10 - Quote Lifecycle Completion (+ Phase B Governance Re-Baseline)

**Date:** 2026-07-19
**Author:** Rasmus
**Status:** Draft
**Design Level:** Epic-Level (Phase 4)
**Mode:** Risk-based, evidence-backed (Master Test Architect)

---

## Executive Summary

**Scope:** Epic-level test design for **Epic 10 — the first Phase B epic** and, by owner design (PB-D3),
a deliberately small "warm-up" epic that does two distinct jobs. First (Story 10.1) it lands the
**one-time Phase B governance re-baseline**: the single machine-readable scope manifest
(`src/scope/manifest.ts`, ADR-B003) from which the deny-list, nav guardrail, tenant-table inventory,
and scope scans all *derive*, plus the `AGENTS.md` / `docs/process` / `phase-scope-reviewer`
re-baseline — the enforcement machinery **every later Phase B module activation depends on**. Second
(Stories 10.2-10.4) it completes the owner-confirmed quote status set: **Förlorad/Avböjd** with a
required structured reason as an append-only lifecycle event (10.2), the **follow-up workflow** with a
one-open-per-quote rule (10.3), and the **first `src/server/read-models/**` module** surfacing quote
pipeline data for lists now and the E19 dashboard later (10.4).

**Epic goal (from epics-phase-b.md):** Warm up the Phase B pipeline on a small epic — land the
governance re-baseline first, then complete the owner-confirmed quote status set with lost/declined
lifecycle, follow-ups, and pipeline surfacing.

**Why this "small" epic is disproportionately risk-bearing:** the story count is low and there are only
**two new tenant tables** with **no new dependencies**, but two of the four stories are among the
highest-leverage changes in the whole phase. (1) **Story 10.1 is the governance keystone** — a
derivation refactor that collapses four independently-authored guardrail copies (deny-list, nav
expected set, H4 tenant-table enrollment, scope scans) into one derived source. If that refactor
*silently* shifts any expected value, or the coherence validator is incomplete, or fail-loud is lost,
then **every subsequent Phase B activation ships against a weakened guardrail** and nobody notices —
the classic "the test can no longer fail" trap (the Epic 9 `A22` lesson, architecture §5.4). (2)
**Story 10.2 re-touches the sent commitment** — the append-only lost/declined path must leave the
Epic 6/7 immutable sent snapshot byte-unchanged (NFR11, FR63), and it widens the lifecycle state
machine that already lives at **five coherent layers** (command guard, sent-lock trigger, lifecycle
RPC guard, `quote_versions.status` CHECK, `quote_events.event_type` CHECK) plus the `QuoteVersionStatus`
timeline union — a drift between any of them is the failure. (3) **Story 10.4 sets the read-model +
entitlement-descriptor precedent** the entire phase reuses; a wrong `{ data, entitlements }` contract
(a withheld field shipped as `null`/`0` instead of absent+listed, or a dishonest partial-sum aggregate)
propagates to every later read-model.

**Risk Summary:**

- Total risks identified: **25**
- High-priority risks (score ≥6): **8**
- Critical (score 9 / auto-BLOCK at design time): **0** — but four controls are **epic blockers
  regardless of numeric score**: (a) any derived guardrail expected value diverging from the shipped
  Phase A surface during the 10.1 refactor (R-1001 — also a story STOP: divergence means pre-existing
  drift to resolve, not paper over); (b) a sent version mutated through the lost/declined path — any
  customer-visible snapshot field, attachment, or PDF-source datum — via command **or** direct
  own-tenant SQL UPDATE (R-1010, NFR11/FR63); (c) either new tenant table (`quote_lost_reasons`,
  `quote_follow_ups`) unenrolled in `TENANT_TABLES` / missing force-RLS + own-tenant policies +
  `anon → none`, incl. `quote_lost_reasons`' insert-only (no UPDATE policy) rule (R-1012/R-1031 — the
  H4 gate makes this CI-fatal by design); (d) real PII/secret in a lost-reason / follow-up-note /
  pipeline golden fixture (R-1015, held at mitigate-control like Epic 6 R-615).
- Critical categories: **TECH/OPS governance integrity** (10.1 derivation-equals-authored, validator
  completeness, fail-loud) is new-in-kind for this epic and sits alongside the familiar **DATA**
  (sent-immutability under the lost path, state-machine cross-layer coherence) and **SEC** (two new
  tenant tables' isolation, the first read-model's RLS-client-only + entitlement contract).

**Coverage Summary:**

- **P0 (Critical):** ~28-41 tests — manifest coherence validator (fails on each incoherent state) +
  derived-equals-authored proof + fail-loud retention + typed-manifest seed; sent-immutability
  regression **re-run** + mutate-only-status proof; lost state-machine coherence across all layers;
  `quote_lost_reasons` migration/RLS/insert-only + H4 enrollment; duplicate-reason rejection; the
  read-model entitlement-descriptor contract + RLS-client-only; fixture PII scan.
- **P1 (High):** ~20-28 tests — reason validation; cross-tenant lost/declined rejection; lifecycle
  golden extended with a lost version; one-open-per-quote index; `quote_follow_ups`
  migration/RLS/enrollment + audited commands; due/overdue date-boundary logic; complete-with-outcome
  + the 10.3↔10.2 auto-complete jump; pipeline aggregation (counts/hit-rate/öre); list-filter
  integration; the 10.2 dialog + 10.3 follow-up E2E.
- **P2 (Medium):** ~7-10 tests — StatusBadge/ConnectionChip rendering; no-analytics-page / no-widget
  guardrail; phase-scope-reviewer manifest-derived baseline; client-island selection logic; legacy
  accept/reject/lost + follow-up deltas; N-4 conservative-default record.
- **P3 (Low):** ~3-4 tests — legacy follow-up delta / parallel-open STOP; deferred coherence-rule stub
  (matrix-rows check wired at 11.1); DX typed errors.
- **Total:** ~58-83 tests across UNIT / INT / RLS / E2E / GOLDEN / DOCS. **A large fraction is reuse,
  not new authoring** — 10.2's headline immutability evidence is a **re-run** of the existing Epic 6/7
  suite, and 10.1's validator cases are fast pure `node --test` units; effective new-authoring effort
  is meaningfully below the raw count (see Resource Estimates).

---

## Inherited Foundation (what Epic 10 builds on, not rebuilds)

Epic 10 is almost entirely *composition over proven Phase A machinery* — it introduces two new tables
and one refactor, and otherwise reuses. Verified in-repo; Epic 10 must **reuse**, not re-invent:

| Inherited asset | Where (verified) | Epic 10 obligation |
| --- | --- | --- |
| Lifecycle state machine at multiple layers: `isLegalLifecycleTransition` (pure) + `markQuoteVersionLifecycle` command guard + the sent-lock trigger's legal-transition guard + the `mark_quote_version_lifecycle` RPC guard, all one closed set | `src/features/quotes/lifecycle.ts` (`LEGAL_TRANSITIONS`); `src/server/commands/quotes/lifecycle.ts`; `supabase/migrations/20260707120000_quote_version_sent_lock.sql:118-134` | 10.2 **widens** this to Förlorad/Avböjd. The new transition must be added to the pure map, both DB guards, and (if a new status/event token is introduced) the `quote_versions.status` + `quote_events.event_type` CHECK sets **and** the `QuoteVersionStatus` timeline union **coherently, one source** — a drift is R-1011. `markQuoteVersionLost` widens the existing RPC (§14), it does not fork one. |
| Sent-immutability enforced at the DB by a **row-equality trigger** that permits only exempt-column changes (`status`), with the command mapping violations to `QUOTE_VERSION_LOCKED` | `20260707120000_quote_version_sent_lock.sql`; `src/server/commands/quotes/quote-db.ts` (`throwMappedQuoteWriteError`) | 10.2's lost flip changes **only** `status` (trigger row-equality passes) + appends a `quote_events` row (append-only trigger) + inserts one `quote_lost_reasons` row. The **full sent-immutability regression suite is re-run** and must stay green (R-1010). No new customer-visible field is written on the version row. |
| `quote_events` append-only lifecycle log with `event_type` CHECK `(created|draft|sent|accepted|rejected|expired|superseded)` and an append-only guard trigger | `20260705120000_quote_version_model.sql:354-388` | 10.2 appends the lost/declined flip as a `quote_events` row. If the outcome needs a new `event_type` token, the CHECK widens coherently (R-1011); the append-only trigger still blocks any UPDATE of an existing event. |
| `TENANT_TABLES` enrollment + H4 inventory gate (compile-exhaustive; FAILS CI on an unenrolled tenant table), currently **24 tenant-owned tables** | `tests/integration/rls/tenant-table-inventory.ts` (`TENANT_TABLES`) | **STANDING CONTRACT:** `quote_lost_reasons` (10.2) and `quote_follow_ups` (10.3) each enroll with spoof/filter/mutation metadata BEFORE merge; the manifest's active `tenantTables` union becomes 26; R-1012/R-1031's automated backstop. |
| Server command envelope: typed `Result<T, CommandErrorCode>`, `verifyOwnership` (zero rows ⇒ `TENANT_ACCESS_DENIED`), validation never echoes raw values, allow-listed audit metadata; SECURITY INVOKER narrow RPCs (ADR-A009) | `src/server/commands/envelope.ts`, `command-errors.ts`; `lifecycle.ts` | 10.2's `markQuoteVersionLost` (widened RPC) and 10.3's single-row follow-up commands (plan/complete/annotate — §14 "single-row mutations remain envelope commands") REUSE this. Capability seam is present so the Epic 11 matrix applies without rework (EB-A4); until then these run under `tenant_admin`. |
| Frozen composite quote snapshot (copy-by-value, `Object.freeze`) — the customer commitment 10.2/10.4 must never disturb | `src/lib/snapshots/**`; `quote_versions` snapshot columns (`20260705120000_..._model.sql:270`) | 10.2 touches only lifecycle status/events, never snapshot content; 10.4 **reads** snapshot/lifecycle data, computes aggregates, and never recomputes or re-derives money (R-1042). |
| Pure `@/lib/money` engine (integer öre, sum-of-rounded, single kronor formatter) | `src/lib/money/**` | 10.4 pipeline **amounts** are öre-derived through this engine only; **no new money computation path** (10.4 STOP). Counts/hit-rate are integer/ratio, not money. |
| Deny-list of forbidden deferred-module categories (currently authored) | `src/features/files/deferred-categories.ts` (`FORBIDDEN_DEFERRED_CATEGORIES`) | 10.1 **re-derives** this from the manifest's `pending` modules; the derived set must equal the current authored list (R-1001). |
| Two-runner stack (`node --test` UNIT / Vitest INT+RLS) + Playwright E2E (CI-gated, `SUPABASE_TEST_REQUIRED=1`), two-tenant fixture, per-run unique ids, goldens under `tests/unit/**`, CI golden PII/secret scan | project-context Testing Rules; `scripts/run-tests.mjs`; `tests/factories/**` | 10.1 validators land as UNIT; 10.2/10.3 land INT + RLS; 10.2 dialog + 10.3 workflow land E2E; the lifecycle golden extends with a lost version; the PII scan extends to lost-reason/follow-up/pipeline fixtures. |

**What is genuinely NEW in Epic 10 (needs fresh coverage):** the `src/scope/manifest.ts` typed
constant + its **coherence validator** + the four **derivations** (deny-list, nav expected set, H4
expected enrollment, scope scans) + the `AGENTS.md`/`docs`/`phase-scope-reviewer` re-baseline; the
**Förlorad/Avböjd** lifecycle widening + `quote_lost_reasons` (insert-only) + `markQuoteVersionLost`;
the `quote_follow_ups` table + follow-up workflow + one-open-per-quote index + due/overdue logic; and
the **first `src/server/read-models/**` module** with the `{ data, entitlements }` + aggregate-honesty
contract. Levels used: UNIT + INT + RLS + E2E + GOLDEN + DOCS.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Any mutation of sent snapshots** | Epic 10 explicit non-scope; NFR11/FR63 — lost/declined is append-only lifecycle only | The sent-immutability regression suite is **re-run** and the lost flip is proven to change only `status` + append events (R-1010). |
| **A separate analytics page / dashboard widget rendering** | PB-D7 (pipeline data only in list/detail + read-model); E19 owns widget rendering; FR107 | 10.4 ships the read-model + list surfacing only; a guardrail asserts NO new nav item / NO widget / NO analytics page (R-1045). |
| **Email reminders / the `quote.follow_up_due` producer** | E13 registers the producer consuming 10.3 data; sending gated N-6; EB-A8 (no forward dependency) | 10.3 lists/badges work **without** notifications; a guardrail asserts no email-send path exists in Epic 10; producer is E13's test surface (cross-ref). |
| **Permission-matrix rows / role-aware withholding SEED** | Epic 11 (ADR-B001) owns the matrix; the N-4 per-role seed is gated | 10.4 builds the withholding **mechanism** (entitlement descriptor, AR-B6) with a **conservative flagged default** (mechanism ungated per the sprint-status OWNER-GATE WATCHLIST); the "activation-without-matrix-rows fails" coherence rule is wired at Story 11.1 (EB-A5), stubbed here (R-1002 residual). |
| **RBAC role storage / non-admin access** | Epic 11 | 10.x commands run under `tenant_admin` via the capability seam (EB-A4); no role storage tested here. |
| **Real Lovable quote/follow-up data import** | Lovable is a behavioral oracle only (AGENTS.md) | The Förlorad-vs-Avböjd distinction + reason categories come from the oracle **terminology task** (Cross-Epic Rule 2, entry criterion); legacy accept/reject/lost (P19) and follow-up (P18) deltas are **documented**, never copied (R-1016/R-1034). |
| **Widget/producer/file-owner/public-surface derivations from the manifest** | Later modules land these derivations (§5.3); 10.1 lands only the four Phase-A-relevant ones | 10.1's validator still enforces the **closed public-surface set of three** and traceability for any listed surface; later derivations are added at their epics (cross-ref). |
| **Pipeline performance / large-dataset aggregation** | Pilot-sized; no Phase A/B SLA on this surface | Correctness of counts/hit-rate/öre and determinism of period boundaries is the concern; perf is a documented residual (R-1047). |

---

## Risk Assessment

Scoring per `probability-impact.md`: Probability 1 (unlikely) / 2 (possible) / 3 (likely);
Impact 1 (minor) / 2 (degraded) / 3 (critical). Score = P × I. Thresholds: 1-3 DOCUMENT,
4-5 MONITOR, 6-8 MITIGATE (CONCERNS at gate), 9 BLOCK (auto-FAIL).

**Impact rationale (why the 6s cluster on governance, immutability, isolation, and the read-model
precedent):** Story 10.1's guardrail machinery gates the *entire* remaining phase — a silent expected-value
shift or an incomplete validator is Impact 3 because it disarms enforcement everywhere downstream, not
just in Epic 10. Story 10.2 re-touches a *customer commitment* — an immutability bypass or a
state-machine drift corrupts the audit property every later epic relies on (Impact 3). The two new
tables carry another tenant's business data, so an isolation gap is Impact 3. Story 10.4's read-model is
*precedent-setting*: a wrong entitlement contract or an RLS-client bypass propagates (Impact 3).
**Probability is held at 2** for most: the isolation harness, the freeze/row-equality trigger, the
narrow-RPC pattern, and the envelope are all proven repeatedly in Phase A, so the residual is *correct
composition at a new boundary* (a first manifest, a first widening of a 5-layer state machine, a first
read-model). Probability drops to 1 only where an automated gate makes silent failure hard (fixture PII
scan) or the surface is inherently constrained.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-1001 | TECH/OPS | **Derivation refactor silently shifts a guardrail expectation** — the deny-list, nav expected set, H4 expected enrollment (the 24-table set), or a scope scan, once *derived* from the manifest, no longer equals the previously-authored Phase A value → enforcement weakens for the whole phase without a visible failure (the named epic risk) | 2 | 3 | 6 | Assert **derived == pre-refactor authored** for each of the four derivations (deny-list, nav, H4 enrollment union, scope scans); the manifest's initial `active` set is exactly Phase A's 7 nav / 24 tables / 7 file owner types under wave `A`. **STOP if any divergence appears** (indicates pre-existing drift to resolve, not paper over — 10.1 Stop Condition) | Dev (10.1) | Story 10.1 |
| R-1002 | TECH | **Manifest coherence validator incomplete** — the validator misses one required incoherent state → an "active-without-epic", an untraceable nav/table/widget/category/file-owner/public-surface, a "pending module with live surface", or a public-surface union > 3 slips through, making the governance guarantee hollow (the Epic 9 `A22` "presence AND coherence" lesson) | 2 | 3 | 6 | A validator UNIT suite that **introduces each incoherent state in test and asserts a failure** (prove the check can fail), covering every §5.4 rule; the "activation without matrix rows fails" rule is stubbed with a recorded residual until 11.1 supplies the matrix source (EB-A5) | Dev (10.1) | Story 10.1 |
| R-1003 | TECH | **Fail-loud lost in the refactor** — a derived guardrail becomes a tautology (expected set computed from the actual set) so a surface **not** manifest-listed no longer fails CI (FR129/FR130 fail-loud regressed) | 2 | 3 | 6 | An explicit **negative**: inject an unlisted nav item / tenant table / file owner type and assert the derived guardrail (and H4) FAILS; keep the expected set independently derived from the manifest's `active` set, never from the runtime surface being checked | Dev (10.1) | Story 10.1 |
| R-1010 | DATA/BUS | **Lost/declined path mutates the sent snapshot** — a customer-visible snapshot field, attachment selection, or PDF-source datum of a sent version changes through `markQuoteVersionLost` (via command or a direct own-tenant SQL UPDATE) → a silent change to a customer commitment (NFR11/FR63 violated) | 2 | 3 | 6 | The RPC flips **only** `status` (row-equality sent-lock trigger passes) + appends a `quote_events` row + inserts one `quote_lost_reasons` row, one transaction + audit; **re-run the full sent-immutability regression suite** and add a mutate-only-status proof; direct-UPDATE negative still returns `QUOTE_VERSION_LOCKED` | Dev (10.2) | Story 10.2 |
| R-1011 | DATA/TECH | **Lifecycle state-machine drift across layers** — Förlorad/Avböjd widening disagrees between the pure `LEGAL_TRANSITIONS` map, the command guard, the sent-lock trigger, the lifecycle RPC guard, the `status`/`event_type` CHECK sets, and the `QuoteVersionStatus` timeline union → an illegal lost transition is accepted at one layer and rejected at another (races, corrupt states) | 2 | 3 | 6 | Widen from a **single source**; UNIT-pin the widened map + token coherence (CHECK sets ⊇ new tokens; timeline union matches); INT-prove an illegal lost transition (lost on a draft / on an accepted / a reversal) is rejected at BOTH the command (`VALIDATION_FAILED`) and the DB (`QV409`→`QUOTE_VERSION_LOCKED`). **Design ambiguity flagged** (new status token vs mapping onto `rejected`) — see Open Assumptions #2 | Dev (10.2) | Story 10.2 |
| R-1012 | SEC | **`quote_lost_reasons` isolation / insert-only gap** — ships without direct `tenant_id`, enable+**force** RLS + own-tenant policies, `anon → none`, or **unenrolled in `TENANT_TABLES`**; or the insert-only rule (unique per version, **no UPDATE policy**) is not DB-enforced → cross-tenant read/write of another tenant's lost reasons, or a lost reason mutated/duplicated | 2 | 3 | 6 | Reuse the proven migration pattern verbatim; **no UPDATE policy** on `quote_lost_reasons` + `unique (quote_version_id)`; enroll in `TENANT_TABLES` with spoof/filter/mutation metadata (H4 CI-fatal otherwise); RLS negatives incl. an UPDATE-rejected assertion | Dev (10.2) | Story 10.2 |
| R-1040 | SEC/TECH | **First read-model sets a wrong entitlement contract** — the precedent `{ data, entitlements }` ships a withheld money field as `null`/`0` (present) instead of **absent + listed in `withheld`**, or an aggregate with a withheld component ships as a **partial sum** (aggregate dishonesty) → every later Phase B read-model inherits the flaw and unentitled roles receive derivable amounts (AR-B6, §11, UX §3.2 rule 4) | 2 | 3 | 6 | UNIT-pin the descriptor contract as the phase's reusable spec: withheld ⇒ absent from `data` AND listed; aggregate honesty (any withheld component ⇒ whole aggregate withheld); table column omission; conservative flagged default for the N-4 seed | Dev (10.4) | Story 10.4 |
| R-1041 | SEC | **Read-model bypasses the RLS client** — the pipeline query runs on a service-role / unscoped client instead of the RLS client (§11) → cross-tenant pipeline data leak (violates the "no service-role from client paths" invariant, the security floor beneath the descriptor) | 2 | 3 | 6 | Read-model queries via the RLS client ONLY; INT cross-tenant proof (tenant A's read-model never returns tenant B counts/amounts); structural assertion that no service-role client is imported on the read-model path | Dev (10.4) | Story 10.4 |

### Medium-Priority Risks (Score 4-5)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-1013 | DATA | **Duplicate lost reason** — a second lost-reason insert for the same version (incl. a concurrent double-submit) is not rejected → two rows, dishonest analytics | 2 | 2 | 4 | `unique (quote_version_id)` at the DB; command idempotency; INT negative incl. a `Promise.all` double-submit | Dev (10.2) |
| R-1014 | BUS | **Missing / invalid reason accepted** — outcome (Förlorad/Avböjd) or the structured reason (category + note; note required when `Annat`) not enforced server-side → dishonest pipeline inputs | 2 | 2 | 4 | Server-side validation (outcome required; category required; note required on `Annat`), never echoing raw values; UNIT + INT negatives | Dev (10.2) |
| R-1030 | DATA | **One-open-per-quote rule breached** — the partial unique index (at most one open follow-up per quote, UXB-A6) is missing/wrong → a second open follow-up is planned; lists drift from the rule (the named epic risk) | 2 | 2 | 4 | Partial unique index on (quote_id) WHERE status='open'; command rejects a second open follow-up with a clear message; a NEW open follow-up allowed after the prior is completed; INT positive + negative | Dev (10.3) |
| R-1031 | SEC | **`quote_follow_ups` isolation gap** — new tenant table ships without the full isolation pattern or unenrolled in `TENANT_TABLES` | 2 | 2 | 4 | Reuse the migration pattern verbatim; enroll in `TENANT_TABLES` (H4 CI-fatal otherwise); RLS cross-tenant + anon negatives; envelope-authorized + audited commands | Dev (10.3) |
| R-1032 | BUS | **Due/overdue classification wrong** — the due/overdue boundary uses the wrong timezone (not Europe/Stockholm) or an off-by-one boundary → `Försenad uppföljning` filter + overdue badge misfire | 2 | 2 | 4 | Deterministic period/date boundaries (Europe/Stockholm); date-boundary UNIT tests (due today, just-overdue, completed-excluded); shared with the 10.4 period logic | Dev (10.3) |
| R-1033 | BUS | **Broken follow-up completion / cross-surface jump** — `Klarmarkera` without the outcome note, or the follow-up→lost path (Story 10.2) doesn't auto-complete the follow-up with the chosen outcome → an open follow-up survives a lost flip, or completion loses the outcome | 2 | 2 | 4 | Complete-with-outcome + `planera nästa`; INT/E2E that a lost flip taken from the follow-up surface auto-completes the follow-up with the chosen outcome; audited | Dev (10.3) |
| R-1042 | DATA/BUS | **Pipeline aggregation error / new money path** — counts, hit rate, or open/overdue counts are computed from something other than lifecycle events, or amounts are not öre-derived via `@/lib/money` (a new rounding/money path — a STOP) | 2 | 2 | 4 | Server-side aggregation from lifecycle events; öre amounts via `@/lib/money` only; UNIT for counts/hit-rate/empty states/period boundaries; **STOP** if a new money path is needed | Dev (10.4) |
| R-1043 | BUS | **List filters/columns return wrong rows** — status filter (incl. Förlorad/Avböjd), `Förlustorsak` column, or `Har uppföljning`/`Försenad uppföljning` filters mis-scope | 2 | 2 | 4 | Filter integration tests across a sent/accepted/lost + open/overdue fixture | Dev (10.4) |
| R-1008 | OPS/BUS | **`AGENTS.md` / docs / phase-scope-reviewer re-baseline wrong** — the phase statement / deferral list doesn't match the Phase C ledger (PRD §14), or `phase-scope-reviewer` still reviews against Phase A | 2 | 2 | 4 | Rewrite in one ADR-backed change; validate via the existing docs-validators pattern; phase-scope-reviewer baseline derives from the manifest (reviews the `active` set) | Dev (10.1) |
| R-1050 | BUS | **Oracle terminology skipped** — E10 carries `[oracle-check]` labels (Förlorad vs Avböjd distinction, reason categories); Cross-Epic Rule 2 requires the `legacy-oracle-explorer` terminology task before the epic's first story | 2 | 2 | 4 | Run the terminology task before Story 10.2; record resolved labels in the story context (entry criterion); the UXB-A5 strawman category list is tenant-tunable later | SM + Dev |

### Low-Priority Risks (Score 1-3)

| Risk ID | Category | Description | Prob | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-1015 | SEC/BUS | **Fixture PII leak** — lost-reason notes, follow-up notes, or pipeline fixtures embed a real name/address/personnummer/orgnr/secret | 1 | 3 | 3 → held at blocker | Anonymized shape-only fixtures; **extend the CI PII/secret scan** to lost-reason/follow-up/pipeline fixtures; committed real PII is an epic blocker regardless of score (mirrors Epic 6 R-615) |
| R-1016 | BUS | **Legacy accept/reject/lost delta undocumented** — the P19 comparison + the Förlorad-vs-Avböjd terminology aren't recorded | 1 | 2 | 2 | DOCUMENT the delta + the oracle-resolved terminology/categories; no data migration |
| R-1034 | BUS | **Parallel-open-follow-ups turns out to be a hard legacy requirement** — would reverse UXB-A6 | 1 | 2 | 2 | DOCUMENT the P18 delta; a hard legacy requirement is a **STOP** (take to oracle/owner) — the design assumes one-open-per-quote |
| R-1046 | OPS | **N-4 entitlement seed treated as confirmed** — 10.4 hard-codes the per-role seed as final instead of a flagged conservative default | 2 | 1 | 2 | DOCUMENT the seed as `[gated: N-4]` conservative default (mechanism ungated per OWNER-GATE WATCHLIST); re-confirm at the owner gate; the mechanism (descriptor) is what 10.4 proves |
| R-1045 | OPS | **Analytics-surface scope creep** — a new nav item / widget / separate analytics page appears (violates PB-D7) | 1 | 2 | 2 | Guardrail scan: pipeline data only in list/detail + read-model; manifest lists no new nav item / no widget for E10 |
| R-1047 | PERF | **Pipeline aggregation latency at scale untested** — pilot-sized only, no SLA | 1 | 2 | 2 | DOCUMENT; add only if an SLA emerges. Correctness, not perf, is the Phase A/B concern here |
| R-1044 | BUS | **StatusBadge/ConnectionChip contract drift** — lifecycle status / Förlustorsak / follow-up chips render inconsistently with UX-BDR4/BDR17 | 2 | 1 | 2 | E2E/component check that filters/columns/chips use `StatusBadge`/`ConnectionChip` |

### Risk Category Legend

- **TECH**: Technical (governance derivation correctness, validator completeness, state-machine coherence, read-model contract)
- **SEC**: Security (new-table isolation, insert-only enforcement, read-model RLS-client-only, fixture PII)
- **DATA**: Data Integrity (sent immutability under the lost path, duplicate reasons, one-open rule, aggregate honesty)
- **BUS**: Business/Compliance (reason honesty, due/overdue truthfulness, filters, oracle terminology, deltas)
- **OPS**: Operations (docs/agent re-baseline, N-4 seed governance, deferred-surface absence)
- **PERF**: Performance (pipeline latency — documented residual)

---

## Testability Notes (Epic-Level)

1. **10.1's headline evidence is an equality proof, and the validator must be proven able to fail.**
   The refactor is only safe if (a) each derived expected value is asserted **equal to the pre-refactor
   authored value** (deny-list, nav set, the 24-table H4 enrollment union, scope scans), and (b) the
   coherence validator is exercised by **introducing each incoherent state and asserting a failure** —
   a validator that never fails proves nothing (the `A22`/Epic 9 lesson, §5.4). Keep the expected set
   derived from the manifest's `active` set, never from the runtime surface under check (else fail-loud
   becomes a tautology — R-1003).
2. **Sent-immutability for 10.2 is a RE-RUN plus a positive proof, not a new suite.** The Epic 6/7
   regression suite already proves the sent snapshot is immutable at the DB; 10.2's obligation is that
   it **stays green after the lost path lands** AND that `markQuoteVersionLost` demonstrably changes
   only `status` + appends events + inserts one lost-reason row (mutate-nothing-else). A test that only
   proves the UI shows a badge is not evidence — the direct own-tenant `UPDATE` negative
   (`QUOTE_VERSION_LOCKED`) is the real proof (architecture §9; Epic 6 precedent).
3. **State-machine coherence is a multi-layer test, widened from one source.** Assert the widened
   transition at the pure `LEGAL_TRANSITIONS` map, both DB guards, and (if a new token is added) the two
   CHECK sets + the `QuoteVersionStatus` union; then INT-prove an illegal lost transition is rejected at
   BOTH the command and the DB. The **open design question** (a new `lost`/`declined` status token vs
   mapping the flip onto `rejected` with the outcome held in `quote_lost_reasons`) must be resolved at
   create-story from architecture §9.1/§14 — it changes which CHECK sets and unions are touched (see
   Open Assumptions #2).
4. **The read-model contract is provable at UNIT without a DB, then the RLS floor at INT.** Pin the
   `{ data, entitlements }` descriptor (withheld absent + listed; aggregate honesty; column omission) as
   a **pure unit spec the whole phase reuses**; separately INT-prove the read-model queries via the RLS
   client only (cross-tenant returns nothing). Do not let the UX-determinism descriptor be mistaken for
   the security floor — §3.6 RLS is the floor.
5. **Both new tables enroll in `TENANT_TABLES` before merge; enrollment is the completeness guarantee.**
   `quote_lost_reasons` and `quote_follow_ups` join the inventory with spoof/filter/mutation metadata so
   the H4 gate + shared cross-tenant/anon suites cover them automatically. `quote_lost_reasons`
   additionally needs the **insert-only** (UPDATE-rejected) negative; `quote_follow_ups` needs the
   **partial-unique-index** (one-open) negative. Do not hand-write ad-hoc isolation tests that bypass
   the inventory.
6. **Due/overdue and period boundaries are deterministic date logic, not clock reads.** Compute against
   an injected instant in Europe/Stockholm; UNIT-pin the boundaries (due-today, just-overdue,
   completed-excluded, empty). The same discipline backs the 10.4 period-window aggregation.
7. **No browser exploration was performed** (this run has no reachable Playwright CLI/browser); the
   design is code- and doc-evidence-based. UX surfacing (the 10.2 dialog, badges, chips, filters, the
   10.3 follow-up sheet) lands as E2E on the established two-tenant fixture with `crypto.randomUUID()`
   seeds, asserting states/affordances — content correctness stays in INT/GOLDEN territory
   (duplicate-coverage guard).

---

## Entry Criteria

- [ ] **Phase A complete and green in `main`** — isolation harness (24-table `TENANT_TABLES` + H4 gate),
      money engine, quote snapshot + sent-lock trigger + lifecycle state machine all live (verified:
      Epic 6-9 done in sprint-status).
- [ ] **Story 10.1 is sequenced FIRST and blocks every other Phase B story** (epics-phase-b §Epic 10;
      sprint-status "NEXT ACTIONABLE: Story 10-1"). 10.2-10.4 must not merge before 10.1's manifest +
      validator + re-baseline land, because their activations flip manifest entries.
- [ ] **Lost-lifecycle data model agreed at create-story** — whether Förlorad/Avböjd introduces a new
      `status`/`event_type` token or maps onto `rejected` with the outcome in `quote_lost_reasons`
      (architecture §9.1/§14); this decision scopes R-1011's CHECK/union coverage (Open Assumptions #2).
- [ ] **Oracle terminology task run** for E10's `[oracle-check]` labels (Förlorad vs Avböjd; reason
      categories) before Story 10.2, with resolved labels recorded in the story context (Cross-Epic
      Rule 2; R-1050).
- [ ] **N-4 posture confirmed as "mechanism proceeds ungated"** — 10.4 ships the entitlement mechanism
      with a flagged conservative default; the seed is not treated as owner-confirmed (OWNER-GATE
      WATCHLIST; R-1046).
- [ ] **PII/secret scan surface identified** for the new fixtures (lost-reason/follow-up notes, pipeline
      fixtures) so R-1015 extends the existing CI scan, not a new one.
- [ ] Local Supabase CLI stack available for INT/RLS/E2E with `SUPABASE_TEST_REQUIRED=1` in CI (the
      post-reset false-green trap from prior retros makes this non-negotiable).

## Exit Criteria

- [ ] All P0 tests passing (100%).
- [ ] All P1 tests passing or each failure explicitly triaged/waived.
- [ ] **Governance integrity proven** — each of the four derivations equals its pre-refactor authored
      value (deny-list, nav set, 24-table H4 enrollment, scope scans); the manifest seed is exactly
      Phase A's 7 nav / 24 tables / 7 file owner types under wave `A` with all Phase B modules `pending`;
      the coherence validator **fails on each** incoherent state (§5.4); an unlisted surface **fails CI**
      (fail-loud retained).
- [ ] **Re-baseline landed** — `AGENTS.md` phase statement + deferral list rewritten to Phase B with the
      Phase C ledger (PRD §14) as the deferred set; `phase-scope-reviewer` + `docs/process` updated; one
      ADR-backed change; docs validators green.
- [ ] **Sent-immutability proven** — the full regression suite is **re-run green** after the lost path;
      `markQuoteVersionLost` changes only `status` + appends one `quote_events` row + inserts one
      `quote_lost_reasons` row; a direct own-tenant `UPDATE` of a sent version still returns
      `QUOTE_VERSION_LOCKED`.
- [ ] **Lifecycle coherence proven** — the widened lost transition agrees across the pure map, both DB
      guards, the CHECK sets, and the `QuoteVersionStatus` union; an illegal lost transition is rejected
      at BOTH the command and the DB.
- [ ] **Isolation proven** — `quote_lost_reasons` (insert-only, unique per version) and
      `quote_follow_ups` (one-open partial unique index) enrolled in `TENANT_TABLES`; H4 green;
      cross-tenant read/write + anon negatives pass per table; the insert-only UPDATE-rejected + the
      second-open-rejected negatives pass.
- [ ] **Read-model precedent proven** — the `{ data, entitlements }` descriptor is contract-pinned
      (withheld absent + listed; aggregate honesty; column omission); the read-model queries via the RLS
      client only; cross-tenant returns nothing; amounts are öre-derived via `@/lib/money` (no new money
      path).
- [ ] **Deferred-surface absence proven** — no new nav item / no widget / no separate analytics page;
      no email-send path; pipeline data only in list/detail + read-model (PB-D7).
- [ ] **Fixture privacy green** — CI PII/secret scan covers lost-reason/follow-up/pipeline fixtures.
- [ ] No open high-priority (≥6) risk unmitigated/unwaived; R-1046 (N-4 conservative default) restated
      in the gate report so the owner-confirm trigger stays visible.

---

## Test Coverage Plan

> **P0/P1/P2/P3 = priority / risk classification, NOT execution timing.** Execution timing is defined
> separately in the Execution Strategy section below.

Test ID format `{EPIC}.{STORY}-{LEVEL}-{SEQ}`. Levels: **UNIT** (pure `node --test`), **INT** (Vitest,
DB-backed command/migration/RPC), **RLS** (Vitest cross-tenant/anon negatives via the shared
inventory), **E2E** (Playwright), **GOLDEN** (data-driven UNIT over `tests/fixtures/golden/**`),
**DOCS** (documented residual/assumption/delta).

### P0 (Critical)

**Criteria**: Blocks core (governance integrity / commitment immutability / isolation / read-model
precedent) + high risk (≥6) + no workaround.

| Test ID | Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 10.1-UNIT-01 | Manifest coherence validator FAILS on each incoherent state: active-without-epic; nav/table/widget/category/file-owner/public-surface not traceable to an active module; pending module with live surface; public-surface union > 3 (10.1 AC4, §5.4) | UNIT | R-1002 | 4-6 | Dev | Each check proven able to fail; matrix-rows rule stubbed (11.1 wiring, EB-A5) |
| 10.1-UNIT-02 | Derived expected values EQUAL the pre-refactor authored Phase A values — deny-list (`FORBIDDEN_DEFERRED_CATEGORIES`), nav expected set, H4 expected enrollment (24-table union), scope scans (10.1 AC3) | UNIT | R-1001 | 3-4 | Dev | The no-drift proof; STOP on any divergence |
| 10.1-UNIT-03 | Fail-loud retained — an unlisted nav item / tenant table / file owner type FAILS the derived guardrail + H4 (10.1 AC3, FR129/FR130) | UNIT/INT | R-1003 | 2 | Dev | Negative injection; guards against tautology |
| 10.1-UNIT-04 | `src/scope/manifest.ts` is a `satisfies ScopeManifest` typed constant; Phase A seed = 7 nav / 24 tables / 7 file owner types under wave `A`; every Phase B module `pending` (10.1 AC2) | UNIT | R-1001 | 1-2 | Dev | Type + seed content |
| 10.1-DOCS-01 | `AGENTS.md` phase statement + deferral list rewritten to Phase B (Phase C ledger = deferred, PRD §14); `phase-scope-reviewer` + `docs/process` updated; one ADR-backed change (10.1 AC1) | DOCS | R-1008 | 1-2 | Dev | Validated via docs-validators pattern |
| 10.2-INT-01 | Sent-immutability regression suite **re-run** green; no customer-visible snapshot field / attachment / PDF-source datum changed via the lost/declined path (10.2 AC3, FR63/NFR11) | INT | R-1010 | 2-3 | Dev | Re-run the existing suite; the headline immutability proof |
| 10.2-INT-02 | `markQuoteVersionLost` flips ONLY `status` + appends one `quote_events` row + inserts exactly one `quote_lost_reasons` row in one transaction + audit event (10.2 AC2, §14) | INT | R-1010 | 2-3 | Dev | Row-equality sent-lock trigger passes (only exempt column changed) |
| 10.2-INT-03 | Illegal lost transition (lost on a draft / on an accepted / a reversal) rejected at BOTH the command (`VALIDATION_FAILED`) and the DB (`QV409`→`QUOTE_VERSION_LOCKED`) (10.2 AC; R-1011) | INT | R-1011 | 2-3 | Dev | Multi-layer coherence proof |
| 10.2-UNIT-01 | Widened lifecycle transition map + status/event-type tokens coherent across the pure predicate, the CHECK sets, and the `QuoteVersionStatus` timeline union — one source, no fork (10.2 tech note) | UNIT | R-1011 | 1-2 | Dev | Scopes per the §9.1/§14 token decision (Open Assumptions #2) |
| 10.2-INT-04 | Migration adds `quote_lost_reasons` (unique (quote_version_id), **no UPDATE policy** = insert-only), direct `tenant_id`, enable+force RLS, own-tenant policies, `anon → none`; enrolled in `TENANT_TABLES` (10.2 arch §9.1) | INT | R-1012 | 2 | Dev | Per-policy enumeration; no supplier/Fortnox columns |
| 10.2-RLS-01 | Cross-tenant read/write + anon-path rejected on `quote_lost_reasons`; **insert-only enforced** (own-tenant UPDATE rejected); H4 gate green with the table enrolled (10.2 test req) | RLS | R-1012 | 2-3 | Dev | Via `TENANT_TABLES` enrollment |
| 10.2-INT-05 | Duplicate lost-reason insert (same version, incl. concurrent double-submit) rejected by `unique (quote_version_id)`; command idempotent (10.2 test req) | INT | R-1013 | 1-2 | Dev | `Promise.all` double-submit |
| 10.4-UNIT-01 | Read-model entitlement descriptor contract — a withheld money field is ABSENT from `data` AND listed in `entitlements.withheld` (never `null`/`0`); aggregate honesty (any withheld component ⇒ whole aggregate withheld); column omission (10.4 AC1, AR-B6/§11) | UNIT | R-1040 | 3-4 | Dev | The precedent-setting phase-wide spec; N-4 conservative default |
| 10.4-INT-01 | Pipeline read-model queries via the RLS client ONLY; tenant A's read-model never returns tenant B counts/amounts; no service-role client on the path (10.4 arch §11) | INT | R-1041 | 2 | Dev | Security floor beneath the descriptor |
| 10.x-UNIT-01 | Fixture/artifact PII scan extended to lost-reason / follow-up-note / pipeline fixtures (standing control) | UNIT | R-1015 | 1 | Dev | CI-gated; blocker regardless of score |

**Total P0**: ~28-41 tests

### P1 (High)

**Criteria**: Important correctness/behavior + medium/high risk + common paths.

| Test ID | Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 10.2-UNIT-02 | Reason validation — outcome ∈ {Förlorad, Avböjd} required; structured reason category required; note required when `Annat`; never echoes raw values (10.2 AC1) | UNIT | R-1014 | 2 | Dev | Pure validator |
| 10.2-INT-06 | Cross-tenant lost/declined attempt rejected generically (RLS + command validation); envelope-authorized + audited (10.2 AC5) | INT/RLS | R-1012 | 1-2 | Dev | Tenant A vs tenant B versions |
| 10.2-GOLDEN-01 | Lifecycle golden fixture extended with a lost version — append-only event + lost reason; sent snapshot byte-unchanged (10.2 test req) | GOLDEN | R-1010 | 1-2 | Dev | Under `tests/unit/**`; anonymized shape-only |
| 10.2-E2E-01 | `Markera som förlorad/avböjd` dialog requires outcome + structured reason (note on `Annat`); confirmation states append-only + snapshot-unchanged + revive-via-new-version; terminal Förlorad/Avböjd badge distinct from Accepterad; reason on the version card + in `Händelser` (10.2 AC1/AC2) | E2E | R-1014, R-1010 | 2 | Dev | Two-tenant fixture; unique-id seeds |
| 10.3-INT-01 | One-open-follow-up-per-quote partial unique index — a second open follow-up rejected with a clear message; a new open follow-up allowed after the prior is completed (10.3 AC1) | INT | R-1030 | 2 | Dev | Positive + negative |
| 10.3-INT-02 | `quote_follow_ups` migration + isolation (direct `tenant_id`, force RLS, policies, `anon → none`, `TENANT_TABLES` enrollment); plan/complete/annotate envelope commands audited (10.3 arch §9.1) | INT | R-1031 | 2 | Dev | Per-policy enumeration |
| 10.3-RLS-01 | Cross-tenant follow-up read/write + anon rejected; H4 green with `quote_follow_ups` enrolled (10.3 AC4) | RLS | R-1031 | 2 | Dev | Via enrollment |
| 10.3-UNIT-01 | Due/overdue classification — date-boundary logic (Europe/Stockholm, injected instant): due-today, just-overdue, completed-excluded, empty; overdue escalation flag (10.3 AC2) | UNIT | R-1032 | 2-3 | Dev | Sleep-free deterministic dates |
| 10.3-INT-03 | Complete-with-outcome (`Klarmarkera`) + `planera nästa`; a lost flip taken from the follow-up surface auto-completes the follow-up with the chosen outcome (10.3↔10.2 jump) (10.3 AC3) | INT | R-1033 | 1-2 | Dev | Cross-story coupling |
| 10.4-UNIT-02 | Pipeline aggregation — sent/accepted/lost counts, hit rate, open/overdue follow-up counts computed server-side from lifecycle events; empty states; amounts öre-derived via `@/lib/money` (no new money path) (10.4 AC1, FR65) | UNIT | R-1042 | 3-4 | Dev | Deterministic period windows |
| 10.4-INT-02 | List filter integration — status filters incl. Förlorad/Avböjd, `Förlustorsak` column, `Har uppföljning` / `Försenad uppföljning` filters return the correct rows (10.4 AC2) | INT | R-1043 | 2-3 | Dev | Mixed lifecycle fixture |
| 10.3-E2E-01 | `Planera uppföljning` (due date + note) → next-follow-up chip; overdue badge; `Klarmarkera` with outcome note → sheet offers `planera nästa` / `Markera som förlorad/avböjd` / `Ny version` (10.3 AC1/AC3) | E2E | R-1033 | 2 | Dev | Affordances + states |

**Total P1**: ~20-28 tests

### P2 (Medium)

**Criteria**: Secondary behavior + low/medium risk + edge cases.

| Test ID | Requirement (AC source) | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 10.4-E2E-01 | Status filters / `Förlustorsak` column / follow-up filters / header chips render via `StatusBadge` / `ConnectionChip` (UX-BDR4, UX-BDR17) (10.4 AC2) | E2E | R-1044 | 2 | Dev | Contract-consistency check |
| 10.4-INT-03 | No separate analytics page / no new nav item / no widget — pipeline data only in list/detail + read-model (PB-D7); deferred-surface + manifest guardrail scan; no email-send path (10.4 AC3) | INT/E2E | R-1045 | 1-2 | Dev | Non-scope guard |
| 10.1-UNIT-05 | `phase-scope-reviewer` review baseline derives from the manifest's `active` set (not hard-coded Phase A) (10.1 AC1) | UNIT | R-1008 | 1-2 | Dev | |
| 10.3-UNIT-02 | Overdue-badge / next-follow-up-chip selection logic extracted + unit-pinned (keep client-island logic off the slow gate) | UNIT | R-1032 | 1-2 | Dev | Coverage-shape lesson |
| 10.2-DOCS-01 | Documented legacy accept/reject/lost delta (P19) + oracle-resolved Förlorad-vs-Avböjd terminology + category list (10.2 migration impact) | DOCS | R-1016, R-1050 | 1 | Dev | Oracle delta register |
| 10.4-DOCS-01 | N-4 entitlement seed carried as a flagged conservative default (mechanism ungated); re-confirm at owner gate (10.4 AC1) | DOCS | R-1046 | 1 | Dev | Assumption register |

**Total P2**: ~7-10 tests

### P3 (Low)

**Criteria**: Nice-to-have + exploratory + residual documentation.

| Test ID | Requirement | Test Level | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| 10.3-DOCS-01 | Documented legacy follow-up delta (P18); the parallel-open-follow-ups reversal STOP recorded (10.3 stop condition) | DOCS | 1 | Dev | Oracle/owner escalation guard |
| 10.1-DOCS-02 | Residual: the "activation without permission-matrix rows fails" coherence rule is wired at Story 11.1 (EB-A5) — stub + placeholder recorded (10.1 tech note) | DOCS | 1 | Dev | Forward-dependency note |
| 10.x-UNIT-02 | DX — clear typed errors for an unknown lost transition / malformed reason input | UNIT | 1-2 | Dev | Developer ergonomics |

**Total P3**: ~3-4 tests

---

## Execution Strategy

**Philosophy: run everything in every PR that can run in <15 min; the DB/E2E suites are the only real
cost.** Epic 10 adds no new runner and no new dependency, so nothing here is expensive enough to defer.

- **Every PR:**
  - All Epic 10 UNIT + GOLDEN (`pnpm test:unit`) — manifest coherence validator + derived-equals-authored
    + fail-loud + typed-seed (10.1); widened transition map + reason validation + read-model descriptor
    + aggregation + due/overdue date logic; the lost-version lifecycle golden; the fixture PII scan.
    Seconds.
  - All Epic 10 INT + RLS (`pnpm test:int`, local Supabase stack) — `markQuoteVersionLost`
    mutate-only-status + the **re-run** of the sent-immutability regression suite; lost state-machine
    coherence at command + DB; `quote_lost_reasons` / `quote_follow_ups` migration + RLS + insert-only /
    one-open negatives + H4 enrollment; read-model RLS-client-only; list filters.
    `SUPABASE_TEST_REQUIRED=1` in CI hard-fails a missing stack (the post-reset false-green trap).
  - Epic 10 E2E (`pnpm test:e2e`, Playwright) — the 10.2 lost/declined dialog + badge, the 10.3
    follow-up sheet + chip/overdue badge, and the deferred-surface-absence guard. Within the 15-min bar.
- **Nightly / Weekly:** nothing Epic-10-specific. (Pipeline perf is deferred, R-1047 — add only if an
  SLA emerges.)

Standard triage order: smoke (manifest typecheck + validator green; login + open one sent quote;
`markQuoteVersionLost` happy path) → P0 (governance integrity + immutability + isolation + read-model
contract) → P1 (reason/follow-up/aggregation + UX) → P2/P3.

---

## Resource Estimates

Ranges, not false precision. Epic 10 is deliberately **small in new authoring**: two new tables, one
governance refactor, one read-model, and **no new dependencies**. Much of the apparent P0 weight is
**reuse** — 10.2's immutability evidence is a **re-run** of the existing Epic 6/7 suite, and 10.1's
validator cases are fast pure `node --test` units. The genuinely new authoring is the manifest +
validator + derivations (10.1), the lost widening + `quote_lost_reasons` (10.2), the `quote_follow_ups`
workflow (10.3), and the first read-model + descriptor (10.4).

| Priority | Count (range) | Effort (range) | Notes |
| --- | --- | --- | --- |
| P0 | ~28-41 | ~24-38 h | 10.1 validator/derivation proofs (fast units, but many) + 10.2 immutability re-run/coherence + isolation dominate |
| P1 | ~20-28 | ~16-26 h | Reason validation + follow-up workflow + pipeline aggregation + E2E |
| P2 | ~7-10 | ~4-8 h | Rendering contracts, non-scope guards, deltas |
| P3 | ~3-4 | ~2-4 h | Residual docs + DX |
| **Total** | **~58-83** | **~46-76 h (~1.5-2 weeks, 1 dev)** | Below Epic 6's footprint — no new table *family*, no new deps, heavy reuse (10.2 immutability is a re-run) |

**Prerequisites**

- **Test data:** two-tenant factory extended with `quote_lost_reasons` + `quote_follow_ups` seeds (open
  / overdue / completed follow-ups; förlorad + avböjd lost versions) + cleanup; a mixed-lifecycle
  pipeline fixture (sent/accepted/lost); the lifecycle golden extended with a lost version; count-
  asserting tests seed `crypto.randomUUID()`.
- **Tooling:** existing runners (`node --test` / Vitest / Playwright) — **no new runner, no new
  dependency**. The CI PII/secret scan extends to the new note fixtures.
- **Environment:** local Supabase CLI stack for INT/RLS/E2E (`SUPABASE_TEST_REQUIRED=1` in CI).

**Non-effort dependencies (calendar/process, not test hours):** the oracle terminology task (R-1050),
the §9.1/§14 lost-token design decision (Open Assumptions #2), and the N-4 posture confirmation (R-1046)
must be resolved/recorded before or during the relevant story — none is test effort but each gates a
story.

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate:** 100% (no exceptions)
- **P1 pass rate:** ≥95% (waivers required for failures)
- **P2/P3 pass rate:** ≥90% (informational)
- **High-risk (≥6) mitigations:** 100% complete or approved waivers

### Coverage Targets

- **Manifest validator + derivations + read-model descriptor + aggregation logic (pure):** ≥90%
- **RLS negatives:** 100% of new tables (`quote_lost_reasons`, `quote_follow_ups`) enrolled + exercised
- **Sent-immutability:** the full regression suite re-run green; the lost path proven mutate-only-status
  at BOTH command and DB layers
- **State-machine coherence:** the widened transition asserted at every layer (pure map, both DB guards,
  CHECK sets, timeline union); illegal lost transition rejected at command AND DB
- **Governance no-drift:** 100% of the four derivations proven equal to their authored Phase A value;
  the validator proven able to fail on each §5.4 incoherence

### Non-Negotiable (epic blockers regardless of numeric score)

- [ ] Each derived guardrail expected value EQUALS the pre-refactor authored Phase A value; an unlisted
      surface FAILS CI (fail-loud retained); the coherence validator FAILS on each incoherent state.
- [ ] Sent versions immutable under the lost/declined path — the regression suite re-run green; the lost
      flip changes only `status`; direct own-tenant `UPDATE` returns `QUOTE_VERSION_LOCKED`.
- [ ] `quote_lost_reasons` (insert-only, unique per version) and `quote_follow_ups` (one-open partial
      unique index) enrolled in `TENANT_TABLES`; H4 green; cross-tenant + anon negatives pass.
- [ ] The first read-model returns `{ data, entitlements }` with withheld fields absent+listed and
      honest aggregates; it queries via the RLS client only.
- [ ] Pipeline amounts are öre-derived via `@/lib/money`; NO new money/rounding path.
- [ ] No new nav item / widget / analytics page / email-send path (PB-D7 / epic non-scope).
- [ ] No real PII/secret in any lost-reason / follow-up / pipeline fixture (CI scan green).
- [ ] R-1046 (N-4 conservative default) restated in the gate report so the owner-confirm trigger stays
      visible.

---

## Mitigation Plans (High-Priority, Score ≥6)

### R-1001: Derivation refactor silently shifts a guardrail expectation (Score 6, blocker-gated)

**Strategy:** For each of the four derivations (deny-list, nav expected set, H4 expected enrollment,
scope scans), assert the derived value EQUALS the pre-refactor authored value; seed the manifest's
`active` set to exactly Phase A's 7 nav / 24 tables / 7 file owner types. **STOP** on any divergence —
it signals pre-existing drift to resolve. **Owner:** Dev (10.1). **Timeline:** Story 10.1.
**Verification:** `10.1-UNIT-02`, `10.1-UNIT-04`.

### R-1002: Manifest coherence validator incomplete (Score 6)

**Strategy:** A validator UNIT suite that introduces each §5.4 incoherent state and asserts a failure
(prove each check can fail); record the matrix-rows rule as a stub wired at 11.1 (EB-A5). **Owner:** Dev
(10.1). **Timeline:** Story 10.1. **Verification:** `10.1-UNIT-01` (+ `10.1-DOCS-02`).

### R-1003: Fail-loud lost in the refactor (Score 6)

**Strategy:** Inject an unlisted nav item / tenant table / file owner type and assert the derived
guardrail + H4 FAIL; derive the expected set from the manifest's `active` set, never from the runtime
surface under check. **Owner:** Dev (10.1). **Timeline:** Story 10.1. **Verification:** `10.1-UNIT-03`.

### R-1010: Lost/declined path mutates the sent snapshot (Score 6)

**Strategy:** The widened RPC flips only `status` (row-equality sent-lock trigger passes) + appends one
`quote_events` row + inserts one `quote_lost_reasons` row (one txn + audit); **re-run the full
sent-immutability regression suite** + a mutate-only-status proof; the direct own-tenant `UPDATE`
negative still returns `QUOTE_VERSION_LOCKED`. **Owner:** Dev (10.2). **Timeline:** Story 10.2.
**Verification:** `10.2-INT-01/02`, `10.2-GOLDEN-01`.

### R-1011: Lifecycle state-machine drift across layers (Score 6)

**Strategy:** Widen from a single source; UNIT-pin the map + token coherence (CHECK sets ⊇ new tokens;
timeline union matches); INT-prove an illegal lost transition is rejected at BOTH the command
(`VALIDATION_FAILED`) and the DB (`QV409`→`QUOTE_VERSION_LOCKED`). Resolve the new-token-vs-map-onto-
`rejected` decision at create-story (Open Assumptions #2). **Owner:** Dev (10.2). **Timeline:** Story
10.2. **Verification:** `10.2-INT-03`, `10.2-UNIT-01`.

### R-1012: `quote_lost_reasons` isolation / insert-only gap (Score 6)

**Strategy:** Reuse the proven migration pattern verbatim; **no UPDATE policy** + `unique
(quote_version_id)`; enroll in `TENANT_TABLES` (H4 CI-fatal otherwise); RLS negatives incl. an
UPDATE-rejected assertion. **Owner:** Dev (10.2). **Timeline:** Story 10.2. **Verification:**
`10.2-INT-04`, `10.2-RLS-01`, `10.2-INT-05/06`.

### R-1040: First read-model sets a wrong entitlement contract (Score 6)

**Strategy:** UNIT-pin the `{ data, entitlements }` descriptor as the phase's reusable spec — withheld
⇒ absent + listed; aggregate honesty; column omission; conservative flagged N-4 default. **Owner:** Dev
(10.4). **Timeline:** Story 10.4. **Verification:** `10.4-UNIT-01`.

### R-1041: Read-model bypasses the RLS client (Score 6)

**Strategy:** Read-model queries via the RLS client ONLY; INT cross-tenant proof (tenant A never sees
tenant B); structural assertion that no service-role client is imported on the read-model path.
**Owner:** Dev (10.4). **Timeline:** Story 10.4. **Verification:** `10.4-INT-01`.

---

## Assumptions and Dependencies

### Assumptions

1. **Story 10.1 lands first and blocks the phase** — 10.2-10.4 flip manifest entries, so 10.1's
   manifest + validator + re-baseline must merge before them (epics-phase-b §Epic 10; sprint-status).
2. **Lost-lifecycle token model is decided at create-story** — whether Förlorad/Avböjd introduces a new
   `status`/`event_type` token (widening two CHECK sets + the `QuoteVersionStatus` union) OR maps onto
   the existing `rejected` status with the outcome held in `quote_lost_reasons` (architecture §9.1/§14).
   This scopes R-1011's coverage; the existing state machine has no lost token today
   (`src/features/quotes/lifecycle.ts`, `20260705120000_..._model.sql:177/367`). **A design authority
   call, not a test call.**
3. **Follow-up commands are single-row envelope commands** (§14 explicitly lists follow-up
   scheduling/completion as non-RPC); no narrow RPC needed for 10.3.
4. **The N-4 per-role seed is a conservative flagged default** — 10.4 proves the withholding
   *mechanism* (descriptor); the seed is not owner-confirmed (OWNER-GATE WATCHLIST; re-score/re-confirm
   at the owner gate).
5. **Reason categories are the UXB-A5 strawman**, tenant-tunable later; the Förlorad-vs-Avböjd
   distinction comes from the oracle terminology task (Cross-Epic Rule 2).
6. **Lovable's follow-up / accept-reject-lost behavior is an intentional, documented delta** (P18/P19) —
   compared, never replicated.

### Dependencies

1. **Local Supabase CLI stack** for INT/RLS/E2E — required at story start.
2. **Oracle terminology task** (R-1050) — required before Story 10.2.
3. **§9.1/§14 lost-token decision** (Assumption #2) — required at 10.2 create-story.
4. **E13 consumes 10.3 follow-up data** (`quote.follow_up_due` producer) — a *downstream* dependency,
   not a forward one; 10.3 lists/badges work without notifications (EB-A8).

### Risks to Plan

- **Risk**: Story 10.1 regression or slip disarms the whole phase's guardrails.
  - **Impact**: Every later Phase B activation ships unguarded.
  - **Contingency**: Treat 10.1 as a hard gate — no 10.2-10.4 merge until 10.1's no-drift +
    validator-fails-on-incoherence + fail-loud proofs are green; STOP on any divergence.
- **Risk**: The lost-token design decision (Assumption #2) is deferred into implementation and the
  state machine is widened inconsistently.
  - **Impact**: R-1011 cross-layer drift; possible corrupt lifecycle states.
  - **Contingency**: Force the decision at 10.2 create-story; the single-source widening + multi-layer
    coherence tests are non-negotiable.

---

## Follow-on Workflows (Manual)

- `*atdd` — generate red-phase P0 scaffolds per story (run explicitly at story start; 10.1 first — the
  validator + derivation proofs).
- `*trace` — epic-boundary traceability + gate decision after the stories land (AC-B1a-5/6 coverage).
- `*nfr-assess` — audit the governance-integrity + isolation + read-model NFR evidence.
- `*test-review` — suite quality after the epic suite lands (esp. the "validator can fail" and
  "derived-equals-authored" assertions).

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: {name} Date: {date}
- [ ] Tech Lead: {name} Date: {date}
- [ ] QA Lead: {name} Date: {date}

**Comments:**

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| **Quote sent-immutability (Epic 6/7)** | 10.2 appends a lifecycle event on a sent version | The full sent-immutability regression suite is **re-run** and must stay green (10.2-INT-01) |
| **Lifecycle state machine (`src/features/quotes/lifecycle.ts` + sent-lock trigger + RPC)** | 10.2 widens the transition set | Coherence across all layers re-proven (10.2-INT-03, 10.2-UNIT-01); existing rejected/expired/superseded transitions still pass |
| **`TENANT_TABLES` H4 gate** | Two new tables enroll (24 → 26) | H4 gate green with `quote_lost_reasons` + `quote_follow_ups` enrolled; existing enrollment untouched |
| **Deny-list / nav guardrail / scope scans** | 10.1 re-derives them from the manifest | Derived values proven equal to the authored Phase A values (10.1-UNIT-02); no existing guardrail weakens |
| **`AGENTS.md` / `docs/process` / `phase-scope-reviewer`** | 10.1 re-baselines the phase statement | Docs validators green; reviewer baseline derives from the manifest (10.1-UNIT-05) |
| **Quote list / detail UI (Epic 6)** | 10.2/10.4 add status filters, `Förlustorsak`, follow-up chips | Existing list/detail behavior unbroken; new surfaces render via `StatusBadge`/`ConnectionChip` (10.4-E2E-01) |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` - Risk classification framework
- `probability-impact.md` - Risk scoring methodology (P×I, thresholds)
- `test-levels-framework.md` - Test level selection
- `test-priorities-matrix.md` - P0-P3 prioritization

### Related Documents

- PRD (Phase B): `_bmad-output/planning-artifacts/prd-phase-b.md` (FR62-65, FR129-130, FR107; NFR11
  carried, NFR47, NFR51; AC-B1a-5/6; §13, §14 Phase C ledger)
- Epics (Phase B): `_bmad-output/planning-artifacts/epics-phase-b.md` (Epic 10, ll.522-696; Cross-Epic
  Delivery Rules ll.44-54)
- Architecture (Phase B): `_bmad-output/planning-artifacts/architecture-phase-b.md` (§5 ADR-B003; §6
  ADR-B004; §9.1 tables; §11 read-model/entitlement; §14 `markQuoteVersionLost`; §3.6 field withholding)
- Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml` (Phase B wave order;
  OWNER-GATE WATCHLIST N-4)
- House-style reference: `_bmad-output/test-artifacts/test-design-epic-6.md`
- Key in-repo evidence: `src/server/commands/quotes/lifecycle.ts`, `src/features/quotes/lifecycle.ts`,
  `src/features/files/deferred-categories.ts`, `tests/integration/rls/tenant-table-inventory.ts`,
  `supabase/migrations/20260705120000_quote_version_model.sql`,
  `supabase/migrations/20260707120000_quote_version_sent_lock.sql`

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `bmad-testarch-test-design`
**Version**: 4.0 (BMad v6)
