# Epic 12 Context: Tenant Provisioning and Onboarding

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make ElproSaas deliverable to independent companies without engineering intervention: an authorised platform operator can create a new tenant, establish its baseline, invite the first Admin, and that Admin can complete the existing configuration needed for a working tenant. The flow must preserve pooled-tenancy isolation throughout and provide an end-to-end proof with a second tenant.

## Stories

- Story 12.1: Platform Operator Identity and the Provision-Tenant Command
- Story 12.2: Operator Console
- Story 12.3: First-Admin Onboarding Checklist

## Requirements & Constraints

- Provisioning is internal, contract-after-signing work only. No public self-registration route, UI, copy, or future-facing signup seam may ship.
- The flow creates a tenant, applies the baseline, and creates the invited first-Admin membership; it must be validated, dry-runnable without writes, idempotent by organisation identity, audited (including the approving person), and safely re-runnable after partial failure. A repeat returns a stable already-provisioned result rather than creating a duplicate.
- Use a structured, version-controlled request/template rather than free-text input. It includes company identity and VAT details, contacts and locale, first Admin, subscription and enabled modules, contract/trial terms, profile and numbering/quote settings, VAT/deduction defaults, email, schedule/calendar, and any permitted initial users or imports. Preview exactly what will be created before an authorised internal person approves execution.
- Commercial terms are tenant data, never application logic. Store subscription status/plan, included users, additional-user price, enabled modules/feature flags, dates, billing reference, and commercial overrides; do not hardcode prices, discounts, or special terms.
- An operator may see only tenant identity, provisioning status, created date, and first-Admin state. The console and provisioning path must never expose or traverse tenant business data; unauthorised and cross-tenant attempts receive generic denials.
- A newly invited first Admin reaches a working state by completing company settings, VAT/display settings, quote terms (with the carried sign-off warning), work roles/pricing baseline, and user invitations. Completion is derived from real server state, not click tracking.
- Required evidence includes atomic rollback, idempotency, operator/forged-claim/absent-claim denials, console data-exposure negatives, tenant-isolation negatives, audit assertions, checklist derivation and dismissal/resume tests, plus an automated or scripted provisioning-to-working-state proof.

## Technical Decisions

- Keep the pooled Supabase tenancy model. `platform_operators` is the narrowly enumerated platform-scoped exception: it records the operator user, grant time, and grantor, and permits operator self-read only. All other new data remains tenant-scoped.
- Gate operator access with a hardened `is_platform_operator()` DEFINER helper: fixed empty search path, schema-qualified references, explicit authorisation, revoked PUBLIC access, and standing negative tests.
- `provision_tenant` is the sole sanctioned provisioning write path and the one Epic 12 SECURITY DEFINER RPC. It must use the same hardening, check operator authority inside the function, atomically create tenant/baseline/invited membership, and write tenant-attributed audit records. Supabase Auth administration for the invite runs server-side in the command's service context, never inside the RPC and never client-reachable. Do not introduce another DEFINER function without human approval.
- Provisioning/onboarding status uses additive `tenants` columns. Derive checklist state server-side from existing settings, pricing, and user state; only per-admin dismissal is persisted as a small column, not a checklist table.
- Any AI assistance is limited to orchestrating and validating a bounded request. It gets neither general database access nor arbitrary production SQL, and secrets do not enter prompts.
- Treat operator console tables/routes as platform-scoped manifest entries, not a tenant-module activation. Preserve Phase B scope guardrails and RLS/H4 conventions for touched schema.

## UX & Interaction Patterns

- Place the console in the same application at `operator/**`, with its own layout outside tenant context, the tenant AppShell, and tenant navigation. Enforce operator authorisation on every server entry, not merely the layout.
- The Swedish operator wizard is linear, resumable, and explicit about commits: company details, displayed baseline defaults, then first-Admin invitation, followed by audit summary and invite status. It supports dry-run, preview-then-approval, interrupted-flow resume, and an already-provisioned state.
- On first sign-in, pin the `Kom igång` checklist on the dashboard until all five server-derived items are green. It is dismissible and resumable, and every item deep-links to its real settings surface. Provide a reminder affordance when an incomplete checklist was dismissed.
- Provisioning is connectivity-required. Show progress, clear failure/retry states, and success only after server-confirmed persistence; do not present stale state as current. Use concise Swedish operational labels and messages.

## Cross-Story Dependencies

- Epic 11 supplies the role, membership, and invite machinery needed by provisioning and first-Admin onboarding.
- Story 12.1 establishes the allow-list and command before the console in Story 12.2; Stories 12.1 and 12.2 precede the final end-to-end onboarding path in Story 12.3.
- The phase's second-tenant proof is scheduled after this epic and re-run at phase close.
