# ADR-B010: Tenant Provisioning Production Enablement

Status: decided for implementation — 2026-09-22. Hosted enablement remains subject to the recorded release approval.

Scope: ADR-backed hardening of the active Epic 12 provisioning module and existing application perimeter. No new module, schema, public endpoint, tenant signup, or Phase C capability is introduced. ADR-B009 remains the field-workflow authority.

## Decision

The shared server operator authorization boundary checks `TENANT_PROVISIONING_ENABLED` on every entry. With `NODE_ENV=production`, only the literal string `true` enables access, including on Vercel preview deployments. Outside production, an absent value preserves the local/unit default; any explicit value other than `true` disables access. The Playwright production-mode local server explicitly sets `true`. The value stays in server environment access, never `NEXT_PUBLIC_*`, Next `env`, rendered props, or action responses. The existing generic denial does not reveal switch state.

Enabling the switch does not authorize an operator: cookie-bound identity verification and the current database allow-list still apply on each entry. Decision 8A operator checks and HMAC proof remain mandatory in the database. This switch contains new application entries; it does not cancel in-flight work or replace database revocation.

Hosted function ACL checks must inspect effective `anon` privileges as well as `PUBLIC`: provider defaults may grant roles independently. The Epic 12 ACL repair removes direct anonymous execution of `is_platform_operator()` while preserving authenticated, service-role and provisioning-owner callers. `audit_onboarding_checklist_dismissal()` is trigger-only and grants no direct execution to API roles; authenticated membership updates still produce its audit events. The regression test reproduces hosted grants inside a rolled-back local transaction before applying the repair.

All app routes receive `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`. No currently implemented browser workflow requests those device permissions. Vercel continues to own HSTS; the application does not replace that header. Hosted responses still require verification after deployment.

CSP is an intentional exception owned by the platform/security programme. A safe nonce policy needs separate Next hydration, RSC, authentication, PDF and deployment-preview testing. This change adds no unsafe or untested CSP, and the release record must record the security owner's acceptance of this exception. Framing is denied by X-Frame-Options in the interim. Future device-permission workflows must review Permissions-Policy explicitly.

Operator pages and Server Actions are same-origin. Retain Next's Origin versus Host/X-Forwarded-Host validation; configure no extra allowed origins and no permissive `Access-Control-Allow-Origin`. The one-use operator approval/reconciliation cookies are HttpOnly, SameSite=Strict, Secure in production, and scoped to `/operator`. Supabase SSR authentication cookies have their separate library behavior; do not claim they are all SameSite=Strict. CORS is browser policy, not authorization. Hosted Supabase may accept cross-origin API requests; valid operator identity, database allow-list checks and server HMAC attestations remain required for provisioning.

The target external Vercel WAF policy covers the production environment, exact `/operator` and descendants `/operator/…`, all methods, per client IP, fixed window 60 seconds, initial limit 120 requests, excess action `rate_limit` (HTTP 429). This includes Server Action POST requests and console navigation. Do not match unrelated prefix paths such as `/operator-other`. Counters are regional, not a globally atomic quota. Automatic DDoS mitigation stays enabled. No provider settings are changed by this ADR or app configuration.

Roll out via logged traffic, preview enforcement, then production enforcement; the user reviews and publishes each staged provider change under the Vercel firewall skill. Shared-IP impact, normal operator navigation and submission traffic, and 429 behavior require observed evidence before enablement. The release procedure below owns the detailed checklist.

## Containment and consequences

Set the switch to `false` and deploy it to all serving production instances. Updating a Vercel environment value alone does not change an existing deployment. Disable/remove operator allow-list access in the hosted database through the approved privileged operational path when immediate containment is required; this also covers old deployments and direct RPC attempts. Neither measure undoes completed work or guarantees cancellation of work already in flight. Retain audit and provisioning records, then reconcile uncertain invitations after incident review.

The [production-readiness procedure](../security/tenant-provisioning-production-readiness.md) is the enablement authority. Repository tests establish local behavior only. Hosted secret pairing, transport, encryption, header responses, WAF publication, containment verification and release approval require a separate redacted evidence record.

## References

- [Next Server Action origin validation](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)
- [Vercel WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
- [Release evidence template](../security/tenant-provisioning-release-evidence-template.md)
