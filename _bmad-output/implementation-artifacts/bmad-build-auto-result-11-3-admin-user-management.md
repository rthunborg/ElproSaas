---
status: blocked
---

# BMad Build Auto Result

Status: blocked
Blocking condition: intent gap

## Evidence and unanswered decisions

Story 11.3 requires invitation resend/revoke/expiry and archive-preserving removal, while the current `tenant_memberships` lifecycle only permits `active`, `invited`, and `disabled`. It has no revoked, ended, or expiry state/timestamp, and its `auth.users` reference cascades on deletion. The owner must select the durable lifecycle representation, including whether an ended membership can ever be re-invited and the authoritative treatment of expired/revoked invitations.

The story also requires every admin action to be fully audited, but Supabase Auth administration is an external service call relative to the database transaction. The owner must select the failure and retry contract for Auth success plus database failure, database success plus Auth failure, resend, and revoke. This needs an explicit authority for idempotency, reconciliation, and any compensation before a server-only service credential path is implemented.

The existing permission and routing seams, membership-role storage, Admin-only `Memberships.Manage` capability, hardened membership RLS helper, append-only audit path, and server-only containment guards were investigated. The specification was deliberately not drafted because choosing either missing contract would produce materially different lifecycle, audit, and access-control behavior.
