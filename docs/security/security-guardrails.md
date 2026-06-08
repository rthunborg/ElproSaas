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
