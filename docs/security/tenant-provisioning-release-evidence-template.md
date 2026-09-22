# Tenant provisioning release evidence template

Status: **NOT APPROVED / provisioning disabled**. This is an unfilled template, not hosted evidence. Copy into the platform's access-controlled release record; retain only redacted metadata and allowed evidence references.

| Release identity | Redacted value |
| --- | --- |
| Application revision / deployment ID | Pending |
| Intended public host / database target | Pending |
| Verification timestamp | Pending |
| Release operator / security owner / approver roles | Pending |

| Required gate | Result and restricted evidence reference |
| --- | --- |
| Compatible Decision 8A signer, RPC owner/grants/Vault reader and zero-write denials | Pending |
| Dedicated app/Vault key pair runtime match; bounded previous-key retirement if rotating | Pending |
| Hosted application TLS, database encryption at rest, protected provider transport | Pending |
| Disabled deployment denies operator page and actions; identity/allow-list checks remain required when enabled | Pending |
| Deployed nosniff, DENY framing, no-referrer and minimal Permissions-Policy; provider HSTS | Pending |
| Same-origin Server Actions and strict operator grant cookies; no permissive app ACAO | Pending |
| CSP exception accepted by platform/security owner under ADR-B010 | Pending |
| WAF production match: /operator and descendants; all methods; IP; 120/60s; HTTP 429; DDoS retained | Pending |
| WAF log review, preview enforcement, user publication and production rule inspection | Pending |
| Allow-list revocation / disabled-deployment containment verification | Pending |
| Final deployment revision and current key state approved for enablement | Pending |

Decision: **NO-GO until every required item is proven or the named CSP exception is explicitly accepted.** Record approver, timestamp, approved revision, evidence reference and limitations. Change `TENANT_PROVISIONING_ENABLED` to exactly `true` only through that approved release; verify the resulting serving deployment and refresh evidence for any changed revision/key/perimeter state. This file grants no approval.

Never include secret values, HMAC proofs, invitation tokens, signed URLs, credentials, privileged-account identifiers, customer data or decrypted Vault output. A historical CI result does not establish a hosted fact. Follow [the production-readiness procedure](tenant-provisioning-production-readiness.md).
