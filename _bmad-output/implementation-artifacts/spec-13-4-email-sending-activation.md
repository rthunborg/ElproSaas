---
title: 'Email Sending Activation'
type: 'feature'
created: '2026-09-24'
status: 'ready-for-dev'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - 'docs/decisions/ADR-B011-epic-13-email-release-and-quote-delivery.md'
  - '_bmad-output/planning-artifacts/architecture-phase-b.md'
  - 'docs/process/review-order.md'
warnings: [oversized]
deferred:
  - 'Real-recipient delivery remains disabled until the separate ADR-B011 owner go-live record is approved.'
---

<intent-contract>

## Intent

**Problem:** Story 13.3 can safely queue, suppress, retry, and show email work, but it deliberately cannot call a provider. The product needs an auditable, sandbox-proven delivery path and a narrowly isolated unsubscribe surface without enabling real-recipient sending by configuration accident.

**Approach:** Extend the existing tenant-explicit outbox worker with a server-only provider adapter and delivery envelope, then add release gating, preference enforcement, valid-PDF quote attachment handling, and the ADR-B004 unsubscribe lifecycle. Keep sandbox delivery synthetic and prove every disabled or invalid release posture leaves queued mail untouched.

## Boundaries & Constraints

**Always:** Run delivery only through the authenticated jobs runner; preserve suppression-before-provider ordering, leased `SKIP LOCKED` claims, append-only delivery events, tenant isolation, sanitized Admin projections, and entitlement-safe content. Hash unsubscribe tokens with SHA-256 after generating 256 random bits, apply database-backed token and IP-hash rate limits, use uniform inactive-token responses, and register the public surface and every new tenant table through the active notifications manifest/H4 contracts.

**Block If:** A change needs a real-recipient release, a production sender identity or credential, a provider-specific contract that cannot be represented behind the adapter, a live flow outside an active manifest module, or a public capability beyond unsubscribe. Halt with the concrete missing owner decision or release evidence.

**Never:** Enable real recipients by default; expose provider credentials, recipients, template bodies, token plaintext, or PDF bytes to clients/Admin projections; add another job/API execution lane, service-role client path, public quote view/acceptance link, marketing/Fortnox/Auth-mail flow, or a public route that imports app-shell, tenant-context, session, or navigation code.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Sandbox delivery | Valid server release control and a synthetic recipient | Claimed queued item renders its entitlement-safe template, the adapter records its provider ID, and the item becomes `sent` with an append-only event | Provider failure follows the existing bounded retry/terminal state path |
| Closed delivery | Missing, malformed, preview-only, or real-recipient configuration | No adapter call; eligible queued item remains queued and truthful | Record only sanitized operational evidence |
| Suppression | Matching tenant, recipient hash, and category | Item becomes `suppressed` before rendering or provider work | Nonmatching tenant/category suppression has no effect |
| Quote attachment | Current valid sent-quote PDF versus stale/invalid/missing PDF | Attach only authorized, current snapshot bytes; never create a public link | Fail closed before provider submission and preserve a recoverable queued state |
| Unsubscribe token | Valid active, revoked, unknown, or rate-limited token | Valid token changes only its allowed non-essential scope; invalid states share one generic response | Token/IP limits return 429 with retry guidance and disclose no tenant/recipient data |

</intent-contract>

## Code Map

- `src/server/email/outbox.ts:31` -- existing service-only enqueue, claim, suppression, and dark processor; evolve its worker contract without weakening state/lease semantics.
- `src/server/email/templates.ts:1` -- recipient-safe DTO boundary; extend only with values needed by the server-side delivery envelope.
- `src/server/email/provider.ts` -- introduce the single server-only adapter seam and release-control validation.
- `src/app/api/jobs/run/route.ts:66` and `src/server/jobs/{runner,producers,service-client}.ts` -- retain the sole authenticated, tenant-round-robin execution lane and jobs-only elevated access.
- `supabase/migrations/20260923175035_email_outbox_pipeline.sql:3` and `20260923182954_email_outbox_security_and_state_fixes.sql:3` -- preserve forced RLS, raw-read revocation, append-only events, lease-bound outcomes, and `SKIP LOCKED` claims while extending delivery/token data.
- `src/scope/manifest.ts:231`, `tests/integration/rls/tenant-table-inventory.ts:98`, and migration-reset policy tests -- notifications is active; enroll unsubscribe storage and its public surface through the manifest-derived contracts.
- `src/server/commands/quotes/mark-sent.ts:127` -- reuse the authorized narrow, currentness-checked PDF-byte access model; never use a signed URL or service-role Storage read.
- `src/components/notifications/NotificationPreferences.tsx:49`, `src/app/api/notifications/preferences/route.ts:15`, and `src/server/read-models/email-outbox.ts:8` -- enable only server-authorized email preferences and keep the Admin queue redacted.
- `src/app/(public)/**` and `scripts/verify/check-service-role-containment.mjs:224` -- public-shell and provider-containment guardrails that must be extended with focused negative tests.

## Tasks & Acceptance

**Execution:**
- `supabase/migrations/` -- extend the outbox delivery envelope and add tenant-scoped unsubscribe token/rate-limit records with forced RLS, explicit grants, exact state/event protections, hashes instead of token plaintext, and H4-compatible keys -- provider delivery and public-token state need durable, tenant-safe authority.
- `src/server/email/outbox.ts` and `src/server/email/{provider,templates}.ts` -- replace dark-only processing with a typed server-only adapter flow that checks release posture before every call, permits synthetic sandbox delivery, records provider outcomes safely, enforces preferences/suppression/dedupe/retry, and keeps real delivery blocked -- delivery remains fail-closed and idempotent.
- `src/app/api/jobs/run/route.ts` and `src/server/jobs/producers.ts` -- dispatch the activated processor exclusively from the existing runner and admit only active-module, priority-defined transactional flows -- no second execution lane or inactive-module send path appears.
- `src/server/commands/quotes/` and the relevant quote/email producer -- enqueue customer quote delivery only with the current valid snapshot PDF obtained through the existing narrow authorization path; stop reminders on every specified terminal condition -- customer mail carries bytes without a public customer capability.
- `src/server/notifications/`, `src/app/api/notifications/preferences/route.ts`, and `src/components/notifications/NotificationPreferences.tsx` -- make non-essential email preference state available only when the server release posture permits it, enforce it during enqueue/delivery, and retain Swedish unavailable/error states -- client toggles cannot bypass server policy.
- `src/app/(public)/unsubscribe/**` and server-only unsubscribe modules -- implement minimal unsubscribe/re-subscribe handling with generic inactive responses, revocation/audit, token/IP fixed windows, and no authenticated-shell imports -- the token is the entire narrowly scoped capability.
- `src/scope/manifest.ts`, `tests/integration/rls/tenant-table-inventory.ts`, manifest coherence tests, migration-reset inventory tests, and `scripts/verify/check-service-role-containment.mjs` -- declare the active notifications unsubscribe surface, enroll any new tenant tables, and replace the dark-posture provider ban with a narrow server-only adapter allowlist -- scope and containment guards fail loud on bypasses.
- `tests/unit/server/email/**`, `tests/integration/email/**`, `tests/integration/rls/**`, `tests/unit/scripts/verify/**`, and `tests/e2e/**` -- cover provider contracts, synthetic sent delivery, closed-gate no-call, suppression/dedupe/lease/retry, preferences, quote-PDF rejection, each reminder stop, public-token uniformity/rate limits/isolation, and provider/public-shell containment -- required database evidence runs with `SUPABASE_TEST_REQUIRED=1`.

**Acceptance Criteria:**
- Given a valid sandbox release configuration and synthetic recipient, when the sole jobs runner processes an eligible queued item, then it records one provider-backed `sent` outcome without exposing recipient or template data outside server-only paths.
- Given absent, invalid, preview-only, or unapproved real-recipient release state, when work is processed, then no provider call occurs and the item remains queued with no false sent result.
- Given concurrent workers, retries, or matching suppression, when they process outbox work, then existing tenant dedupe, disjoint claims, lease recovery, retry, and suppression-before-send invariants still hold.
- Given a non-essential email preference or unsubscribe token, when it is changed through its authorized surface, then future matching delivery is suppressed while essential categories and other tenants/categories are unaffected.
- Given unknown, revoked, or rate-limited public tokens, when the unsubscribe route is requested, then callers receive the same minimal inactive response or a rate-limit response without tenant enumeration, privileged capability, or authenticated-shell imports.
- Given customer quote delivery and every terminal reminder condition, when the quote PDF is stale/invalid or the quote is accepted, rejected, withdrawn, superseded, or expired, then no unauthorized attachment/send/reminder occurs; a valid delivery uses only current authorized PDF bytes and has no public acceptance link.

## Spec Change Log

## Review Triage Log

## Auto Run Result

Status: ready-for-dev

## Design Notes

The transport adapter is intentionally provider-agnostic. Release control is evaluated by the server immediately before submission, so a deployment setting cannot turn a queued real-recipient item into a send without the ADR-B011 owner record. The outbox stores only the server-side delivery data required to make that decision and never widens the existing Admin read model.

Unsubscribe is a separate public capability: the URL carries the only plaintext token, database lookup uses its SHA-256 hash, and the route derives scope solely from the resolved token. This keeps it outside the authenticated app boundary while preserving a narrow, auditable re-subscribe path.

## Verification

**Commands:**
- `pnpm run typecheck` -- expected: no TypeScript errors.
- `pnpm run lint` -- expected: no lint errors.
- `pnpm run test:unit` -- expected: provider, release-control, preference, unsubscribe, and containment unit coverage passes.
- `SUPABASE_TEST_REQUIRED=1 pnpm run test:integration` -- expected: migration, RLS, queue concurrency, token, and quote-PDF integration suites execute with no required skips or failures.
- `pnpm run test:e2e` -- expected: authenticated preference/Admin visibility and public-shell flows pass where their configured browser coverage applies.
