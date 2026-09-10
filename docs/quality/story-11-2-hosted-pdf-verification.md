# Story 11.2 Hosted PDF Verification

Status: **verified** — 2026-09-10

## Decision and scope

**IN:** An owner-authorized, controlled hosted smoke verified the merged Story
11.2 runtime path: a Seller generated a fresh quote PDF and previewed it through
the app's audited broker. The run used disposable demo data on
`elprosaas-demo` and was not CI or a regression suite.

**DEFERRED:** This evidence does not replace code review, expand hosted testing
into CI, authorize customer sending or acceptance, or establish a custom email
path. The quote and PDF remain demo fixtures for owner inspection.

## Deployment and migration

| Evidence | Verified value |
| --- | --- |
| Merged main commit | `8723a3b66e986e045655d114c7fafa7af9155f73` |
| Demo migration | `20260907171252_role_aware_phase_a_policy_evolution.sql` applied; database reports `20260907171252` |
| Production deployment | `dpl_3LgNpc9NL3DpWY4C88nF2rFatoJe` |
| Browser alias | `https://elpro-saas.vercel.app` |
| CI on merged main | [passed run 34480169710](https://github.com/rthunborg/ElproSaas/actions/runs/34480169710) |

## Sanitized durable database evidence

The following metadata-only query was run against demo project
`wmqmzznmwpheswjjozhq`. It returns identifiers, statuses, and booleans only;
it selects no customer fields, PDF bytes, signed URLs, secrets, or tokens.
The disposable quote is `e3e22207-310e-4315-a341-14f8044e337a`. Before the
Seller action, its version was draft, `not_generated`, had no PDF file, and had
no prior PDF-generation or preview audit.

```sql
select qv.id, qv.pdf_status, qv.pdf_file_id,
 exists(select 1 from public.file_links fl where fl.owner_type='quote_version' and fl.owner_id=qv.id and fl.file_id=qv.pdf_file_id and fl.purpose='quote_pdf' and fl.archived_at is null) as active_pdf_link,
 exists(select 1 from public.audit_events ae where ae.target_id=qv.id and ae.command='quote.pdf.render.complete' and ae.event_type='quote.pdf.generated' and ae.actor_user_id='3a301cc2-cc48-4985-b63e-fcbd2c48df1d') as seller_generation_audit,
 exists(select 1 from public.audit_events ae where ae.target_id=qv.id and ae.command='quote.pdf.signedAccess.create' and ae.event_type='quote.pdf.signed_access.created' and ae.actor_user_id='3a301cc2-cc48-4985-b63e-fcbd2c48df1d') as seller_preview_audit,
 exists(select 1 from public.tenant_memberships m where m.user_id='3a301cc2-cc48-4985-b63e-fcbd2c48df1d' and m.tenant_id=qv.tenant_id and m.role='saljare' and m.status='active' and not exists(select 1 from public.membership_roles mr where mr.membership_id=m.id)) as seller_only_membership,
 exists(select 1 from public.tenant_memberships m where m.id='ce2e9bda-7225-4c9d-901f-55b56c75ba6a' and m.status='disabled') as fixture_admin_disabled,
 (select max(version) from supabase_migrations.schema_migrations) as latest_migration
from public.quote_versions qv where qv.id='3e86a2ff-4606-4e8b-9f04-b8e68418f5a1';
```

Result: quote version `3e86a2ff-4606-4e8b-9f04-b8e68418f5a1` is
`generated`; PDF file `ee16e8f2-6bfc-42d5-b592-2c36512790a2` is bound by an
active quote-PDF link; `active_pdf_link`, `seller_generation_audit`,
`seller_preview_audit`, `seller_only_membership`, and
`fixture_admin_disabled` are all `true`. The Seller actor is
`3a301cc2-cc48-4985-b63e-fcbd2c48df1d`. The disabled fixture-admin membership
is `ce2e9bda-7225-4c9d-901f-55b56c75ba6a`; it belonged to the separate fixture
operator `d142d1e3-988c-486c-804a-93030f9dc2e5`, never the Seller.

## Runtime observations

- A real Seller password session, with no service-role browser or session
  impersonation, created the fresh PDF through the normal app action and then
  requested the normal preview.
- The preview response was HTTP 200, identified as a PDF, had valid PDF
  signature/content type, was 4,228 bytes with SHA-256
  `3924bef745bfb075b16ca779c0fba761a7fe1ab9fc24665f462384d838bc8d06`, and
  parsed as one page. The rendered page was inspected as readable and complete,
  without clipping or overlaps.
- Direct Seller Storage listing disclosed no objects. Direct download and raw
  signed-URL creation against the database-confirmed PDF object each returned
  HTTP 404, while the audited app broker succeeded.

Together, the generated state/link, two Seller-attributed audit records, valid
preview, and raw-Storage negatives establish the deployed attestation-secret
and server-only signing path beyond configuration-presence checks.

## Limits and sources

The earlier full-diff review timeout remains historical; this hosted smoke is
runtime evidence only. Source contracts are
`src/server/quote-pdf/attestation.ts`,
`src/server/storage/quote-pdf-signer.ts`,
`src/server/commands/quotes/quote-pdf-signed-access.ts`, and
`supabase/migrations/20260907171252_role_aware_phase_a_policy_evolution.sql`.
