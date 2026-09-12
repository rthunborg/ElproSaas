# Agent Instructions

Current project phase: Phase B / Legacy Parity Release. Product implementation
requires an approved story (or an ADR-backed task) AND must respect the scope
manifest — the single machine-readable source of truth for what surface is
active vs pending: `src/scope/manifest.ts` (ADR-B003). A module's **live surface**
(nav, tenant tables, widgets, notification categories, public surfaces, file
owner types) may exist only when that module is `active`; a module is flipped
`pending → active` in the **same PR** as its first schema/nav change (per-epic
activation, FR129). **`deferredFileToken` is the deliberate exception — it is
PENDING-only governance metadata, not live surface:** a pending module carries
the token that its module's files would use, and the file-index deny-list is
DERIVED from exactly those pending tokens (a token on an `active` module would
mean the deny-list blocks a shipped module's own files, so activation drops it).
Do not read the active-only rule as applying to deferred tokens — the manifest,
its coherence validator, and the deny-list tests all encode the opposite.

Mandatory rules:

- Treat the Lovable app as a behavioral oracle only. Do not copy code by default.
- Baseline plan: [docs/planning/saas-rebuild-phased-plan-2026-06-07.md](docs/planning/saas-rebuild-phased-plan-2026-06-07.md); Phase B/C direction: [docs/planning/post-phase-a-plan-2026-07-08.md](docs/planning/post-phase-a-plan-2026-07-08.md).
- **Scope is manifest-governed.** Phase B delivers the legacy parity inventory plus the two sanctioned additions (Fortnox integration, multi-tenant productization), wave-tagged B1a/B1b/B2/B3 in `src/scope/manifest.ts`. Every scope guardrail (the file-index deny-list, the nav guardrail expected set, the H4 tenant-table inventory, the deferred-token scope scans) DERIVES from the manifest; the coherence validator enforces presence AND coherence. Fail-loud is retained: any surface not manifest-listed fails CI (FR129/FR130).
- **Deferred to Phase C (hard exclusions — the Phase C ledger, PRD §14). No exceptions without a new owner decision:** all AI flows (DoU/self-inspection/tender/panel-image/KNX/supplier AI parsing, RAG chat, any AI job or mutation); live supplier vendor APIs (Ahlsell/Rexel/Solar/Sonepar — file import only in Phase B); customer portal / online acceptance (BankID/portal signing — end customers do not log in); bookkeeping integrations beyond Fortnox; the public anonymous suggestion endpoint (P70); net-new features beyond the parity inventory + the two sanctioned additions; the full-release legal/GDPR program parked in Phase A (customer-facing disclaimer wording `A22`-tax, retention program, authoritative tax-number ownership NFR15); a native mobile app; self-serve tenant signup (until N-2 resolves).
- Phase B module stories DO create database migrations, add dependencies, and modify app code — under manifest governance (an activation story flips the module `active` in the same PR as its schema/nav change). Process-only / docs-only tasks still do NOT create migrations, add dependencies, edit `.env`, or modify app code.
- No service-role access from client paths. No unauthenticated privileged functions. Unauthenticated surfaces are limited to the ADR-B004 closed set of three (calendar feed, asset QR, email unsubscribe), each carrying no privileged capability.
- Use the deeper docs in `docs/process`, `docs/quality`, `docs/security`, and `_bmad-output/project-context.md`.
- A live demo deployment exists (Vercel `enhancior/elpro-saas` + Supabase `elprosaas-demo`): see [docs/process/demo-environment.md](docs/process/demo-environment.md). Migrations flow repo→demo via `supabase db push` after merge; CI and tests never target the demo project.

## Code Review Rules

- Future completed implementation stories must contain one author-written `## Suggested Review Order`, following [the project convention](docs/process/review-order.md). The implementation/fix author refreshes rationale, verified stops and evidence after fixes; reviewers check it against the final change. Use the project BMAD hooks and section scaffold; do not backfill historical stories. The auto-bmad root delegates this work and never authors story code or spec content.

- Report concrete, production-reachable defects introduced by the PR that affect correctness, security, tenant isolation, data integrity, or customer-visible output. Before reporting a missing guard, verify whether an enforced downstream validator, database constraint, trigger, or authorized wrapper already blocks the path; if it does, report only an identified bypass.
- On follow-up commits, prioritize regressions in changed lines and unresolved consequential findings. After three completed review rounds, do not start another broad pass; limit follow-up review to regressions in the latest fixes and unresolved serious findings. Distinguish a reachable defect from optional defense-in-depth by naming the caller, authorization level, and invariant bypass.
- Leave deterministic formatting, lint, and schema-shape checks to CI. Do not restate them as review findings unless the PR disables or bypasses the check.

<!-- bmad:context -->
<!-- Verified 2026-09-08 against db2100af8401de4a336027463086fae5302f5a04. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## ElproSaas

ElPro is a multi-tenant application for electrical contractors, built with Next.js, TypeScript, and Supabase. Planning lives under `_bmad-output/planning-artifacts/`; shared governance lives in this file and `docs/`.

## Where things are

- For Phase B architecture changes, read `_bmad-output/planning-artifacts/architecture-phase-b.md`; current amendments supersede historical Phase A guidance.
- For money/tax changes, follow architecture-phase-b §12A and the shared `src/lib/money/` implementation.
- For quote lifecycle or PDF-provenance changes, read `docs/decisions/ADR-B008-quote-review-authority-and-derived-artifact-validity.md`.
- For deeper domain and implementation conventions, read `_bmad-output/project-context.md`; retain its recorded lessons while checking historical claims against current decisions.
- For local database or browser verification, read `docs/process/local-setup.md`, including resource ownership and cleanup requirements.

## Running and verifying

- For required integration/RLS evidence, set `SUPABASE_TEST_REQUIRED=1` and inspect executed/skipped counts; unavailable services can otherwise skip suites. Explicitly skipped tests are not coverage.
- Use Playwright's configured production web server; do not substitute `next dev`, whose HMR socket prevents hydration in headless Chromium.

## Conventions that differ from defaults

- Follow ADR-B009 for field workflows: connected responsive web at 360×640, explicit failure/retry, and success only after server-confirmed persistence. PWA installation, durable offline storage, queues, and synchronization remain Phase C.

<!-- /bmad:context -->
