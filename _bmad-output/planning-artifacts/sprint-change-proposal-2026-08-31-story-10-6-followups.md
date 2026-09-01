# Sprint Change Proposal — Story 10.6 Follow-ups

Date: 2026-08-31
Status: approved by owner — implement in the current branch; one later PR, no merge

## Issue summary

Review of Story 10.6 exposed three pre-existing quote lifecycle gaps: review provenance/authority/audit was not explicit enough, draft edits could leave a stale PDF sendable, and successor versions could omit eligible attachments. A low-severity PDF policy-window phrase also described an exclusive `validTo` boundary as inclusive.

## Impact and approved proposal

This is a **moderate direct adjustment** within active `quotes`; no module activation, new navigation, product area, or Phase C scope is authorized. Option A is approved: add Story 10.8 for provenance/authority/audit and Story 10.9 for PDF validity/attachment carry-forward. ADR-B008 is the decision authority.

- **IN — 10.8:** authenticated explicit attestation to exact server-validated content; one-time 15-minute authorization invalidated by relevant changes; temporary `tenant_admin` authority with the Epic 11 permission seam; atomic actor/correlation audit for successful lifecycle mutations; remove direct-DML/bypass and obsolete digest overloads.
- **IN — 10.9:** invalidate PDF on customer-visible draft changes; send only a current PDF/fingerprint with a separate server-only HMAC-SHA256 byte attestation; archive/unlink obsolete reference; carry forward active/eligible predecessor attachments as preselected immutable reuse; warn for omitted candidates; correct exclusive-`validTo` wording. Option A uses a database-issued render ID plus a narrow authenticated pre-upload reservation RPC as the sole writer of immutable nullable `files.artifact_kind='quote_pdf'`; reserved draft artifacts cannot be signed. PostgreSQL verifies the short-lived attestation with `pgcrypto` against matching Vault secret `quote_pdf_attestation_<key-id>`; review authority remains non-HMAC. Start is correlation-idempotent with a five-minute lease and completion response loss reconciles without archiving a current generated PDF.
- **DEFERRED:** global physical deletion, legal retention, and reclamation remain future Story 31.7 work after E31's central retention-policy/deletion-request foundation. “Attachment retention” here means version carry-forward only; Story 31.7 owns dry-run, legal-hold-aware, tenant-scoped physical Storage reclamation without inventing legal periods.

## Artifact changes

PRD, architecture, UX, Epic 10, Story 10.6 closure, sprint status, and deferred ledger are synchronized with ADR-B008 and Stories 10.8/10.9. The five former tax open questions are settled by the approved decision; the demo-only `TAX_SIGN_OFF_REQUIRED` warning remains, and real-customer use still requires re-score/block. Current local verification: Supabase reset succeeded twice; real replay against an already-migrated DB passes for both 10.8/10.9 migrations; focused post-replay migration/behavior contracts passed (4 files / 50 tests); complete changed integration surface passed (27 unique files / 382 tests); changed unit surface passed (15 files / 110 tests); and local DB lint, TypeScript, changed-file ESLint, Next build, lockfile guard, service-role source/bundle containment, HMAC secret/bundle containment, tenant-table inventory (27), and `git diff --check` passed. Browser E2E/Playwright was deliberately not run because it requires a persistent app server; the prohibited Auto-BMAD self-test and broad wrappers were not run. Round 3/final convergence remains pending.

## Implementation and verification handoff

Development owns the approved corrective implementation and focused unit/integration/RLS evidence. Current evidence is recorded above, but do not report the stories done until Round 3/final convergence completes. **Manual setup pending:** matching Vercel and Supabase Vault HMAC secrets are not attested as provisioned, and repository-scoped Supabase profile authentication requires owner login. Migrations flow to demo only after merge. **Uncertain tool syntax:** confirm the installed Supabase/Vercel CLI syntax and version before any secret operation. No tests were run for this documentation-only reconciliation.
