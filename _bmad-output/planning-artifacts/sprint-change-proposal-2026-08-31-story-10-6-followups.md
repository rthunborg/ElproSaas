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

PRD, architecture, UX, Epic 10, Story 10.6 closure, sprint status, and deferred ledger are synchronized with ADR-B008 and Stories 10.8/10.9. The five former tax open questions are settled by the approved decision; the demo-only `TAX_SIGN_OFF_REQUIRED` warning remains, and real-customer use still requires re-score/block. Final local verification is green: Supabase reset succeeded twice; real replay against an already-migrated DB passes for both 10.8/10.9 migrations; focused migration/authority/PDF/audit contracts passed 48/48; the parallel-safe rollback contract passed 7/7; the complete changed integration surface passed 28 files / 388 tests; the post-PR-fix required full integration/RLS suite passed 85 files / 906 tests; the full unit suite passed 94 suites / 1,675 tests; and DB lint, TypeScript, full ESLint, Next build, lockfile guard, service-role source/bundle containment, HMAC secret/bundle containment, tenant-table inventory (27), and `git diff --check` passed. The human-triaged PR fixes additionally prove serialized concurrent memlog writes, width-safe extreme-value PDF rendering, and complete audit-fixture recovery evidence; they are not a fourth automatic review round. Hosted GitHub Actions run [33495807115](https://github.com/rthunborg/ElproSaas/actions/runs/33495807115) also passed verify, database, and Playwright (121 passed, 1 skipped). Local Playwright and the prohibited Auto-BMAD self-test remained deliberately unrun inside Codex. Round 3/final convergence is complete.

## Implementation and verification handoff

Development completed the approved corrective implementation, three automatic review rounds, fixes, and local/hosted verification. Keep Stories 10.6/10.8/10.9 in `review`, not `done`, until the post-merge demo step is attested. **Manual setup pending after merge:** provision matching Vercel and Supabase Vault HMAC secrets, authenticate the repository-scoped Supabase profile if required, and apply repository migrations to demo through the documented repo→demo flow. Confirm the installed Supabase/Vercel CLI syntax and version before any secret operation; do not mutate the demo project before merge.
