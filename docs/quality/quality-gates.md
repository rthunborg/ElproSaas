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

These gates are enforced in CI. See [ci.md](ci.md) for the gate-to-command mapping and the deferred gates activated by later stories.

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

### Standing PR contract — tenant-owned tables must be enrolled (RLS coverage gate)

The cross-tenant negative tests are not a manual reviewer checklist — they are an
**automated standing gate** (architecture §18; the §9 RLS test matrix). A product PR
that **adds or touches a tenant-owned table MUST enroll it** in the parameterized
cross-tenant negative suite **before merge**, or CI fails:

- The single enrollment point is the tenant-table inventory module
  (`tests/integration/rls/tenant-table-inventory.ts`, `TENANT_TABLES`). The
  cross-tenant suite, the anonymous-path suite, **and** the H4 RLS table-inventory
  gate all read that one list, so a new table enlists by **data** (one edit), not by
  a copy-pasted parallel suite.
- The **H4 inventory gate** (`tests/integration/rls/rls-inventory-gate.int.test.ts`,
  run by the `db` job's `test:int`) introspects the live schema for tenant-owned
  `public` base tables and fails CI with a named **"table not covered"** message when
  any is unenrolled. A missing enrollment is **red CI, not reviewer diligence**
  (architecture §18 RLS coverage gate). "Tenant-owned" is defined precisely in the
  inventory module header (a `public` base table with a direct `tenant_id` column, or
  the `tenants` root); the gate handles the `tenants` edge case explicitly.
- **Service-role containment** is enforced at two layers: a fast source-level
  pre-build guard (`verify:service-role-containment`) and the **authoritative
  built-bundle grep** (`verify:bundle-containment`, run **after** `pnpm build`) that
  scans the produced `.next` payload for any service-role key name, the
  `LOCAL_SUPABASE_SERVICE_ROLE_KEY` re-export symbol, a `NEXT_PUBLIC_*SERVICE_ROLE*`
  name, or a `service_role` JWT value (architecture §9, §20). This app uses no
  service-role key (anon + RLS), so a clean build yields zero hits; a planted token
  turns the check red.
- The **command-isolation** dimension (a client-supplied `tenant_id`/parent id is
  rejected even when submitted) is enforced by the server command envelope and proven
  by `tests/integration/commands/envelope-failure-modes.int.test.ts`
  (`TENANT_ACCESS_DENIED`) — the §9 "Command isolation" matrix row.

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
