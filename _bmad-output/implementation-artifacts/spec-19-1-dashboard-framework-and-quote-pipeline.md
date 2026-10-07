---
title: 'Story 19.1: Dashboard Framework and Live Quote Pipeline'
type: 'feature'
story_id: '19.1'
sprint_key: '19-1-widget-registry-and-dashboard-framework'
created: '2026-10-07'
status: 'ready-for-dev'
phase: 'Phase B / Legacy Parity Release'
baseline_revision: '8cc2d192672e80b8a2dd2e3925997ce8988a13b1'
baseline_ref: 'origin/main'
review_loop_iteration: 0
followup_review_recommended: true
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
