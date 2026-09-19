# Demo Environment (MVP)

Provisioned 2026-07-03 after Epic 5 (owner decision). This is the **internal
pilot / demo** deployment of the Phase A app — not production, and not a test
target. It exists so the owner can demo the product and pilot users can try it.

## Topology

| Piece | Value |
| --- | --- |
| Hosting | Vercel project [`elpro-saas`](https://vercel.com/enhancior/elpro-saas) (Enhancior team), auto-deploys from `main` on GitHub `rthunborg/ElproSaas`. |
| Database | Supabase project **`elprosaas-demo`** — ref `wmqmzznmwpheswjjozhq`, region `eu-north-1` (Stockholm), **Enhancior** org (`oykbutypisxdgifmrxid`), free tier. [Dashboard](https://supabase.com/dashboard/project/wmqmzznmwpheswjjozhq). |
| App env vars (Vercel) | The 2026-09-10 Production inventory contains `NEXT_PUBLIC_SUPABASE_URL=https://wmqmzznmwpheswjjozhq.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY`, `QUOTE_PDF_ATTESTATION_KEY_ID`, and `QUOTE_PDF_ATTESTATION_HMAC_SECRET`. On 2026-09-14, Production `NEXT_PUBLIC_APP_URL` was set to `https://elpro-saas.vercel.app`. Seller quote-PDF preview uses the service-role secret only in `src/server/storage/quote-pdf-signer.ts` after the checked database target binding; never expose or commit it. `ELPRO_QUOTE_SEND_TRACK=demo` is a documented explicit disposable-demo opt-in for sending, but was absent from this inventory and was not provisioned for the PDF setup. The application default remains fail-closed `real_customer`, blocking unresolved `TAX_SIGN_OFF_REQUIRED` before send. Story 12.1's separate provisioning-attestation key is not part of this dated inventory and must not be inferred as provisioned. |
| Accounts | As of 2026-09-10, the Enhancior Supabase MCP connection and the default Supabase CLI independently reach the correct demo project. The committed named profile has not been rechecked; do not infer its current authentication state from this evidence. |

## Auth callback configuration

**IN — 2026-09-14 authenticated dashboard inspection:** the demo project's Supabase Auth Site URL is `https://elpro-saas.vercel.app` and its sole redirect URL is `https://elpro-saas.vercel.app/auth/invite/confirm`. The invite and recovery preview links use `{{ .ConfirmationURL }}`. At that inspection, custom SMTP was off; confirm email was on, while anonymous sign-ins and manual linking were off. These settings were saved and re-navigation confirmed them.

**SEAM — controlled hosted mail proof:** the owner subsequently reported that SMTP credentials were entered and authorized one manual invitation/recovery proof against this demo project and the matching Vercel deployment. Record neither credentials, mailbox identity, nor verification URLs in the repository. The invitation proof passed: a real Gmail receipt, unmodified link, hosted callback, application acceptance, and isolated membership/role verification completed. It used the authenticated backend invitation operation and Auth Admin API, not the user-facing Server Action. After an existing dead SPF include target in the `enhancior.se` Cloudflare zone was replaced with the Google Workspace provider record, a recovery message reached Gmail with SPF, DKIM, and DMARC passing; its unmodified hosted callback reached the password-update page. This is a single controlled sample; it does not establish a deliverability or availability SLO. The existing required local Auth-to-Mailpit browser test verifies password update and fresh sign-in, so no further personal hosted exercise is needed. Pinned private-fixture cleanup ended two memberships, revoked no invitations, and deleted no Auth users; an independent tenant-scoped read verified only two ended memberships and no active or invited membership. Auth users and records were retained, with no existing demo data cleanup. Cloudflare verified the owner Gmail destination. Free sender operations cannot be configured in the UI without an apex-MX change, so the owner has been asked to choose the existing `thunborg.se` sender on Free or paid operations; no DNS or paid-plan change was made. Sender name Kopplas is intentional future naming; no app, repository, or configuration rename is in scope. The proof may establish receipt and application behavior only; automated CI continues to use the local stack, and neither a configuration report nor a single test establishes availability, retention, or recovery objectives. Monitoring and backup workflows are production operations, not permission to target generic integration tests at the hosted project.

**SEAM — scheduled operational checks:** a private approved Workspace Drive folder was created and `BACKUP_DRIVE_FOLDER_ID` is configured as a GitHub secret; do not record its identifier here. A dedicated Google Cloud project has been prepared under the approved organization; billing was linked only because the UI required it, with no paid account activation or paid-resource deployment. Drive API was enabled and verified in the service-details UI on 2026-09-15. The internal OAuth app is prepared through the User Data Policy agreement step, which remains unaccepted; no OAuth client or grant exists. A project-only monthly 100 SEK gross-cost (credits excluded) budget is saved with 50/80/100% actual-cost email alerts to the approved billing/project recipients; current gross cost is 0 SEK and the existing account-wide budget is unchanged. It is alert-only, not a hard cap; [eligible-service coverage](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps) excludes Drive. An owner-only local GPG recovery key exists outside the repository; `BACKUP_GPG_PASSPHRASE` was set at 2026-09-15T09:33:24Z, and a fresh GitHub secret listing confirms four configured backup secrets. Independent owner recovery-key escrow and database-password input remain pending. Database URL is absent, so the workflow remains disabled. It uses bounded Storage inventory/checksum controls with exact pooler-target validation. Monthly heartbeat `elpro-monthly-recovery-check` is configured for the first day at 09:00 local to inspect backup freshness, recovery evidence, monitoring gaps, and the 100 SEK/month cap; it has not yet executed. These controls do not prove a hosted restore, alert delivery, retention, or availability.

**IN — 2026-09-14 pilot verification release evidence:** PR #65 CI [34925739157](https://github.com/rthunborg/ElproSaas/actions/runs/34925739157) passed at its PR head `141d3df`: 1,780 units with zero skips, 1,028 required DB/RLS tests with zero skips and `SUPABASE_TEST_REQUIRED=1`, plus 138 browser tests with four existing explicit skips. Post-merge main CI [34926333592](https://github.com/rthunborg/ElproSaas/actions/runs/34926333592) passed at `93d4901`. This includes the separately closed R-1106 mapping: active current-tenant membership counts once per assigned role, with lifecycle exclusions, deterministic granting-role unions, cross-tenant isolation, and three passing Roles E2E tests. The preceding production deployment `dpl_zt1Xqkvqd9SeB5AqY4fkALNHrYPr` became READY for `efd87fa` with the canonical alias; post-merge CI 34888266259 passed. A post-deployment manual monitor sample returned HTTP 200 in 417 ms at 19:44:49.911Z. The isolated alert simulation recorded `[false, false, true]`; its GitHub failure notification was received in the owner-approved mailbox at 19:40:46Z. This proves the bounded alert-delivery checkpoint only, not availability or a monitoring history. GitHub scheduled cadence failed: two runs over about eight hours rather than five-minute checks. The approved free Cloudflare monitoring setup is in implementation and is not evidence until it runs and retains the required history.

**SEAM — backup prerequisites:** the repository has server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets for this exact demo project. A private approved Workspace Drive folder exists and `BACKUP_DRIVE_FOLDER_ID` is configured as a GitHub secret, without recording the identifier. A dedicated Google Cloud project has been prepared under the approved organization; billing was linked only because the UI required it, with no paid account activation or paid-resource deployment. Drive API was enabled and verified in the service-details UI on 2026-09-15. The internal OAuth app is prepared through the User Data Policy agreement step, which remains unaccepted; no OAuth client or grant exists. A project-only monthly 100 SEK gross-cost (credits excluded) budget is saved with 50/80/100% actual-cost email alerts to the approved billing/project recipients; current gross cost is 0 SEK and the existing account-wide budget is unchanged. It is alert-only, not a hard cap; [eligible-service coverage](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps) excludes Drive. An owner-only local GPG recovery key exists outside the repository; `BACKUP_GPG_PASSPHRASE` is configured, and a fresh secret listing confirms the four configured backup secrets. Independent owner recovery-key escrow and database-password input remain pending. Database URL is absent. `PILOT_BACKUP_ENABLED` remains false; no encrypted backup upload or restore has run.

**IN — 2026-09-15 operational evidence update:** PR #67 merged as `6396894`; its CI [34974280415](https://github.com/rthunborg/ElproSaas/actions/runs/34974280415) and post-merge main CI [34975165329](https://github.com/rthunborg/ElproSaas/actions/runs/34975165329) passed. Production deployment `dpl_6SY3bJeY7syS4LKG3HqocmJm1th4` is READY for that exact merge. The prior pending backup-prerequisite statement is superseded in part: all eight backup secrets are configured, owner recovery-key escrow is confirmed, and the first hosted encrypted backup run [34975181883](https://github.com/rthunborg/ElproSaas/actions/runs/34975181883) captured, encrypted, and uploaded 298,442 encrypted bytes to the private approved Drive folder. A separate local verification downloaded, decrypted, and checksum-verified the uploaded archive. That structural verification is not complete recovery evidence: the actual Auth and Storage managed migration-ledger data were absent; only the table definitions existed. The aggregate report listed two tenants, seven memberships, seven Auth users, 31 migration records, and one Storage object totaling 4,228 bytes; it did not establish migration-ledger data recovery. Do not record folder identifiers, recipient addresses, key material, or secret values. A new guard-owned local restore launch timed out and then returned `RESOURCE_UNCERTAIN`; stop requests were submitted; no scoped container was observed and no restore executed. PR #68 head is `36cf8f32dbe1100b88a9651a6cd7c3ca7c074b46`. CI [35012539387](https://github.com/rthunborg/ElproSaas/actions/runs/35012539387) passed 1,797 units with zero skips, 1,028 integration/RLS tests with one explicit skip for the dedicated recovery test, and 138 browser tests with four explicit skips. Its dedicated recovery job executed the recovery test (one passed, zero skipped): it restored the synthetic database and ledgers, verified physical Storage GET bytes and metadata, took full database-row snapshots, and confirmed ordinary x-upserts are rejected without mutation. The storage information route is database-backed; this proof does not treat it as a physical-byte assertion. The repair addresses three valid review findings: immutable object upsert, stale backup acceptance, and selection before ownership filtering. The claimed object-info metadata-shape defect was false for the pinned Storage version. The 2026-09-15 backup is still incomplete because the pinned CLI excluded Auth and Storage managed migration-ledger data even with schema flags. PR #68 now captures them through native pinned-client exports plus aggregate JSON, requires positive ledger counts and equality before the restored runtime starts, and fails old archives closed; a fresh main backup is required after merge. This synthetic proof does not establish recovery of the private owner archive or operational RPO/RTO. PR #69 CI [34981672486](https://github.com/rthunborg/ElproSaas/actions/runs/34981672486) passed for documentation only and is not operational proof. Main therefore remains `6396894`, and the hosted recovery has not executed. `PILOT_BACKUP_ENABLED` stays false until that restore and alert proof succeed.

**SEAM — availability evidence:** Cloudflare Production deployed worker version `bcf49ba2-63e9-4fce-bc29-5e4ce4607e12` with a five-minute Cron. After the unchanged schedules were reapplied at about 13:56, no observable events or inbox delivery have yet been evidenced; monitor controls remain open. The controlled delivery-rehearsal Cron was disabled through an official Wrangler-trigger deploy at about 14:24 UTC; its worker/DO data were preserved and the UI subsequently confirmed that no rehearsal Cron triggers remain. An independently reviewed Vercel `allProductionEdgeRequests` measurement window from 2026-09-14T13:00Z through 2026-09-15T13:00Z recorded 176 requests and zero server 5xx responses: an observed server-5xx rate of 0/176 (0%) for that bounded Vercel measurement window. It does not establish the 30-day 99.5% availability SLO, a full-month or SLO error-rate result, alert proof, or monitoring retention.

**2026-09-16 correction:** The preceding PR #68 record is superseded by spec-only head `bb910b16c8fd26c2e6205e14f840a2f400c67c8a`; the unchanged runtime path was tested at `36cf8f32dbe1100b88a9651a6cd7c3ca7c074b46`. CI [35012539387](https://github.com/rthunborg/ElproSaas/actions/runs/35012539387) passed 1,797 units / zero skips, 1,028 integration/RLS tests / one explicit special-test skip, and 138 browser tests / four explicit skips. The dedicated recovery job executed the special test: one passed / zero skipped. It restored synthetic database and ledger state, verified physical Storage GET bytes and metadata, retained full database-row snapshots, and rejected ordinary x-upserts without mutation. The three valid review findings were immutable-object upsert, stale-backup acceptance, and choosing a backup before ownership filtering. The metadata-shape finding was false for the pinned Storage version; its object-info route is database-backed. This synthetic proof does not establish recovery of the private owner archive or operational RPO/RTO. A fresh main backup and actual isolated archive restore remain required.

Post-merge main CI `34975165329` executed 1,782 units / zero skipped, 101 required integration/RLS files / 1,028 tests / zero skipped with `SUPABASE_TEST_REQUIRED=1`, and 138 browser tests / four explicit skips.

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

## Tenant-provisioning attestation rollout (Story 12.1 Decision 8A; planned)

This section records the required coordinated rollout, not current deployment evidence. Story 12.1 is `in-progress`; do not enable provisioning or apply the enforcement migration until every preceding step has succeeded.

1. Generate a dedicated 256-bit provisioning HMAC secret outside the repository. It is separate from JWT, `SUPABASE_SERVICE_ROLE_KEY`, and quote-PDF key material. Choose a non-secret key ID matching the implementation validator.
2. Provision matching server-only `TENANT_PROVISIONING_ATTESTATION_KEY_ID` and `TENANT_PROVISIONING_ATTESTATION_HMAC_SECRET` values in the application secret store and exactly one filtered Vault secret named `tenant_provisioning_attestation_<key-id>`. Do not display, log, audit, screenshot, or commit the value.
3. Deploy the compatible signer/server path. It must call the sole public authenticated `provision_tenant` RPC under the current allow-listed operator's normal Supabase Auth JWT and use the repository's length-prefixed, domain-separated Node/Postgres HMAC format. The attestation TTL is at most two minutes and it never reaches the browser.
4. Only after the signer is compatible, apply the enforcement migration that installs the migration-owned insert-only baseline catalogue, dedicated least-privilege `NOLOGIN NOINHERIT` function owner, exact grants/filtered Vault access, and removal of the legacy delegate and broad service-role provisioning DML. Do not repair or bypass rows manually.
5. Verify DB/TypeScript catalogue coherence; exact owner/grants; generic zero-write rejection of unsigned, forged, expired, wrong-domain, wrong-key, and tampered mutations; provider-free replay/reconciliation; and signed reservation → at-most-one Auth call → exact-generation outcome ordering. The service role may administer Auth only after reservation and never calls or writes the provisioning database surface.
6. For rotation, provision current and previous matching app/Vault keys before deploy. Retain previous only through the maximum two-minute attestation TTL, then remove it through the normal owner-approved secret process. Longer overlap and accepting unknown key IDs fail the contract.

No custom provisioning JWT, raw invitation token in the RPC, second callable DEFINER writer, recoverable token escrow, or second-person approval is introduced.

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

## 2026-09-16 operational recovery verification — bounded alert rehearsal verified

**Alert rehearsal:** The separate rehearsal recorded forced failures at 12:20:00Z, 12:25:00Z, and 12:30:00Z. Its isolated Durable Object aggregate recorded three samples, three failures, one alert, one delivered notification, and zero failed delivery attempts; the first two failures produced no alert. The owner-approved inbox received the alert at 12:30:06Z for the 12:30:00Z synthetic incident, with SPF, DKIM, and DMARC pass. No customer data was included. The rehearsal Cron was removed and saved at about 12:31:15Z; the UI confirmed no Cron or unsaved state, while retaining rehearsal Worker/DO data. Production was untouched. `PILOT_BACKUP_ENABLED` was set and read back true at 12:31:31Z. The daily 01:23 UTC schedule begins 2026-09-17; the monthly heartbeat is active for the first day at 09:00 local. Neither has execution evidence yet.

**Post-merge CI:** [35093489403](https://github.com/rthunborg/ElproSaas/actions/runs/35093489403) passed at `cbc4753`: 1,797 units / zero skipped (26.90 s); 101 database files / 1,028 passed / one explicit dedicated-recovery skip with `SUPABASE_TEST_REQUIRED=1` (93.11 s); dedicated recovery one passed / zero skipped; and 138 browser passed / four explicit skips (125.27 s). This is post-merge regression evidence, not alert proof.

After PRs #68 and #69 merged to `main` as `cbc4753`, backup run [35093574844](https://github.com/rthunborg/ElproSaas/actions/runs/35093574844) succeeded from 12:02:32Z to 12:04:56Z, uploaded 303,872 encrypted bytes (two retained, none deleted; the older archive fails closed because it lacks native ledgers), and included explicit Auth and Storage migration ledgers. Actual private-archive rehearsal [35093851115](https://github.com/rthunborg/ElproSaas/actions/runs/35093851115) selected the backup at age 57,989 ms and restored/verified two tenants, seven memberships, seven Auth users, 31 migrations, and one 4,228-byte Storage object. Checksums, the full Storage row, and ledgers matched. Auth/RLS REST verification completed at 12:07:06.235Z, 97.235 seconds after workflow dispatch (111 seconds including cleanup), within the approved RPO/RTO. Independent review cleared this scoped evidence; it does not prove provider, project, DNS, Vercel-session, or full disaster recovery. The production aggregate covers 176 samples from 2026-09-15T21:35:49Z through 2026-09-16T12:05:44Z: 176 HTTP 200 and zero failures, transport errors, missed slots, or alerts — about 14.5 hours, not a 30-day SLO. The bounded alert rehearsal is verified above. `PILOT_BACKUP_ENABLED` is true; daily execution, accumulation of seven valid daily copies, and monthly repetition remain obligations.
