---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-generation-mode', 'step-03-test-strategy', 'step-04-generate-tests', 'step-04c-aggregate', 'step-05-validate-and-complete']
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-09-24'
workflowType: 'testarch-atdd'
inputDocuments:
  - '_bmad-output/implementation-artifacts/spec-13-4-email-sending-activation.md'
  - 'docs/decisions/ADR-B011-epic-13-email-release-and-quote-delivery.md'
  - '_bmad-output/test-artifacts/test-design-epic-13.md'
  - '_bmad/tea/config.yaml'
  - 'playwright.config.ts'
  - 'tests/unit/server/email/outbox.atdd.test.ts'
  - 'tests/integration/email/outbox.atdd.int.test.ts'
  - 'tests/unit/scripts/verify/email-provider-containment.atdd.test.ts'
---

# ATDD Checklist — Epic 13, Story 13.4: Email Sending Activation

**Date:** 2026-09-24  
**Author:** Rasmus  
**Primary test levels:** server unit/static containment, required-stack integration/RLS, and focused Playwright E2E

## Story summary

Story 13.4 activates provider-backed email delivery only for synthetic sandbox recipients through the existing authenticated jobs runner. It adds a narrow public unsubscribe capability, applies preference/suppression rules before sending, and attaches quote PDFs only from the existing current-authorized byte path.

The design stays fail-closed for absent, malformed, preview-only, and unapproved real-recipient release postures. No test or fixture in this artifact authorizes a real-recipient provider call.

## Preflight and generation mode

The approved Story 13.4 specification has six explicit acceptance criteria. The repository is a full-stack Next.js application with node:test unit suites, Vitest integration suites, and a production-mode Playwright configuration. Existing Story 13.3 email-outbox tests, two-tenant factories, required-stack gating, and the notifications E2E fixture are the established patterns.

AI generation is selected. Browser recording is unnecessary because the user-facing surfaces are specified and no live service may be started for this task. The delivery-provider seam is implemented and tested as a server-injected sandbox adapter; no real-recipient delivery is admissible under ADR-B011.

## Acceptance criteria and test strategy

| Acceptance criterion | Red-phase scenarios | Level and priority |
| --- | --- | --- |
| AC1: synthetic sandbox send only through the jobs runner | Valid sandbox send records one sanitized provider ID and `sent` event; an adapter never receives raw recipient/template data outside the server seam. | Unit P0; integration P0; focused E2E P1 |
| AC2: every closed posture fails before provider work | Absent, malformed, preview-only, unapproved, and real-recipient controls make zero adapter calls and retain `queued`. | Unit P0; integration P0 |
| AC3: existing outbox integrity invariants survive activation | Concurrent claims remain disjoint; retry, stale lease recovery, dedupe, and matching suppression produce no duplicate send. | Unit P0; required-stack integration P0 |
| AC4: preference and unsubscribe scope is precise | A non-essential email preference or valid token suppresses only its matching future category and tenant; essential mail and other scopes remain eligible. | Unit P0; integration/RLS P0; focused E2E P1 |
| AC5: public token route has no enumeration or app shell | Unknown/revoked tokens return one minimal response; fixed token/IP windows return 429 and the public page contains no authenticated navigation. | Unit P0; integration/RLS P0; E2E P0 |
| AC6: quote PDFs and reminders preserve authority/lifecycle | Stale/invalid PDFs and five quote terminal states cause zero attachment/send/reminder; current PDF bytes stay server-only and no public acceptance link is emitted. | Unit P0; required-stack integration P0; static containment P0; focused E2E P1 |

The red suite deliberately exercises pure release parsing, outbox orchestration, token hashing, and containment at unit level; durable state transitions, tenant isolation, rate limits, and current-PDF authority at required-stack integration level; and only the authenticated preference and anonymous public journeys in Playwright. This avoids duplicating database invariants in browser tests.

## Failing tests created — RED phase

All **17** cases are intentionally marked `test.skip()` until green implementation removes the marker. Each contains expected behavioral assertions and is marked `expected_to_fail` in the staged generation artifacts.

### Server, integration, RLS, and containment — 12 tests

- [provider.atdd.test.ts](C:/DEV/ElproSaas/tests/unit/server/email/provider.atdd.test.ts) — 2 P0 cases for synthetic adapter delivery and the closed release-control matrix.
- [email-delivery-activation.atdd.int.test.ts](C:/DEV/ElproSaas/tests/integration/email/email-delivery-activation.atdd.int.test.ts) — 3 P0 required-stack cases for single sandbox delivery, closed-gate no-call, and suppression before rendering.
- [quote-delivery-attachment.atdd.int.test.ts](C:/DEV/ElproSaas/tests/integration/email/quote-delivery-attachment.atdd.int.test.ts) — 2 P0 and 1 P1 case for current PDF bytes, stale/invalid/missing rejection, and all five reminder terminal states.
- [email-unsubscribe.atdd.rls.test.ts](C:/DEV/ElproSaas/tests/integration/rls/email-unsubscribe.atdd.rls.test.ts) — 2 P0 cases for 256-bit hashed token authority, two-tenant isolation, uniform inactive responses, and token/IP limiting.
- [email-delivery-containment.atdd.test.ts](C:/DEV/ElproSaas/tests/unit/scripts/verify/email-delivery-containment.atdd.test.ts) — 1 P0 and 1 P1 static containment case for the server-only adapter allowlist and public-shell import boundary.

### Focused browser journeys — 5 tests

- [email-preferences-email-activation.atdd.e2e.spec.ts](C:/DEV/ElproSaas/tests/e2e/notifications/email-preferences-email-activation.atdd.e2e.spec.ts) — P0 persisted non-essential email opt-out and P1 essential-category behavior.
- [public-unsubscribe-email-activation.atdd.e2e.spec.ts](C:/DEV/ElproSaas/tests/e2e/notifications/public-unsubscribe-email-activation.atdd.e2e.spec.ts) — P0 anonymous unsubscribe without app shell plus P1 uniform inactive and rate-limit journeys.

## Factory, fixture, and mock requirements for green phase

No new shared fixture implementation is created in RED phase. The scaffolds use existing two-tenant cleanup, admin SQL, required-stack, and Playwright authentication patterns. Green phase must extend the established fixture setup with:

- Synthetic sandbox tenant mail fixtures, a non-essential category, and one essential category. Real recipients are never a test fixture.
- Adapter-spy results containing only a synthetic provider message ID and a deterministic release-control clock.
- Current, stale, invalid, and missing PDF-authority fixtures that return bytes only from the existing narrow server path.
- Active, revoked, unknown, and pre-rate-limited opaque unsubscribe tokens. The browser fixture may hold plaintext test tokens; persistent storage holds only SHA-256 hashes.

### Provider mock contract

The injected sandbox adapter accepts a server-rendered envelope for a synthetic recipient and returns `{ providerMessageId: string }`. A success creates exactly one `sent` outcome/event; a closed release control calls it zero times. Failure characterization and any chosen provider SDK contract remain implementation work behind this adapter seam.

### Stable UI selectors

The browser scaffolds use accessible roles and names, so no new `data-testid` attributes are required. Green implementation must provide a status region for saved preferences and unsubscribe outcomes, retain Swedish unavailable/error copy, and keep the anonymous unsubscribe page free of authenticated navigation.

## Implementation checklist

- [ ] Add a server-only `src/server/email/provider.ts` release-control parser and adapter. It admits synthetic sandbox envelopes only and returns a sanitized provider ID; it performs no real-recipient delivery without the separate ADR-B011 owner record. Remove `test.skip()` from `13.4-UNIT-001` and `13.4-UNIT-002`; run `pnpm exec tsx --test tests/unit/server/email/provider.atdd.test.ts`.
- [ ] Evolve the jobs-runner-owned outbox processor with suppression/preference evaluation before rendering, disjoint claim/outcome semantics, closed-gate no-call behavior, and a sanitized `sent` event. Remove skips from `13.4-INT-001` through `003`; run `SUPABASE_TEST_REQUIRED=1 pnpm run test:int -- tests/integration/email/email-delivery-activation.atdd.int.test.ts`.
- [ ] Add current-authorized quote PDF attachment resolution and terminal reminder eligibility checks. Remove skips from `13.4-INT-004` through `006`; run `SUPABASE_TEST_REQUIRED=1 pnpm run test:int -- tests/integration/email/quote-delivery-attachment.atdd.int.test.ts`.
- [ ] Add forced-RLS unsubscribe token/rate-limit persistence, a hash-only server module, generic inactive responses, and the narrow public route. Enroll every tenant table and the public surface through manifest-derived contracts. Remove skips from `13.4-RLS-001` and `002`; run `SUPABASE_TEST_REQUIRED=1 pnpm run test:int -- tests/integration/rls/email-unsubscribe.atdd.rls.test.ts`.
- [ ] Replace the Story 13.3 dark provider ban with narrow server-only adapter and public-route containment checks. Remove skips from `13.4-STATIC-001` and `002`; run `pnpm exec tsx --test tests/unit/scripts/verify/email-delivery-containment.atdd.test.ts` and `pnpm run verify:service-role-containment`.
- [ ] Extend authenticated and anonymous Playwright seed data, then implement preference and unsubscribe UI with Swedish saved/error/inactive/rate-limit states. Remove five browser skips and run `pnpm run test:e2e -- tests/e2e/notifications/email-preferences-email-activation.atdd.e2e.spec.ts tests/e2e/notifications/public-unsubscribe-email-activation.atdd.e2e.spec.ts`.

## Test execution plan

```powershell
# RED scaffold registration: all 17 are intentionally skipped.
pnpm exec vitest run tests/integration/email/email-delivery-activation.atdd.int.test.ts tests/integration/email/quote-delivery-attachment.atdd.int.test.ts tests/integration/rls/email-unsubscribe.atdd.rls.test.ts
pnpm run test:e2e -- tests/e2e/notifications/email-preferences-email-activation.atdd.e2e.spec.ts tests/e2e/notifications/public-unsubscribe-email-activation.atdd.e2e.spec.ts

# GREEN required evidence after implementation.
SUPABASE_TEST_REQUIRED=1 pnpm run test:int
pnpm run test:unit
pnpm run test:e2e
```

## Red-phase aggregation

The API/server worker generated 12 cases and the browser worker generated 5 cases. Both staged outputs declared success, all test bodies contain `test.skip()`, each scaffold is marked `expected_to_fail: true`, and no placeholder assertion was accepted. The staged generation and aggregate summary are retained at [API staged output](C:/DEV/ElproSaas/_bmad-output/test-artifacts/tmp/tea-atdd-api-tests-story-13-4-2026-09-24.json), [E2E staged output](C:/DEV/ElproSaas/_bmad-output/test-artifacts/tmp/tea-atdd-e2e-tests-story-13-4-2026-09-24.json), and [aggregate summary](C:/DEV/ElproSaas/_bmad-output/test-artifacts/tmp/tea-atdd-summary-story-13-4-2026-09-24.json).

### ADR-B011 boundary

Sandbox/mock delivery may be exercised only with synthetic recipients. A real-recipient provider call, sender identity, credentials, or owner release record is outside this ATDD run and remains owner-gated.

## Validation evidence

| Check | Result |
| --- | --- |
| `node --experimental-strip-types --import ./tests/support/register.mjs --test …provider.atdd… …email-delivery-containment…` | 4 tests discovered and skipped; 0 pass, 0 fail. |
| `pnpm exec vitest run` for the three Story 13.4 integration/RLS files | 8 tests skipped across 3 files; exit 0. |
| `pnpm exec playwright test --list` for the two Story 13.4 browser files | 5 tests discovered across 2 files; exit 0. |
| `pnpm run typecheck` | Passed. |
| `git diff --check` | Passed. |

The registration checks validate intentionally skipped RED scaffolds only. Required-stack integration, browser behavior, and real adapter execution remain green-phase evidence after implementation. No managed resource or browser session was created by this run.

## Red → green → refactor handoff

1. Implement one P0 behavior at a time and remove only that case's `test.skip()`.
2. Run its focused command, then the required `SUPABASE_TEST_REQUIRED=1` integration suite where it touches database/RLS authority.
3. After all 17 cases are green, run the unit, integration, E2E, manifest coherence, migration-reset, and containment gates named in the Story 13.4 specification.
4. Refactor only with the server-only adapter boundary, public-shell isolation, and quote-PDF authority checks still passing.

## Completion summary

The Story 13.4 RED scaffold is complete: 17 skipped, behavior-bearing acceptance cases across 7 files; no placeholder assertion; and one checklist with the green implementation map. The next workflow is the Story 13.4 implementation run, which owns removal of `test.skip()` and required-stack execution evidence.
