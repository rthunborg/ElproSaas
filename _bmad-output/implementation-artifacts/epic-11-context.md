# Epic 11 Context: RBAC Mechanism and Admin User Management

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Replace the tenant-admin-only model with enforceable, tenant-scoped roles and a single permission mechanism, then give admins audited user and role-management tools. This establishes least-privilege access for the active Phase A surface and a reusable authorization, RLS, and test foundation for every later module activation.

## Stories

- Story 11.1: Role Storage and Permission-Matrix Mechanism
- Story 11.2: Non-Admin Access to the Phase A Surface (Matrix Seed, Role-Aware RLS, Nav and Landing)
- Story 11.3: Admin User Management
- Story 11.4: Roles Surface, Effective Permissions, and the Per-Role Test Harness

## Requirements & Constraints

- Support the five tenant roles Företagsadmin (stored as `tenant_admin`), Projektledare, Montör, Säljare, and Ekonomi. A membership can hold multiple roles; authorization is the union of their grants. Arbetsledare is a job-scoped assignment delivered with jobs, never a tenant role.
- Use the owner-supplied permission keys for customers, jobs, quotes, invoice basis, economy, users, roles, and company settings. Permissions cover resource/action, data scope, and sensitive-field groups; keys represent stable operations rather than pages. Deny by default.
- Activate the Phase A matrix seed: Företagsadmin, Projektledare, and Ekonomi can see sales prices, cost, and contribution margin; Montör sees none; Säljare sees sales prices but cost and contribution margin are withheld unless explicitly entitled. A below-margin warning for Säljare may reveal only a server-computed boolean and threshold label, never cost-derived values.
- Every command and read is server-authorized. Unauthorized navigation, commands, queries, and cross-tenant attempts return generic denials without existence signals. Client-side hiding is usability only.
- Entitlement absence is distinct from null or zero. Sensitive values must be absent from payloads, exports, aggregates containing withheld data, and emails; the response exposes entitlement metadata so UI can omit table columns or render `Dold` in details.
- Admins can invite, resend, revoke, reset, deactivate, reactivate, re-role, and end memberships. Audit every membership and role/permission change; role/permission changes require a reason. Preserve history, prevent removal/demotion/deactivation of the last active tenant admin, and never mutate a shared Auth account globally.
- A removed membership is ended and returns only through a fresh invitation with explicit roles. Resends supersede prior attempts; revoked or superseded invitations cannot activate access. Tenant access remains database-authoritative.
- No tenant-facing custom-role builder or DB permission-table model is in scope. Tenant-specific role compositions are controlled internally through a validated configuration or internal platform surface.

## Technical Decisions

- Keep `tenant_memberships` as the tenant/user authority and add `membership_roles` with tenant, membership, and role uniqueness. Widen the legacy role check additively while retaining the `tenant_admin` literal and `is_tenant_admin()` semantics.
- Define a typed, version-controlled `permission-matrix.ts` mapping module, capability, roles, and sensitive-field entitlements. The manifest coherence validator rejects an activated module with no matrix rows. Derive command checks, nav/tabs, landing routes, the effective-permissions viewer, and negative tests from it.
- Add `requireCapability` after membership resolution in the command envelope. It returns stable `PERMISSION_DENIED`; job-specific elevation is checked inside job commands when that module arrives.
- Use hardened, non-public SECURITY DEFINER role helpers with fixed empty search paths and schema-qualified references. RLS combines active membership, the role gate, and applicable row scope. Generate policy role arrays from the matrix and prove policy-to-matrix agreement.
- Enforce row-sensitive data with role-gated RLS. Put column-sensitive data in separately role-gated companion tables for new Phase B schemas; server read models still project data and return `{ data, entitlements }`.
- Before calling Supabase Auth, validate actor and target and record the tenant-scoped operation plus audit event transactionally. Record success, failure, or uncertainty and provide retry/reconciliation without duplicate membership mutation. Do not add a general background-job or custom email system.

## UX & Interaction Patterns

- Provide Admin-only `Användare & roller` with `Användare` and `Roller` tabs. Users show status, role set, invite/revoke/resend and lifecycle actions, an audit-event panel, and an effective-permissions grid grouped by module with the granting role.
- Seed-role cards explain access; the Roles view shows only manifest-active module rows, sensitive-field entitlements, member counts, and that Arbetsledare is assigned within a job.
- Show an immediate-effect warning for role edits. Describe deactivation and removal as tenant-scoped loss of company access while preserving history. Mark inactive people in retained records and leave future-booking reassignment as the scheduling seam.
- Render withheld detail values with the `MaskedValue` treatment (`Dold` and accessible explanation), never as zero or blank; omit withheld table columns entirely.

## Cross-Story Dependencies

- Story 10.1 supplies the scope manifest and is required before the matrix/coherence integration.
- 11.1 establishes the role, matrix, helper, and envelope mechanisms; 11.2 applies them to the Phase A surface; 11.3 uses them for membership administration; 11.4 exposes the matrix and generalizes the harness.
- This epic precedes B1b activations. Every future module activation must add matrix rows and per-role command/RLS evidence through the harness.
