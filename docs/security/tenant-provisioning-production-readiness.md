# Tenant Provisioning Production Readiness

This procedure governs the transition from completed Epic 12 implementation
evidence to **real production tenant provisioning**. It records an enablement
gate, not a merge prerequisite. A PR may merge only through the normal
independent-review and CI gates; it may not enable real provisioning until this
procedure has been completed and explicitly approved.

It supplements the Story 12.1 Decision 8A contract in
[Security Guardrails](security-guardrails.md) and the planned rollout in
[Demo Environment](../process/demo-environment.md). It creates no deployment
provider change or hosted evidence claim. The repository controls and target
perimeter policy are now specified by
[ADR-B010](../decisions/ADR-B010-tenant-provisioning-production-enablement.md).

## Decision and ownership

| Role | Responsibility |
| --- | --- |
| Release operator | Assembles the redacted evidence pack for the exact production deployment and records the enablement decision. Does not approve their own incomplete evidence. |
| Security owner | Reviews the attestation-key, hosted-data-protection, and perimeter evidence against Decision 8A. Confirms that unresolved items are either proven or keep provisioning disabled. |
| Platform/security programme | Owns the ADR-B010 rate-limit, CORS, security-header policy, CSP exception and hosted verification. Supplies observed configuration and reviews changes before enablement. |
| Release approver | Gives the recorded go/no-go approval after the release operator and security owner have completed their checks. |

These are responsibilities, not person assignments. The normal PR review order,
required CI, scope checks, and security/RLS review remain merge gates under
[Branching and PR Policy](../process/branching-and-pr-policy.md). This
production gate cannot be bypassed by a manual database change, a service-role
call, a new public path, or a temporary relaxation of the Decision 8A contract.

## Evidence record and redaction

Keep the complete evidence pack in the access-controlled release/security
evidence record used by the platform programme. The release record must identify
the production deployment, application revision, database/project target, date,
reviewing roles, and final approval or refusal. The PR or release description
may link to that record and state its outcome, but must contain only redacted
metadata.

Use the [redacted release evidence template](tenant-provisioning-release-evidence-template.md)
to assemble the record. Its unfilled fields are not evidence or approval.

Never store in the repository, PR, screenshots, logs, audit events, or the
release record itself: secret values, attestation values, raw invitation tokens,
signed URLs, bearer tokens, customer data, credentials, or decrypted Vault
output. A non-secret key ID, provider object name, deployment identifier, and
pass/fail result may be retained only when they are allowed by the platform
programme's evidence-handling policy. Redact any value that would identify a
customer, privileged account, or secret-bearing configuration.

## Required evidence before enablement

The release operator must collect the following evidence for the exact intended
production deployment. A historical demo, local-stack, CI, source-code, or
catalogue result does not substitute for this hosted evidence.

### 1. Deployment and Decision 8A boundary

- Identify the deployed application revision and the matched hosted database
  target.
- Confirm the deployment contains the compatible server-only signer before the
  enforcement/removal migration is relied on.
- Keep `TENANT_PROVISIONING_ENABLED=false` (or absent in production) until the
  enablement approval. Only the exact value `true` enables the server operator
  boundary; it never replaces identity or database allow-list authorization.
  Verify disabled page/action access on the exact hosted deployment, retaining
  only generic denial results. Playwright's local production-mode opt-in is not
  hosted approval.
- Confirm the only callable provisioning writer remains the authenticated
  `provision_tenant` RPC; its database owner, grants, filtered Vault access,
  search path, and fail-closed attestation checks match the approved Decision
  8A contract.
- Preserve redacted verification that unauthenticated callers have no
  privileged provisioning capability, and that the only unauthenticated
  surfaces remain the ADR-B004 closed set: calendar feed, asset QR, and email
  unsubscribe. Self-serve signup and customer-facing provisioning remain out
  of scope.

### 2. Attestation key pairing and bounded rotation

- Confirm that the server-only application secret store and filtered Vault
  entry contain the same intended current key material for the recognised key
  ID, without reading, printing, or recording the secret value. The evidence
  must show the matching result and the exact app/deployment and Vault target
  it covers.
- Confirm the key is dedicated to tenant-provisioning attestations and is
  distinct from JWT, service-role, quote-PDF, and other key material.
- Record a controlled fail-closed verification appropriate to the release:
  valid current-key work can be accepted only through the approved signer and
  RPC path, while an absent, unknown, expired, wrong-domain, or tampered proof
  is rejected with zero writes. Do not use a raw secret or real customer data
  as evidence.
- For a rotation, establish and verify both current and previous app/Vault
  pairs before deploying the switch. The previous pair may remain accepted only
  for the maximum two-minute attestation TTL. Record the planned retirement
  time and the completed retirement result through the normal owner-approved
  secret process. Do not lengthen the overlap, accept unknown key IDs, or leave
  a previous key enabled as an open-ended fallback.

If matching app/Vault material, the compatible signer, or the bounded rotation
record cannot be proven, real provisioning remains disabled. Presence of a
secret name alone is not matching or runtime evidence.

### 3. Hosted transport and data protection

Obtain redacted, provider-originated evidence for the actual public deployment
and database project that:

- hosted TLS is active for the public application boundary and the observed
  certificate/endpoint belongs to the intended production deployment;
- the selected hosted database service provides encryption at rest for the
  intended project, including any provider limitation or configuration needed
  for that claim; and
- application-to-provider connections use the provider's supported protected
  transport configuration.

Do not infer these facts from a framework default, local configuration, a
provider marketing page, or a demo inspection. Any provider setting, exception,
or unconfirmed hosted value that the evidence does not establish stays recorded
as unresolved and blocks real provisioning enablement until the security owner
accepts evidence for it.

### 4. API perimeter and browser policy

The platform/security programme supplies redacted hosted verification of ADR-B010:

- Vercel WAF: production environment, exact `/operator` or path prefix
  `/operator/`, all methods, per-IP fixed 60-second window, initial threshold
  120 requests, excess action `rate_limit` returning **429** (not `deny`/403).
  Keep automatic DDoS mitigation enabled. Include console GETs, RSC requests
  and Server Action POSTs; exclude unrelated prefixes. Counters are regional,
  so this is not a globally atomic quota. Inspect actual plan support and any
  existing rules/bypasses before staging.
- Rollout: stage with excess action `log`; inspect the rule and staged diff;
  have the user publish and review matched traffic/shared-IP impact. Preserve
  production logging while testing a separate preview-scoped 429 rule, again
  inspected and published by the user. Confirm ordinary console navigation and
  submission work and excess preview requests receive 429. Then stage the
  production 429 rule, inspect its exact scope/diff, and have the user publish.
  Record rule ID, publication, observation and final production configuration.
  Watch the first 24 hours and keep a reviewed log-mode rollback available.
  Agent work may stage rules, but publication remains user-owned under the
  [Vercel firewall skill](https://github.com/vercel/vercel-plugin/blob/main/skills/vercel-firewall/SKILL.md).
- App CORS: same-origin operator pages/Server Actions, Next Origin versus
  Host/X-Forwarded-Host validation, no additional allowed origins or permissive
  ACAO. One-use operator grant cookies are HttpOnly, SameSite=Strict, Secure
  in production and scoped to `/operator`; these claims do not describe all
  Supabase auth cookies. Hosted Supabase CORS is not authorization: operator
  allow-list and Decision 8A HMAC checks remain mandatory for direct RPCs.
- Headers: verify `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, and
  `Permissions-Policy: camera=(), microphone=(), geolocation=()` on hosted
  application responses, plus Vercel-owned HSTS. CSP remains the explicit
  platform/security-owned exception in ADR-B010, requiring owner acceptance;
  a separate nonce/hydration implementation and verification task must address
  it. Do not introduce an untested CSP to satisfy a checklist.

The release operator verifies the final production policy covers provisioning
requests without expanding the closed unauthenticated perimeter. Source config,
an unpublished draft or log-only rule is not evidence of hosted enforcement.
Missing policy evidence keeps real provisioning disabled.

## Release approval checkpoint

Before enabling real provisioning, the release record must show all of the
following:

1. The release operator has assembled the required redacted evidence for the
   exact deployment and recorded any remaining limitations.
2. The security owner has reviewed the Decision 8A key pairing/rotation,
   hosted TLS/encryption, and perimeter evidence, and has rejected any
   unproven enablement claim.
3. The platform/security programme has supplied its applicable rate-limit,
   CORS, and security-header evidence or has explicitly left provisioning
   disabled pending that evidence.
4. The release approver has recorded an explicit enablement approval tied to
   the deployment revision and evidence record.

An approval applies only to the recorded deployment and current key state.
Redeployment, key rotation, a perimeter-policy change, or an unresolved evidence
failure requires the relevant evidence to be refreshed before provisioning is
enabled again. This checkpoint does not replace future independent PR review,
CI, required database/RLS evidence, manifest governance, or Phase B scope
constraints.

## Containment

Disable/remove the affected operator allow-list access through the approved
database operational path for immediate denial on subsequent authorization.
Set `TENANT_PROVISIONING_ENABLED=false` and deploy to every serving production
instance to close new console entries. Vercel environment edits require a new
deployment; verify its active revision and denial instead of assuming an edit
changed already deployed code. Remove allow-list access when containing old
deployments or direct RPC callers as well. Neither control cancels work already
in flight or reverses completed provisioning. Preserve audit/provisioning data
and reconcile uncertain invitation outcomes before a separately approved restart.

## Release evidence still to collect

At the time this procedure was added, it records required evidence only. It
does not assert that any production secret pairing, rotation, TLS,
encryption-at-rest, rate limiting, CORS, security headers, or release approval
has been configured or verified. Those hosted facts must be proven at the
release checkpoint above.
