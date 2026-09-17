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
- ElPro tenants are companies/legal entities, not individuals. V1 accepts Swedish non-personal legal entities only (`SE` + normalized checksum-valid ten-digit organisation number), rejects personnummer-shaped identities and sole proprietorship tenants, and treats formatting/name variations as the same identity. Archived/inactive tenants retain the durable identity reservation. This does not restrict CRM end customers, which may be companies or private individuals without personnummer capture.
- The flow creates a tenant, applies the exact versioned server-owned baseline, and creates the invited first-Admin membership atomically before any Auth Admin call. Dual idempotency uses request UUID + canonical request hash plus canonical organisation identity: same ID/hash returns the original result; same ID/different content returns `IDEMPOTENCY_CONFLICT`; different ID/same identity returns `ALREADY_PROVISIONED`; no replay silently updates.
- Use strict `schema_version = 1`, never free text. Required fields are request ID, legal identity/name, first Admin, baseline profile/version, subscription plan/status, included users, additional-user price in integer öre, and contract start. Optional fields are VAT, contacts/address, contract/trial end, billing reference, structured commercial overrides, Reply-To, known active modules/approved flags, and supported profile fields. Unknown/version-mismatched fields fail explicitly; future recognized fields may appear as deferred but block execution and are never stored for later.
- The server-owned baseline applies `sv-SE`, `Europe/Stockholm`, `SEK`, approved existing VAT/tax-profile references, terms placeholders/sign-off warnings, approved number-series defaults, and conservative display defaults. V1 rejects logo/files, Fortnox setup, schedules/calendar, extra initial users/imports, pending modules, arbitrary flags, raw tax rates, final legal terms, free-text agent instructions, and secrets.
- Preview is stateless and writes no DB, audit, Auth, or preview row. It returns the schema/request IDs, normalized identity, validations/warnings, action, exact baseline profile/version, every proposed value, first Admin, proposed audit events, unsupported/deferred fields, and server hash. Execution resubmits the original request/hash with explicit approval; mismatch rejects and baseline drift returns `PREVIEW_STALE`. Approver comes only from the authenticated allow-listed `auth.uid()`; one operator may preview and approve.
- Commercial terms are tenant data, never application logic. Store subscription status/plan, included users, additional-user price, enabled modules/feature flags, dates, billing reference, and commercial overrides; do not hardcode prices, discounts, or special terms.
- An operator may see only tenant identity, provisioning status, created date, and first-Admin state. The console and provisioning path must never expose or traverse tenant business data; unauthorised and cross-tenant attempts receive generic denials.
- A newly invited first Admin reaches a working state by completing company settings, VAT/display settings, quote terms (with the carried sign-off warning), work roles/pricing baseline, and user invitations. Completion is derived from real server state, not click tracking.
- Required evidence includes atomic rollback, idempotency, operator/forged-claim/absent-claim denials, console data-exposure negatives, tenant-isolation negatives, audit assertions, checklist derivation and dismissal/resume tests, plus an automated or scripted provisioning-to-working-state proof.

## Technical Decisions

- Keep the pooled Supabase tenancy model. `platform_operators` is the narrowly enumerated platform-scoped exception: it records the operator user, grant time, and grantor, and permits operator self-read only. All other new data remains tenant-scoped.
- Gate operator access with a hardened `is_platform_operator()` DEFINER helper: fixed empty search path, schema-qualified references, explicit authorisation, revoked PUBLIC access, and standing negative tests.
- `provision_tenant` is the sole sanctioned provisioning write path and the one Epic 12 SECURITY DEFINER RPC. It must use the same hardening, check operator authority inside the function, atomically create tenant/baseline/invited membership/identity-idempotency facts/`pending_first_admin_invite`, and write tenant-attributed audit records. Supabase Auth administration starts only after commit, runs server-side, never inside the RPC and never client-reachable. Do not introduce another DEFINER surface.
- Persist `pending_first_admin_invite`, `first_admin_invite_unknown`, `first_admin_invite_requested`, `first_admin_invite_failed`, and `ready`. Provider acceptance means requested, not delivered; timeout means unknown; definitive failure stores only a sanitized code plus operator retry. Retry reconciles membership/invitation/Auth identity by normalized email, reuses a usable Epic 11 invitation, and sends anew only when none exists. Audit every transition through existing authorised paths.
- Provisioning/onboarding status uses additive `tenants` columns. Derive checklist state server-side from existing settings, pricing, and user state; only per-admin dismissal is persisted as a small column, not a checklist table.
- Phase B ships no AI provisioning flow. Free-text agent instructions are rejected; no client or off-product assistant receives database access, arbitrary production SQL, secrets, or credentials.
- Treat operator console tables/routes as platform-scoped manifest entries, not a tenant-module activation. Preserve Phase B scope guardrails and RLS/H4 conventions for touched schema.

## UX & Interaction Patterns

- Place the console in the same application at `operator/**`, with its own layout outside tenant context, the tenant AppShell, and tenant navigation. Enforce operator authorisation on every server entry, not merely the layout.
- The Swedish operator wizard has three data-entry steps plus a hash-bound approval confirmation: eligible company identity/details, displayed exact baseline defaults, then first-Admin name/e-mail. Dry run says nothing was saved and shows every required preview field. Resume derives from durable state; request conflict, already-provisioned identity, stale baseline, and each first-Admin handoff state have explicit truthful outcomes, never an email-delivery claim or implicit update.
- On first sign-in, pin the `Kom igång` checklist on the dashboard until all five server-derived items are green. It is dismissible and resumable, and every item deep-links to its real settings surface. Provide a reminder affordance when an incomplete checklist was dismissed.
- Provisioning is connectivity-required. Show progress, clear failure/retry states, and success only after server-confirmed persistence; do not present stale state as current. Use concise Swedish operational labels and messages.

## Cross-Story Dependencies

- Epic 11 supplies the role, membership, and invite machinery needed by provisioning and first-Admin onboarding.
- Story 12.1 establishes the allow-list and command before the console in Story 12.2; Stories 12.1 and 12.2 precede the final end-to-end onboarding path in Story 12.3.
- The phase's second-tenant proof is scheduled after this epic and re-run at phase close.
