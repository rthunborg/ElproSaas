# Security Guardrails

## Non-Negotiable Rules

- No service-role key in browser/client paths.
- No unauthenticated privileged functions.
- No `.env` edits unless explicitly requested.
- No secrets in prompts, logs, screenshots, docs, fixtures, or committed files.
- No database migrations without an approved migration story.
- No production tables for deferred modules during Phase A.

## Tenant Isolation

The default architecture is pooled multi-tenant SaaS:

- Production contains many tenant companies.
- Every business row must be tenant-owned.
- RLS must enforce tenant isolation.
- Tests must prove Tenant A cannot access Tenant B data.
- Admin-only Phase A still requires cross-tenant negative tests.

## Auth And Authorization

Phase A implements only `tenant_admin`.

Future roles must not be simulated with client-only UI checks. When added, permissions must be enforced server-side and in RLS where applicable.

Any service-role use must be documented with file path, purpose, and test coverage.

## Platform Tenant Provisioning (Story 12.1 Decision 8A)

- `provision_tenant` is the only public authenticated provisioning writer and the only callable provisioning `SECURITY DEFINER` RPC. Server code calls it under the platform operator's normal Supabase Auth JWT; the function derives current `auth.uid()` and verifies `is_platform_operator()` itself.
- Every mutation also requires a server-minted, domain-separated HMAC-SHA-256 attestation. Preview remains stateless/no-write and reconciliation remains provider-free with sanitized output.
- The provisioning key is a dedicated 256-bit secret, separate from JWT, service-role, and quote-PDF keys, present only in the app secret store and a filtered Supabase Vault entry. Use the established length-prefixed Node/Postgres encoding, explicit key IDs, fail-closed verification, maximum two-minute TTL, and current/previous overlap bounded to that TTL. Never persist, log, audit, return, screenshot, or commit the attestation or key.
- The RPC owner is a dedicated least-privilege `NOLOGIN NOINHERIT` role with only required table operations and filtered Vault-secret access. `authenticated` receives EXECUTE on this exact RPC only. `PUBLIC`, `anon`, `authenticator`, and `service_role` receive no provisioning-RPC execution or provisioning-table DML, and callers never inherit the owner role.
- The attestation binds action/schema, operator, canonical request and organisation identity, preview/approval, authoritative baseline, token hash, exact invitation/membership/reservation identity, absolute approval/dispatch generations, expected generation, sanitized outcome, key/attestation IDs, and issued/expiry. Invalid proof fails generically with zero writes.
- The authoritative baseline catalogue is migration-owned, insert-only database data. No runtime role has DML; TypeScript is only a preview/build-time mirror with mandatory coherence tests.
- Provider flow is DB commit → signed `reserve_dispatch` returning durable provider identity facts → at most one server-only Auth call → separately signed sanitized outcome for that reservation/generation. Caller-supplied retry identity and stale/out-of-order/conflicting outcomes fail closed. Raw invitation tokens remain in server memory and never enter the RPC.
- No legacy delegate/fallback, custom provisioning JWT, service-role database call, second callable DEFINER writer, trusted `fresh_approval` boolean, or second-person approval is allowed. Provision matching app/Vault key material and a compatible signer before applying the enforcement/removal migration.

## Server Commands

Sensitive mutations must:

- Verify authenticated user.
- Verify tenant membership.
- Validate input.
- Run transactionally where consistency matters.
- Write audit events.
- Ignore client-supplied `tenant_id`, or verify it against authenticated tenant membership in every command.

## Storage And Files

- Buckets should be private by default.
- File metadata must be tenant-owned.
- Signed URLs should be short-lived.
- Uploads require MIME and size validation.
- Deletions should be auditable.
- Anonymized fixtures must not contain customer secrets or personal data.

## Lovable Oracle Handling

The current Lovable app may contain real company/customer data. Agents must:

- Inspect only what is needed.
- Avoid pasting sensitive records into docs.
- Export anonymized fixtures for tests.
- Preserve behavior with golden masters, not copied code.

## Deferred Integrations

Fortnox, supplier APIs, AI jobs, public cron jobs, and webhook endpoints are deferred. Any future implementation must include explicit auth/signature verification, audit logs, idempotency, and negative tests.
