# Story 10.4: Pipeline Surfacing and Dashboard Read-Model

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Säljare and Projektledare,
I want quote pipeline data (sent/accepted/lost counts, hit rate, open/overdue follow-ups, and öre-derived amounts) surfaced consistently in the quote list/detail AND available as a server read-model,
so that the pipeline is visible now and the E19 dashboard can render it later without re-implementation.

## Story Context

- **Epic 10 [Wave B1a]:** Quote Lifecycle Completion (+ Phase B Governance Re-Baseline) — the deliberately small first Phase B epic (PB-D3). **This is the FOURTH and FINAL story of Epic 10.**
- **Depends on the three LANDED epic-10 models (aggregate over exactly these — invent nothing new):**
  - **Story 10.1** — the scope manifest `src/scope/manifest.ts` + the four derived guardrails (deny-list / nav / H4 enrolment / scope scans). The `quotes` module is already `active` (wave `A`); its `widgets: []` and single `navItems: [{ route: "/quotes" }]` are the guardrail floor this story MUST NOT grow.
  - **Story 10.2** — the SINGLE `lost` lifecycle token (status `lost` ⟺ the joined `quote_lost_reasons.outcome ∈ {forlorad, avbojd}`); `quote_events.event_type` was widened to include `'lost'`; the `quote_lost_reasons` table (insert-only). **The read-model's lost count aggregates over the `lost` `quote_events` rows + `quote_lost_reasons`; the list `Förlustorsak` column already reads the joined reason.**
  - **Story 10.3** — the `quote_follow_ups` table (updatable, one-open-per-quote partial unique index), the pure Europe/Stockholm `classifyFollowUp` date primitive (`src/features/quotes/follow-up-dates.ts`), the `selectNextOpenFollowUp`/`followUpChipState` selectors (`follow-up-view.ts`), the `Har uppföljning` / `Försenad uppföljning` list filters, the overdue badge, and the detail-header `FollowUpChip`. **The read-model's open/overdue follow-up counts aggregate over `quote_follow_ups`; this story reuses the 10.3 date discipline for its period windows.**
- **Nature of the work (NO new migration, NO new table, NO new dependency):**
  1. The **FIRST `src/server/read-models/**` module** (architecture §11) — a pipeline read-model returning the phase-defining **`{ data, entitlements }`** contract. This precedent propagates to every later Phase B read-model, so getting the descriptor shape exactly right is the highest-stakes deliverable (R-1040).
  2. The **sensitive-field withholding MECHANISM** (AR-B6 / architecture §3.6 tier 3 / §11): money amounts ride the entitlement descriptor so an unentitled role receives **field-absence + a `withheld` listing** — with the **conservative single-role `tenant_admin` default** (money-entitled ⇒ nothing withheld). Ship the mechanism; NEVER the confirmed N-4 per-role matrix (owner-gated).
  3. The pure **pipeline aggregation** (counts / hit rate / open+overdue follow-up counts / öre-derived amounts) computed server-side from lifecycle events, with deterministic Europe/Stockholm period boundaries.
  4. The **"render consistently" list/detail pass** — fold the 10.3 follow-up chip + overdue-badge tri-state tones into a shared `src/components/quotes/status.ts` primitive (the explicit 10-3 deferred item; see ⚑ below), and confirm status filters / `Förlustorsak` column / follow-up filters render via `StatusBadge` + the status.ts tone authority.
- **The problem this solves:** 10.2–10.3 completed the owner-confirmed lifecycle and the follow-up workflow, but pipeline health (how many sent/accepted/lost, the hit rate, how many follow-ups are open/overdue, the accepted value) is not computed anywhere and the follow-up tones are bespoke-inline (a DRY/consistency debt 10.3 deliberately deferred here). This story makes the pipeline **visible now** (list/detail) and **queryable** (the read-model) so E19 renders widgets over it later with zero re-implementation.

## ⚑ SCOPE BOUNDARY — read-model + list surfacing ONLY; NO widget, NO analytics page, NO new money path

> **This story ships the read-model DATA + the list/detail consistency pass — nothing renders in a new surface.** Per PB-D7 / FR107, pipeline data appears ONLY in the existing quote list/detail and in the read-model E19 consumes later. This story MUST NOT add: a new nav item, a dashboard widget, a separate analytics/reports page, a manifest `widgets` entry, an email-send path, or any new money/rounding/VAT computation path. If you find yourself building a widget, a `/dashboard` surface, or an `estimateX`/rounding routine, **STOP** — widgets are Epic 19 (§15.2), money computation lives only in `@/lib/money` (10.4 Stop Condition).

## ⚑ SETTLED DESIGN DECISIONS (do NOT re-litigate at dev time)

1. **First read-model lives in `src/server/read-models/**` and returns `{ data, entitlements }` (architecture §11).** Query the **RLS cookie-bound client ONLY** (`createSupabaseServerClient` — the same client `src/features/quotes/read.ts` uses); **NEVER** a service-role/unscoped client on this path (R-1041, the security floor beneath the descriptor). The RLS client scopes every row to the caller's tenant with no tenant id passed.
2. **The entitlement descriptor is `entitlements: { withheld: FieldPath[] }` (AR-B6, exact contract, §11).** A withheld money field is **ABSENT from `data`** (never `null`, never `0`) **AND listed in `withheld`**. Aggregate honesty is computed server-side: **any aggregate with a withheld component is itself withheld** (absent + listed) — never a partial sum. A wholly-withheld table column is omitted (not per-cell masked). The UI never consults role names client-side.
3. **The N-4 per-role money-visibility seed is OWNER-GATED — ship the MECHANISM, not the matrix.** The read-model applies a **conservative single-role `tenant_admin` default: money-entitled ⇒ `withheld: []`**. Do NOT create `src/server/authz/permission-matrix.ts` (Epic 11 owns it), do NOT enumerate `projektledare`/`saljare`/`ekonomi`/`montor` entitlements, do NOT hard-code the confirmed matrix. The read-model takes an **entitlement/role input with a conservative default** so Epic 11's matrix seed (11.2) retrofits it without rework (EB-A4). Prove the mechanism by unit-testing the descriptor for an **unentitled** input → money absent + listed. Carry the seed as `[gated: N-4]` in the completion notes (R-1046 / 10.4-DOCS-01).
4. **Counts + hit rate derive from lifecycle events (`quote_events`), not from live status reads (FR65).** sent/accepted/lost counts = distinct versions with the respective `quote_events.event_type` (`sent`/`accepted`/`lost`) whose `occurred_at` falls in the period window. Event-sourcing the counts (not reading the current `status`) is what makes a superseded-then-lost history honest. **Hit rate = acceptedCount / (acceptedCount + lostCount)** (the decided-deals win rate); **zero decided ⇒ `null`** (never `0`, never `NaN` — the empty-state honesty analog of the withheld rule). Counts and hit rate are NOT money and are ALWAYS present (never withheld).
5. **Money amounts are öre-derived integer sums of EXISTING frozen values — NO new money path (10.4 Stop Condition, R-1042).** The money aggregate (e.g. `acceptedValueOre` = the integer sum of the frozen `quote_versions.accepted_price_ore` for accepted versions in the period) is a plain integer öre addition; format for display via the single `formatOreAsKronor` authority in `@/lib/money`. Do NOT re-derive VAT/ROT/totals, do NOT round, do NOT recompute a snapshot value. This money aggregate is the field that RIDES the entitlement descriptor (decision 2/3).
6. **Deterministic Europe/Stockholm period boundaries — reuse the 10.3 date discipline, no `Date.now()` on the pure path (R-1032 shared logic).** The period window `[from, to]` is computed on the Europe/Stockholm calendar boundary from an INJECTED instant via the same explicit `Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' })` discipline as `follow-up-dates.ts` — never the host default zone, never `Date.now()` on the classification/window path. Overdue follow-up counting reuses `classifyFollowUp` verbatim.
7. **The "render consistently" pass consolidates the 10.3 follow-up tones into `status.ts` (the explicit 10-3 deferred item — MUST close here).** See ⚑ below and Task 4.

## ⚑ 10-3 DEFERRED ITEM THIS STORY MUST CLOSE (chip/badge tone consolidation)

> Deferred-work ledger + epic-10 retro-notes (Story 10-3): *"Follow-up chip + overdue badge use bespoke inline tones instead of a shared `status.ts` primitive — fold the follow-up tri-state tones (overdue / due-today / upcoming) into `status.ts` during Story 10.4's 'render consistently' pass (SETTLED DESIGN DECISION 6 / 10.4 AC2)."* This is a named 10.4 obligation — **not** a fresh deferral to re-punt.

Two concrete duplications to eliminate (both currently hardcode tones that shadow `QUOTE_STATUS_COLORS`):
- `src/components/quotes/FollowUpChip.tsx` — inline `bg-rose-100/…`, `bg-amber-100/…`, `bg-blue-100/…` for overdue/due-today/upcoming (does NOT import `status.ts`).
- `src/components/quotes/QuoteList.tsx` — the row overdue badge hardcodes `border-rose-300 bg-rose-100 text-rose-900`, byte-duplicating `QUOTE_STATUS_COLORS.lost`.

Consolidate: add a follow-up tone authority to `src/components/quotes/status.ts` (mirror the `QUOTE_STATUS_LABELS`/`QUOTE_STATUS_COLORS` + `quoteStatusLabel`/`quoteStatusColor` shape) — e.g. `FOLLOW_UP_TONE_LABELS` / `FOLLOW_UP_TONE_COLORS` keyed by the `FollowUpDateClass` (`upcoming | due-today | overdue`) plus `followUpToneLabel(state)` / `followUpToneColor(state)`. Have `FollowUpChip.tsx` AND the `QuoteList.tsx` row badge consume it. Keep text-first (WCAG 1.4.1 — the label is the primary signal, color is redundant). NOTE: literal reuse of `StatusBadge`/`ConnectionChip` is **not feasible** — `StatusBadge` is keyed to `QuoteVersionStatus` (cannot model the follow-up tri-state) and **no `ConnectionChip` component exists in the repo** (it is a UX contract name, honored here via the shared status.ts tone authority + text-first rendering). Extending `status.ts` IS the "shared primitive" the deferral asks for.

## Acceptance Criteria

### AC1 — Pipeline read-model with the `{ data, entitlements }` contract + entitlement mechanism

**Given** quotes across the lifecycle (sent, accepted, lost/declined) and a queried period
**When** the pipeline read-model is queried
**Then** it returns, computed **server-side from lifecycle events** (`quote_events`) via the **RLS client only**: sent/accepted/lost counts, hit rate (`accepted/(accepted+lost)`, zero-decided ⇒ `null`), open + overdue follow-up counts, and the öre-derived money aggregate (accepted value) — with deterministic Europe/Stockholm period boundaries (FR65, §11)
**And** the money amount rides the entitlement descriptor: for an **unentitled** role the amount is **ABSENT from `data`** and **listed in `entitlements.withheld`** (never `null`/`0`), aggregate honesty holds (any withheld component ⇒ the whole money aggregate withheld), and the **conservative default is single-role `tenant_admin` ⇒ money-entitled ⇒ `withheld: []`** (mechanism per AR-B6; seed carried as `[gated: N-4]`, never the confirmed matrix).

### AC2 — Quote list/detail render consistently (status filters, Förlustorsak column, follow-up filters, header chips)

**Given** the quote list and detail surfaces with lifecycle-completion data
**When** the surfaces render
**Then** the status filters (incl. Förlorad/Avböjd), the `Förlustorsak` column, the `Har uppföljning` / `Försenad uppföljning` follow-up filters, and the detail-header follow-up chip (from Stories 10.2–10.3) render consistently via `StatusBadge` + a **shared `status.ts` tone authority** (UX-BDR4 / UX-BDR17 text-first contract)
**And** the 10.3 bespoke-inline follow-up tones in `FollowUpChip.tsx` and the `QuoteList.tsx` overdue row badge are folded into the `status.ts` primitive (the named 10-3 deferred item), with no behavioral change to the (already-correct) filters.

### AC3 — No new analytics surface (read-model + list/detail only)

**Given** no separate analytics page exists
**When** scanning the shipped surface
**Then** pipeline data appears **only** in the quote list/detail surfaces and the read-model E19 consumes later (PB-D7) — **no new nav item, no dashboard widget, no analytics/reports page, no manifest `widgets` entry, no email-send path** (guardrail-scanned; the manifest `quotes` module keeps `widgets: []` and its single `/quotes` nav item; the derived nav/widget expected sets stay unchanged).

### AC4 — Read-model isolation floor (RLS-client-only, cross-tenant proof)

**Given** tenant A and tenant B quotes/events/follow-ups
**When** tenant A queries the pipeline read-model
**Then** it never returns tenant B counts/amounts (the RLS client scopes every underlying query to tenant A), and a **structural assertion proves no service-role/unscoped client is imported on the read-model path** (the "no service-role from client paths" invariant, R-1041).

## Tasks / Subtasks

- [x] **Task 1 — The pure pipeline aggregation (AC1) — `node --test` unit-first**
  - [x] 1.1 New pure module `src/server/read-models/quote-pipeline-aggregate.ts` (or `src/features/quotes/pipeline-aggregate.ts` — keep the PURE aggregation separate from the DB query so it unit-tests without a stack). Input: the already-read rows (lifecycle events + accepted-version öre + follow-up rows) + the resolved period window; output: the full (pre-entitlement) aggregate object `{ period, sentCount, acceptedCount, lostCount, hitRate, openFollowUpCount, overdueFollowUpCount, acceptedValueOre }`.
  - [x] 1.2 Counts derive from `quote_events` (`event_type` `sent`/`accepted`/`lost`) whose `occurred_at` falls in the period window (SETTLED DECISION 4); count distinct versions per state. `hitRate = acceptedCount / (acceptedCount + lostCount)`; **zero decided ⇒ `null`** (never `0`/`NaN`). Empty-input ⇒ all counts `0`, `hitRate = null`, `acceptedValueOre = 0`.
  - [x] 1.3 `acceptedValueOre` = the INTEGER sum of the frozen `quote_versions.accepted_price_ore` for accepted versions in the period (plain integer öre addition — **NO new money/rounding path**, SETTLED DECISION 5). Display formatting (where surfaced) uses `formatOreAsKronor` from `@/lib/money` ONLY.
  - [x] 1.4 `openFollowUpCount` = open `quote_follow_ups`; `overdueFollowUpCount` = open AND `classifyFollowUp(due_date, injectedNow) === "overdue"` (reuse `src/features/quotes/follow-up-dates.ts` verbatim — do NOT fork the date logic).
  - [x] 1.5 New pure period-window helper (in the aggregate module or `src/features/quotes/pipeline-period.ts`): resolve `[from, to]` on the Europe/Stockholm calendar boundary from an INJECTED instant, reusing the `sv-SE`/injected-clock discipline of `follow-up-dates.ts` (export/extend `calendarDayIn` if needed, or add a parallel pure helper). Deterministic; no `Date.now()` on the pure path (SETTLED DECISION 6). — **Done: exported `calendarDayIn` from `follow-up-dates.ts`; `resolvePipelinePeriod(instant, months=12)` resolves the trailing-year window on the Stockholm boundary.**
- [x] **Task 2 — The entitlement descriptor mechanism + the `{ data, entitlements }` projection (AC1) — `node --test` unit-first (the precedent spec)**
  - [x] 2.1 New pure module `src/server/read-models/entitlements.ts` (the phase-defining descriptor seam): a pure `projectWithEntitlements(fullAggregate, entitlementInput)` → `{ data, entitlements: { withheld } }`. A withheld money field is **deleted from `data`** (absent, not null/0) AND **pushed to `withheld`** (a stable `FieldPath` string, e.g. `"acceptedValueOre"`). **Aggregate honesty:** any withheld money component ⇒ the whole money aggregate is withheld. Counts/hitRate are never withheld.
  - [x] 2.2 The entitlement input is a **role set (or a `moneyEntitled` boolean) with a conservative default**; the default resolves `tenant_admin ⇒ moneyEntitled: true ⇒ withheld: []`. **Do NOT create `permission-matrix.ts`, do NOT enumerate the other roles, do NOT ship the N-4 matrix** (SETTLED DECISION 3). Keep the seam shaped so Epic 11's matrix retrofits it (a single injectable entitlement resolver, conservative default baked in).
  - [x] 2.3 New DB-querying read-model `src/server/read-models/quote-pipeline.ts`: `readQuotePipeline(period, entitlementInput?)` — query the **RLS client** (`createSupabaseServerClient`) for `quote_events` (period-scoped), the accepted versions' `accepted_price_ore`, and `quote_follow_ups`; call the pure aggregate (Task 1) then the pure projection (Task 2.1); return `{ data, entitlements }`. On a query error, degrade to a generic result (mirror `read.ts`'s generic-error posture) — never leak SQL/stack. — **Done: `readQuotePipeline(period?, entitlementInput?, deps?)`; `deps.client` is an injectable RLS-client seam (default resolves `createSupabaseServerClient`); imports NO privileged/unscoped client and never writes.**
- [x] **Task 3 — List/detail read + filter consistency (AC2) — reuse the 10.3 projection, DO NOT rebuild**
  - [x] 3.1 Confirm `src/features/quotes/read.ts` already surfaces `lost_reason` (10.2), `has_open_follow_up` + `overdue_follow_up` (10.3). **Do NOT duplicate that read into the read-model** — the read-model is the aggregate; the list projection stays the per-row surface. Only ADD what AC2 consistency needs (no new per-row fields required unless a filter is proven wrong). — **Confirmed: no new per-row field; added ONLY a non-behavioral `deps.client` seam to `readQuoteList` so the harness binds tenant A's RLS client for the INT-02 proof.**
  - [x] 3.2 Verify the `QuoteList.tsx` status filter (incl. `lost`), `Förlustorsak` column, and `Har uppföljning`/`Försenad uppföljning` filters return the correct rows across a mixed sent/accepted/lost + open/overdue fixture (10.4-INT-02). These already work (10.2/10.3) — this task PROVES consistency, not new behavior.
- [x] **Task 4 — Consolidate the follow-up tones into `status.ts` (AC2; the named 10-3 deferred item)**
  - [x] 4.1 In `src/components/quotes/status.ts` add the follow-up tone authority keyed by `FollowUpDateClass` (`upcoming | due-today | overdue`): `FOLLOW_UP_TONE_LABELS` (`Uppföljning` / `Uppföljning idag` / `Försenad uppföljning`), `FOLLOW_UP_TONE_COLORS` (blue / amber / rose — the current chip tones), and `followUpToneLabel(state)` / `followUpToneColor(state)`. PURE (no JSX), importable by both the client island and a `node --test` unit. Mirror the existing `quoteStatusColor`/`quoteStatusLabel` shape + the unknown-key neutral fallback.
  - [x] 4.2 Refactor `src/components/quotes/FollowUpChip.tsx` to consume `followUpToneLabel`/`followUpToneColor` from `status.ts` (delete the bespoke inline `label`/`color` ternaries). Preserve the `data-testid="next-follow-up-chip"` + `data-overdue`/`data-due-today` attributes and the text-first output.
  - [x] 4.3 Refactor the `QuoteList.tsx` row overdue badge to consume the same `status.ts` primitive (delete the hardcoded `border-rose-300 bg-rose-100 text-rose-900` that duplicates `QUOTE_STATUS_COLORS.lost`). Preserve `data-testid="quote-row-overdue-follow-up-badge"` + the "Försenad uppföljning" text.
- [x] **Task 5 — Guardrail: no new analytics surface (AC3)**
  - [x] 5.1 Confirm the `quotes` module in `src/scope/manifest.ts` keeps `widgets: []` and its single `navItems: [{ route: "/quotes" }]` — do NOT add a widget/nav entry. The 10.1 derivations (`EXPECTED_NAV_ROUTES` == the 7 routes; empty widget set) must stay green with NO pin change. — **Confirmed: `manifest.ts` NOT edited; TENANT_TABLES stays 26.**
  - [x] 5.2 Add the non-scope guardrail (10.4-INT-03): assert no new nav item / no dashboard widget / no separate analytics page appears for E10, and no email-send path exists on the read-model/list path (a deferred-surface + manifest scan mirroring the R-1045 mitigation). **NO new tenant table ⇒ `TENANT_TABLES` count stays 26; do NOT bump any manifest count pin and do NOT enrol a table** (there is none).
- [x] **Task 6 — Tests (all ACs; map to test-design-epic-10 IDs) — see Dev Notes → Testing**
  - [x] 6.1 UNIT (`node --test`, under `tests/unit/**`): **10.4-UNIT-01** (the precedent-setting descriptor contract — a withheld money field ABSENT from `data` AND listed in `withheld` for an unentitled input; NEVER `null`/`0`; aggregate honesty: any withheld component ⇒ whole aggregate withheld; column omission; `tenant_admin` conservative default ⇒ `withheld: []`); **10.4-UNIT-02** (aggregation — sent/accepted/lost counts + hit rate incl. zero-decided ⇒ `null` + open/overdue counts + empty states + `acceptedValueOre` öre-derived via `@/lib/money`; deterministic Europe/Stockholm period windows); a unit for the follow-up tone authority (`followUpToneLabel`/`followUpToneColor` per state incl. unknown-key fallback). — **21 unit tests, all green, 0 skipped.**
  - [x] 6.2 INT (Vitest, local Supabase): **10.4-INT-01** (the read-model queries via the **RLS client ONLY**; tenant A's read-model never returns tenant B counts/amounts; a **structural assertion that no service-role client is imported on the read-model path** — grep/import-graph check, mirror the Phase-A "no service-role from client paths" negatives); **10.4-INT-02** (list-filter integration — status filters incl. Förlorad/Avböjd, `Förlustorsak` column, `Har uppföljning`/`Försenad uppföljning` return the correct rows over a mixed sent/accepted/lost + open/overdue two-tenant fixture).
  - [x] 6.3 INT/E2E: **10.4-INT-03** (non-scope guard — no new analytics page / nav item / widget; pipeline data only in list/detail + read-model; no email-send path — deferred-surface + manifest guardrail scan).
  - [x] 6.4 E2E (Playwright): **10.4-E2E-01** (status filters / `Förlustorsak` column / follow-up filters / detail header chip render via `StatusBadge` + the shared `status.ts` tone authority — the UX-BDR4/BDR17 contract-consistency check) — two-tenant fixture, `crypto.randomUUID()` seeds. — **4 E2E tests green; global-setup seeds a dedicated already-lost pipeline quote + reuses the 10.3 overdue-follow-up quote.**
  - [x] 6.5 DOCS: **10.4-DOCS-01** (record the N-4 entitlement seed as a **flagged conservative default** — mechanism ungated per the sprint-status OWNER-GATE WATCHLIST; re-confirm at the owner gate; the mechanism, not the matrix, is what 10.4 proves). — **See Completion Notes `[gated: N-4]`.**
  - [x] 6.6 PII (**10.x-UNIT-01**): if any pipeline golden/fixture is added, extend the STANDING PII/secret scan through the SHARED authority (`tests/support/anonymization-scan.ts` + the standing privacy-scan test) — NOT a weaker fixture-local check (the 10.2 review lesson, R-1015). Keep all pipeline/list fixtures anonymized shape-only. — **No golden fixture added (factory-built rows only, anonymized shape-only); the STANDING anonymization scan is unchanged and stays green.**

## Dev Notes

### What this story IS / IS NOT

- **IS:** the first `src/server/read-models/**` module (pipeline read-model, `{ data, entitlements }`); the sensitive-field withholding MECHANISM (entitlement descriptor with a conservative `tenant_admin` default); the pure pipeline aggregation (counts / hit rate / open+overdue follow-up counts / öre-derived accepted value) with deterministic Europe/Stockholm period windows; the list/detail "render consistently" pass that folds the 10.3 follow-up tones into `status.ts`; the non-scope guardrail (no new nav/widget/analytics/email).
- **IS NOT:** any dashboard WIDGET or a `/dashboard` render (**Epic 19**, §15.2 — E19 consumes this read-model); the confirmed N-4 per-role money-visibility MATRIX (**Epic 11** owns `permission-matrix.ts`; 10.4 ships only the mechanism + conservative default, EB-A4); a new migration / tenant table (Migration/Coexistence Impact: **None** — `TENANT_TABLES` stays 26); any RPC; any new money/tax/rounding path (10.4 Stop Condition — amounts are integer öre sums of EXISTING frozen values, formatted via `@/lib/money`); any mutation of a sent snapshot (the read-model READS, never writes — NFR11/FR63); any notification/email-send path (Epic 13); a new dependency or a new test runner.

### The read-model contract (architecture §11 — the phase-defining precedent, get it EXACTLY right)

```
readQuotePipeline(period, entitlementInput?) -> {
  data: {
    period: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' },   // Europe/Stockholm calendar boundary
    sentCount: number,
    acceptedCount: number,
    lostCount: number,
    hitRate: number | null,           // accepted / (accepted + lost); zero-decided => null
    openFollowUpCount: number,
    overdueFollowUpCount: number,
    acceptedValueOre?: number          // ABSENT when withheld (never null/0)
  },
  entitlements: { withheld: string[] } // e.g. [] for tenant_admin; ["acceptedValueOre"] when unentitled
}
```

- **Withheld ⇒ absent + listed** (§11): the money field is `delete`d from `data` (not set to `null`/`0`) AND its `FieldPath` string is pushed to `withheld`. UI rule (later): absent + listed = `MaskedValue`/omit column; absent + not-listed = genuinely empty. **The UI never consults role names client-side.**
- **Aggregate honesty (§11 / UX §3.2 rule 4):** any aggregate whose components include a withheld value is itself withheld — the server never ships a partial sum. For 10.4 the money aggregate is a single field, but bake the rule into the projection (a helper that, given the set of withheld leaf fields, withholds any aggregate depending on them) so later multi-component read-models inherit correct behavior.
- **The security floor is §3.6 (RLS), NOT this projection** — the descriptor is the UX-determinism layer. A crafted request bypassing the read-model hits the RLS floor (all underlying queries are RLS-client-scoped). That is why 10.4-INT-01 proves RLS-client-only + no service-role import.
- **Keep the pure aggregation and the pure entitlement projection SEPARATE from the DB query** so 10.4-UNIT-01/02 pin the contract without a stack and 10.4-INT-01 proves only the query/isolation layer (the epic-9/10 "extract pure logic to the fast unit gate" lesson; retro-notes 10-1 Phase-4 two-runner discipline).

### The entitlement MECHANISM vs the N-4 MATRIX (SETTLED DECISION 3 — the owner gate)

- Sprint-status OWNER-GATE WATCHLIST: *"N-4 before the 11-2 entitlement seed is treated as confirmed (mechanism proceeds ungated)."* Architecture ADR-B001 (§3.1) + AR-B6: sensitive money fields are withheld **server-side by structural absence**, never by client masking; the per-role SEED is `[gated: N-4]`, the MECHANISM is not.
- 10.4 builds the mechanism: the descriptor projection + a conservative entitlement resolver defaulting `tenant_admin ⇒ money-entitled`. Under B1a everyone IS `tenant_admin` (EB-A4 capability seam), so at runtime `withheld` is `[]` today. The **unit test drives an unentitled input** to prove the withholding path works — that is the deliverable, not a runtime role split.
- **Do NOT** create `src/server/authz/permission-matrix.ts`, `capability.ts`, or role enumerations — Epic 11 (11.1/11.2) owns them. The "activation-without-matrix-rows fails" coherence rule is wired at 11.1 (EB-A5), not here (stubbed; R-1002 residual). Keep the entitlement resolver a single small injectable seam with the conservative default baked in so 11.2 feeds it the real matrix with no rework.

### Counts, hit rate, and the money aggregate (SETTLED DECISIONS 4/5 — event-sourced, öre-honest)

- **Event-sourced counts (FR65):** read `quote_events` (RLS-scoped) filtered to `occurred_at` within the period; count distinct versions per `event_type` (`sent`/`accepted`/`lost`). 10.2 widened `quote_events.event_type` to include `'lost'` (coherently across the 3 DB layers), so the lost count reads the `lost` events. Deriving from events (not the live `status`) keeps a superseded-then-lost or re-sent history honest.
- **Hit rate = acceptedCount / (acceptedCount + lostCount)** (decided-deals win rate). **Zero decided ⇒ `null`** — the empty-state honesty analog of the withheld rule (never `0`, never `NaN`). Unit-test the zero-decided and all-empty cases explicitly. (FR65 says "hit rate" without pinning the denominator; `accepted/(accepted+lost)` is the honest decided-win rate and is recorded as the story's assumption — flag it in the completion notes so E19/owner can confirm.)
- **Money aggregate (NO new money path, R-1042):** `acceptedValueOre` = integer sum of the frozen `quote_versions.accepted_price_ore` for the period's accepted versions. This is plain integer addition of ALREADY-computed frozen öre — NOT a recompute of VAT/ROT/totals. Format via `formatOreAsKronor` (`@/lib/money`) only, wherever displayed. If aggregating pipeline value appears to need any rounding/VAT/summation-of-non-öre logic, **STOP** (10.4 Stop Condition).
- **Period boundaries (SETTLED DECISION 6):** compute `[from, to]` on the Europe/Stockholm calendar boundary from an injected instant, reusing the `sv-SE`/`Intl.DateTimeFormat` discipline in `follow-up-dates.ts` (the module already computes "today in Stockholm" from an injected instant — extend/parallel it; do NOT introduce a second date convention or `Date.now()` on the pure path). Overdue follow-up counting calls `classifyFollowUp` verbatim.

### The "render consistently" pass — reuse, do NOT reinvent (AC2 + the 10-3 deferral)

- `src/components/quotes/status.ts` is the existing tone authority (`QUOTE_STATUS_LABELS`/`QUOTE_STATUS_COLORS` + `quoteStatusLabel`/`quoteStatusColor` + `LOST_OUTCOME_LABELS`/`LOST_CATEGORY_LABELS`). ADD the follow-up tone authority here (SETTLED DECISION 7 / ⚑ above). This is the "shared `status.ts` primitive" the 10-3 deferral names.
- `FollowUpChip.tsx` + the `QuoteList.tsx` overdue row badge consume the new `status.ts` helpers; delete their inline tone literals. Keep the `data-testid`s + text-first labels intact so 10.3's E2E + the new 10.4-E2E-01 stay green.
- `StatusBadge.tsx` already reads `status.ts` for lifecycle badges — leave it. The `Förlustorsak` column already resolves via `lostOutcomeLabel`/`lostCategoryLabel` (10.2). The status + follow-up filters already work (10.2/10.3) — the consistency pass is the tone consolidation + a proof, NOT a filter rewrite.
- `QuoteList.tsx` carries an unrelated open picker-readiness deferral (deferred-work, list-page-create-entry-points) — leave it untouched; only refactor the overdue badge tone.

### Reuse — do NOT reinvent

- RLS read client + generic-error posture: `src/features/quotes/read.ts` (`createSupabaseServerClient`, `GENERIC_READ_ERROR`, öre coercion at the read boundary). The read-model mirrors this client + posture (NEVER a service-role client — `src/server/db/supabase-server-client.ts` also exports the service-role factory; the read-model must NOT import it).
- Europe/Stockholm date discipline: `src/features/quotes/follow-up-dates.ts` (`classifyFollowUp`, the internal `calendarDayIn` sv-SE formatter). Reuse verbatim; extend for the period window if needed.
- Money formatter: `formatOreAsKronor` in `@/lib/money` (`src/lib/money/ore.ts`) — the single öre→kronor authority. No second formatter.
- Tone authority: `src/components/quotes/status.ts`. Follow-up selectors: `src/features/quotes/follow-up-view.ts` (`selectNextOpenFollowUp`, `followUpChipState`, `FollowUpRecord`).
- Two-tenant fixtures + `tests/factories/**` (quote/version/event/lost-reason/follow-up seeds already exist from 6.x/10.2/10.3 — extend with accepted-version + mixed-lifecycle pipeline seeds). Per-run `crypto.randomUUID()` ids. `SUPABASE_TEST_REQUIRED=1` INT/RLS gate against a freshly `supabase db reset` local stack.

### Constraints & persistent facts (from epic-10 retro-notes + deferred-work overlaps — MUST honor)

1. **NO new tenant table ⇒ manifest count STAYS 26; do NOT bump any pin and do NOT enrol a table (there is none).** The `quotes` module already carries `quote_follow_ups` (10.3 → active union 25→26). This story adds no migration (Migration/Coexistence Impact: None), so `TENANT_TABLES` stays 26 and the `manifest-shape`/`manifest-derivations` pins are untouched. Do NOT invent an enrolment. (epic-10 retro-notes 10-1/10-2 count-pin reconciliation; the frozen Phase-A gate validators stay `>= 24` FLOORS — do not re-touch.)
2. **Close the 10-3 chip/badge tone consolidation into `status.ts` HERE (deferred-work ledger names this story explicitly).** Not a fresh deferral — SETTLED DECISION 7 / Task 4 / AC2. (deferred-work.md "Deferred from: code review of 10-3"; epic-10 retro-notes 10-3.)
3. **Unskip-or-delete ATDD finalize discipline is a HARD GATE (epic-10 retro-notes Tier-A + the 10.2/10.3 review findings).** Every ATDD scaffold this story creates must end EITHER unskipped-and-green OR deleted — never a shipped `describe.skip` masquerading as coverage, never a throwing-placeholder next to the real test. Any "all unskipped and green" Change-Log claim must be literally true (three separate 10.2 Patches were exactly this failure mode; do not repeat). A task marked done whose standing control was never actually widened is the same failure (the 10.2 Task-6.4 lesson) — if you claim the PII scan was extended, extend the SHARED authority, not a fixture-local check.
4. **First read-model = phase-defining precedent (R-1040/R-1041).** A wrong `{ data, entitlements }` shape or an RLS-client bypass propagates to EVERY later Phase B read-model. Pin the descriptor as a pure unit spec (10.4-UNIT-01) and prove RLS-client-only + no service-role import (10.4-INT-01). This is why the pure projection is kept DB-free and the query layer thin.
5. **Two-runner discipline (epic-10 retro-notes 10-1 Phase-4).** Pure logic (aggregation, hit-rate/empty-state, entitlement projection, period window, the follow-up tone authority) lands as `node --test` UNIT — NOT Playwright. DB-backed isolation/RLS-client-only + list-filter integration is Vitest INT/RLS; only the rendered filters/column/chip are Playwright E2E. Do not push pure-TS assertions into the slow gate.
6. **N-4 seed is a flagged conservative default, NEVER the confirmed matrix (R-1046, SETTLED DECISION 3).** Ship the mechanism (server field-absence + `withheld` listing) with `tenant_admin ⇒ money-entitled`; carry `[gated: N-4]` in the completion notes; re-confirm at the owner gate. Do NOT create `permission-matrix.ts` or enumerate roles (Epic 11).
7. **No service-role on any read path; no new money/rounding path; no snapshot-content write; no notification/email path; no RPC.** Hard invariants (AGENTS.md; the ⚑ scope boundary; Stop Conditions). The read-model READS via the RLS client only.
8. **Golden fixture EOL + PII scan via the SHARED authority (epic-10 retro-notes 10-1/10-2, R-1015).** If a pipeline golden fixture is added, the dir-wide `tests/fixtures/golden/**/*.json text eol=lf` `.gitattributes` pin (added in 10.2) already covers it, and any new fixture must fail CI on real PII via the STANDING `anonymization-scan.ts` control — not a weaker fixture-local pattern. Keep all pipeline/list fixtures anonymized shape-only. (No golden fixture is required by these ACs — prefer factory-built rows.)
9. **`SUPABASE_TEST_REQUIRED=1` CI gate (epic-10 retro-notes 10-2/10-3).** The INT/RLS/E2E gate hard-fails on a missing/unreset stack. Run against a freshly `supabase db reset` local stack. The committed `supabase/cli-profile.yaml` lacks `dashboard_url` for CLI 2.109.1 (10.2/10.3 dev hit this) — use a complete TEMP profile for the local reset only; do NOT commit a cli-profile change (out of scope).

### Testing (levels, IDs, and the non-negotiables)

- Runners: `node --test` (UNIT under `tests/unit/**`), Vitest (INT/RLS, DB-backed, local Supabase), Playwright (E2E). **No new runner, no new dependency.**
- **P0 non-negotiables (test-design exit criteria for 10.4):** the `{ data, entitlements }` descriptor is contract-pinned (withheld ABSENT + listed, never `null`/`0`; aggregate honesty; column omission; `tenant_admin` conservative default ⇒ `withheld: []`) — 10.4-UNIT-01; the read-model queries via the RLS client ONLY with a cross-tenant proof + a no-service-role-import structural assertion — 10.4-INT-01; pipeline amounts öre-derived via `@/lib/money`, NO new money path; no real PII/secret in any fixture (CI scan green) — 10.x-UNIT-01.
- **P1:** aggregation counts/hit-rate/empty-states/period-windows (10.4-UNIT-02); list-filter integration over a mixed lifecycle fixture (10.4-INT-02).
- **P2:** contract-consistency E2E via StatusBadge/status.ts (10.4-E2E-01); non-scope guard (10.4-INT-03); N-4 seed DOCS (10.4-DOCS-01).
- Test IDs map to `test-design-epic-10.md` (R-1040/R-1041/R-1042/R-1043/R-1044/R-1045/R-1046/R-1015). Do NOT hand-write an ad-hoc isolation suite that bypasses the established RLS-client/`TENANT_TABLES` conventions (Testability Note 5).

### Project Structure Notes

- **New files:** `src/server/read-models/quote-pipeline.ts` (DB query), `src/server/read-models/quote-pipeline-aggregate.ts` (pure aggregation) [or `src/features/quotes/pipeline-aggregate.ts`], `src/server/read-models/entitlements.ts` (the descriptor projection + conservative resolver) [or `src/features/quotes/pipeline-period.ts` for the period helper]; UNIT tests under `tests/unit/server/read-models/**` (or `tests/unit/features/quotes/**`), INT under `tests/integration/**`, E2E under `tests/e2e/quotes/**`.
- **Edited files:** `src/components/quotes/status.ts` (add the follow-up tone authority), `src/components/quotes/FollowUpChip.tsx` + `src/components/quotes/QuoteList.tsx` (consume it), possibly `src/features/quotes/follow-up-dates.ts` (export a period-window helper). `src/scope/manifest.ts` is NOT edited (no new table/nav/widget).
- `src/server/read-models/**` is a NEW directory (this is the first module). All quote surfaces stay under `src/{app/(app)/quotes,components/quotes,features/quotes,server/commands/quotes,server/read-models}` — no new nav module directory.

### Stop Conditions Requiring Human Approval

- **STOP** if pipeline aggregation appears to require a new money computation path outside `@/lib/money` (a VAT/ROT/rounding recompute) — the money aggregate is an integer öre SUM of existing frozen values only (epics-phase-b §Story 10.4 Stop Condition; R-1042).
- **STOP** if satisfying the entitlement mechanism appears to require building the N-4 per-role matrix or `permission-matrix.ts` — that is Epic 11; 10.4 ships only the mechanism + conservative `tenant_admin` default.
- **STOP** if the read-model appears to require a service-role/unscoped client, an RPC, or any write — the read-model READS via the RLS client only.
- **STOP** if the "render consistently" pass surfaces a genuine filter/column defect that needs a schema or read-projection change beyond the tone consolidation (reconcile/escalate — do not silently expand scope).

### References

- [Source: epics-phase-b.md#Story 10.4 (ll.662-695): AC, Technical Notes (first read-model, `{data,entitlements}` pattern, deterministic period boundaries), Test/Security/Money/Migration Impact, Stop Condition; EB-A4 (10.2–10.4 under tenant_admin + envelope capability seams; 11.2 matrix retrofit)]
- [Source: architecture-phase-b.md#11 Entitlement/Field-Presence Contract (ll.383-392 — `src/server/read-models/**`, `{data, entitlements.withheld}`, absent+listed, aggregate honesty, column omission, RLS-client, security floor = §3.6); #3.6 sensitive-field withholding tier 3 (ll.114-120); #3.1 ADR-B001 (server field-absence, not client masking); #17 source tree (`server/read-models/`, `server/authz/permission-matrix.ts` = Epic 11)]
- [Source: prd-phase-b.md FR65 (l.313 — sent/accepted/lost counts, open follow-ups, hit rate for E19), FR107 (l.384 — dashboard widgets read this, widget surface grows per manifest, never placeholder), Journey B4 (l.149), PB-D7 (pipeline data only in list/detail + read-model)]
- [Source: test-design-epic-10.md — 10.4-UNIT-01/02, 10.4-INT-01/02/03, 10.4-E2E-01, 10.4-DOCS-01, 10.x-UNIT-01; R-1040/R-1041/R-1042/R-1043/R-1044/R-1045/R-1046/R-1015; Testability Notes 4/5/6; Entry/Exit Criteria (read-model precedent proven; RLS-client-only; öre-derived; fixture privacy); Special Considerations #3/#4]
- [Source (code, reuse): src/features/quotes/read.ts (RLS read client + generic-error posture + öre coercion + the 10.2 lost_reason / 10.3 open+overdue follow-up list projection); src/features/quotes/follow-up-dates.ts (classifyFollowUp, calendarDayIn sv-SE/injected-clock); src/features/quotes/follow-up-view.ts (selectNextOpenFollowUp/followUpChipState); src/components/quotes/status.ts (tone authority to extend); src/components/quotes/{FollowUpChip.tsx,QuoteList.tsx,StatusBadge.tsx} (consolidation targets); src/lib/money/ore.ts (formatOreAsKronor); src/server/db/supabase-server-client.ts (RLS client — NEVER the service-role factory); src/scope/manifest.ts (quotes module ll.126-153 — widgets [] / one nav item, unchanged); tests/unit/scope/manifest-derivations.test.ts (nav/widget expected-set guardrails)]
- [Source (constraints): _bmad-output/auto-bmad/retro-notes/epic-10.md (Story 10-1 two-runner + count-pin reconciliation; Story 10-2 unskip-or-delete + standing-control widening; Story 10-3 chip/badge → status.ts consolidation, occluded-error-banner lane, post-mutation orchestrator); _bmad-output/implementation-artifacts/deferred-work.md ("Deferred from: code review of 10-3" — the chip/badge status.ts fold, explicitly 10.4-scoped)]

## Dev Agent Record

### Agent Model Used

Opus 4.8 (1M) — auto-bmad create-story delegate.

### Debug Log References

- Full regression at completion: `node --test tests/unit/**` → 1517 pass / 1 fail (the fail is the PRE-EXISTING, unrelated Story 9.2 golden fixture `tests/fixtures/golden/lovable/acceptance.json` canonical-serialization mismatch — unmodified from HEAD, LF, zero overlap with 10.4). `vitest run` (full INT) → 73 files / 782 tests, 0 fail. `playwright test tests/e2e/quotes/` → 40 tests, 0 fail (incl. the 4 new 10.4-E2E-01 + the 10.2/10.3 specs — no regression from the tone fold or fixture change). `tsc --noEmit` → exit 0. `eslint` (all changed files) → 0/0.

### Completion Notes List

- **First `src/server/read-models/**` module shipped (the phase-defining precedent).** `readQuotePipeline(period?, entitlementInput?, deps?)` returns the exact `{ data, entitlements: { withheld } }` contract. The pure aggregation (`quote-pipeline-aggregate.ts`) and the pure entitlement projection (`entitlements.ts`) are kept DB-free so 10.4-UNIT-01/02 pin the contract without a stack; the thin query layer (`quote-pipeline.ts`) is proven by 10.4-INT-01.
- **Entitlement MECHANISM, not the N-4 MATRIX `[gated: N-4]`.** `projectWithEntitlements` deletes a withheld money leaf from `data` (ABSENT, never null/0) AND lists its stable `FieldPath` in `entitlements.withheld`; aggregate honesty is baked into a general `withholdFields` helper. The single injectable resolver defaults conservatively: explicit `moneyEntitled` wins; else `roles.includes("tenant_admin")`; else (no input) money-entitled → `withheld: []` (the B1a single-role reality). The unentitled path is proven by driving `{ moneyEntitled: false }`. **No `permission-matrix.ts`, no role enumeration** — Epic 11 (11.2) feeds this same seam the real matrix with no rework. The N-4 seed stays a flagged conservative default; re-confirm at the owner gate.
- **Assumption flagged for E19/owner (FR65 denominator):** hit rate = `acceptedCount / (acceptedCount + lostCount)` (decided-deals win rate); zero-decided ⇒ `null` (never 0/NaN). FR65 does not pin the denominator — this is the story's recorded assumption.
- **No new money path (R-1042):** `acceptedValueOre` is a plain integer öre SUM of the frozen `quote_versions.accepted_price_ore` for the in-window accepted versions; display formats via `formatOreAsKronor` (`@/lib/money`) ONLY. No VAT/ROT/rounding/recompute.
- **Deterministic Europe/Stockholm windows (SETTLED DECISION 6):** `calendarDayIn` was EXPORTED from `follow-up-dates.ts` (not forked) and reused by `resolvePipelinePeriod`; overdue counting calls `classifyFollowUp` verbatim. No `Date.now()` on the pure path (the boundary clock is injected via `deps.now` / captured once).
- **10-3 deferred item CLOSED:** the follow-up tri-state tones are folded into `status.ts` (`FOLLOW_UP_TONE_LABELS/COLORS` + `followUpToneLabel/Color`, mirroring `quoteStatus*`, unknown-key neutral fallback). `FollowUpChip.tsx` + the `QuoteList.tsx` overdue row badge now consume that ONE authority; the bespoke inline rose/amber/blue literals (which byte-duplicated `QUOTE_STATUS_COLORS.lost`) are deleted. Colors byte-preserved so the render is visually unchanged; all `data-testid`s + Swedish text intact.
- **RLS-client-only floor (R-1041):** `quote-pipeline.ts` imports ONLY `createSupabaseServerClient` (the anon-key RLS client) and never a privileged/unscoped client; the structural 10.4-INT-01 assertion greps the source and the cross-tenant proof shows tenant A never sees tenant B's pipeline. Comments deliberately avoid the banned token so the guard scan is honest.
- **No scope growth (AC3):** `manifest.ts` was NOT edited — `widgets: []`, single `/quotes` nav item, `TENANT_TABLES` stays 26; no nav/widget/analytics page/email path. Migration/Coexistence Impact: None (no migration, no table).
- **Unskip-or-delete finalize (HARD GATE):** all 7 ATDD scaffolds are UNSKIPPED and GREEN — no `describe.skip` / `{ skip: true }` / throwing placeholder remains. The RLS/list-filter INT scaffolds' local placeholders were replaced with real imports + the `deps.client` seam; the E2E scaffold was completed with the missing sign-in + a seeded lost quote.

### File List

**New:**
- `src/server/read-models/quote-pipeline-aggregate.ts` (pure aggregation + Europe/Stockholm period helper)
- `src/server/read-models/entitlements.ts` (the `{ data, entitlements }` descriptor projection + conservative resolver)
- `src/server/read-models/quote-pipeline.ts` (the DB read-model — RLS client only)

**Modified (source):**
- `src/features/quotes/follow-up-dates.ts` (export `calendarDayIn` for reuse)
- `src/components/quotes/status.ts` (add the follow-up tone authority)
- `src/components/quotes/FollowUpChip.tsx` (consume the status.ts tone authority; delete inline tones)
- `src/components/quotes/QuoteList.tsx` (row overdue badge consumes the status.ts tone authority; delete inline rose literal)
- `src/features/quotes/read.ts` (non-behavioral `deps.client` injectable seam on `readQuoteList`)

**Modified (tests):**
- `tests/unit/server/read-models/entitlements.test.ts` (green: real imports, unskipped — 10.4-UNIT-01)
- `tests/unit/server/read-models/quote-pipeline-aggregate.test.ts` (green: real imports, unskipped — 10.4-UNIT-02)
- `tests/unit/components/quotes/follow-up-tone.test.ts` (green: real imports, unskipped — tone authority)
- `tests/integration/rls/quote-pipeline-read-model.rls.test.ts` (green: real `readQuotePipeline` via `deps.client`, unskipped — 10.4-INT-01)
- `tests/integration/features/quotes/quote-pipeline-list-filters.int.test.ts` (green: real `readQuoteList` via `deps.client` + mixed two-tenant fixture, unskipped — 10.4-INT-02)
- `tests/integration/features/quotes/quote-pipeline-non-scope-guard.int.test.ts` (green: unskipped — 10.4-INT-03)
- `tests/e2e/quotes/quote-pipeline-consistency.e2e.spec.ts` (green: sign-in wired + unskipped — 10.4-E2E-01)
- `tests/e2e/global-setup.ts` (seed a dedicated already-lost pipeline quote + expose `pipelineLostQuote`)

**Modified (tracking):**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (10-4 → review)

### Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-19 | 0.1 | Story context created (ready-for-dev) — first `src/server/read-models/**` pipeline read-model with the `{ data, entitlements }` contract + the sensitive-field withholding MECHANISM (conservative single-role `tenant_admin` default, N-4 gated); pure event-sourced aggregation (sent/accepted/lost counts, hit rate = accepted/(accepted+lost) with zero-decided⇒null, open/overdue follow-up counts, öre-derived accepted value via `@/lib/money`); deterministic Europe/Stockholm period windows (reusing the 10.3 date discipline); the list/detail "render consistently" pass that folds the 10.3 follow-up chip + overdue-badge tri-state tones into a shared `status.ts` primitive (the named 10-3 deferred item); no new nav/widget/analytics/email surface; NO new migration/table (TENANT_TABLES stays 26). |
| 2026-07-19 | 1.0 | Implemented (→ review). New `src/server/read-models/{quote-pipeline-aggregate,entitlements,quote-pipeline}.ts` — the pure aggregation + the `{ data, entitlements }` descriptor projection (conservative `tenant_admin` resolver, `[gated: N-4]`) + the RLS-client-only DB read-model. `calendarDayIn` exported from `follow-up-dates.ts` for the pure period helper. The 10-3 deferred follow-up tones folded into `status.ts` (`FOLLOW_UP_TONE_*` + `followUpTone*`), consumed by `FollowUpChip.tsx` + the `QuoteList.tsx` overdue badge (inline literals deleted, colors byte-preserved). Non-behavioral `deps.client` seam added to `readQuoteList`. ALL 7 ATDD scaffolds unskipped + green: 21 UNIT (10.4-UNIT-01/02 + tone), INT 10.4-INT-01/02/03, E2E 10.4-E2E-01 (global-setup seeds a dedicated lost pipeline quote). Full regression: 782/782 INT, 40/40 quote E2E, 1517/1518 unit (1 unrelated pre-existing 9.2 golden fixture). `manifest.ts` untouched (TENANT_TABLES 26); no migration/widget/nav/email path. |
