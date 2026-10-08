---
title: 'Story 19.1: Dashboard Framework and Live Quote Pipeline'
type: 'feature'
story_id: '19.1'
sprint_key: '19-1-widget-registry-and-dashboard-framework'
created: '2026-10-07'
status: 'done'
phase: 'Phase B / Legacy Parity Release'
baseline_revision: 'b8ccf1575ae94b33487470a08899f10022a8c3dc'
baseline_ref: 'origin/main'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - 'AGENTS.md'
  - '_bmad-output/project-context.md'
  - '_bmad-output/planning-artifacts/prd-phase-b.md'
  - '_bmad-output/planning-artifacts/epics-phase-b.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - '_bmad-output/planning-artifacts/ux-design-specification-phase-b.md'
  - 'docs/planning/saas-rebuild-phased-plan-2026-06-07.md'
  - 'docs/planning/post-phase-a-plan-2026-07-08.md'
  - 'docs/process/review-order.md'
  - 'docs/process/agent-model-routing.md'
  - 'docs/process/local-setup.md'
  - 'docs/quality/ci.md'
deferred: []
---

<intent-contract>

## Intent

Dashboard-entitled users currently receive an operational landing page without the shipped Epic 10 pipeline. Deliver a manifest-governed dashboard framework and its first real widget, `Offertpipeline`, using the existing quote lifecycle read-model. This bounded slice can proceed alongside Epic 14 because it has no person, booking, conflict, scheduling, time, or job-depth dependency.

The current owner-approved bounded intent is framework plus live E10 quote pipeline in 19.1; follow-ups and scheduling/job/time widgets remain in 19.2. The canonical epic/PRD amendments are prepared, and independent High spec review passed on 2026-10-07 with no material tenant, permission, money, failure, or scope blocker. This contract is ready for development through the normal single-story route after the configured execution base contains this planning package and isolated ownership/preflight checks pass. No additional owner confirmation is required for this routine promotion. Planning readiness does not mark implementation complete or complete Epic 19. Launch only this reviewed story by its explicit spec path; never launch the entire Epic 19 as a consequence of this slice.

## Capabilities

- **CAP-1 — Governed framework**
  - **intent:** A dashboard user can see the operational widgets supported by active modules and their permissions.
  - **success:** The rendered widget set equals the eligible active manifest × registry × permission intersection; unknown, duplicate, missing, orphan, or pending widget registrations fail the coherence gate.
- **CAP-2 — Live pipeline**
  - **intent:** A quote-entitled user can understand sent, accepted, and lost activity and the decided-deal hit rate over the displayed period.
  - **success:** `Offertpipeline` matches the existing E10 aggregation over real RLS-scoped data, names its period and rate denominator, and offers one valid deep link to `/quotes`.
- **CAP-3 — Honest money**
  - **intent:** A user receives pipeline accepted value only when the server grants that sensitive field.
  - **success:** Withheld `acceptedValueOre` is absent from every browser-bound data representation and listed in `entitlements.withheld`; its card renders the existing UX masking contract without a zero/null substitute.
- **CAP-4 — Honest load and recovery**
  - **intent:** A user can distinguish loading, successful empty activity, loaded activity, and unavailable pipeline data, and retry a failed read.
  - **success:** A query or aggregation fault produces a generic card-local error with retry, never fresh zero metrics; onboarding and the dashboard heading remain usable.

## Boundaries & Constraints

**IN:** The framework, registry/coherence tests, responsive `WidgetCard`, fixed role defaults, live quote pipeline presentation, and the narrowly necessary result-bearing quote read path. Cover FR65 consumption, FR107–108 and the framework portion of AC-B1b-8; do not claim full AC-B1b-8 widget parity.

**Always:** Use the current server-resolved role set and request-bound RLS client; apply both `Dashboard.View` and the widget's existing `Quotes.View` capability before loading quote data. Read the sensitive-field matrix through the existing entitlement seam. Preserve dynamic request rendering and the onboarding checklist/reminder/hidden states. Register exactly one widget, `quote-pipeline`, on its already-active producing module `quotes` in the same PR. Dashboard remains the already-active framework module; do not rewrite its Phase A activation history or activate a pending module.

**Block If:** A missing source requires E14/E15/E16 changes, a new table/RPC/view/policy/dependency, a new permission grant, a tenant selector, or an unapproved money rule. Bring the concrete requirement back to the coordinator before expanding scope. Failure signaling in the existing reader is an identified in-scope prerequisite, not a reason to fabricate zero data.

**Never:** Use an admin/service client; accept client roles or `moneyEntitled` as authority; deliver withheld fields then hide them with CSS; cache a tenant result across requests/users; read pending-module data; create placeholder/disabled/coming-soon cards; change role landings; create a dashboard preference store; create quote/follow-up mutations.

## Non-goals

- `Uppföljningar` list/quick-complete and its due/overdue content; it remains 19.2 despite its E10 source already existing.
- Bookings, conflicts, active-job depth, reported/expected time, any E14 person/booking/RPC changes, `/my-day`, and E16–18 workspace changes.
- All Phase C ledger exclusions, analytics expansion, custom filters/date-picker, user widget customization, charts beyond the existing count/rate/value summary, realtime subscriptions, periodic polling, or background producers.
- New schema, migration, grants, role catalog/matrix policy, tax/VAT/ROT/rounding behavior, external integrations, deployments, or demo data changes.

## Success signal

A reviewed 19.1 implementation shows one live, tenant-isolated pipeline card to eligible roles; preserves the existing onboarding and landing behavior; excludes pending and unentitled surfaces; and visibly recovers from a failed load without claiming empty data. Tests demonstrate the browser payload entitlement boundary, source consistency, and card-local failure isolation. Remaining widgets and full Epic 19 completion stay pending.

</intent-contract>

## Current Source Evidence and Prerequisites

Planning inspection only, 2026-10-07. `origin/main` resolved to `8cc2d192672e80b8a2dd2e3925997ce8988a13b1`; the planning checkout HEAD was `647cb4c17418aac094edf4197f3bc244d49eae7b`. A read-only diff against origin/main showed no differences in the inspected dashboard page, quote reader/aggregate/projection, or permission matrix. Re-resolve and inspect the baseline before implementation; these hashes are provenance, not a forever-frozen execution base.

| Prerequisite | Exact source evidence | Dispatch implication |
| --- | --- | --- |
| Active quote and dashboard modules | `src/scope/manifest.ts`, module IDs `quotes` and `dashboard`, both active, current widget arrays empty | Add only `quote-pipeline` to `quotes.widgets`; no pending-module activation |
| Pipeline source exists | `src/server/read-models/quote-pipeline.ts`, `readQuotePipeline`, reads quote_events, quote_acceptances, quote_follow_ups and latest quote_versions through createSupabaseServerClient | Reuse its queries, pagination, aggregation and projection; zero migrations |
| Failure information is missing | Same reader: query-error returns call projectWithEntitlements(emptyAggregate(...)); catch also returns emptyAggregate; PipelineDescriptor has no load status | Add an explicit result-bearing read entry before wiring the card. A wrapper around current zeros cannot reconstruct failure |
| E10 semantics are pinned | `quote-pipeline-aggregate.ts`, aggregateQuotePipeline, resolvePipelinePeriod; `tests/unit/server/read-models/quote-pipeline-aggregate*.test.ts` | Retain distinct-version event counts, accepted/(accepted+lost), null when no decided deals, and Stockholm period logic |
| Money source/projection exists | `quote-pipeline.ts`, accepted_price_ore read from quote_acceptances; `entitlements.ts`, projectWithEntitlements | Display frozen accepted commitment, including adjusted accepted price; do not substitute frozen sent total |
| Actual current grants | `src/server/authz/permission-matrix.ts`, PERMISSION_MATRIX.dashboard / .quotes and SENSITIVE_FIELD_MATRIX.quotes.acceptedValueOre | Widget capability and money entitlement are separate; preserve current grants exactly |
| Per-request authority exists | `resolve-tenant-context.ts` / core, membership_roles resolution; `src/components/app-shell/RouteAccessBoundary.tsx`; dashboard layout | Independently resolve/check dashboard reads; do not assume a wrapping layout prevents all descendant reads |
| Dashboard states exist | `src/app/(app)/dashboard/page.tsx`, readOnboardingChecklist and showChecklist/showReminder branches; `src/server/read-models/onboarding-checklist.ts` | Checklist/reminder/hidden states and fail-hidden onboarding semantics remain unchanged |
| Isolation and presentation baselines exist | `tests/integration/rls/quote-pipeline-read-model.rls.test.ts`, role-aware-phase-a-surface.atdd.int.test.ts; `tests/e2e/auth/role-aware-phase-a-surface.atdd.e2e.spec.ts`; first-admin-checklist.e2e.spec.ts | Reuse existing negative cases and add proof for the new browser-bound path |
| Widget registry is still a gap | `src/scope/manifest-schema.ts`, validateManifestCoherence currently checks declared widget duplicate/pending surfaces but has no actual registry input | Explicitly validate registry-to-manifest equality and capability coherence; existing manifest-only checks cannot prove registration completeness |

The owner-approved bounded intent, prepared canonical 19.1/19.2 split, and passed independent High spec review support ready-for-dev promotion. Before dispatch, the coordinator must verify that the configured execution base contains this planning package, launch only the preserved 19.1 sprint key/spec, retain the configured checkpoint choices, and pass isolated-worktree ownership/preflight checks including reservations for the shared manifest/coherence seams. The recorded source-inspection baseline above remains historical evidence; it is not the implementation launch base. No product tests, local services, browser run, migration run, or implementation code review were executed while authoring or promoting this document.

## Data, Entitlement, and Failure Contract

### Existing pipeline semantics

1. Use the default `resolvePipelinePeriod(now)` trailing 12-calendar-month window, inclusive `from`/`to` in Europe/Stockholm. Show actual resolved dates; no new date arithmetic or period controls.
2. `Skickade`, `Accepterade`, `Förlorade` count distinct versions with the corresponding in-window lifecycle event, not the current quote/version status. Historic events survive later lifecycle changes.
3. Label hit rate `Träffgrad`; disclose `Accepterade / (accepterade + förlorade)`. No decided deals renders `Ingen träffgrad ännu`, not 0%. Rate formatting is presentation only.
4. `Accepterat värde` sums frozen `quote_acceptances.accepted_price_ore` for accepted versions in the period, using existing integer-öre logic and `formatOreAsKronor`. No new money arithmetic. Legitimate entitled zero is allowed only after a successful read.
5. Existing open/overdue follow-up counts may remain internal to the shared E10 reader. Do not expose them in this card's browser DTO or render a second follow-up card. Preserve the existing latest-terminal-status exclusion and its tests.
6. A successful empty period means no sent/accepted/lost activity in that period. State `Inga offerthändelser under perioden`; valid zero counts and the null-rate message may accompany it. Unentitled money must still be absent. No-data-for-this-period does not assert the tenant has no quotes.

### Roles and server selection

| Current role set | Framework | quote-pipeline | acceptedValueOre in card data |
| --- | --- | --- | --- |
| tenant_admin | Allowed | Present | Present |
| projektledare | Allowed | Present | Present |
| saljare | Allowed | Present | Absent + listed withheld |
| montor | Allowed current landing fallback | Absent; no quote query | No quote data |
| ekonomi | Allowed | Absent; Quotes.View is not granted | No quote data despite separate money entitlement |
| Multi-role / unknown input | Existing normalizeRoles and union of valid roles | Capability union, deduplicated one card | Sensitive-field union; unknown/omitted roles fail closed |

This table documents the current code-owned matrix; it does not replace that matrix with client policy or new role grants. With one eligible widget, all eligible role defaults place it first in the same span. Ineligible roles see the preserved operational landing copy and applicable onboarding; no locked placeholder widget and no false empty quote totals. Preserve the current `/dashboard` landing, including Montör until E15 changes it.

After the server resolves its current tenant membership and role set, it selects active registered widgets using existing `resolveCapability`. Only then call eligible readers. Retry repeats that authority resolution; a revoked role or stale session must not retain earlier access or values. Client islands receive only filtered widget presentation data and projected result data, never the matrix, role set, raw accepted rows, or a caller-controllable entitlement override. Counts being non-money in the E10 descriptor does not grant access to the quote widget.

### Result-bearing reader seam

Add `readQuotePipelineResult` in `src/server/read-models/quote-pipeline.ts`, backed by the same query/aggregation core as `readQuotePipeline`; do not duplicate the queries in a dashboard reader. Its public success is a projected descriptor plus the server completion instant; failure is a discriminated generic error carrying no descriptor/metrics/money/raw SQL/stack. Exact TypeScript naming may follow project Result conventions, but success and failure must be structurally distinguishable.

Keep the existing exported `readQuotePipeline` signature and its historical empty-descriptor fallback compatible for its current callers/tests. The dashboard must use the new result-bearing entry and never use that compatibility fallback to decide its state. Update outdated reader comments to distinguish the two paths.

Every failed page/batch, client construction or query exception, malformed clock/period, and unsafe aggregation/öre failure on the dashboard path must yield unavailable data. A partial successful query sequence cannot yield partial totals or fresh zeros. Keep existing bounded pagination/chunking intact, including faults beyond the first page/batch. The dashboard result's value must be projected before it crosses any client boundary.

Do not add a preflight health query: it cannot prove the later data reads succeeded. Do not inspect metric values to infer failure. If an expected money field is absent but not listed as withheld, reject the malformed presentation descriptor as unavailable rather than filling in zero. Preserve actual money validation; unsafe or malformed money cannot be treated as a fresh accepted-value total. Retain source integrity constraints and distinguish synthetic malformed fixtures from reachable database states in evidence.

### Widget state contract

| State | Card behavior | Freshness/recovery |
| --- | --- | --- |
| Loading | Title and accessible skeleton; no fabricated numeric placeholders | Reserve useful dimensions; no success timestamp |
| Loaded | Period, counts, hit rate and permitted accepted value | `Hämtad <time>` records server read completion, not source mutation time or realtime freshness |
| Successful empty | Meaningful period-specific explanation, null-rate copy; no invented activity | Success completion stamp allowed |
| Failed | `Kunde inte läsa offertpipeline` plus `Försök igen`; no metrics/amounts | No fresh success stamp; no last-known-value cache in this slice |
| Withheld field on success | Lock + `Dold`; tooltip/long-press `Din roll ser inte belopp`; SR `Dolt för din roll` | Never stringify, format, or substitute absent money |
| Ineligible widget | No card or skeleton and no reader invocation | No unauthorized deep link or query |

The shared card has a title, content/state, one primary deep link `Visa offerter` to the existing authorized `/quotes`, and a separate retry control on failure. Retry must request a fresh server read with current authority (for example the repository's route-refresh pattern), announce loading/result accessibly, and remain safe under repeated clicks. Framework isolates a failed card so it does not replace the page or disrupt onboarding. Test isolation using injected card outcomes; do not ship a second fake widget solely to prove the framework.

## Registry and UI Contract

- Concrete widget ID is `quote-pipeline`; sole owner module is `quotes`; required capability is `Quotes.View`. Derive the runtime eligible IDs from the active manifest union, then map IDs to server-approved loaders, presentation components and deterministic role defaults.
- The registration key set must equal the active manifest widget union. A registration without a declared active producer, a declared ID without implementation, duplicate ownership/registration, a capability missing from its producing module's matrix, or platform-scoped widget masquerading as tenant content fails loudly in the pure coherence/unit gate. Keep existing duplicate/pending/orphan checks and fail-closed runtime eligibility.
- Validate the actual component/loader registration set, not a second hardcoded list that can drift independently. Pending-module widget fixtures fail; no registry entry for later widgets is shipped now.
- Use a 12-column desktop grid that stacks to one column on small screens; the single pipeline card occupies a useful full-width row in this slice. Include 360×640, tablet and desktop layout checks. No drag/drop, saved layouts or settings.
- Keep dashboard heading, Swedish operational introductory copy, and onboarding above the grid. The exact checklist condition remains visible + not workingState + not dismissed; reminder remains visible + not workingState + dismissed; otherwise both hidden. Preserve terms warning, dismiss/restore persistence and first-admin authorization. One widget fault must not change those states.
- Reuse existing shared styles/components; a new `WidgetCard` or `MaskedValue` must implement the binding UX contracts without copying Lovable source. No new component library/dependency.

## Ownership and Code Map

Implementation is independently owned from Epic 14. The coordinator reserves every shared path below before dispatch; a worker is not alone and must preserve other stories' edits.

| Ownership | Concrete paths / responsibility |
| --- | --- |
| 19.1 implementation owner | `src/app/(app)/dashboard/page.tsx`; new `src/components/dashboard/DashboardGrid.tsx`, `WidgetCard.tsx`, `QuotePipelineWidget.tsx`, `DashboardRetry.tsx`; new `src/server/read-models/dashboard.ts`; new `src/scope/widget-registry.ts` |
| 19.1 bounded shared reader amendment | `src/server/read-models/quote-pipeline.ts`: result-bearing entry/shared core; preserve current exported wrapper and E10 semantics. `quote-pipeline-aggregate.ts` and `entitlements.ts` remain reused authorities, not replacement implementations |
| Coordinator-serialized scope seam, included in this story's PR | `src/scope/manifest.ts`: exactly `quotes.widgets = ["quote-pipeline"]`; `src/scope/manifest-schema.ts`: necessary actual-registry coherence integration; existing coherence/derivation tests touched only as necessary. Worker supplies proposed minimal diff; coordinator sequences it with E14 |
| Shared primitive only if no reusable component exists | New `src/components/ui/MaskedValue.tsx` (confirm exact directory convention first); coordinator explicitly reserves it before creation; no global redesign |
| 19.1 new test ownership | `tests/unit/scope/widget-registry.test.ts`; `tests/unit/server/read-models/quote-pipeline-result.test.ts`, `dashboard.test.ts`; `tests/unit/components/dashboard/widget-state.test.ts`; `tests/integration/rls/dashboard-pipeline.rls.test.ts`; `tests/e2e/dashboard/dashboard-pipeline.e2e.spec.ts` |
| Existing regression tests; coordinate before edits | `tests/integration/rls/quote-pipeline-read-model.rls.test.ts`; `tests/integration/rls/role-aware-phase-a-surface.atdd.int.test.ts`; `tests/e2e/auth/role-aware-phase-a-surface.atdd.e2e.spec.ts`; `tests/e2e/onboarding/first-admin-checklist.e2e.spec.ts`; fixture support only if a required role/state is missing |
| Explicitly outside worker ownership | E14 specs, migrations, persons/bookings/conflict RPCs, scheduling/time/jobs-depth code; permission-matrix grants, tenant-table inventory, global nav/shell, onboarding read/commands/components. Coordinator owns epic/PRD, sprint and launch metadata |

`src/app/(app)/dashboard/layout.tsx` and `RouteAccessBoundary` are reviewed integration boundaries, not permission substitutes or planned rewrites. If required implementation names differ after context inspection, record the ownership amendment before editing instead of silently widening globs.

## Tasks and Acceptance Criteria

1. Inspect/reconfirm current baseline and shared-path reservations; capture sensitive route `gpt-6.1-sol / high` for implementation and the money/tenant independent review. Use ordinary Low only for non-sensitive supplemental review scopes.
2. Add/test the shared result-bearing quote reader entry and compatible existing wrapper before card wiring; preserve RLS-only reads and existing source/date/money logic.
3. Define/test actual registry completeness, active ownership and capability coherence; submit/coordinate the one-ID manifest enrollment in the same story PR.
4. Add dashboard server selection/projection, reusable card/grid and live pipeline presentation; preserve onboarding and dynamic landing behavior.
5. Exercise acceptance/failure/role/tenant/layout cases and refresh implementation-author review trail from final code/evidence.

| AC | Given / when | Required outcome |
| --- | --- | --- |
| AC19.1-1 | Current active manifest and actual registrations are resolved | Exactly one declared pipeline widget; equality/coherence checks reject missing/orphan/pending/duplicate/unknown-capability cases; no later placeholders |
| AC19.1-2 | Each current seed role, unknown/empty roles and multi-role sets request dashboard or retry | Authority is resolved server-side; eligible admin/PL/säljare see one card; Montör/Ekonomi make no quote-widget read; no unknown-role access; existing landing retained |
| AC19.1-3 | Same period contains sent/accepted/lost history, repeated events, a superseded version and adjusted acceptance | Card equals existing pure aggregate, rate denominator is explicit, default dates are Stockholm-resolved, and accepted value uses accepted commitment |
| AC19.1-4 | Säljare versus entitled admin/PL receives serialized card data | Säljare amount key absent + withheld; no value in HTML/RSC/client props or hidden attributes; Dold contract accessible. Entitled zero remains distinguishable from withholding/failure |
| AC19.1-5 | Successful empty/zero-decided period, including tenant A with tenant B-only data | Period-specific empty explanation and null-rate copy; no tenant B values or identity; no inference that all tenant quotes are absent |
| AC19.1-6 | Each query stage, later page/batch, client/query throw, malformed clock/period or unsafe aggregate fails | Generic card-local error/retry, no fresh zeros or partial values, no raw detail; sibling framework/onboarding remains usable; legacy reader compatibility retained |
| AC19.1-7 | Retry succeeds, repeatedly fails, or role/session is revoked before retry | Current authority is checked again; accessible loading then server-confirmed result; no stale success timestamp or retained unauthorized value; multiple clicks do not create side effects |
| AC19.1-8 | Checklist undismissed, dismissed, completed, non-admin/invisible or onboarding read failure | Existing checklist/reminder/hidden behavior, terms warning and dismiss/restore persist; pipeline success/failure does not alter it |
| AC19.1-9 | Keyboard, screen reader and 360×640/tablet/desktop viewports | Title/content/link/retry/mask reachable; no overflow; skeleton/resolved states fit grid; one authorized deep link; completion timestamp says read time without realtime claim |

## Verification Plan

No verification claim is made by this planning artifact. Use isolated synthetic local fixtures with per-run UUIDs and current repository harnesses; never target demo.

| Evidence | Cases / AC coverage | Limits to record |
| --- | --- | --- |
| Pure unit: widget-registry.test.ts + existing manifest suites | Real registration set equals active union; pending, orphan, missing, duplicate, capability and role-union negatives (AC1/2) | Synthetic matrix/manifest fixtures supplement real set; test actual production selector too |
| Reader-result unit with paginated injected client | Every stage and later-page/batch fault, thrown exceptions, empty success, aggregate overflow/invalid date, wrapper compatibility (AC3/5/6) | Fake query transport does not prove RLS; reuse E10 aggregate/projection tests |
| Dashboard server/projection unit | No loader invoked for ineligible role; server role resolver use; withheld key absence and allowlisted browser DTO; error has no values (AC2/4/6/7) | Serialization tests must inspect real DTO, not a parallel example |
| Card state/presentation unit | Successful empty vs error vs null-rate vs entitled zero vs withheld; freshness stamp; isolated failure (AC4–9) | Browser proof still required for hydration/focus/layout |
| Local DB/RLS dashboard composition | Tenant A/B isolation through actual new result entry and adapter; Säljare withheld money; Montör/Ekonomi no quote result; spoofed role/tenant input cannot widen access (AC2/4/5) | Use request-authority seam, actual authed client and existing role harness; no privileged app reads |
| Production-server Playwright | Live seeded aggregate vs card, primary deep link, all-role visibility, payload/HTML absence, retry recovery plus revocation, checklist regression, mobile/keyboard states (AC2–9) | Server-read fault injection must reach the real result path. Browser request interception alone does not prove server-side DB failure |
| Existing E10/E11/E12 regression suites | Pipeline aggregation/projection/read-model RLS, role-aware route/landing, onboarding dismiss/restore/completion | Record executed/skipped counts; skipped cases are not evidence |

Focused unit commands use the existing Node test runner/import hook. After focused evidence, required project gates remain `pnpm typecheck`, `pnpm lint`, `pnpm run test:unit`, `pnpm build` and existing source/built-bundle containment checks; use CI's required install/audit/lockfile checks and authoritative ordering. Local integration runs set `SUPABASE_TEST_REQUIRED=1` and execute both new composition coverage and relevant existing pipeline/role suites. Run Playwright with its configured production web server, never `next dev`. CI still owns full DB/migration/inventory gates even though this story adds no migration.

Start any needed managed local stack/webserver through the resource guard per `docs/process/local-setup.md`; stop its owned lifecycle IDs when finished. Report actual revision/worktree state, commands, outcomes and executed/failed/skipped counts. Browser fault testing may use a contained injected dependency seam in the repository harness; do not add production env switches, a publicly callable fault endpoint, or broad unguarded test hooks. If a necessary browser fault case cannot run, report the precise evidence gap rather than claiming AC6/7 passed.

## Planned Review Concerns

These are planning guidance, not a completed `Suggested Review Order`. The implementation author must create exactly one final author-written section per `docs/process/review-order.md` and `_bmad/custom/review-order-template.md` after code and verification exist, using verified final line stops and actual evidence. Do not invent line numbers or paste an empty final heading now.

1. **Operational entry and preserved onboarding:** dashboard page/grid/card, checklist conditions and role-default eligibility; verify empty and unavailable remain distinct.
2. **Trust and money boundaries:** dashboard server authority, actual active registry, result-bearing RLS read, projection before browser serialization and shared integer-öre source.
3. **Failure and evidence:** each page/batch error path, compatible legacy reader, retry reauthorization and observed freshness; map ACs to meaningful executed assertions and state mocked/skipped limitations.

## Planning Decisions, Assumptions, and Validation Record

- **Decision:** Current owner-approved bounded intent/split is the source authorization; canonical epic/PRD amendments are prepared, independent High spec review passed, and this spec is ready-for-dev. Launch remains subject to the configured base containing the package and isolated ownership/preflight. No full-epic dispatch or completion.
- **Decision:** Preserve current code-owned capabilities and acceptedValueOre entitlement. Säljare masking and Ekonomi exclusion follow source code, not a newly inferred grant.
- **Decision:** A new result-bearing reader entry is necessary because current query failure is indistinguishable from empty data; retain the old public wrapper for compatibility and share core queries.
- **Reviewed bounded presentation assumption:** Default trailing-year period, explicit current decided-deals hit-rate formula, fixed full-width one-card layout and read-completion timestamp are the smallest supported presentation of E10/UX; no new business metric or numeric freshness SLA.
- **Open implementation detail:** Locate any shared MaskedValue/style primitive and an appropriate contained browser server-read fault seam. Resolve by repository inspection; coordinate reservations if a new primitive/shared fixture edit is needed.
- **Blocker policy:** If a new permission policy, schema/RPC or E14 prerequisite proves necessary, stop dependent implementation and ask one concise scope question with evidence; continue independent work.
- **Format/provenance:** The caller explicitly required the project's single-file sprint-style implementation spec. Apply bmad-spec's five-field kernel and coherence/preservation sweeps here; do not claim a canonical folder SPEC/memlog workflow or generate extra files outside assigned ownership. Resolved configuration is English/ElproSaas; activation hooks empty. Customization carries review-order as planning guidance.
- **Independent spec review (2026-10-07):** Independent gpt-6.1-sol / High reviewer reported no material tenant-isolation, permission, money, failure-semantics, or scope blockers. This is planning-contract review only; it does not claim implementation review, executed tests, or a product verification result. The implementation review-loop count remains 0.
- **Coherence sweep:** CAP-1–4 each have intent/success; constraints rule out concrete alternatives; non-goals and testable signal explicit; source gaps and assumptions recorded. This is a planning self-check, not independent approval.
- **Preservation sweep:** The approved split, independent E14 lane, exact existing dashboard states, active-only manifest governance, role defaults, no placeholders, quote source/withholding/failure details, ownership/coordinator seams, review-before-dispatch and required evidence are represented above. Wrapper-only skill ceremony is omitted; no product evidence invented.

## Execution Routing

- Implementation: gpt-6.1-sol / high, context-free child; actual permission, tenant and accepted-money projection boundaries require High. Selected before dispatch on 2026-10-07. Parent session unchanged.

## Implementation Snapshot and Verification

Implementation author: Story 19.1 implementation delegate (gpt-6.1-sol / High), 2026-10-07. Product changes are uncommitted in the dedicated `C:/Users/Rasmus/.codex/worktrees/story19-1-dashboard/ElproSaas` working tree based on verified HEAD `b8ccf1575ae94b33487470a08899f10022a8c3dc`. Required DB/browser evidence and independent implementation review are incomplete; this is a verification checkpoint, not a completed story.

Recorded implementation choices:

- The result-bearing reader shares the existing query/pagination/aggregate/projection core. Its strict clock/period and accepted-money conversion rejects malformed input; the historical exported reader retains its descriptor fallback. No query duplication, health probe, money rule, migration, grant or dependency was added.
- The actual registry has one loader/presentation registration. The coordinator approved the serialized one-ID quotes manifest enrollment and structural actual-registry validator input. Runtime selection applies both current Dashboard.View and Quotes.View before any quote loader. Fixed eligible defaults use the same first full-width row.
- The dashboard adapter resolves authority on every invocation and allowlists period/count/rate/projected-money fields. Current sensitive-field authority is checked again at the browser DTO boundary, and error results are sanitized. Follow-up counts, raw rows, roles and matrices do not enter client props.
- A card-local mask was approved instead of adding a shared UI primitive. It supports focus/hover, keyboard dismissal and a 450ms touch hold. Existing Zinc/Tailwind and restrained admin-page conventions were reused; the generic frontend skill's other-project DESIGN.md/Figma paths do not exist here.
- The page preserves the original onboarding conditions/copy and dynamic rendering. Eligibility precedes a streamed loading fallback; retry uses the existing route-refresh pattern and shows loading without retaining values or completion time.
- Ownership amendment approved: new `tests/e2e/dashboard/playwright.config.ts`, `read-plan.ts`, `server-read-proxy.mjs`, `setup.ts`, and `teardown.ts`. The dedicated config consumes an already running server. The loopback-only proxy faults/holds actual PostgREST reads for synthetic JWT subjects via ignored filesystem plans; it has no HTTP control API or production source switch. Browser timestamps use real read-time bounds; deterministic clock/period/completion proof remains in units.

Executed against this working tree:

| Command | Outcome |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed, unchanged lockfile |
| `pnpm run verify:lockfiles` | Passed |
| `pnpm audit --audit-level=high` | Passed threshold; 2 moderate advisories, no high/critical |
| `pnpm run verify:service-role-containment` | Passed |
| `pnpm typecheck` | Passed |
| `pnpm lint` | Passed; 0 errors, 13 existing warnings outside new code |
| Focused Node command over widget-registry, quote-pipeline-result, dashboard and widget-state suites | 88 passed, 0 failed, 0 skipped |
| `pnpm run test:unit` | 2,037 total; 2,036 passed, 0 failed, 1 pre-existing Linux-xattrs skip |
| `pnpm build` with private isolated app environment and proxy public URL `http://127.0.0.1:37921` | Passed; dashboard remains dynamic |
| `pnpm run verify:bundle-containment` | Passed against that final production build |
| `node --check tests/e2e/dashboard/server-read-proxy.mjs` | Passed |
| `pnpm exec playwright test --config tests/e2e/dashboard/playwright.config.ts dashboard-pipeline --list` | Collected 48 enabled tests; 0 browser assertions executed |
| `git diff --check` | Passed |

The final broad gates cover product behavior through the calendar-clock and accessible-mask edits. Subsequent changes only reconcile validator comments and add the missing role-bearing member in a browser fixture; a final typecheck covers that fixture amendment. Earlier builds are superseded by the proxy-bound final build.

Required integration/RLS and Playwright executions: **not run** (0 executed; no skipped-suite coverage claim). Root resource support reported `HOOK_CONTEXT_UNAVAILABLE`; no stack, proxy, app server or browser was launched by this delegate. The ignored private runtime preparation is not service readiness or migration evidence. No demo data/environment was used. The harness, hydration, focus/long-press, live RLS projection, retry/revocation and responsive/onboarding compositions remain unverified until guarded resources are ready. An author reconciliation and independent review remain required after that execution/fixes.

## Required Verification Continuation

The root owns the resource guard lifecycle and uses its exact latest trusted context after a fresh actor hook. Read the private runtime `tmp/private/story19-runtime/HANDOFF.md`; do not print private environment values. Required endpoints: isolated Supabase API `127.0.0.1:56421`, PostgreSQL `127.0.0.1:56422`, test-only proxy `127.0.0.1:37921`, production app `127.0.0.1:3201`. No resource IDs exist for this delegate.

1. Complete root's guarded Compose admission/readiness and SQL-only migration/inspection steps from that handoff.
2. Use the private test environment in the same PowerShell process and set `SUPABASE_TEST_REQUIRED=1`. Run:
   `pnpm exec vitest run tests/integration/rls/dashboard-pipeline.rls.test.ts tests/integration/rls/quote-pipeline-read-model.rls.test.ts tests/integration/rls/role-aware-phase-a-surface.atdd.int.test.ts`.
3. Root launches the proxy under its guard with command arguments:
   `node tests/e2e/dashboard/server-read-proxy.mjs --upstream http://127.0.0.1:56421 --port 37921 --control-root tests/e2e/.auth/dashboard-control`.
   Use this worktree as cwd. The proxy tolerates the not-yet-created control directory.
4. Root launches the production server under its guard from the same cwd: load private app environment; set `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:37921`; consume the matching final build; `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3201`. If source/config changes invalidate the build, rebuild with those same public values first.
5. With approved browser-process ownership, private app/test environment, `E2E_PORT=3201` and `SUPABASE_TEST_REQUIRED=1`, run `pnpm exec playwright test --config tests/e2e/dashboard/playwright.config.ts`. This includes the new 48-case suite plus existing role-aware landing and first-admin checklist regression. Its config does not launch a web server.
6. Record executed/failed/skipped counts and fix actual failures. Refresh this same authored review section, then obtain independent High implementation review. Root stops its resource IDs through the guard; preserve runtime volumes/config and keep 19.2/Epic 19 incomplete.

## Suggested Review Order

Author: original Story 19.1 implementation delegate (gpt-6.1-sol / High), with the verification/fix delegate (gpt-6.1-sol / High) owning the guarded-browser, payload-capture, query-fault, responsive-header and Round 1 corrections. Phase 6 test author (gpt-6.1-sol / High) owns the appended overlap and successive-retry rationale below.
Reconciled against final implementation commit `7ee80eeda329bc84e99c860c22a1670b1cd8f58c`, including the narrow Round 2 responsive patch, plus this spec-only provenance refresh, 2026-10-07. Review the full original implementation from `b8ccf1575ae94b33487470a08899f10022a8c3dc`; original recorded rationale is retained. Historical Round 1 evidence is preserved; Phase 6 and Round 2 evidence are recorded below. CI-specific stops are refreshed against reviewed scheduling commit `1ecb193ad065332c5b48aa59717b67bc20a57c50`, retaining the earlier dashboard cwd repair `4bb0b3f76f240f748b44e249c192e88d25064d53` and widget-inventory repair `f997370d41238b89dca68b122d022ddcbf352a25`, plus this spec-only evidence reconciliation, 2026-10-08.

### Operational entry and usable explanations

The original author retained the heading/copy and onboarding branches, placing the full-width card beneath them; live verification required a reserved phone header correction retaining controls and tenant identity. Round 1 anchors the profile menu left on phones and right on desktop, treats mask trigger/explanation as one hover region, and listens for Escape while open because hover need not move keyboard focus.

- `src/app/(app)/dashboard/page.tsx:14` — `DashboardPage`: preserves entry and onboarding branches.
- `src/components/app-shell/AppShell.tsx:241` — `min-h-14`: wraps phone controls without losing identity.
- `src/components/app-shell/AppShell.tsx:279` — `sm:left-auto sm:right-0`: keeps the opened profile link within the viewport.
- `src/components/dashboard/QuotePipelineWidget.tsx:31` — `onMouseEnter`: retains hover across trigger and explanation.
- `src/components/dashboard/QuotePipelineWidget.tsx:28` — `document.addEventListener`: dismisses open explanations with Escape regardless of focus.

### Actual registration and the server trust boundary

The coordinator reserved exactly the quotes widget enrollment; dashboard activation history and permission grants stay unchanged. The registry carries actual loader/component functions, while request authority and an explicit browser allowlist prevent roles, follow-ups, raw rows or withheld money from crossing the client boundary.

- `src/scope/manifest.ts:153` — `quote-pipeline`: enrolls the active quotes producer's sole widget.
- `src/scope/widget-registry.ts:10` — `WIDGET_REGISTRY`: registers actual loader and presentation functions.
- `src/scope/manifest-schema.ts:316` — `options.widgetRegistry`: validates equality, ownership and capability coherence.
- `src/server/read-models/dashboard.ts:54` — `browserPipeline`: projects money and server-only fields before serialization.

### Shared source semantics and honest failure results

The spec required a result-bearing entry because the old empty fallback cannot identify failed reads; both exported paths share the original query core. Strict reads reject malformed clocks/money and return no descriptor on stage/page/batch faults, while the original local mask and route refresh avoid retained values and a new shared primitive.

- `src/server/read-models/dashboard.ts:33` — `readDashboard`: resolves authority before eligible loaders.
- `src/server/read-models/quote-pipeline.ts:289` — `readQuotePipelineResult`: returns success only after completed reads.
- `src/server/read-models/quote-pipeline.ts:303` — `readQuotePipeline`: preserves the compatibility descriptor/fallback.
- `src/components/dashboard/QuotePipelineWidget.tsx:46` — `QuotePipelineWidget`: distinguishes loading, empty, loaded and unavailable presentation.
- `src/components/dashboard/DashboardRetry.tsx:9` — `DashboardRetry`: refreshes current authority without retaining local values.

### Required CI partition and contained test transport

Round 1 separates the newly enabled dashboard cases from the ordinary suite because they require their own seeded fixture and actual server-read proxy; the new unconditional CI job owns an isolated stack and both servers. The proxy rejects non-origin-form targets before forwarding; its HTTP400 faults avoid SDK retries consuming multiple planned steps, and page-owned response-stage capture reads actual server bytes then resumes unchanged, failing closed on missing bodies.

- `playwright.config.ts:33` — `testIgnore`: excludes exactly the dashboard spec from ordinary collection.
- `.github/workflows/ci.yml:447` — `dashboard-e2e`: adds the required isolated CI gate.
- `tests/e2e/dashboard/playwright.ci.config.ts:27` — `webServer`: supplies proxy and production app startup for CI.
- `tests/e2e/dashboard/server-read-proxy.mjs:58` — `resolveProxyTarget`: denies invalid targets before plans or upstream requests.
- `tests/e2e/dashboard/dashboard-pipeline.e2e.spec.ts:84` — `Fetch.getResponseBody`: observes actual bytes before unchanged continuation.

### Acceptance evidence and operational limits

Registry negatives cover AC1; DTO/RLS/revocation assertions cover AC2/4/5/7. Reader-result units exercise clock/money validation and every stage/page/batch failure (AC3/5/6), live RLS adds source/batch evidence, and 51 dashboard browser cases plus six existing regressions cover secrecy, failure/retry, onboarding and accessible responsive behavior (AC2–9).

- `tests/unit/scope/widget-registry.test.ts:50` — `19.1-UNIT-001`: checks actual registration against the active manifest.
- `tests/unit/server/read-models/dashboard.test.ts:216` — `19.1-UNIT-004`: asserts DTO allowlist and withheld amount absence.
- `tests/integration/rls/dashboard-pipeline.rls.test.ts:185` — `19.1-INT-004`: exercises seller authority against forged caller properties.
- `tests/unit/server/read-models/quote-pipeline-result.test.ts:360` — `19.1-UNIT-012`: distinguishes explicit failure from compatible fallback.
- `tests/e2e/dashboard/dashboard-pipeline.e2e.spec.ts:165` — `19.1-E2E-003`: checks observed HTML/RSC/DOM for withheld values.
- `tests/e2e/dashboard/dashboard-pipeline.e2e.spec.ts:387` — `steps: 12`: exercises actual pointer passage into the explanation.
- `tests/e2e/dashboard/dashboard-pipeline.e2e.spec.ts:392` — `hover tooltip dismisses Escape`: proves dismissal while focus remains elsewhere.
- `tests/e2e/dashboard/dashboard-pipeline.e2e.spec.ts:462` — `menuBounds`: checks the opened profile link on phone/tablet/desktop.
- `tests/unit/e2e/server-read-proxy.test.ts:19` — `before any forwarding`: exercises the actual handler with zero upstream calls for denied targets.

- `tests/unit/server/read-models/dashboard.test.ts:415` — `19.1-AUTO-API-001`: isolates concurrent authority, counts and serialized money in reverse completion order.
- `tests/unit/server/read-models/dashboard.test.ts:508` — `19.1-AUTO-API-002`: prevents overlapping failed reads from corrupting another request's result.
- `tests/e2e/dashboard/dashboard-pipeline.e2e.spec.ts:508` — `19.1-E2E-011`: keeps successive failed retries usable before same-session recovery.

Phase 6 adds controlled overlap because sequential identity/failure tests cannot expose completion-order contamination (AC2/4/5/6), and one same-session two-failure-to-recovery journey because separate single-retry cases cannot prove sustained retry usability (AC7). Existing factories and private server-read plans make these additions deterministic without new product seams or duplicated arithmetic/RLS truth tables.

Evidence: Round 1 final browser 56 passed/0 failed/0 skipped (51.6s), full units 2,048 passed/0 failed/one existing Linux-xattrs skip; prior required RLS 27 passed/0 failed/0 skipped remains applicable because reader/DB source did not change. Seller capture again observed seven responses (one initial navigation, one HTML, five later RSC). Production build, typecheck, full lint (0 errors/13 existing warnings), source/bundle containment, lockfile and diff checks passed. Fresh real-fixture collection proved root 178 cases with zero dashboard cases and official CI configuration 56 cases (50 dashboard); all four pre-existing CI jobs remained structurally identical.

Evidence: Phase 6 full Node units: 2,052 passed/0 failed/one existing Linux-xattrs skip (2,053 total); guarded official-CI-config browser launcher with retries disabled: 57 passed/0 failed/0 skipped (49.1s, 51 dashboard plus six regressions). Focused Node 92/0/0, dashboard burn-in 10 × 29 = 290/0/0, added browser 1/0/0 then repeat-each 3/0/0, typecheck, focused lint and diff checks passed. Prior required RLS 27/0/0 is inherited, not rerun in Phase 6; application/reader/DB source did not change. See [Phase 6 commands, logs and limits](../test-artifacts/automation-summary-story-19-1.md).

Limits: local execution consumed the official CI configuration through an ignored wrapper removing only its webServer startup; root-owned services supplied the matching build and browser. At that local run, the remote job and automatic startup had not run; the later CI follow-up failure and required rerun are recorded below. Injected query faults and synthetic money fixtures supplement live RLS; the Linux-xattrs skip is not coverage. Three payload-observation cases pause response bodies and do not prove streaming/loading, which separate unpaused hold/release cases exercise. Local fixtures do not establish hosted/demo behavior. Phase 6 overlap cases inject resolver/reader outcomes and prove orchestration/DTO independence, not database isolation; the browser case uses actual production-server reads through held subject-bound proxy plans released in finally. Round 1 review and independent narrow trail reconciliation completed; Round 2 patch evidence is recorded below, and the independent narrow regression/trail check reported no findings. Story 19.2 and full Epic 19 remain incomplete.
### Round 2 phone notification bounds

Round 2 fix author: gpt-6.1-sol / Low, ordinary responsive layout route. The full-width phone header puts the bell on the left, so its existing right-anchored 320px dialog opened outside the viewport. I retained the width and notification behavior, anchoring the dialog left below sm and right from sm upward. The existing three viewport cases now open the actual dialog, assert both edges, trial-click the actual Visa alla link, and close with Escape while preserving profile-menu, header and card assertions (AC9).

- `src/components/notifications/NotificationBell.tsx:84` — `sm:left-auto sm:right-0`: restores responsive popup anchoring without domain changes.
- `tests/e2e/dashboard/dashboard-pipeline.e2e.spec.ts:449` — `notificationBounds.x`: detects the reproduced phone clipping.
- `tests/e2e/dashboard/dashboard-pipeline.e2e.spec.ts:454` — `trial: true`: verifies the real center link is actionable.

Executed on HEAD `27a21dad196e21c1cfd9aedb9b0afd9d28563d2c` plus this narrow uncommitted patch, 2026-10-07: before the class fix, `node tmp/private/story19-runtime/run-ci-browser.mjs --grep 'live full-width row fits'` produced 2 passed/1 failed/0 skipped, with mobile dialog x=-266.03125. After the matching production rebuild, the same command passed 3/0/0 (10.0s), then the full guarded CI browser wrapper passed 57/0/0 (51.7s), with test count unchanged. Logs: ignored `tmp/private/story19-runtime/round2-focused-browser.log` and `round2-full-browser.log`.

Current full Node units passed 2,052/0 failed/one existing Linux-xattrs skip (2,053 total, 7.1s; `round2-unit.log`). Typecheck, full lint (0 errors/13 existing warnings), production build, source/bundle containment, lockfile and diff checks passed. Required RLS 27/0/0 remains inherited because this patch changes only responsive classes and browser assertions; reader/DB/permissions are unchanged. Root supplied and restarted the guarded matching production app; this author launched or stopped no resources. Trial-click verifies browser actionability and the real `/notifications` href without navigating into the notification center. Remote CI startup and hosted/demo behavior remain untested; the existing synthetic-fixture and platform-skip limits above remain applicable. Original author and Phase 6 rationale are preserved.

### CI follow-up: repository-root startup and shipped widget inventory

The CI startup fix author anchors both proxy and production app commands to the repository root because Playwright otherwise resolves relative commands from the nested configuration directory. The integration fix author (gpt-6.1-sol / High) updates only two historical empty-widget assertions to the exact approved `quote-pipeline` consumer; the source, tenant boundaries, permission grants and four other inventory guards remain intact.

- `tests/e2e/dashboard/playwright.ci.config.ts:28` — `cwd: process.cwd()`: resolves the proxy entry point and private control root.
- `tests/e2e/dashboard/playwright.ci.config.ts:32` — `cwd: process.cwd()`: resolves the production Next build and start entry point.
- `tests/unit/e2e/dashboard-ci-startup.test.ts:18` — `dashboard CI resolves startup entry point`: detects incorrect default cwd for both real Node entry points.
- `tests/integration/features/quotes/quote-pipeline-non-scope-guard.int.test.ts:47` — `expect(quotes?.widgets)`: pins the approved quote-module widget exactly.
- `tests/integration/features/quotes/quote-pipeline-non-scope-guard.int.test.ts:67` — `expect(widgets)`: rejects missing, extra, duplicate or misplaced widget inventory.

Evidence: `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/e2e/dashboard-ci-startup.test.ts` passed 2/0/0; an in-memory negative control deleting both cwd settings failed 0/2/0 with the doubled proxy/Next paths, without modifying files or launching services. Full `pnpm run test:unit` passed 2,054 / failed 0 / skipped 1 existing Linux-xattrs test (2,055 total, 19.2s). `pnpm typecheck`, focused lint and diff checks passed. The separate inventory author ran six manifest/source assertions with a temporary focused Vitest configuration without globalSetup: 6/0/0, 692ms; its code-only commit is `f997370d41238b89dca68b122d022ddcbf352a25`, independently reviewed with no findings.

Limits: the first remote dashboard run `37766806362` performed zero browser attempts because proxy startup failed. The subsequent run `37768476568` verified automatic startup and passed all 57 dedicated dashboard cases; its independent database teardown failure and the required scheduling rerun are recorded below. A local list-only probe could not collect without the cleaned-up ignored fixture.json artifact; no fixture was fabricated and no managed resources were launched. These path and inventory assertions add no fresh DB/RLS or browser execution evidence. Two completed broad review rounds remain unchanged; this follow-up uses only narrow independent regression and trail review.

### Required integration scheduling without test loss

The High scheduling author isolates the existing job-run rollback suite because its global audit-events trigger teardown conflicted with concurrent database transactions. Normal integration files retain parallel execution in group 0; only that unchanged DDL suite runs in group 1 after the earlier suites finish their teardown hooks, preserving all assertions and required gates.

- `vitest.config.ts:43` — `name: "integration-parallel"`: includes normal integration files while excluding the single DDL suite.
- `vitest.config.ts:55` — `sequence: { groupOrder: 1 }`: runs the exclusive audit-DDL group after parallel suite teardown.
- `tests/unit/scripts/verify/integration-test-partitions.test.ts:33` — `installed Vitest collects every integration file once`: checks exact coverage, required setup, timeouts and zero retries.
- `tests/unit/scripts/verify/integration-test-partitions.test.ts:74` — `installed Vitest finishes parallel teardown first`: proves teardown ordering and detects deliberately reversed interference.

Evidence reported by the scheduling author and independently checked by a High narrow reviewer: code commit `1ecb193ad065332c5b48aa59717b67bc20a57c50` resolves all 123 integration files exactly once (122 parallel, one audit-DDL). The focused Node suite passed 3/0/0; its installed-Vitest synthetic scheduler probe passed all three cases in the intended order, then asserted the one intentional failure and interference message with reversed nonzero groups. Required globalSetup, alias, 30-second test/hook timeouts and failure handling remain unchanged; no retry, skip or assertion changes were introduced. Typecheck, focused ESLint and diff checks passed; independent High review returned No findings.

Limits: the synthetic scheduler proves suite afterAll completion before the next group begins, without proving worker-process termination or executing the real database suites. It adds no local DB/RLS, browser or full-unit evidence. Fresh required CI must validate the real database schedule and the chained pilot-performance command; the failed run below did not execute that pilot. Two completed broad review rounds and the frozen intent remain unchanged; this continuation receives only a narrow independent trail check.

## Historical Auto Run Result

Historical halted invocation; superseded by the current Auto Run Result and Round 1 Patch Verification below. This result is preserved as provenance, not the current verification gate.

Status: blocked
Blocking condition: implementation verification failed
Reason: Required DB/RLS and production-server browser verification cannot execute while root resource support returns HOOK_CONTEXT_UNAVAILABLE (no current root turn actor is open). No managed stack, proxy, app server or browser was launched. A fresh trusted root actor hook and guarded readiness are required; the prepared runtime is not readiness.
Implementation: Manifest-governed dashboard framework and live quote pipeline implemented; author snapshot and exact continuation commands are recorded above.
Evidence: focused 88 passed / 0 failed / 0 skipped; full unit 2036 passed / 0 failed / 1 pre-existing Linux-xattrs skip. Typecheck, lint (0 errors / 13 existing warnings), frozen install, high-threshold audit, lockfile, production build and source/bundle containment passed. Required DB/RLS 0 executed; 48 enabled browser cases collected / 0 executed. Independent review rounds: 0; gate held at step03.
Completion hook: blocked/incomplete result preserved; no completed-trail reconciliation or completion claim. Author review-reference self-check passed 16 references / 0 errors, pending independent verification.

## Verification Resume Metadata

- 2026-10-07: The owner explicitly requested continuation of Story 19.1. Root reported a fresh trusted resource-guard actor hook and an active Compose registration; the prior HOOK_CONTEXT_UNAVAILABLE actor-hook blocker is resolved. Restore in-progress solely to resume the implementation-verification gate.
- Runtime readiness, required DB/RLS and browser execution remain pending. Preserve the prior halted result as historical evidence; no new implementation, verification, review or completion is claimed by this metadata-only restoration. Baseline and frozen intent remain unchanged.

## Live Verification Invocation

- Resume HEAD: 798f1f601663f355ca9622716ef4713bb5ee9d80. Per coordinator instruction, retain the full original implementation baseline b8ccf1575ae94b33487470a08899f10022a8c3dc for independent review; do not limit review to resume metadata.
- Implementation verification continuation: gpt-6.1-sol / high, selected before context-free dispatch because authority, tenant and money boundaries remain within scope. Root reports isolated platform readiness and 80 applied migrations; required test execution is still to be established in this invocation.

## Live Verification Execution

Continuation author: gpt-6.1-sol / High. HEAD `798f1f601663f355ca9622716ef4713bb5ee9d80`, plus test-only working-tree changes. No permission, schema, money-rule or batch-size amendment has been made in this continuation; the coordinator subsequently reserved the narrow responsive header fix recorded below.

- Root supplied isolated runtime readiness: 80/80 migrations and seed verified, Auth/Storage/REST 200. Historical blocked result above is retained as provenance; its hook-context blocker no longer describes this invocation.
- Required command: private test environment in the same process, `SUPABASE_TEST_REQUIRED=1`, `pnpm exec vitest run tests/integration/rls/dashboard-pipeline.rls.test.ts tests/integration/rls/quote-pipeline-read-model.rls.test.ts tests/integration/rls/role-aware-phase-a-surface.atdd.int.test.ts`. Outcome: 27 executed; 25 passed, 2 failed, 0 skipped. Failures: existing E10 multi-ID batch completeness and new 19.1-INT-005 real later-page/batch case.
- Bounded synthetic diagnosis: raw RLS quote_acceptances queries return 200 with 50/90 IDs and gateway 502 with 100/102 IDs. The new result entry correctly returns unavailable while the legacy entry falls back to zero; batch success is not claimed. Root owns runtime parity diagnosis/remediation; no product workaround or schema/grant repair was applied.
- Production build with private isolated app environment and proxy public URL `http://127.0.0.1:37921` passed; `/dashboard` remains dynamic. Built-bundle containment passed. Bounded guarded app3201/login and proxy37921/Auth health checks returned 200. Root restarted the app to consume the completed build.
- Coordinator/root explicitly reserved new `tests/e2e/dashboard/guarded-test.ts` and import-only amendments to the dashboard spec, existing role-aware browser spec and first-admin checklist spec. The fixture connects the guard-owned loopback Chrome via CDP only when the dedicated environment is supplied, retains Playwright fresh contexts, and never closes the root browser. Standard configured CI behavior remains the base fixture. No assertions or skip markers changed. Typecheck and focused ESLint passed; diff whitespace check passed.
- Browser attempt: private ignored Node launcher, root-owned Chrome CDP37922, production app3201, dedicated config with no webServer, `SUPABASE_TEST_REQUIRED=1`. Collected 54 (48 dashboard + 6 existing regression cases); interrupted after the first two existing role tests failed login before dashboard assertions. This interrupted attempt supplies no positive AC browser coverage.
- Fresh bounded Auth diagnosis: server sign-in succeeded but browser Auth token request failed transport. Expected token OPTIONS preflight returned 204 with no Access-Control-Allow-Origin/Headers/Methods through proxy37921. Synthetic fixture and owned browser context were cleaned. Root holds runtime/browser lifecycle and is correcting the isolated runtime before a fresh global setup/run.

Verification is in progress; runtime remediation, green batch/browser evidence, independent High implementation review and final author-trail reconciliation remain required. Story19.2 and full Epic19 remain pending.
### Corrected runtime and first complete browser run

- Root supplied a newly admitted buffered/CORS-enabled isolated runtime, preserving the original volumes/config. Fresh readiness again verified 80/80 migrations and seed plus Auth/Storage/REST 200; direct and proxied token OPTIONS included exact app origin, POST and the five required Auth headers. No product/grant workaround was introduced.
- Required integration rerun passed **27/27, 0 failed, 0 skipped** in 17.73 seconds, including old E10 and new 19.1-INT-005 real page/batch completeness.
- Fresh-global-setup browser run executed **54: 44 passed, 10 failed, 0 skipped** in 3.5 minutes. All six existing role/onboarding regressions passed. Five failures came from test transport protocol/synchronization; five came from existing whole-page mobile header overflow. No failed assertion was removed or relaxed.
- Installed PostgREST SDK defaults retry idempotent 503 reads. Root authorized a nonretryable HTTP400 synthetic query fault so each private plan step represents one completed logical production read. The actual reader, failure result and retry controls remain exercised. Proxy restart is root-owned; the app has no fault switch.
- Seller payload capture now waits for and inspects the actual initial login RSC before a new HTML navigation, then asserts the explicit HTML, DOM and subsequent RSC. Observer capture rejection is recorded and asserted false; missing required bodies cannot pass secrecy checks.
- Coordinator/root reserved `src/components/app-shell/AppShell.tsx` after verifying it did not overlap the concurrent PR86 changes. Only four responsive class strings changed: below-sm header wraps into two rows, its control row takes the available width, and tenant identity flexes/truncates within the remaining space. Notifications, profile, sign-out, menu and tenant identity stay rendered; desktop stays a single row. Existing 360/tablet/desktop checks now additionally assert these controls/identity are visible and in bounds.
- Syntax check, focused ESLint, direct `node node_modules/typescript/bin/tsc --noEmit` and diff whitespace check passed after this fix batch. Final app build/browser evidence is pending root app Stop, bounded rebuild and root restart. No completion/review claim is made yet.
## Final Verification Handoff

Author verification gate: **passed; ready for independent implementation review**. Story completion remains pending that review and final-trail reconciliation. Tested revision/worktree: HEAD `798f1f601663f355ca9622716ef4713bb5ee9d80` plus the final uncommitted source/test corrections; full review baseline remains `b8ccf1575ae94b33487470a08899f10022a8c3dc`.

| Executed check | Final outcome |
| --- | --- |
| Private test environment + `SUPABASE_TEST_REQUIRED=1`; required dashboard-pipeline, quote-pipeline-read-model and role-aware integration/RLS suites | 27 passed, 0 failed, 0 skipped; 17.73s. No DB/application source changed afterwards |
| `node --experimental-strip-types --import ./tests/support/register.mjs --test 'tests/unit/**/*.test.ts'` | 2,037 total; 2,036 passed, 0 failed, 1 pre-existing Linux-xattrs skip |
| `node node_modules/typescript/bin/tsc --noEmit` | Passed after final test-only capture changes; equivalent project TypeScript gate |
| `node node_modules/eslint/bin/eslint.js` | Passed; 0 errors, 13 existing warnings. Final capture file additionally passed focused ESLint |
| Private app environment + public proxy URL37921; `node node_modules/next/dist/bin/next build` | Passed after responsive source fix; dashboard remains dynamic. Root restarted app from matching artifact |
| `node scripts/verify/check-service-role-containment.mjs` / `check-bundle-containment.mjs` / `check-lockfiles.mjs` | All passed against final source/production build |
| Ignored private Node browser launcher; dedicated config, root-owned Chrome CDP37922 and production app3201; affected payload/revocation grep | 3 passed, 0 failed, 0 skipped; 11.8s |
| Same launcher/config/resources; final full browser suite with fresh global setup | 54 passed, 0 failed, 0 skipped; 48.3s. Includes 48 dashboard and 6 unchanged existing role/onboarding regressions |
| Seller actual-response secrecy evidence | 7 dashboard responses observed: 1 initial navigation, 1 HTML, 5 later RSC; body capture, amount/property absence and DOM/mask assertions passed |
| `git diff --check` | Passed |

The last capture correction uses page-owned CDP Fetch response-stage observation, not response mocking or replacement: `Fetch.getResponseBody` reads the server bytes, `Fetch.continueResponse` resumes them without overridden status/headers/body, and required capture failures fail assertions. It applies only to seller secrecy and the two role-revocation cases; retry/loading hold-release checks remain unpaused. This fixes the observed CDP transport limitation where consumed/canceled streamed RSC responses were no longer retrievable or never reported finished. See the [Chrome Fetch protocol](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/) and the concrete helper review stop.

The author has no active DB/browser consumers. Root owns lifecycle Stop requests and preserves runtime/profile/data state; no resources were raw-launched, adopted, reset or deleted by this delegate. No deployment, demo data change, new dependency, schema/grant/money rule or later widget was introduced. Current uncommitted continuation files are the spec, four responsive class strings in AppShell, the strict browser/proxy fixture corrections, the guarded browser fixture, and coordinator-approved import-only amendments to two existing regressions.
## Review Routing

### 2026-10-07 — Round 1 of 3

- Complete configured roster: blind-hunter, edge-case-hunter, verification-gap, intent-alignment, auto-bmad-security, auto-bmad-cross-model. All use gpt-6.1-sol / high because the full diff includes tenant authority and money withholding; selected before dispatch. External reviewer resolved at runtime with cli_delegate.py --layer-argv, this worktree/config and --codex-effort high; confirmed model, approval_policy=never, read-only sandbox and worktree root.
- Parent and delegate consume two of five concurrency slots, so launch three internal reviewers first and the other two when slots free; external bounded CLI runs concurrently. Retain every layer and defer collection/triage until the complete roster has launched. Review baseline remains b8ccf1575ae94b33487470a08899f10022a8c3dc.

## Review Triage Log

### 2026-10-07 — Review pass

**Round 1 of 3**

- intent_gap: 0
- bad_spec: 0
- patch: 5: (high 1, medium 4, low 0)
- defer: 0
- reject: 0
- addressed_findings:
  - High CI partition: ordinary config excludes exactly the dashboard spec; required dashboard-e2e job uses dedicated setup/teardown, proxy and production app. Fresh real-fixture collection: root 178/zero dashboard, official CI 56/50 dashboard. Final local guarded execution of that CI config:56 passed/0 failed/0 skipped; remote CI startup remains unexecuted.
  - Medium profile menu: phone left anchor and desktop right anchor preserve controls/context. Opened link bounds passed at 360, tablet and desktop in the final browser suite.
  - Medium tooltip pointer retention: one trigger/explanation hover region with no layout gap. Actual 12-step pointer passage passed, followed by outside-pointer dismissal.
  - Medium unfocused Escape: open-state document key listener preserves focus. Final browser test asserted elsewhere focus before/after hover and Escape dismissal; focused1-case verification also passed.
  - Medium test-proxy boundary: strict target resolver is used before any forwarding/plans. Twelve focused unit cases passed, including actual-handler zero-forward negatives; live ordinary request 200 and external absolute/network-path/same-origin absolute requests400.
- Independent High triage verified concrete callers and no downstream enforcement; the CI claim from four layers was deduplicated as one claim/action. Intent auditor found no material divergence. No intent/spec amendment is required.
- All six configured layers completed against full original baseline b8ccf1575ae94b33487470a08899f10022a8c3dc. Host capacity allowed two simultaneous internal reviewers; bounded batches retained every layer before triage.
- External result: High Sol 6.1, approval never, read-only sandbox, exact worktree root. Complete final UTF-8 artifact 681 bytes; full diff SHA256 8E8BB58D6A1DF798B4923180FED0A2699BEA8E2FF4BDA5362A05E39A008A29BC. Original Codex success is evidenced by conditional display invocation; Windows forward-slash display failed, canonical backslash display exited 0. Redundant same-diff provider retry was cancelled after this completed artifact was validated; transport failure is separate from the completed review round.
- Fix route selected before dispatch: gpt-6.1-sol / high for the actual proxy boundary and full mixed batch. Coordinator reserves playwright.config.ts and .github/workflows/ci.yml only for a required isolated dashboard CI partition; preserve existing jobs/assertions/gates and E14 exclusions.

### 2026-10-07 — Review pass

**Round 2 of 3**

- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 1, low 0)
- defer: 0
- reject: 0
- addressed_findings:
  - `[medium]` `[patch]` Phone notification popup clipping: retained existing dialog width/behavior and added responsive left-phone/right-desktop anchoring. Three viewport cases now open the dialog, check both edges and real link actionability, then verify Escape/focus; existing profile/header/card assertions remain. Reproduced before fix (2 passed/1 failed/0 skipped; phone x=-266.03125), then rebuilt focused 3/0/0 and full browser 57/0/0.
- All six independent configured layers completed before triage. Blind and external claims deduplicated once; edge/verification/security reported no findings; intent reported no material divergence.
- Independent narrow regression/trail check passed after fixes: additive assertions, preserved original/Phase 6 rationale, exactly one section, 34 stops/0 reference errors. This is not a third broad review round.
- Current pass recommendation: false; patched high 0, medium 1, low 0; score 3. Prior Round 1 history and review_loop_iteration 0 preserved.

## Round 1 Patch Verification

Author: same High verification/fix delegate; full baseline and frozen intent unchanged. The coordinator reserved root `playwright.config.ts` and `.github/workflows/ci.yml` only for the required isolated CI partition, plus new `tests/e2e/dashboard/playwright.ci.config.ts` and `tests/unit/e2e/server-read-proxy.test.ts`. AppShell ownership remains limited to responsive controls/menu positioning; QuotePipelineWidget changes are mask interaction only. Existing CI jobs, browser assertions, skip markers, permission matrix and database/application reader source are preserved.

| Executed check | Round 1 outcome |
| --- | --- |
| `node --experimental-strip-types --import ./tests/support/register.mjs --test 'tests/unit/**/*.test.ts'` | 2,049 total;2,048 passed,0 failed,1 existing Linux-xattrs skip. Sequential after the completed build |
| Focused `tests/unit/e2e/server-read-proxy.test.ts` | 12 passed,0 failed,0 skipped; real handler refuses denied targets before upstream request |
| TypeScript, full ESLint, production build, source/bundle containment, lockfiles, diff whitespace | Passed; lint 0 errors/13 existing warnings; dashboard dynamic. Root started matching production artifact |
| Workflow YAML parse and comparison to HEAD | Valid; all 4 existing jobs structurally unchanged; new required dashboard job depends on verify and requires isolated services |
| Fresh dedicated global setup + ordinary and official-CI Playwright `--list`, paired teardown | Ordinary 178 cases/37 files/zero dashboard; official CI 56 cases/3 files/50 dashboard. Setup actually executed against isolated DB |
| Bounded live proxy boundary probe | Ordinary Auth health forwarding200; external absolute, network-path and same-origin absolute request targets 400 |
| Official CI config via ignored guarded wrapper, fresh setup, Chrome CDP37922/app3201/proxy37921 | 56 passed,0 failed,0 skipped;51.6s. Attempts 39.70s within 300s budget |
| Seller actual-response secrecy evidence | Seven observed dashboard bodies: 1 initial navigation,1 HTML,5 later RSC; required capture/property/sentinel/DOM assertions passed |
| Earlier required integration/RLS evidence | 27 passed,0 failed,0 skipped remains applicable; this batch changed no database/reader/authority source |

An initial browser pass was 55 passed/1 failed/0 skipped: the newly added Escape case set focus before hydration, and failed the pre-Escape focus assertion. Moving focus after hydration and asserting it before hover corrected the fixture; focused 1 passed/0 failed/0 skipped, followed by the final 56-case result above. A unit run concurrent with build hit one transient bundle-file access failure; the recorded full unit result is the subsequent sequential run against the completed artifact. No assertion was removed or weakened.

Local guarded execution imported the official CI config and omitted only its webServer startup, retaining exact collection, fixture setup/teardown, reporters and duration budget; the root supplied the matching guarded services. The ignored collection launcher performed fresh fixture startup/teardown but `--list` does not start webServers. No remote GitHub CI execution or automatic CI server-start result is claimed. Dependencies/lockfile remain unchanged, so prior frozen-install/audit evidence remains historical and applicable.

No active DB/browser consumers remain. Root owns lifecycle requests and preserves runtime/profile/data. Round 1 remains the single completed broad review (five patches:one High, four Medium); followup_review_recommended remains true for the root's configured follow-up. No broad Round 2 review, commit, push, deployment or full-epic completion occurred in this fix lane.
## Auto Run Result

Status: done — Round 2 follow-up, responsive patch verification and independent narrow regression/trail check complete.
blocking_condition: none
trail_narrow_check_status: passed — independent reviewer verified the final narrow patch and all 34 stops, preserving original and Phase 6 rationale, current evidence and limits. No consequential mismatch; author reconciliation complete.
Current Round 2 breakdown: patch 1 (High 0 / Medium 1 / Low 0); intent_gap 0; bad_spec 0; defer 0; reject 0; followup_review_recommended: false; severity score 3. Round 1 five-patch history is retained above; two completed broad rounds of three.
Implementation: Story 19.1 delivers the operational dashboard framework and full-width quote-pipeline widget while preserving onboarding. The manifest-coherent registry contains actual loader/presentation functions; the dashboard server resolves current authority and serializes a browser DTO allowlist that withholds unauthorized money and server-only fields. The result-bearing quote source shares legacy query semantics, distinguishes unavailable reads from empty data, and retains the compatible reader. Presentation covers loading, empty, success, withheld money and explicit failure/retry with refreshed authority. All five Round 1 findings are addressed: required isolated dashboard CI partition, responsive profile menu bounds, composite tooltip hover, focus-independent Escape, and strict test-proxy targets. Full baseline and frozen intent remain unchanged.

Files changed (whole author-owned code/test/spec inventory since `b8ccf1575ae94b33487470a08899f10022a8c3dc`; excludes root auto-bmad report/state files):

- `.github/workflows/ci.yml` — Adds the required isolated dashboard browser job while retaining existing jobs.
- `playwright.config.ts` — Partitions the dashboard spec into its fixture/proxy-aware CI gate.
- `_bmad-output/implementation-artifacts/spec-19-1-dashboard-framework-and-quote-pipeline.md` — Records implementation, verification, review triage and the single authored review trail.
- `src/app/(app)/dashboard/page.tsx` — Composes operational dashboard and existing onboarding with server-derived widget state.
- `src/components/app-shell/AppShell.tsx` — Keeps phone header controls, tenant identity and opened profile menu within the viewport.
- `src/components/notifications/NotificationBell.tsx` — Keeps its opened phone notification dialog within the viewport.
- `src/components/dashboard/DashboardGrid.tsx` — Provides the responsive full-width dashboard widget layout.
- `src/components/dashboard/WidgetCard.tsx` — Provides semantic widget framing and authorized navigation.
- `src/components/dashboard/QuotePipelineWidget.tsx` — Renders pipeline states, authorized money and accessible mask interactions.
- `src/components/dashboard/DashboardRetry.tsx` — Refreshes the server route with explicit pending state and current authority.
- `src/scope/manifest.ts` — Enrolls the active quote module's pipeline widget.
- `src/scope/widget-registry.ts` — Registers actual widget loaders and components with eligibility metadata.
- `src/scope/manifest-schema.ts` — Validates registry/manifest ownership, equality and capability coherence.
- `src/server/read-models/dashboard.ts` — Coordinates authorized loaders and projects the browser-safe dashboard DTO.
- `src/server/read-models/quote-pipeline.ts` — Adds explicit read results while preserving the shared query core and legacy wrapper.
- `tests/unit/scope/widget-registry.test.ts` — Exercises registry coherence and invalid enrollment boundaries.
- `tests/unit/server/read-models/dashboard.test.ts` — Checks role eligibility, DTO projection and withheld/server-only property absence.
- `tests/unit/server/read-models/quote-pipeline-result.test.ts` — Covers strict result validation, page/batch faults and legacy compatibility.
- `tests/unit/components/dashboard/widget-state.test.ts` — Covers dashboard presentation state semantics.
- `tests/unit/e2e/server-read-proxy.test.ts` — Verifies proxy target rejection and zero forwarding through its real handler.
- `tests/unit/e2e/dashboard-ci-startup.test.ts` — Verifies both CI Node entry points resolve from repository-root startup cwd.
- `vitest.config.ts` — Schedules the unchanged global audit-DDL suite after normal parallel integration teardown.
- `tests/unit/scripts/verify/integration-test-partitions.test.ts` — Verifies exact installed-runner coverage and synthetic positive/negative teardown ordering.
- `tests/integration/rls/dashboard-pipeline.rls.test.ts` — Verifies live authority, tenant boundaries and actual source/page/batch reads.
- `tests/e2e/dashboard/dashboard-pipeline.e2e.spec.ts` — Implements 50 actual-browser dashboard acceptance cases and strict payload observation.
- `tests/e2e/dashboard/playwright.config.ts` — Defines dedicated dashboard collection, fixtures and browser settings.
- `tests/e2e/dashboard/playwright.ci.config.ts` — Adds isolated proxy/production-app startup and required CI reporting/budget.
- `tests/e2e/dashboard/guarded-test.ts` — Connects root-owned CDP Chrome with fresh test contexts for guarded local verification.
- `tests/e2e/dashboard/setup.ts` — Creates isolated role/source/dashboard fixtures and private fault-plan state.
- `tests/e2e/dashboard/teardown.ts` — Cleans owned fixtures and fault-plan state after dedicated browser execution.
- `tests/e2e/dashboard/read-plan.ts` — Defines deterministic contained query-fault and hold/release plans.
- `tests/e2e/dashboard/server-read-proxy.mjs` — Forwards real local responses with bounded planned faults and strict upstream target validation.
- `tests/e2e/auth/role-aware-phase-a-surface.atdd.e2e.spec.ts` — Uses the guarded fixture import while preserving existing role assertions.
- `tests/e2e/onboarding/first-admin-checklist.e2e.spec.ts` — Uses the guarded fixture import while preserving existing onboarding assertions.
Verification: Current Round 2 full Node units 2,052 passed / 0 failed / 1 existing Linux-xattrs skip (2,053 total, 7.1s); focused three-viewport browser 3/0/0 (10.0s), full official-CI-config guarded browser 57/0/0 (51.7s). Typecheck, full lint (0 errors / 13 existing warnings), matching production build, source/bundle containment, lockfiles and diff checks passed. Required RLS 27/0/0 is inherited, not rerun: the Round 2 fix changes responsive classes and browser assertions only. Prior dependency-install/audit and Phase 6 focused/burn-in evidence remain historical; dependencies are unchanged.

Review trail: Exactly one authored section, preserving original implementation and Phase 6 test rationale with this actual fix author's responsive rationale and evidence. Reference and independent narrow checks passed: 34 stops, 0 errors, no consequential mismatch. Two completed broad rounds; no Round 3 started. review_loop_iteration remains 0 because no spec repair loop occurred. Current pass recommendation is false (one Medium patch, score 3).

Residual limits at the Round 2 local handoff: remote CI automatic startup was unexecuted; the later CI follow-up section records its actual failure and pending rerun. Local execution imports that configuration with root-owned matching guarded services. Synthetic fixtures, paused payload-observation cases and the explicit Linux skip retain the recorded limits. Story 19.2, full Epic 19, Phase 8, PR/push and deployment remain outside this result; the root owns Phase 7 human review.

Resource handoff: No active DB/browser consumers remain. Root owns app df471365-4c7b-430c-9d38-ae6d0745c9a2 and the retained proxy/Chrome/Compose lifecycle; this delegate launched/stopped no resource and deleted no runtime/data/profile state.

## Follow-up Review Routing

### 2026-10-07 — Round 2 of 3

All six configured Build Auto layers retained: blind, edge, verification, intent, security, external Codex CLI. Selected gpt-6.1-sol / high before dispatch for full changed scope including tenant authority, revocation, payload and money boundaries. Ordinary trail-reference reconciliation is Low. Baseline b8ccf1575ae94b33487470a08899f10022a8c3dc; prior Round 1 and repair-loop counter preserved. Host-capacity batches defer triage until all layers have launched and completed.

### 2026-10-07 — Round 2 triage and patch route

All six configured independent layers completed against the full baseline. Blind and external independently identified the same phone notification-dialog clipping regression; edge and verification returned no findings, intent found no material divergence, security returned No findings. Deduplicated one Medium patch; intent_gap 0, bad_spec 0, defer 0, reject 0. AppShell's new full-width phone row moved the bell left while its existing right-anchored 320px popup became offscreen; this is reachable on the shipped 360px shell. Coordinator reserved NotificationBell.tsx narrowly for responsive bounds, with no notification domain/API/permission changes. Ordinary layout fix route selected gpt-6.1-sol / low before dispatch. Preserve all other edits and the single original-author trail; this fix author will append its own rationale and verified evidence.

External provenance: resolved configured gpt-6.1-sol / high, approval_policy never, read-only sandbox and exact worktree. Successful invocation exit 0, 589-byte UTF-8 final artifact, SHA256 of review input 900A5BB1709B9D9F5B3552D28F2CDE84A17380B5D2963FB383260AE616DE411C, 1200-second subprocess cap. First Windows argument-quoting attempt was refused before Codex executed (20:08:52 UTC); one corrected provider invocation completed 20:12:47 UTC, under 235 seconds after that refusal. Exact provider launch instant was not separately logged. No duplicate provider review or display retry occurred.

## CI Follow-up Verification — 2026-10-08

Author-owned repair, preserving the approved intent, earlier review findings, terminal metadata and all coordinator-owned state. Ordinary dashboard cwd/path review is routed to gpt-6.1-sol / Low; this existing fix-author session retains its prior High effort rather than claiming live reconfiguration. The separately assigned inventory author remains High for its actual database-test diagnosis. Both narrow reviews preserve the two completed broad rounds and three-round cap.

[Dashboard job 113277399291](https://github.com/rthunborg/ElproSaas/actions/runs/37766806362/job/113277399291) at `6802b0d23ff9eb6f52d9e98c67bd2c337d6b6857` completed migrations, then failed before tests with `MODULE_NOT_FOUND` for `tests/e2e/dashboard/tests/e2e/dashboard/server-read-proxy.mjs`. Playwright defaults webServer cwd to its configuration directory. Both repository-relative commands now explicitly use repository cwd; test collection, retry count, assertions, time budgets and environment authority are unchanged.

The independent database failure at [job 113277399149](https://github.com/rthunborg/ElproSaas/actions/runs/37766806362/job/113277399149) was the two stale Epic 10 empty-widget pins. Reported full DB result: 1,217 passed / 2 failed / 1 explicit dedicated-recovery skip. The subsequent pilot-performance command did not execute because the preceding test:int command failed. The dedicated recovery-loader job succeeded; that coverage remains distinct from the skipped general-DB case.

Current local correction evidence and limits are recorded in the CI follow-up concern within the single Suggested Review Order. Independent gpt-6.1-sol / Low narrow dashboard regression and trail review returned No findings; it independently reran the two startup checks (2/0/0) and reference checker (39 stops / 0 errors). No new broad review round was started. The root owns fresh CI publication, final report/checkpoint decisions and any resource lifecycle.

### Fresh CI result and reviewed integration scheduling continuation

[CI run 37768476568](https://github.com/rthunborg/ElproSaas/actions/runs/37768476568) tested `e91769e0182e45be13e89b3e95a4a13539503d54` and completed with overall failure. Reported results: dedicated dashboard 57 passed; general browser 174 passed / four existing skips; verify and dedicated recovery succeeded. The general DB run executed 1,218 passed / one failed / one explicit isolated-recovery skip. Its sole `40P01` failure occurred during the pre-existing job-run global audit-trigger teardown. The chained pilot-performance command did not execute; dedicated recovery success does not convert the skipped general-DB case into coverage.

The High author then committed the bounded scheduling repair `1ecb193ad065332c5b48aa59717b67bc20a57c50` and received independent High narrow review with No findings. Its exact 123-file partition and focused 3/0/0 evidence are documented in the single Suggested Review Order above. That evidence demonstrates completion of earlier suite teardown hooks before the next group, not termination of worker processes or fresh real-DB execution.

This spec-only reconciliation preserves frozen intent, terminal metadata, two completed broad rounds and coordinator commits `e36b8046dc4c73f7e3874c2e5b84fcc50856ca22` and `72148207a94a1337a447bf607acf78b711e540b2`. Independent gpt-6.1-sol / Low narrow trail review returned No findings and independently verified 43 stops / 0 reference errors, unchanged frozen intent/frontmatter and the precise teardown-only guarantee; no additional broad review is started. Root owns publication and the fresh required CI run. Database and pilot gates remain unverified after the scheduling repair until that run completes.
