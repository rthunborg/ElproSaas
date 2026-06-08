# Quality Gates

## Gate 0: Scope Gate

Before any implementation work:

- Confirm the phase.
- Confirm whether the task is docs/config only or product implementation.
- Check against explicit Phase A deferrals.
- Check whether migrations, dependencies, network access, or `.env` changes are requested.

If scope is unclear, stop and ask for clarification.

Unclear scope blocks product implementation. It does not block read-only analysis, scope clarification, or docs-only clarification work.

## Gate 1: Repository Hygiene

Required for active development:

- Fresh install must be reproducible.
- One package manager must be chosen before product implementation.
- Generated build artifacts should not be hand-edited.
- Secrets must not be committed.

## Gate 2: Static Quality

Required for Phase A product PRs:

- Typecheck.
- Lint.
- Unit tests.
- Build.

For docs/config-only PRs, run lightweight file review and syntax checks where supported.

## Gate 3: Domain Correctness

Required when money, tax, calculations, quotes, or acceptance is touched:

- Golden-master fixture comparison.
- Unit tests for rounding, VAT, ROT, grön teknik, quote versioning, and immutability.
- Owner/accounting sign-off for business assumptions.

## Gate 4: Tenant And Security

Required when auth, tenant data, storage, server commands, or database policies are touched:

- Cross-tenant negative tests.
- Role/membership tests for implemented roles.
- No client service-role access.
- No unauthenticated privileged endpoint.
- Storage access tested for tenant isolation.

## Gate 5: Migration And Coexistence

Required when importing or replacing current Lovable behavior:

- Anonymized fixture captured.
- Old/new comparison documented.
- Fallback path documented.
- Manual backfill risks documented.

## Phase Acceptance Gates

| Phase | Minimum gates |
| --- | --- |
| Internal Pilot | Clean install, typecheck, lint, money/tax/unit tests, command integration tests, RLS negative tests, migration reset, setup docs, no privileged client paths. |
| External Beta | Role tests, mobile workflow tests, production observability, backup/restore runbooks, onboarding/offboarding, stricter audit, retention/deletion docs. |
| Commercial V1+ | Full RBAC tests, integration operations, performance/load tests, security scanning, customer docs, support SLAs. |
