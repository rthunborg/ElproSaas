# Epic 11 Context: RBAC Mechanism and Admin User Management

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Replace the tenant-admin-only model with a mechanism-first, server-enforced authorization system and self-service tenant user administration. The epic establishes one auditable permission source, makes least privilege real across the active Phase A surface, prevents sensitive financial data from reaching unentitled users, and supplies reusable proof that role boundaries hold as later modules activate.

## Stories

- Story 11.1: Role Storage and Permission-Matrix Mechanism
- Story 11.2: Non-Admin Access to the Phase A Surface (Matrix Seed, Role-Aware RLS, Nav and Landing)
- Story 11.3: Admin User Management
- Story 11.4: Roles Surface, Effective Permissions, and the Per-Role Test Harness

## Requirements & Constraints

- Support the tenant roles Företagsadmin (stored as `tenant_admin`), Projektledare, Montör, Säljare, and Ekonomi. A user may hold multiple tenant roles; permissions are the union of those roles. Arbetsledare is a job-scoped designation, never a tenant role.
- Authorize every read and mutation on the server through both capability checks and RLS. UI visibility is convenience only. Deny by default, and return generic authorization failures with no data or existence signal.
- Make the permission matrix a machine-readable, versioned source of truth. Each module activation must add its own matrix rows in the same change, and activation without them must fail validation.
- Use the owner-approved money defaults: Montör receives no sales price, cost price, or contribution margin; Säljare receives sales prices but not cost or margin by default; Projektledare, Ekonomi, and Företagsadmin receive all three. A separately granted contribution-margin capability may extend Säljare access. A below-permitted-margin warning for Säljare may reveal only a server-computed boolean and threshold label, never a cost-derived amount.
- An unentitled role must never receive a sensitive value in a response, export, or email. A withheld field is absent from data and declared as withheld; a partial aggregate that includes withheld components is also withheld.
- Admins must be able to invite, resend or revoke invitations, reset passwords, activate/deactivate, change roles, and end memberships. Audit every action and role/permission change; role/permission changes require a reason. Do not permit deactivation, role downgrade, or removal of the tenant's last active Admin.
- Preserve history when a membership is ended or deactivated; do not hard-delete it. Auth administration is server-only and must not be importable from client paths. Supabase Auth invitations are the sanctioned email path; custom invitation email waits for the notification/email posture.
- CI must prove boundaries for every seeded role and active module: at least one denied-command test and one RLS read/write negative, plus policy-to-matrix agreement. The reusable harness must generate both allowed paths and denied cases.
- Do not add DB permission tables, tenant-facing custom role building, tenant-runtime-mutable roles, or changes to `is_tenant_admin()` semantics.

## Technical Decisions

- Keep the existing `tenant_admin` literal and widen the role constraint additively. Store multi-role assignments in `membership_roles` keyed by tenant, membership, and role; authorization APIs accept role sets.
- Define a typed, `satisfies`-guarded matrix in `src/server/authz/permission-matrix.ts`, mapping module and capability to allowed roles and declaring sensitive-field entitlements. Use the stable named business capability vocabulary (for example `Jobs.ViewAssigned`, `Jobs.ViewAll`, `Economy.ViewCostPrice`, and `InvoiceBasis.ExportToFortnox`), never page or widget names.
- Add `requireCapability(ctx, moduleId, capability)` after membership resolution in the command envelope. It evaluates the role set and returns stable `PERMISSION_DENIED` on failure.
- Use hardened `has_tenant_role(tenantId, allowedRoles)` RLS helpers: fixed empty search path, schema-qualified references, `STABLE`, PUBLIC access revoked, and standing negative tests. Policies combine active membership, matrix-derived role gate, and required row scope; generate role arrays from the matrix and fail loud on drift.
- RLS is the sensitive-data floor: role-gate fully sensitive rows and use companion tables for sensitive columns on otherwise-readable Phase B rows. Server read models return `{ data, entitlements: { withheld } }`; the descriptor distinguishes withheld data from genuinely empty data. Exports and emails use the same recipient-specific projection.
- Derive navigation, tab/widget visibility, landing redirects, the effective-permissions view, and test cases from the same matrix. Render the permissions viewer server-side; do not ship the matrix to the client as authority.

## UX & Interaction Patterns

- Show only active-manifest modules for which the role has read access. Hide inaccessible items rather than disabling or teasing them; direct unauthorized navigation reaches a generic access experience.
- The Admin-only `Användare & roller` area has `Användare` and `Roller` tabs. Users lists show identity, role set, invitation/active/deactivated status, and last sign-in; invite and lifecycle actions confirm their effects and expose an event history.
- The user detail provides a read-only, server-derived effective-permissions grid grouped by module and annotated with the granting role. The Roles tab shows only seed roles, member counts, manifest-active module capabilities, and sensitive-field entitlements; explain that Arbetsledare is assigned within a job.
- Render withheld values as an explicit masked state in details and omit wholly withheld columns in dense tables. Never substitute zero, null-like fallback, or a client-side role calculation; hide an entire feature area when masking would make it unusable.

## Cross-Story Dependencies

- Story 11.1 depends on the Story 10.1 manifest/coherence groundwork. Stories 11.2, 11.3, and 11.4 build respectively on the role mechanism, Phase A role-aware enforcement, and the preceding administration surface.
- This epic precedes B1b: every later module activation relies on its matrix, RLS, entitlement, navigation, and negative-test mechanisms.
- Job-scoped Arbetsledare enforcement belongs with the later job-members model, while this epic must preserve the boundary. Custom email remains dependent on the notifications/email work; use the existing Auth invitation path here.
