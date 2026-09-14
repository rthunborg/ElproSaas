# Demo Environment (MVP)

Provisioned 2026-07-03 after Epic 5 (owner decision). This is the **internal
pilot / demo** deployment of the Phase A app — not production, and not a test
target. It exists so the owner can demo the product and pilot users can try it.

## Topology

| Piece | Value |
| --- | --- |
| Hosting | Vercel project [`elpro-saas`](https://vercel.com/enhancior/elpro-saas) (Enhancior team), auto-deploys from `main` on GitHub `rthunborg/ElproSaas`. |
| Database | Supabase project **`elprosaas-demo`** — ref `wmqmzznmwpheswjjozhq`, region `eu-north-1` (Stockholm), **Enhancior** org (`oykbutypisxdgifmrxid`), free tier. [Dashboard](https://supabase.com/dashboard/project/wmqmzznmwpheswjjozhq). |
| App env vars (Vercel) | The 2026-09-10 Production inventory contains `NEXT_PUBLIC_SUPABASE_URL=https://wmqmzznmwpheswjjozhq.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`, `QUOTE_PDF_ATTESTATION_KEY_ID`, and `QUOTE_PDF_ATTESTATION_HMAC_SECRET`. On 2026-09-14, Production `NEXT_PUBLIC_APP_URL` was set to `https://elpro-saas.vercel.app`. Seller quote-PDF preview uses the service-role secret only in `src/server/storage/quote-pdf-signer.ts` after the checked database target binding; never expose or commit it. `ELPRO_QUOTE_SEND_TRACK=demo` is a documented explicit disposable-demo opt-in for sending, but was absent from this inventory and was not provisioned for the PDF setup. The application default remains fail-closed `real_customer`, blocking unresolved `TAX_SIGN_OFF_REQUIRED` before send. |
| Accounts | As of 2026-09-10, the Enhancior Supabase MCP connection and the default Supabase CLI independently reach the correct demo project. The committed named profile has not been rechecked; do not infer its current authentication state from this evidence. |

## Auth callback configuration

**IN — 2026-09-14 authenticated dashboard inspection:** the demo project's Supabase Auth Site URL is `https://elpro-saas.vercel.app` and its sole redirect URL is `https://elpro-saas.vercel.app/auth/invite/confirm`. The invite and recovery preview links use `{{ .ConfirmationURL }}`. At that inspection, custom SMTP was off; confirm email was on, while anonymous sign-ins and manual linking were off. These settings were saved and re-navigation confirmed them.

**SEAM — controlled hosted mail proof:** the owner subsequently reported that SMTP credentials were entered and authorized one manual invitation/recovery proof against this demo project and the matching Vercel deployment. Record neither credentials, mailbox identity, nor verification URLs in the repository. The invitation proof passed: a real mailbox receipt, unmodified link, hosted callback, application acceptance, and isolated membership/role verification completed. It used the authenticated backend invitation operation and Auth Admin API, not the user-facing Server Action. After an existing dead SPF include target in the `enhancior.se` Cloudflare zone was replaced with the Google Workspace provider record, a recovery message reached the inbox with SPF, DKIM, and DMARC passing. This is a single controlled sample; it does not establish a deliverability or availability SLO. Hosted password recovery remains in progress through password update and fresh sign-in. The displayed sender name remains a Supabase Auth configuration follow-up. The proof may establish receipt and application behavior only; automated CI continues to use the local stack, and neither a configuration report nor a single test establishes availability, retention, or recovery objectives. Monitoring and backup workflows are production operations, not permission to target generic integration tests at the hosted project.

**SEAM — scheduled operational checks:** the backup workflow is disabled pending an approved destination and uses bounded Storage inventory/checksum controls with exact pooler-target validation. Monthly heartbeat `elpro-monthly-recovery-check` is configured for the first day at 09:00 local to inspect backup freshness, recovery evidence, monitoring gaps, and the 100 SEK/month cap; it has not yet executed. These controls do not prove a hosted restore, alert delivery, retention, or availability.

## Supabase CLI profile (per-project isolation)

Added 2026-07-14 after another project on the dev machine overwrote the global
`~/.supabase/profile` selector and broke every CLI call. This repo pins its own
CLI profile so cross-project clobbering can't recur:

- **Profile file:** [`supabase/cli-profile.yaml`](../../supabase/cli-profile.yaml)
  (committed; YAML — the CLI's TS implementation parses custom profiles with a
  YAML parser and silently falls back to the default profile on a parse
  failure, so don't convert it). It points at the normal production platform;
  only `name: elprosaas` is project-specific. No secrets.
- **Selection:** `SUPABASE_PROFILE=supabase/cli-profile.yaml` is set in the
  committed `.claude/settings.json` `env`, so agent sessions always use it
  (env/flag beat the global `~/.supabase/profile` file). The relative path
  resolves against the process cwd — run `supabase` from the repo root, or use
  `--profile` with an absolute path. Humans: set the env var in your shell or
  pass `--profile` explicitly.
- **Token slot:** the CLI stores its access token in the OS credential store
  under the ACTIVE profile's name, so this profile needs a one-time
  `supabase login --profile "<repo>/supabase/cli-profile.yaml"` (browser flow,
  Enhancior account). Other projects should get their own profile file + name
  + login the same way; then no project's `supabase login` can evict another's
  token, and nothing needs to write the shared global selector file.

## Schema & data lifecycle

- **Migrations flow one way: repo → demo.** The committed `supabase/migrations/`
  set is the contract. The repo is `supabase link`ed to the demo project; after
  an epic merges to `main`, apply new migrations with `supabase db push`
  (sanctioned by the 2026-07-03 guardrail decision — see
  [claude-code-coexistence.md](claude-code-coexistence.md)). Never edit the demo
  schema directly; never write a migration against the demo DB first.
- **CI never touches this project.** All CI jobs run against the LOCAL Supabase
  CLI stack only (see [ci.md](../quality/ci.md)). Do not point any test at the
  demo project.
- **Demo data is disposable.** It was seeded by one-off scripts (session
  scratchpad, not committed) connecting as the managed `postgres` role via the
  session pooler (`aws-1-eu-north-1.pooler.supabase.com:5432`, user
  `postgres.<ref>`, TLS verified against the published Supabase prod CA). The
  seeded content: tenant **Elpro Demo AB** (company settings, approved quote
  terms, 2 work roles, 3 articles, 2 customers — one company with facility +
  contact, one private with a fake personnummer — and one calculation with
  sourced/hidden/tillval rows). Reseeding or extending demo data the same way is
  fine; keep it obviously fake (`.example.test` emails, fabricated org/person
  numbers, öre values under 10 digits).

## Admin users (Phase A has no signup/invite flow — users are provisioned manually)

| Email | Tenant | Role |
| --- | --- | --- |
| `rasmus.thunborg@enhancior.se` | Elpro Demo AB | `tenant_admin` |
| `johan@eraelteknik.se` | Elpro Demo AB | `tenant_admin` |
| `alexander.lewandowski@gmail.com` | Elpro Demo AB | `tenant_admin` |

Passwords are held by the owner (never committed anywhere); reset via the
Supabase dashboard (Authentication → Users) if lost. To add another user:
insert into `auth.users` + `auth.identities` (GoTrue email-provider shape,
`extensions.crypt(pw, extensions.gen_salt('bf'))`, confirmed email, matching
`auth.identities` row with `provider_id = user id::text`) plus a
`tenant_memberships` row (`role='tenant_admin'`, `status='active'`) — or use
the dashboard's Add User button and insert only the membership row. When
inserting `auth.users` by SQL, set `confirmation_token`, `recovery_token`,
`email_change`, and `email_change_token_new` to `''` (not NULL) — GoTrue fails
sign-in with a 500 "Database error querying schema" otherwise. SQL can be run
without the DB password via `supabase db query --linked` (Management API).

### Controlled Seller verification account (2026-09-10)

**IN:** `seller.pdf-verification@elpro.example.test` is a disposable hosted
smoke-test account for the PDF verification runbook. Its auth user ID is
`3a301cc2-cc48-4985-b63e-fcbd2c48df1d`, tenant ID is
`f93c7922-f152-4c54-a60b-943bd6e1db7a`, and active membership ID is
`cfc1c7e1-5064-4816-a992-9f917b6eded5`, with scalar role `saljare` and no
`membership_roles` rows. The DPAPI credential was reloaded and used for a new
password sign-in. The resulting Seller JWT plus the anon API key invoked the
PostgREST `has_tenant_role` RPC and returned Seller true, Admin false, and
Projektledare false. This is actual-session authorization evidence, not a
service-role or database-session simulation.

For same-Windows-user agents, the password is available only through the
DPAPI-encrypted PSCredential at
`%USERPROFILE%/.codex/private/elprosaas-demo/seller-pdf-verification.credential.xml`.
Import it privately with `Import-Clixml`; never print the password or store a
session token. This convention is a SEAM for the authorized controlled Seller
smoke only, not a general credential-distribution mechanism.

## Guardrail posture (what agents may/may not do here)

- **Allowed:** `supabase link`, `supabase db push` (committed migrations only),
  read-only inspection, demo-data seeding as above.
- **Still hard-blocked** (deny-list + `guard.ps1`): `supabase projects delete`
  and edge-function deploys. The DB password is owner-held; do not persist it
  in the repo or any committed file. The owner specifically authorized the
  2026-09-10 Vault/Vercel provisioning and the controlled Seller hosted smoke;
  that narrow authorization does not generalize secret operations or hosted
  mutations.
- The demo project is NOT a stop-condition violation: the CI "no shared
  dev/staging/prod project" rule constrains CI, which remains local-stack only.

## Server attestation provisioning and rotation (ADR-B008)

**IN:** Production/demo PDF-byte activation and successful signed-file-access audit finalization use a server-side HMAC secret identified by a key ID: Vercel environment variables `QUOTE_PDF_ATTESTATION_KEY_ID` and `QUOTE_PDF_ATTESTATION_HMAC_SECRET`, plus a matching Supabase Vault secret named `quote_pdf_attestation_<key-id>`. Signed-file access derives a domain-separated file-specific subkey from this approved root; it does not add another production credential. The secret is never committed, displayed in logs, or supplied to clients. Local/test setup may use the clearly test-only key ID `test_v1` and a disposable test-only secret; it is not a deployable secret.

Provision a new key in this order: create `quote_pdf_attestation_<key-id>` in Vault first; set the matching server-only Vercel variables; then deploy. Verify with the approved fresh database/application evidence before relying on the key.

For rotation, create and deploy the new matching key before removing the old Vault secret. Retain the old secret through old-deployment drainage plus the maximum five-minute in-flight render lease, then retire it with an audited owner-approved operational change. This is a deployment runbook, not a new retention or deletion workflow.

**Dated provisioning evidence (2026-09-10):** the sensitive Production
`SUPABASE_SERVICE_ROLE_KEY` existed in Vercel (its value was not inspected). A
new 48-byte random HMAC was created in the demo Vault and transferred through
in-memory stdin into the matching sensitive Production
`QUOTE_PDF_ATTESTATION_HMAC_SECRET` and `QUOTE_PDF_ATTESTATION_KEY_ID` values;
Vault metadata confirmed exactly one matching name. An individual Vercel
public-environment read confirmed the exact demo Supabase URL. No secret value
or key ID is recorded here. Deployment `dpl_AkQ7qeViPeUKu1LKQPLFpUE5scMv`
(`https://elpro-saas-3z6064332-enhancior.vercel.app`) completed successfully
from current `main` SHA `2e12d27f09af47686270f118b16fc2c4515bffe8`.

**Runtime status — VERIFIED (2026-09-10):** the merged main commit
`8723a3b66e986e045655d114c7fafa7af9155f73`, migration `20260907171252`, and
Production deployment `dpl_3LgNpc9NL3DpWY4C88nF2rFatoJe` were verified by the
owner-authorized Seller smoke. The durable evidence, scope, and remaining
limits are recorded in [Story 11.2 hosted PDF verification](../quality/story-11-2-hosted-pdf-verification.md).

## Hosted PDF runtime verification (manual, post-merge)

**Decision — IN:** prove the production Vercel deployment and the
`elprosaas-demo` database together, only after the merged migration has been
applied with `supabase db push`. This procedure verifies merged `main` and its
matching committed migrations; automated tests never use the shared demo
database. This run is a controlled demo-data mutation, not CI.

### 1. Provisioning presence (necessary, not runtime proof)

1. Confirm the Vercel **Production** target for `enhancior/elpro-saas` is
   built from merged `main` and its `NEXT_PUBLIC_SUPABASE_URL` targets ref
   `wmqmzznmwpheswjjozhq`.
2. Create exactly one non-empty Vault secret in the same demo project named
   `quote_pdf_attestation_<key-id>`, where `<key-id>` is the intended Vercel
   key ID, and set its value to the intended HMAC secret. Keep both values out
   of terminals, logs, commits, browser clients, and audit metadata.
3. In that deployment's server-only environment, set
   `SUPABASE_SERVICE_ROLE_KEY`, `QUOTE_PDF_ATTESTATION_KEY_ID`, and
   `QUOTE_PDF_ATTESTATION_HMAC_SECRET`. The latter two are required by
   `src/server/quote-pdf/attestation.ts`; a missing value fails closed. The key
   ID must match `^[A-Za-z0-9_-]{1,64}$`; the implementation imposes no other
   documented production-secret format requirement. The HMAC secret is only
   checked for non-emptiness in code; use a cryptographically generated,
   high-entropy value as an operational requirement, but do not present an
   entropy or format threshold as code-enforced. Never use the local
   `test_v1`/test-only fixture secret in a hosted environment.
4. Deploy or redeploy after all Vercel variable changes, then select that
   resulting Production deployment for the runtime check.
5. A database owner may establish **presence only** without decrypting or
   displaying a secret:

   ```sql
   select exists (
     select 1
     from vault.secrets
     where name = 'quote_pdf_attestation_<key-id>'
   ) as quote_pdf_attestation_secret_present;
   ```

   `true` does not prove that the Vault and Vercel values match, that the
   deployment received its variables, or that runtime signing works. Do not
   query `vault.decrypted_secrets` for this check.

### 2. Runtime proof

1. Sign in to the matching hosted deployment as a demo `Säljare` and use a
   disposable draft quote. Generate a **fresh** PDF with `Generera PDF`; wait
   for `PDF genererad`, then use `Förhandsgranska`. A successful preview proves
   the server-only signer can use `SUPABASE_SERVICE_ROLE_KEY` after the
   database has bound the exact file target.
2. Verify durable, metadata-only evidence for that newly generated version as
   a database owner. The generated row must have `pdf_status = 'generated'`, a
   non-null `pdf_file_id`, an active `quote_pdf` link to that same file, and a
   `quote.pdf.generated` audit event for the same version. After the successful
   preview, it must also have a `quote.pdf.signedAccess.create` /
   `quote.pdf.signed_access.created` audit event for that version. Substitute
   the known disposable version UUID; this query returns identifiers/statuses
   only, never customer content, a signed URL, or secret material:

   ```sql
   select qv.id, qv.pdf_status, qv.pdf_file_id is not null as has_pdf_file,
          exists (
            select 1 from public.file_links fl
            where fl.owner_type = 'quote_version'
              and fl.owner_id = qv.id
              and fl.file_id = qv.pdf_file_id
              and fl.purpose = 'quote_pdf'
              and fl.archived_at is null
          ) as has_active_pdf_link,
          exists (
            select 1 from public.audit_events ae
            where ae.target_id = qv.id
              and ae.command = 'quote.pdf.render.complete'
              and ae.event_type = 'quote.pdf.generated'
          ) as has_pdf_generated_audit,
          exists (
            select 1 from public.audit_events ae
            where ae.target_id = qv.id
              and ae.command = 'quote.pdf.signedAccess.create'
              and ae.event_type = 'quote.pdf.signed_access.created'
          ) as has_signed_preview_audit
   from public.quote_versions qv
   where qv.id = '<disposable-quote-version-uuid>';
   ```

   This is the proof that the server HMAC and the matching Vault secret passed
   `complete_quote_pdf_render`; configuration presence alone cannot establish
   it. A successful preview additionally proves the server-only signer and the
   post-signing HMAC audit finalizer completed for the bound file/version. If
   generation evidence is present but `has_signed_preview_audit` is false,
   preview did not complete successfully (or this is not the newly previewed
   disposable version); investigate the preview stage rather than treating
   generation as signed-access proof.
3. For the optional technical negative-role check, use the same authenticated
   `Säljare` session and the disposable PDF's object path. Confirm the normal
   quote-page preview still works, then verify that raw persistent Storage
   browse, download, and URL-signing operations are denied. Do not use or share
   a service-role key or signed URL. Record only pass/fail and the disposable
   version identifier; remove or archive the demo fixture according to the
   owner's normal demo-data practice.

### Troubleshooting by stage

| Stage | Evidence / likely boundary | Next check |
| --- | --- | --- |
| Provisioning | Variable or Vault-presence check is absent | Confirm the Production deployment/database pairing, exact key-ID spelling, and the one Vault name. Redeploy after Vercel changes. |
| PDF generation | `Generera PDF` fails or remains failed | Inspect the hosted server error without exposing secrets. A missing, malformed, duplicate, empty, or mismatched HMAC/Vault key fails closed before activation. |
| Preview | PDF is generated but `Förhandsgranska` fails | Confirm the same deployment has `SUPABASE_SERVICE_ROLE_KEY`; the preview signer is the only service-role exception and runs after a checked database target binding. |
| Durable proof | UI result has no generated state/audit row | Check that the post-merge migration was applied to the demo project and query the exact disposable version ID. Do not repair rows manually. |
| Role boundary | A raw Storage operation succeeds for `Säljare` | Stop the rollout check and investigate the Storage/RLS policy; do not compensate with a client service-role credential. |

**Assumptions / questions:** this guide records code and migration contracts,
not an independent inspection of Vercel, Vault, or the deployed runtime. The
installed Supabase CLI syntax for Vault secret creation remains unverified;
use the dashboard or confirm the local CLI's version and help output before
performing that owner-controlled operation.

**Source evidence:** `src/server/quote-pdf/attestation.ts` (environment key-ID
validation); `src/server/storage/quote-pdf-signer.ts` (server-only preview
signer); `src/components/quotes/QuotePdfPanel.tsx` (hosted UI actions);
`supabase/migrations/20260831124312_story_10_9_quote_pdf_attachment_validity.sql`
(Vault lookup, HMAC verification, generated state, audit event);
`supabase/migrations/20260907171252_role_aware_phase_a_policy_evolution.sql`
(signed-preview attested audit finalizer); and
`tests/integration/commands/quote-pdf-validity.int.test.ts` (Säljare raw
Storage denial contract).

## Post-epic routine (for future epic runs)

After an epic's PR merges to `main`:
1. Vercel auto-deploys `main` — no action needed.
2. If the epic added migrations: `supabase db push` (repo is already linked).
3. Optionally extend demo data so the new surface has content to show.
