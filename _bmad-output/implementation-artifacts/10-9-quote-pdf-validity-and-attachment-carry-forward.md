# Story 10.9: Quote PDF Validity and Attachment Carry-Forward

Status: review

## Story

As a quote user, I want every sent quote to use a current PDF and successors to start with eligible predecessor attachments, so that customer-visible material is coherent across edits and versions.

## Scope

**IN:** invalidate current PDF on customer-visible draft edit; require current generated PDF/fingerprint and HMAC byte attestation before send; archive/unlink obsolete PDF reference while retaining bytes and denying normal signed access; carry active/eligible predecessor attachments forward preselected with editable selection and warnings; correct exclusive-`validTo` wording. Quote-PDF provenance uses a database-issued render ID and a durable `files.artifact_kind='quote_pdf'` marker.

**DEFERRED:** physical reclamation, retention schedules, and hard deletion (future Story 31.7 after E31's central retention-policy workflow). Carry-forward is version behavior, not a global retention commitment.

**SEAM:** Story 31.7 may reclaim bytes only after the central policy workflow supplies owner-approved retention periods. Its eventual executor must be tenant-scoped, dry-run-first, legal-hold-aware, idempotent, and audited; this story creates no deletion path or retention commitment.

## Provenance Decision (Option A)

**Decision:** `start_quote_pdf_render` issues the sole render/file ID. Before any non-upsert Storage upload, the authenticated, narrow `reserve_quote_pdf_file` RPC reserves metadata for that exact ID. It is the only authenticated route that can insert the durable nullable `files.artifact_kind='quote_pdf'` discriminator; generic file creation remains `NULL`. The marker and protected file identity/metadata are immutable after reservation.

**Decision:** activation and final send independently verify that the private Storage object exists and that its system MIME and size match the reserved metadata. They additionally require a separate server-only HMAC-SHA256 attestation, verified in PostgreSQL with `pgcrypto` against Supabase Vault secret `quote_pdf_attestation_<key-id>`. The attestation binds tenant, actor, quote version, render/file ID, current content fingerprint, bucket, path, checksum, size, MIME, correlation ID, key ID, and issuance/expiry window. It is short-lived, fails closed, and is never returned, logged, or persisted. Review authorization remains non-HMAC; no Edge Function, service-role/elevated Storage credential, or client bypass is allowed.

**Decision:** render start is correlation-idempotent with a five-minute lease and bounded recovery. If completion commits but its response is lost, reconciliation preserves the current generated PDF rather than archiving it.

**Decision:** failed, invalidated, completed-but-unsent, and historical quote-PDF metadata remain protected rather than becoming generic files. Their bytes are retained; archived metadata/links are ineligible for normal signed access.

**Reason:** Round-2 Sol/xhigh security review selected the durable marker over relying only on transient render state or links. This records the selected provenance boundary, not final review convergence or successful DB/Storage test execution.

**Assumption / question:** Storage's system metadata remains the server-side existence/type/size evidence. The HMAC is the byte-binding proof; PostgreSQL does not rehash Storage bytes. Any change to that evidence model requires a new decision.

**Migration boundary:** SQL migrations are ledgered and replayed by the Supabase reset/migration mechanism. Both new migrations are intentionally replay-safe and passed real replay against an already-migrated local database.

## Acceptance Criteria

> **No Design Gate Criteria for this story.** The canonical Epic 10 criteria prescribe user-visible behavior but do not define Visual, Behaviour, Animation, or Visual-validation gate criteria. This absence is intentional; the UX delta remains binding through the references below.

### AC1 — Current PDF is a send precondition
**Given** customer-visible draft content changes
**When** the edit is saved
**Then** the active PDF is invalidated
**And** send rejects missing, stale, or fingerprint-mismatched PDF output until a current PDF is generated.

### AC2 — Obsolete PDF reference is archived, not deleted
**Given** a current PDF is superseded
**When** it is invalidated or replaced
**Then** its active reference is archived/unlinked, bytes are retained, and normal signed access refuses the archived file.

### AC3 — Eligible attachment carry-forward
**Given** a successor is created
**When** predecessor attachments are evaluated against the current calculation
**Then** all active eligible attachments are preselected, may be deselected/reselected, and reuse immutable bytes without copying
**And** archived or ineligible attachments are omitted with a warning.

### AC4 — Customer-facing tax/PDF wording correction
**Given** a policy window has exclusive `validTo`
**When** rendered to a customer
**Then** wording does not present that boundary as inclusive
**And** fixed-price green inputs are gross including VAT before 97%; ROT+green uses disjoint allowance, insufficient allowance blocks, and reverse charge is mutually exclusive with deductions.

## Dependencies

Stories 10.6 and 10.8.

## Tasks / Subtasks

Checked tasks indicate the implementation is present. Round 3/final automatic convergence and hosted verify/database/Playwright CI are complete; status remains `review` only for post-merge remote-demo provisioning.

- [x] Task 1 — ADR-B008 render reservation/HMAC activation boundary (Supporting infrastructure, not a direct AC).
  - [x] Reserve the database-issued render/file ID and immutable quote-PDF metadata before the non-upsert Storage upload.
  - [x] Require the separate server-side HMAC byte attestation for activation/send; later PDF/send tasks consume this boundary.
- [x] Task 2 — Invalidate and gate PDF validity (AC1).
  - [x] Define the customer-visible edit invalidation boundary and current fingerprint check.
  - [x] Reject send unless a current generated PDF exists.
- [x] Task 3 — Archive obsolete PDF references and deny normal access (AC2).
  - [x] Archive/unlink reference without hard-deleting bytes.
  - [x] Ensure signed-access paths refuse archived files.
- [x] Task 4 — Implement successor attachment eligibility/carry-forward behavior (AC3).
  - [x] Evaluate active eligible predecessor attachments against current calculation and preselect them.
  - [x] Permit reselect/deselect; warn for omitted archived/ineligible candidates; reuse immutable files without byte copy.
- [x] Task 5 — Correct PDF/tax behavior and copy (AC4).
  - [x] Render exclusive `validTo` accurately and enforce the settled green/ROT/reverse-charge input constraints.
- [x] Task 6 — Add regression coverage and UI behavior proof (AC1–AC4).
  - [x] Cover draft edit → stale PDF → send denial → regeneration; archive access denial; carry-forward/reselection/warning; and boundary wording/input edges in focused unit/component/DB-backed test files.

## Files

### Files Created

- `supabase/migrations/20260831124312_story_10_9_quote_pdf_attachment_validity.sql`
- `src/server/quote-pdf/attestation.ts` — shared ADR-B008 server-side HMAC byte-attestation helper, owned by Story 10.9.
- `tests/integration/commands/quote-pdf-validity.int.test.ts`
- `tests/integration/commands/quote-attachment-carry-forward.int.test.ts`
- `tests/integration/rls/quote-pdf-validity-migration-reset.int.test.ts`
- `tests/unit/server/quote-pdf/attestation.test.ts`
- `tests/integration/components/create-new-version-attachment-selection.test.ts`
- `tests/unit/server/commands/eligible-calculation-attachment-file-ids.test.ts`
- `tests/unit/server/commands/quote-pdf-display-name.test.ts`
- `tests/support/quote-pdf.ts`

### Files Modified

- `src/server/commands/quotes/generate-pdf.ts`
- `src/server/commands/quotes/mark-sent.ts`
- `src/server/commands/quotes/new-version.ts`
- `src/server/commands/quotes/validation.ts`
- `src/server/quote-pdf/render.ts`
- `tests/unit/server/quote-pdf/render.test.ts` — valid extreme-value right-margin geometry regression.
- `tests/unit/server/commands/quote-pdf-start-response-recovery.test.ts` — bounded same-correlation replay contracts for lost and malformed start responses.
- `tests/integration/commands/generate-quote-pdf-retry-consistency.int.test.ts` — committed-response-loss recovery and owned-lease compensation/immediate-retry proof.
- `src/server/commands/quotes/quote-db.ts`
- `src/server/commands/quotes/update-draft.ts`
- `src/server/commands/files/file-db.ts`
- `src/server/commands/files/files.ts`
- `src/features/quotes/actions.ts`
- `src/features/quotes/read.ts`
- `src/features/quotes/send-gate.ts`
- `src/components/quotes/CreateNewVersionButton.tsx`
- `src/components/quotes/QuoteDetailView.tsx`
- `supabase/seed.sql` — local-only Vault key plus the parallel-safe shared audit-failure test fixture; neither is applied by repo-to-demo migration push.
- `src/scope/manifest.ts` and `tests/integration/rls/tenant-table-inventory.ts` — shared ADR-B008/H4 inventory impacts.
- Quote detail/new-version attachment selection UI and signed-file-access seams required by AC2–AC3.
- Focused existing quote PDF, signed-access, attachment, tax golden, and component tests updated for the new behavior.
- Shared Story 10.8 final-send signature/introspection tests updated to carry the separate Story 10.9 HMAC proof.

### Files Not Created

- No physical-deletion/reclamation worker, retention-policy system, new nav item, public surface, or new scope module. The attestation helper and its tests are shared ADR-B008 infrastructure but owned by Story 10.9's PDF-byte activation boundary, not Story 10.8 review authority.

## References

- `AGENTS.md`
- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/epics-phase-b.md` — canonical Story 10.9 acceptance criteria
- `_bmad-output/planning-artifacts/architecture-phase-b.md` — ADR-B008 entry
- `_bmad-output/planning-artifacts/ux-design-specification-phase-b.md` — ADR-B008 quote correction delta
- `docs/decisions/ADR-B008-quote-review-authority-and-derived-artifact-validity.md`
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-31-story-10-6-followups.md`

## Test Gate

Verification status: current local and hosted-CI evidence is recorded below. Round 3/final automatic convergence is complete; the story remains `review`, not done, because post-merge remote-demo provisioning is explicitly unclaimed.

### Required full project gates

1. `pnpm audit --audit-level=high`.
2. Lockfile guard and service-role source containment.
3. Full TypeScript, full ESLint, and full `pnpm test:unit`.
4. Production build.
5. Service-role bundle containment and HMAC secret/bundle containment.
6. Empty-DB `supabase db reset`, local DB lint, and focused integration/RLS contracts.
7. Browser E2E/Playwright.

### Evidence actually run

- **Dependency audit:** passed — the project-scoped pnpm override schema moved from its obsolete `package.json` placement to `pnpm-workspace.yaml`; the lockfile resolves `brace-expansion` 5.0.9, `js-yaml` 4.3.1, and `nanoid` 3.3.18; `pnpm audit --audit-level=high` exits 0 with `No known vulnerabilities found`. Frozen lockfile-only regeneration and the bundled-Node lockfile guard passed. Existing `node_modules` was deliberately not broadly reinstalled, so focused `pnpm why` still observes its stale pre-lockfile graph; CI's frozen install will materialize the patched graph.
- Lockfile guard and service-role source containment passed. Full TypeScript passed. Changed-file ESLint and full ESLint passed: the bundled Node ran `node_modules/eslint/bin/eslint.js .` and exited 0 with no findings after `eslint.config.mjs` explicitly ignored non-product `.agents/**` skill resources and generated `supabase/.temp/**`; application, tests, scripts, and real Supabase sources remain in scope. After the human-triaged PR fixes, the full unit suite passed 94 suites / 1,678 tests.
- Next build, service-role bundle containment, and HMAC secret/bundle containment passed.
- Empty-DB local `supabase db reset` completed successfully twice; local DB lint and tenant-table inventory (27) passed. Focused migration/authority/PDF/audit contracts passed 48/48, the parallel-safe rollback contract passed 7/7, the complete changed integration surface passed 28 unique files / 388 tests, and the post-PR-fix required full integration/RLS suite passed 85 files / 906 tests. **Additional supporting verification, not the canonical CI migration-ledger contract:** both 10.8/10.9 migrations are replay-safe and passed real replay against an already-migrated local database; the canonical migration proof remains empty-DB `supabase db reset`.
- **Round-3 delta:** a fresh local reset applied the complete migration/seed chain; both 10.8 and 10.9 real replays passed; DB lint was clean; the four focused migration/authority/PDF/audit files passed 48/48; and the production mark-sent plus forced-audit-rollback files initially passed 24/24. After the shared audit-rollback harness was made parallel-safe and a fresh reset installed its local-only seed fixture, the rollback file passed 7/7 and all 28 changed integration files passed 388/388. Final TypeScript, full ESLint, Next build, full unit (94 suites / 1,673 tests), DB lint, lock/source/bundle/HMAC containment, and diff hygiene passed.
- Hosted GitHub Actions run [33495807115](https://github.com/rthunborg/ElproSaas/actions/runs/33495807115) passed verify, database, and Playwright: 121 passed and 1 skipped, with the Playwright report uploaded. Local Playwright was deliberately **NOT RUN** inside Codex because it would require a persistent app server.
- **Human-triaged post-Round-3 PR fix (not a fourth automatic review):** the cursor now performs deterministic font-aware wrapping and vertical pagination per physical line. A valid extreme V2 category that previously exceeded the A4 content width is verified through extracted PDF geometry and a rendered-page visual inspection; no text crosses the right margin.
- **Human-triaged post-Round-3 PR fix (not a fourth automatic review):** a lost or malformed committed `start_quote_pdf_render` response is replayed once with the same correlation. If both responses remain undecodable, the command reads the authoritative render identity and compensates only its own correlation, so an immediate retry does not wait for the five-minute lease. Pure replay contracts passed 3/3; the two DB-backed response-fault cases await exact-head CI because the borrowed local stack became unavailable and was not restarted inside Codex.

`git diff --check` passed. The prohibited Auto-BMAD self-test and broad wrappers were not run. Remote demo Vault/Vercel secret provisioning is not attested, and demo migrations flow only after merge; no pre-merge demo mutation was attempted.

### Review Findings

**Round 1 of 3**

- Superseded: application-computed checksum plus Storage metadata is not the approved byte-activation proof. Required proof is the distinct server-only HMAC attestation and fail-closed PostgreSQL/Vault verification.

**Round 2 of 3**

- Added forced-audit rollback proofs for PDF render start, completion, and failure, including real local Storage-object setup for completion.
- Corrected send-track coverage so unresolved tax sign-off is accepted only with explicit `demo` configuration and rejected on `real_customer`, leaving the draft unchanged.
- The durable `artifact_kind='quote_pdf'` reservation marker remains Option A provenance metadata, not a substitute for the HMAC byte attestation.
- Required coverage includes metadata-before-upload/non-upsert, attestation expiry/mismatch/Vault-key failures, five-minute correlation lease recovery, response-loss reconciliation, marker immutability, and archived-access denial. Current local migration/RLS evidence is recorded in the Test Gate above.
- Both new migrations are intentionally replay-safe and passed real replay against an already-migrated local database.
- Final convergence is resolved by Round 3 below.

**Round 3 of 3 — final automatic review**

- Fixed the explicit final-send attestation gap. The request-bound server now obtains a DB-issued five-minute challenge for the current immutable PDF, downloads the private object through normal RLS, verifies its exact byte length and SHA-256, signs the canonical payload with the server-only secret, and passes the HMAC to the atomic send RPC. PostgreSQL rechecks currentness/Storage metadata and verifies the signature through Vault immediately before consuming the distinct Story 10.8 review authority.
- Fixed the late-first-upload gap. The `storage.objects` immutability trigger now permits a quote-PDF object's first insert only while its durable metadata reservation is `draft`; a missing object cannot later be injected after the file has become linked, locked, archived, current, or historical.
- Added focused successful/forged-send HMAC coverage, non-consumption on failure, linked-without-object upload denial, replay-safe function-signature introspection, and production-like test signing of downloaded bytes. The legacy-active-PDF fixture now follows the legal draft-reserve → first-upload → linked sequence.
- Final evidence is green: fresh reset, both real migration replays, focused DB/grant/behavior coverage (48/48), rollback 7/7, all 28 changed integration files 388/388, full integration/RLS 85 files/905 tests, TypeScript, full ESLint, Next build, full unit (94 suites / 1,673 tests), DB lint, lock/source/bundle/HMAC containment, diff hygiene, and hosted Playwright (121 passed, 1 skipped). Final automatic convergence is verified; no fourth automatic review is permitted, so any later concern requires human triage.

**Human-triaged post-Round-3 PR comments — not an automatic review round**

- Accepted the underlying PDF-width finding with a corrected reproduction: the three cited summary rows fit at valid limits, while the adjacent standard-VAT category row overflowed. General width-aware wrapping fixes both that case and future long customer-visible rows; the visual margin check is green.
- Accepted and fixed the start-response lease finding: same-correlation replay recovers a lost committed response, and bounded authoritative compensation clears this command's lease after repeated malformed responses. Current unit evidence is 1,678/1,678; exact-head CI owns the fresh-stack DB proof.
