> **HISTORICAL / SUPERSEDED — do not use this as an execution handoff.** Story
> 11.2 is complete and its hosted PDF evidence is in
> [Story 11.2 hosted PDF verification](../quality/story-11-2-hosted-pdf-verification.md).
> The Phase 5, pending-resource, and local-stack directions below describe the
> 2026-09-07 recovery state only. Use
> [Story 11.3 handoff](story-11-3-handoff.md) for the next story.

# Story 11.2 implementation recovery

Prepared 2026-09-07 at the user's request. This document supplements the
[story specification](../../_bmad-output/implementation-artifacts/spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing.md)
and its [ATDD checklist](../../_bmad-output/test-artifacts/atdd-checklist-spec-11-2-non-admin-access-to-the-phase-a-surface-matrix-seed-role-aware-rls-nav-and-landing.md).
It changes the execution handoff, not the owner-approved product scope or acceptance bar.

## Readiness and dispatch

- Specification: `in-progress`, ready to resume **Phase 5 implementation**.
- Auto-bmad phases 0-4 remain complete; phases 5-9 are incomplete. Do not re-plan,
  regenerate ATDD, enter review directly, or mark the story done.
- The previous partial implementation is committed at `b725092`; its original
  build baseline is `efd8d73d53479ba737a09456c7d740cdaa6e028b`. Preserve both as
  review evidence, including when the build workflow captures a resume baseline.
- Docker server 29.7.2 and project-local Supabase status responded during this
  preparation pass. No database reset, migration application, fixture write,
  application startup, or acceptance-test execution was performed.
- The 2026-09-09 recovery session and its delegate received their own trusted
  hook contexts. That establishes lifecycle identity, but it does not transfer
  ownership of the already-running local Supabase stack or make it disposable.
  Existing-stack ownership/reset authorization remains pending; no database write,
  reset, service start, or service stop was performed during the audit recovery.

Use `/auto-bmad --story 11-2` after that prerequisite is established. The resume
must recheck local readiness; status observations here are not a lease or proof
of migration/fixture readiness. The story is not ready to ship.

## Audit authority recovery decision

Status: `in-progress`. The conflict recorded by the 2026-09-09 build halt is
resolved architecturally without widening the generic audit RPC:

- `public.record_audit_event` remains authenticated and Admin-only. It is not a
  non-admin envelope escape hatch because its caller controls command, event,
  target, and metadata.
- Each audited non-admin mutation moves behind an authenticated-only,
  command-specific `SECURITY DEFINER` wrapper with an empty `search_path`. The
  wrapper verifies `auth.uid()`, tenant membership and the exact matrix-authored
  role set, owns target lookup/generation, binds the audit action and target, and
  commits the mutation plus audit row in one transaction.
- The shared internal audit primitive owns the database timestamp and repeats
  actor/active-membership checks. It has no execute grant for `PUBLIC`, `anon`,
  `authenticated`, or `service_role`; it is reachable only from checked wrappers.
- Revoke the corresponding direct authenticated DML grant as each command is
  migrated. Otherwise an entitled caller could bypass both the command capability
  and its audit record through PostgREST.

`customer.create` is the reference implementation in migration
`20260907171252_role_aware_phase_a_policy_evolution.sql`. Its focused integration
suite proves entitled Seller success with exactly one trustworthy audit row,
cross-tenant and unentitled denial, raw audit forgery denial, direct customer
INSERT denial, function ACL/search-path hardening, and mutation rollback when the
audit insert fails. Static checks pass; the database suite is authored but remains
unexecuted until the existing local stack is confirmed disposable and reset.

The recovery inventory found 33 audited paths capable of being granted to a
non-admin role: CRM 6, pricing/settings 6, calculation-level 3, quotes 12, jobs 2,
and files 4. The reference migration closes one path; Phase 5 must migrate the
remaining 32. The nine existing atomic quote/provenance/PDF wrappers need their
internal Admin assertion evolved to their declared role capabilities, while the
other paths need command-specific atomic wrappers and direct-DML bypass closure.
High-churn calculation row/section/reorder commands are intentionally unaudited
and are outside this recovery inventory.

## Runtime requirements

Follow the user's standing resource lifecycle instructions and
[local setup](local-setup.md). Use `C:\Users\Rasmus\.agent-runtime\resource-guard.ps1`
only through built-in Windows PowerShell 5.1 with the hook-injected context.
Check every machine result and verified cleanup result. Do not improvise global
Docker/WSL changes, broad cleanup, or an untracked startup path.

An already-running Supabase stack is not automatically owned by this run.
Establish whether it is owned or borrowed and whether it is a disposable,
isolated project test stack before any reset or fixture mutation. Do not reset
or stop another actor's stack. A valid hook context is necessary but does not
prove the guard supports an arbitrary Supabase/Compose startup: the supported
ComposeUp model is restricted, so an unsupported lifecycle path must remain an
explicit blocker. Playwright's configured production build/start also creates
a server and must follow the same lifecycle rules.

Tests target local Supabase only, never the demo or a shared hosted database.
Set `SUPABASE_TEST_REQUIRED=1` for required integration runs. Check actual executed
test counts: this setting does not activate explicit `test.skip()` declarations.
Use the existing Node unit runner (`pnpm run test:unit`); `tsx` is not required.

## Implementation order and completion criteria

1. **Reconcile authority and inventory.** Audit the partial matrix against
   architecture-phase-b.md ADR-B001 sections 3.3A-3.7, the active manifest, and
   existing server commands. Record module, business capability, operation,
   role grants, table/policy, row scope, sensitive fields, and test identifiers.
   Enumerate membership resolution separately from the seven navigation modules.
   Do not infer tenant-wide scope from a financial entitlement or Jobs.ViewAssigned.
   All-held-role union behavior remains mandatory; granting a field does not
   independently grant its parent module or row.
2. **Create real proof fixtures.** Extend isolated tenant/role fixtures and
   replace the scaffold's declared-but-unimplemented adapter. Test actual
   production commands/read models and authenticated RLS operations. Catalog
   inspection must independently compare deployed policy predicates/grants with
   the expected matrix and row scope; add a deliberate-drift failure proof.
3. **Implement database access.** Complete the existing empty
   `20260907171252_role_aware_phase_a_policy_evolution.sql` after checking where
   it has been applied. Prove membership self-read, role-child self-read, each
   governed table operation, Storage, lifecycle locks and unchanged Admin paths.
   Do not broaden audit RPC grants or use privileged bypasses to make a new role
   mutation pass. If a required authorized mutation conflicts with the enforced
   downstream audit contract, identify the concrete caller and invariant and
   resolve within the approved architecture or surface that precise conflict.
4. **Complete commands and safe reads.** Declare the real operation capability
   on each Phase A command; deny before validation, target lookup or audit. Test
   both a same-tenant missing and existing target plus a cross-tenant target.
   Inventory nested snapshots, exports, PDFs, files and owner-label lookups as
   well as top-level money fields. Projection alone cannot protect an inline
   value obtainable through direct PostgREST/Storage. Apply ADR-B001's carried
   module closure where required. If a required role journey cannot coexist with
   that closure, record the concrete table/field/journey conflict; do not invent
   a schema split, widen access, or silently drop the journey.
5. **Wire the surface.** Connect landing and route guards to server entry points;
   a helper existing on disk is insufficient. Verify nested routes, role-union
   navigation, inaccessible cross-module selectors/labels, generic denial, and
   no client authority imports. Keep the Montor dashboard fallback until E15 and
   job assignment/Arbetsledare enforcement in E16. Do not add those surfaces now.
6. **Activate, verify, then review.** Repair/activate all ten ATDD scenarios or
   replace them with demonstrably equivalent executed tests. Record the final
   coverage mapping. Run the specification's verification commands, satisfy
   every I/O matrix row, and only then enter configured build-auto review.
   Post-build TEA and required follow-up review still follow in auto-bmad order.

A returning implementation worker that lists unfinished work must be resumed
or its remaining work completed before the parent runs the final matrix audit,
as build-auto step 3 already requires. Ordinary unfinished work is not itself
an external blocker. Missing runtime capability or a concrete unresolved
architecture conflict is a blocker; record it and preserve resumable state.

## Required evidence at implementation completion

| Spec matrix row | Required executed evidence |
| --- | --- |
| Legacy Admin | Real scalar-only active Admin context and existing Admin read/write/lifecycle regression paths. |
| Seeded role union | Table-driven role sets, ordering/duplicates, grant union, server nav/landing, and authenticated row-scope behavior. |
| Crafted denial | Command before-lookup/no-audit tests, real RLS negatives, direct-route denial, and absence of sensitive serialized fields/aggregates. |
| Jobs assignment seam | Jobs.ViewAssigned does not grant whole-tenant jobs; unavailable assignments add no capability; Montor fallback has no protected money. |

Map all five acceptance criteria as well as these four matrix rows. For a role
with broad same-tenant grants, prove a cross-tenant or other actual forbidden
operation; never fabricate a denial for an allowed business operation. For a
module with no mutation or table, mark that dimension not applicable with its
reason and cover its real read boundary. Do not create a dashboard command just
to fill a test matrix. The suite must fail if an expected role/module/operation
case is omitted; an empty loop is not evidence.

Report command, test identifier, executed/pass/skip counts, and relevant fixture
or migration baseline. Historical lint/typecheck/unit passes and authored
scaffolds do not establish acceptance coverage. No skipped covering test,
constant-return adapter, or expected-results-only catalog may satisfy the audit.
