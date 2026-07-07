---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-07-07'
workflowType: testarch-test-design
designLevel: epic
epicNum: 8
revision: 2 (refreshed 2026-07-07 — 8.1 SHIPPED + Epics 6-7 frozen; Wave 2 ready-to-detail)
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 8, lines 1556-1753; stories 8.1-8.5)
  - _bmad-output/planning-artifacts/architecture.md (ADR-A006 entity-scoped private file model; ADR-A009 narrow RPC; §5 command registry generateQuotePdf/createSignedFileAccess/archiveFile; §6 Storage strategy; §9 immutable-lifecycle triggers; §12 quote PDF; §13 acceptance; §14 File And Storage Model; §15 audit)
  - _bmad-output/planning-artifacts/prd.md (required-files FRs)
  - _bmad-output/project-context.md (Testing Rules; Security Regression Harness Rules; RLS-by-default + GRANTs; TENANT_TABLES enrollment contract; golden PII scan; demo-data-only decision)
  - _bmad-output/test-artifacts/test-design-epic-6.md + test-design-epic-7.md (house style; 6.3 PDF stores through 8.1; sent-lock QV409 / accepted-lock AR704 lock-code family 8.4 must join)
  - _bmad-output/implementation-artifacts/sprint-status.yaml (8.1 done; Epics 6-7 done; 8.2-8.5 backlog — Wave 2 now READY)
  - SHIPPED 8.1 CODE (verified in-repo this revision) — supabase/migrations/20260704120000_file_storage_foundation.sql; src/server/storage/{object-path,lifecycle,signed-access}.ts; src/server/commands/files/{files,file-db,validation}.ts; supabase/config.toml [storage.buckets.tenant-files] public=false
  - SHIPPED 8.1 TESTS (verified in-repo) — tests/integration/rls/{file-tables-migration-reset.int,storage-object-isolation.rls}.test.ts; tests/integration/commands/{file-signed-access,file-link-ownership,generate-quote-pdf-storage-privacy}.int.test.ts; tests/unit/server/{commands/file-validation,storage/object-path}.test.ts
  - FROZEN Epic 6/7 lock triggers (8.4 basis) — supabase/migrations/20260707120000_quote_version_sent_lock.sql (QV409→QUOTE_VERSION_LOCKED); 20260711120000_accepted_record_lock.sql (AR704→ACCEPTED_RECORD_LOCKED); src/server/commands/quotes/{generate-pdf,accept}.ts (8.1 consumers)
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES + H4 inventory gate — files/file_links enrolled)
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
---

# Test Design: Epic 8 - Required Files And Private Storage

**Date:** 2026-07-07 (revision 2 — refreshed against shipped reality)
**Author:** Rasmus
**Status:** Draft — Wave 1 (8.1) SHIPPED & PROVEN; Wave 2 (8.2-8.5) READY-TO-DETAIL
**Design Level:** Epic-Level (Phase 4)
**Mode:** Risk-based, evidence-backed (Master Test Architect)

> **Revision note (2026-07-07).** This is a refresh of the 2026-07-04 design. That first pass was
> written *prospectively* — 8.1 was "NEXT", Epics 6-7 were backlog, and Wave 2 (8.2-8.5) was
> deliberately at planning depth pending the owner tables and the sent/accepted lifecycles it locks.
> **Since then: Story 8.1 shipped and is `done`; Epics 6 and 7 shipped and are frozen; 8.2-8.5 remain
> `backlog` — Wave 2 is now ready to run.** This revision (a) moves 8.1 from *planned* to *shipped*
> and records what it actually delivered vs. deliberately deferred, grounded in the in-repo code and
> tests; (b) marks the R-801/803/804/805/806/807/819 controls MITIGATED (with the concrete tests that
> prove them); (c) upgrades the Wave-2 risks/coverage from planning depth to ready-to-implement,
> grounded against the now-frozen Epic 6 sent-lock (`QV409`) and Epic 7 accepted-lock (`AR704`) that
> 8.4 must join and agree with; and (d) confirms the "single Phase A file model" contract **held** —
> Epic 6's `generateQuotePdf` and Epic 7's `accept` both already consume 8.1's `tenant-files` bucket,
> `deriveObjectPath`, and `file_links`, with no competing model.

---

## Executive Summary

**Scope:** Epic-level test design for Epic 8 — the epic that gives Phase A **private, tenant-owned,
validated, lifecycle-aware file storage**, and nothing broader. Five stories, delivered in **two
waves**: the file-storage **foundation** (8.1 — private bucket config, `files`/`file_links` metadata,
polymorphic entity links with command-level ownership validation, server-derived paths, and the
`createSignedFileAccess` command, plus the RLS/storage negative matrix) — **now shipped**; then, with
the owner workflows now in place, **validated uploads + entity file panels** (8.2), the
**tenant-authorized signed preview/download UX** (8.3), **quote/PDF/attachment/acceptance-evidence
lifecycle locks** (8.4), and an **optional limited Phase A file index + file audit** (8.5).

**Epic goal (from epics.md):** Manage *only* Phase A-required files through private, tenant-owned,
validated, lifecycle-aware storage — no broad document center.

**Why this epic is risk-bearing:** Epic 8 is where Phase A **crosses the object-storage boundary** for
the first time. Every earlier epic kept sensitive state in Postgres under the proven RLS harness; Epic 8
adds a **second storage plane (Supabase Storage) that RLS on `storage.objects` and server-derived paths
must isolate as strictly as the database** — and it does so for exactly the artifacts a customer relies
on (quote PDFs, selected attachments, acceptance evidence). Four risk classes converge:

1. **Isolation across two planes** — `files`/`file_links` are tenant-owned tables (full Epic 2-5
   pattern: direct `tenant_id`, composite same-tenant FK, enable+**force** RLS, `anon → none`,
   `TENANT_TABLES` enrollment) **and** the storage layer itself must deny cross-tenant list/read/sign
   and reject spoofed object paths. A tenant boundary that holds in the DB but leaks in Storage is a
   full breach. **[8.1 SHIPPED — proven; see below.]**
2. **Private-by-default with no client-controlled paths** — a public bucket or a client-entered storage
   path is a direct data-exposure hole (architecture §6/§14). **[8.1 SHIPPED — private `tenant-files`
   bucket + server-derived `{tenant_id}/{file_id}/{safe_name}` paths, asserted at construction.]**
3. **Signed-access as the single authorization funnel** — `createSignedFileAccess` verifies tenant
   membership → file metadata ownership → lifecycle state **before** issuing a short-lived URL, and
   rejects anonymous / cross-tenant / spoofed-path / expired attempts with **generic user-safe errors**.
   **[8.1 SHIPPED — funnel + env-configurable TTL + permanent-vs-transient error classification.]**
4. **Lifecycle immutability of commitments** — once a quote is sent or an acceptance recorded, the
   linked PDF/attachment/evidence must be **locked at command validation AND DB constraint/trigger
   level** (not disabled buttons); deletion of locked files is archive-only with an audit trail.
   **[8.4 STILL OPEN — 8.1 persisted the lock FIELDS but shipped NO enforcement trigger; the frozen
   Epic 6 `QV409` and Epic 7 `AR704` triggers are the family 8.4 must join.]**

**The keystone dependency held:** 8.1 was the hard, already-sequenced dependency for Epic 6, and the
contract survived contact with reality — **Epic 6's `generateQuotePdf` (6.3) stores its PDF through
8.1** (`tenant-files` bucket, `deriveObjectPath`, `file_links` purpose `quote_pdf`; verified in
`src/server/commands/quotes/generate-pdf.ts` + `generate-quote-pdf-storage-privacy.int.test.ts`), and
**Epic 7's `accept` materializes acceptance evidence through 8.1** (`link_existing_file`,
`owner_type='quote_acceptance'`, `purpose='acceptance_evidence'`; verified in
`src/server/commands/quotes/accept.ts`). No competing file/storage model appeared anywhere — R-814
held.

**Wave-2 reality (8.2-8.5) — now firmly groundable:** at the original design date, Epics 6-7 were
backlog, so Wave 2 was left at planning depth to avoid forking the lock rule table before the sent/
accepted lifecycles were frozen. **They are now frozen.** The Epic 6 sent-lock trigger
(`QV409 → QUOTE_VERSION_LOCKED`) and the Epic 7 accepted-lock trigger (`AR704 → ACCEPTED_RECORD_LOCKED`)
exist and are stable — and their migration headers **explicitly name "Epic 8.4 locked-evidence-file"
as the third scope of the shared lock-code FAMILY** (one shared trigger shape, related-but-distinct
codes, not a fork). Wave 2's concrete scenarios can therefore be detailed at each create-story with
firm targets; the remaining "re-confirm at create-story" items are the owner-approved MIME/size policy
constants (R-817) and the optional-index build/skip decision (R-816), not lifecycle uncertainty.

**Risk Summary:**

- Total risks identified: **21** (adds R-822, the "8.4 lock must join the QV409/AR704 family" fork risk
  that only became concrete once the two lock triggers shipped).
- High-priority risks (score ≥6): **11**.
- **Now MITIGATED by shipped 8.1 (was Planned):** R-801 (files/file_links isolation + enrollment),
  R-803 (private bucket / server-derived path), R-804 (signed-access funnel), R-805 (storage-plane
  cross-tenant/spoof), R-806 (expired-URL / TTL), R-807 (atomic metadata+link RPC), R-819 (fixture
  PII scan). Each has a concrete in-repo test (see the Risk table's *Status/Evidence* column).
- **Still OPEN (Wave 2, `backlog`):** R-808 (upload MIME/size GATE — 8.1 shipped metadata-only, no
  gate), R-809 (existence disclosure on the upload path — 8.2/8.3), R-810 (metadata-first ordering in
  the preview UX — 8.3), R-811 (upload error states — 8.2), R-812 + R-822 (lock ENFORCEMENT trigger +
  family agreement — 8.4), R-813 (partial lock/archive — 8.4), R-816 (index scope creep — 8.5).
- Critical (score 9 / auto-BLOCK): **0**. Five controls remain epic blockers regardless of numeric
  score — (a) files/file_links unenrolled or missing force-RLS (R-801, **SATISFIED** by 8.1 + H4 gate);
  (b) any public bucket / client path (R-803, **SATISFIED** by 8.1); (c) a cross-tenant/anon signed-URL/
  list/read/spoof succeeding (R-804/R-805, **SATISFIED** by 8.1's negative matrix); (d) a sent/accepted
  locked file mutable/deletable or UI-only locking (R-812, **OPEN** — 8.4); (e) real PII/raw customer
  file in a committed fixture/artifact (R-819, **SATISFIED** — scan extended, held at mitigate-control).
- Critical categories: **SEC** (two-plane isolation, private-by-default, signing funnel, path spoofing,
  existence disclosure) — the dominant class, largely CLOSED by 8.1 — then **DATA** (lifecycle-lock
  integrity, metadata-first ordering, partial lock/archive) — the live Wave-2 concern — then **BUS/scope**
  (index scope creep, MIME/size owner-approval).

**Coverage Summary:**

- **P0 (Critical):** ~30-44 tests. **8.1's P0 slice is DONE** (migration-reset + files/file_links RLS
  negatives + enrollment; link both-side ownership; private-bucket/server-path construction;
  `createSignedFileAccess` authorization matrix incl. lifecycle gate + expired-URL via low TTL;
  storage-plane cross-tenant list/read/sign + path spoof; atomic metadata+link RPC rollback; fixture
  PII scan). **Remaining Wave-2 P0:** 8.2 upload MIME/size/owner/lifecycle server validation +
  no-existence-disclosure; 8.4 sent/accepted lock at command AND DB, archive-only-on-delete + audit,
  agreeing with QV409/AR704.
- **P1 (High):** ~18-28 tests — 8.2 entity-panel upload UX + four distinct user-safe error states +
  no-raw-path UI + storage-write compensation; 8.3 preview/download UX + expiry→refresh reauthorization
  + metadata-first ordering; 8.4 lock-warning UX + quote/acceptance lifecycle golden; 8.5 limited-index
  tenant-scoped listing + file audit events.
- **P2 (Medium):** ~8-14 tests — lifecycle-state edge transitions, a11y/keyboard, documented Lovable
  attachment-locking delta, index-absence guardrail, checksum/hash behavior.
- **P3 (Low):** ~3-6 tests — large-file/streaming edges, signed-URL TTL boundary fuzz, DX messages.
- **Total:** ~59-92 tests across UNIT / INT / RLS / STORAGE-NEG / E2E / GOLDEN / DOCS. **Roughly the
  8.1 third is landed; the ~2/3 remaining is Wave-2 upload/preview/lock/index UX + the two-layer lock.**

---

## What Story 8.1 Actually Shipped (verified in-repo — Wave 1 baseline)

8.1 landed as designed. This section pins the concrete artifacts so Wave-2 stories EXTEND them (never
re-invent) and so `*trace`/`*nfr` at the epic boundary can map coverage to real code.

| 8.1 deliverable | Where (verified this revision) | Test evidence |
| --- | --- | --- |
| `files` table — direct `tenant_id`, `bucket_id` default `tenant-files`, server-derived `object_path`, closed `lifecycle_state` union, composite `unique(id, tenant_id)` (the FK target), `unique(bucket_id, object_path)`, `uploaded_by` ON DELETE SET NULL, enable+**force** RLS, own-tenant SELECT/INSERT/UPDATE (no delete), `anon → none` | `supabase/migrations/20260704120000_file_storage_foundation.sql` | `file-tables-migration-reset.int.test.ts` (358 lines — reset-from-empty + per-table policy/GRANT enumeration) |
| `file_links` table — polymorphic `owner_type`/`owner_id` (closed union incl. now-active `quote_version`/`quote_acceptance`/`job`), closed `purpose` union, **composite same-tenant FK `(file_id, tenant_id) → files(id, tenant_id)`** (R-802 both-side), persisted lock fields `is_locked`/`locked_at` (NO enforcement trigger yet — 8.4), force RLS, own-tenant policies | same migration | `file-tables-migration-reset.int.test.ts`; `file-link-ownership.int.test.ts` (554 lines — foreign-file AND foreign-owner both rejected) |
| **Private bucket** `tenant-files` (`public=false`) seeded in BOTH `supabase/config.toml [storage.buckets.tenant-files]` AND the migration (belt-and-braces, load-order-independent) | `config.toml` + migration `insert into storage.buckets ... public=false` | migration-reset construction assertion (bucket private; AC4) |
| **`storage.objects` RLS** — own-tenant SELECT/INSERT/UPDATE (no delete) scoped to `bucket_id='tenant-files'` AND `is_tenant_admin((foldername(name))[1]::uuid)`, guarded by a uuid-shape regex so a malformed/absent first segment denies before the cast; `anon` gets no policy | same migration | `storage-object-isolation.rls.test.ts` (170 lines — cross-tenant list/read/sign + path spoof + anon) |
| **Server-derived path** `deriveObjectPath({tenantId,fileId,displayName})` — tenant-first (verbatim from `ctx.tenantContext.tenantId`), NFC-normalized + traversal-sanitized name segment (`../`, `/`, `\`, control chars, surrogate-split all handled), never client-trusted | `src/server/storage/object-path.ts` (pure) | `tests/unit/server/storage/object-path.test.ts` (fast `node --test` gate) |
| **`createSignedFileAccess` funnel** — membership → metadata ownership (`loadFileForAccess`) → lifecycle gate (`isAccessEligibleLifecycle`: archived/deleted rejected, fail-closed) → sign; anon/cross-tenant/spoof/wrong-lifecycle rejected with generic `FILE_ACCESS_DENIED`; runs on the request-bound anon-key RLS client (NO service-role) | `src/server/commands/files/files.ts`, `file-db.ts`, `src/server/storage/{signed-access,lifecycle}.ts` | `file-signed-access.int.test.ts` (259 lines — anon/cross-tenant/lifecycle/expired matrix) |
| **Env-configurable TTL** `SUPABASE_SIGNED_URL_TTL_SECONDS` (default 300s) with a **MAX 24h ceiling** (a fat-fingered huge value clamps to the safe default — fail-toward-tighter, R-806) and permanent-vs-transient error classification (retryable 408/425/429 + 5xx → `SERVER_ERROR`, never masked as a permanent denial) | `src/server/storage/signed-access.ts` (pure `resolveSignedUrlTtlSeconds`/`isPermanentStorageDenial`) | `file-validation.test.ts` (TTL + error-classification units); expired-URL INT via low test TTL |
| **Atomic metadata+link RPC** `create_file_with_link` + the link-existing-file RPC `link_existing_file` — narrow, **SECURITY INVOKER** (caller RLS, own-tenant, no service-role app path), fixed empty `search_path`, schema-qualified; single-txn (both persist or neither, R-807); `revoke ... from public` then grant to authenticated/service_role only | same migration | `file-link-ownership.int.test.ts` (rollback + both-side ownership); `create_file_with_link` atomicity |
| **Pure validators** — `validateCreateFileLink`/`validateSignedAccess`, `OWNER_TYPES`/`ACTIVE_OWNER_TYPES`/`FILE_PURPOSES` closed unions; a deferred-module owner type is a STOP caught at the fast gate | `src/server/commands/files/validation.ts` (pure) | `file-validation.test.ts` (166 lines) |
| **Consumed by Epic 6/7 (contract held)** — 6.3 `generateQuotePdf` stores the PDF through 8.1 (`tenant-files`, `deriveObjectPath`, `file_links` purpose `quote_pdf`, find-or-create so a double-submit does not duplicate); 7.x `accept` links acceptance evidence (`link_existing_file`, `quote_acceptance`/`acceptance_evidence`) | `src/server/commands/quotes/{generate-pdf,accept}.ts` | `generate-quote-pdf-storage-privacy.int.test.ts` (266 lines) |

**What 8.1 deliberately did NOT ship (correctly deferred — the Wave-2 backlog):**

- **No upload MIME/size validation GATE** — `files.mime_type`/`size_bytes` are persisted *metadata
  only*; there is no server-side accept/reject of a blocked type or oversized upload. That gate is
  **8.2** (R-808). The pure validators cover owner-type/purpose/id shape, not content policy.
- **No object-BYTE upload path** except 6.3's PDF pipeline — the generic user-facing upload (choose a
  file → validate → write the object + compensate on DB failure) is **8.2** (R-807 storage-side / R-808).
- **No lock-ENFORCEMENT trigger on `file_links`** — the `is_locked`/`locked_at` FIELDS exist but nothing
  enforces them. A locked link is today mutable/deletable at the DB. That trigger is **8.4** (R-812) and
  must join the `QV409`/`AR704` family (R-822).
- **No entity file panels / preview-download UX / limited index** — 8.1 is command + schema only; the UX
  is **8.2/8.3/8.5**.

---

## Two-Wave Structure & Sequencing

| Wave | Stories | Status | Depends on | Test focus |
| --- | --- | --- | --- | --- |
| **Wave 1** | **8.1** | **DONE** ✅ | Epics 1-2 | Foundation: schema/RLS/enrollment, ownership-validated links, private bucket, server-derived paths, `createSignedFileAccess` + storage negative matrix + atomic RPC. **Shipped & green; consumed by 6.3/7.x.** |
| **Wave 2** | 8.2, 8.3, 8.4, 8.5 | **backlog — READY** | 8.1 (done) + Epics 3/5/6/7 (done) | Upload GATE + entity panels (8.2), signed preview/download UX (8.3), sent/accepted lock TRIGGER (8.4), optional limited index + file audit (8.5). **Owner tables + sent/accepted lifecycles now FROZEN — detail at each create-story with firm targets.** |

**Standing contract this epic established, now proven:** *8.1 is the single Phase A file model.* Every
file consumer REUSES and EXTENDS `files`/`file_links` — and two already do (6.3 PDF, 7.x evidence) with
no competing model. A second file/storage model appearing in 8.2-8.5 is a design defect and a STOP.

**Why the split still matters for testing:** 8.1's negatives (RLS, storage spoof, signed-access) landed
first and self-contained. 8.4's lock matrix is only fully meaningful against the frozen Epic 6 sent-state
and Epic 7 accepted-state — which now exist — so 8.4 **cross-references and must AGREE with** the
`QV409`/`AR704` triggers rather than re-invent a divergent lock mechanism (R-822).

---

## Inherited Foundation (what Epic 8 builds on, not rebuilds)

Epics 2-7 shipped the isolation + immutability harness Epic 8 extends. Verified in-repo; Wave-2 stories
must **reuse**, not re-invent:

| Inherited asset | Where | Wave-2 obligation |
| --- | --- | --- |
| Tenant-table pattern (direct `tenant_id`, composite same-tenant FK, enable+**force** RLS, own-tenant `is_tenant_admin` policies, `anon → none`, archive-over-delete, `set_updated_at()`) | 8.1 migration (already applies it to `files`/`file_links`) | 8.2-8.5 add NO new tenant table by default; any new table (unlikely) reuses the pattern + enrolls |
| `TENANT_TABLES` enrollment + H4 inventory gate | `tests/integration/rls/tenant-table-inventory.ts`; `rls-inventory-gate.int.test.ts` | `files`/`file_links` **already enrolled**; Wave-2 must keep them green and must NOT hand-write ad-hoc isolation tests that bypass the inventory |
| Server command Result model (`Result<T, CommandErrorCode>`, `verifyOwnership` zero-rows ⇒ `TENANT_ACCESS_DENIED`, generic errors, allow-listed audit metadata) | `src/server/commands/envelope.ts`, `command-errors.ts`; already used by `createSignedFileAccess`/`createFileLink` | 8.2 upload + 8.4 lock commands REUSE it; a locked-file mutation ⇒ a stable lock code in the `QV409`/`AR704` FAMILY (R-822) |
| **Frozen sent-lock trigger** `QV409 → QUOTE_VERSION_LOCKED` on `quote_versions` + child snapshot/attachment locks; PDF-render columns EXEMPT (regenerable) | `supabase/migrations/20260707120000_quote_version_sent_lock.sql` | 8.4's locked `quote_pdf`/`quote_attachment_snapshot` file link must AGREE: a sent version's linked PDF/attachment is immutable, the file-side lock is the sibling of the version-side lock |
| **Frozen accepted-lock trigger** `AR704 → ACCEPTED_RECORD_LOCKED` on `quote_acceptances` (locks EVERYTHING except archived_at/updated_at) + `jobs` source-ref lock | `supabase/migrations/20260711120000_accepted_record_lock.sql` | 8.4's locked `acceptance_evidence` file link must AGREE: accepted evidence is immutable except an approved audited correction; same trigger SHAPE, distinct-but-related code |
| Narrow Postgres RPC discipline (ADR-A009, SECURITY INVOKER default) | 8.1's `create_file_with_link`/`link_existing_file`; Epic 5/6/7 RPCs | 8.2's real upload path EXTENDS `create_file_with_link` (adds the storage-object write + compensation) without a signature change (the 8.1 RPC comment says so); mechanism change without ADR = STOP |
| `audit_events` append-only + own-tenant-read, allow-listed sanitized metadata | `supabase/migrations/20260629121136_audit_events.sql`; architecture §15 | 8.4/8.5 write file events (uploaded/linked/locked/archived/signed) through the SAME table; NO raw file contents/bucket/path/PII |
| Two-runner + Playwright E2E + two-tenant fixture + golden PII/secret+ORGNR scan; goldens under `tests/unit/**` (runner-glob trap) | project-context Testing Rules; `scripts/run-tests.mjs`; `tests/factories/**` | 8.2/8.4 land INT; 8.2/8.3/8.5 land E2E; the PII scan **already extended** to file-metadata fixtures — keep it green |
| Service-role containment (source + built-bundle guards) — app uses NO service-role key; `createSignedFileAccess` signs on the RLS client | `scripts/verify/check-service-role-containment.mjs`; `signed-access.ts` | 8.2 upload/8.3 preview paths stay anon+RLS client / server-command; no service-role key on any browser/client file path |

**What is genuinely NEW and still to build in Wave 2:** the **upload MIME/size validation gate + the
object-byte write + storage-success/DB-failure compensation** (8.2); the **entity file panels + four
distinct upload error states** (8.2); the **signed preview/download UX with expiry→refresh
reauthorization + metadata-first ordering** (8.3); the **`file_links` lock-enforcement trigger** joining
the `QV409`/`AR704` family + archive-only-on-delete + audit (8.4); the **optional limited file index +
file audit events** (8.5).

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Broad document center / cross-module document workflows / deferred-module file indexing** | Epic 8 explicit non-scope; ADR-A006 IN for Phase A files only; 8.5 STOP; 8.1 migration already asserts no `documents`/index table | 8.5 tests assert the index lists ONLY CRM/calc/quote/acceptance/job files, NO deferred groupings/document-center workflows (R-816). Index is *optional* (skippable if entity panels suffice). |
| **Public buckets / unauthenticated file access / client-entered storage paths** | Epic 8 non-scope; architecture §6/§14; 8.1/8.3 STOP | **Already enforced by 8.1** — `tenant-files` private, server-derived paths, path-spoof negatives green (R-803/R-805). Wave-2 upload/preview must not regress it. |
| **Virus/malware scanning** | Epic 8 non-scope "unless separately approved" | MIME + size + owner + lifecycle validation is the Phase A upload gate (8.2); scanning is a documented residual (R-820), a STOP if requested inside this epic. |
| **External document integrations (Fortnox, supplier docs, e-sign)** | Deferred (AGENTS.md); ADR-A008 SEAM-only | No external integration tables/routes/credentials; migration test asserts absence. |
| **Final MIME allow-list + size limits + required-file policy** | epics.md 8.2 tech note: owner approval before real pilot use; conservative dev defaults OK | 8.2 tests pin the VALIDATION MECHANISM against conservative dev defaults; final policy constants are an owner Sign-Off residual (R-817), re-confirmed at 8.2 create-story. Under demo-data-only (2026-07-03) not a real-pilot blocker yet. |
| **Raw legacy/customer file migration** | epics.md 8.1/8.2 notes: anonymized metadata fixtures only; Lovable oracle-only | Fixtures carry file *metadata shape* only; the PII scan (already extended) blocks real PII/secrets. Raw-file migration is Epic 9, owner-gated. |
| **Quote snapshot/immutability, PDF rendering pipeline, acceptance capture** | Epic 6 owns snapshot + PDF source-of-truth + sent immutability; Epic 7 owns acceptance evidence + accepted state — **both shipped** | 8.1 provides the STORAGE the PDF lands in (proven — 6.3 uses it); 8.4 provides the file-side LOCK. The snapshot freeze and accepted lock are Epic 6/7 tests (`QV409`/`AR704`) — 8.4 cross-references and must AGREE (R-822). |
| **Retention / legal deletion policy for locked evidence beyond archive-only** | epics.md 8.4 STOP (legal decision) | 8.4 tests enforce archive-only-on-delete + audit as the Phase A default; any hard-delete retention rule is a STOP requiring legal sign-off (R-818). |
| **File-storage performance / scale / bulk operations** | Pilot-sized NFRs; no Phase A SLA | Single-file correctness + isolation is the concern; large-file/streaming edges are P3 exploratory (R-820); perf documented residual. |

---

## Risk Assessment

Scoring per `probability-impact.md`: Probability 1/2/3, Impact 1/2/3, Score = P × I. Thresholds:
1-3 DOCUMENT, 4-5 MONITOR, 6-8 MITIGATE (CONCERNS at gate), 9 BLOCK (auto-FAIL).

**Impact rationale (unchanged):** Epic 8's artifacts are customer-facing commitments (quote PDFs,
attachments, acceptance evidence) on a new storage plane. Cross-tenant storage leak, public bucket,
spoofable path, unauthorized signed URL, or a mutable locked-evidence file are **Impact 3**. Probability
is held at 2 for most (the DB-side harness is proven; the storage plane was the novel residual — **now
largely validated by shipped 8.1**), dropping to 1 where an automated gate makes silent failure hard.

**Status/Evidence column (new this revision):** MITIGATED = shipped 8.1 code + a green in-repo test
proves the control; OPEN = Wave-2 backlog; each row cites the concrete artifact.

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner | Status / Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-801 | SEC | `files`/`file_links` isolation gap (no force-RLS / own-tenant policies / `anon → none` / unenrolled) → cross-tenant read/write of file metadata + links | 2 | 3 | 6 | Reuse tenant-table pattern verbatim on both tables; enroll in `TENANT_TABLES`; migration-reset + cross-tenant + anon negatives | Dev (8.1) | **MITIGATED** — 8.1 migration (force RLS, own-tenant policies, anon none, composite FK); `file-tables-migration-reset.int.test.ts` + H4 gate + shared cross-tenant/anon suites green |
| R-802 | SEC | Cross-tenant / cross-owner link creation — link whose file is tenant A but owner tenant B, or a bare `file_id` FK | 2 | 3 | 6 | Composite same-tenant FK `file_links(file_id,tenant_id)→files(id,tenant_id)`; command re-validates BOTH file AND owner-record ownership | Dev (8.1) | **MITIGATED** — composite FK in migration; `file-link-ownership.int.test.ts` (foreign-file AND foreign-owner both rejected, 554 lines) |
| R-803 | SEC | Public bucket or client-controlled storage path → unauthenticated exfiltration / path traversal | 2 | 3 | 6 | Private bucket only; server-derived paths only; construction assertion + path-spoof negatives | Dev (8.1) | **MITIGATED** — `tenant-files` public=false (config + migration); `deriveObjectPath` tenant-first + traversal-sanitized; `object-path.test.ts` + migration-reset construction assertion |
| R-804 | SEC | Unauthorized signed URL — signs for anon / cross-tenant / wrong-lifecycle, or without metadata-ownership check | 2 | 3 | 6 | Funnel: membership → metadata ownership → lifecycle state BEFORE signing; generic user-safe error each | Dev (8.1) | **MITIGATED** — `createSignedFileAccess` (`files.ts`/`file-db.ts`/`lifecycle.ts`); `file-signed-access.int.test.ts` (anon/cross-tenant/lifecycle matrix, 259 lines) |
| R-805 | SEC | Storage-plane cross-tenant access / path spoofing — tenant A lists/reads/signs tenant B's `storage.objects` or spoofs a path directly | 2 | 3 | 6 | `storage.objects` RLS keyed on the first path segment (uuid-guarded); metadata-first, storage-second; full storage negative matrix | Dev (8.1) | **MITIGATED** — `storage.objects` policies in 8.1 migration (regex-guarded `::uuid` cast); `storage-object-isolation.rls.test.ts` (list/read/sign/spoof + anon, 170 lines) |
| R-806 | DATA | Expired signed URL not re-authorized (or never expires) — stale URL still works / refresh re-issues without a fresh check / unbounded TTL | 2 | 3 | 6 | Env-configurable low TTL (testable expiry); MAX ceiling; refresh re-runs full auth | Dev (8.1 foundation; 8.3 refresh UX) | **MITIGATED (foundation)** — `resolveSignedUrlTtlSeconds` (default 300s, 24h MAX clamp), `expiresAt` computed; expired-URL INT via low test TTL. **Refresh-reauthorization UX is 8.3 (OPEN).** |
| R-807 | DATA/OPS | Storage↔DB atomicity break / orphaned objects — object written but metadata not (or vice versa) on a mid-flow failure | 2 | 3 | 6 | Atomic metadata+link via narrow RPC (ADR-A009); storage-success/DB-failure compensation | Dev (8.1 RPC; 8.2 storage-write compensation) | **MITIGATED (DB-side)** — `create_file_with_link` single-txn rollback; `file-link-ownership.int.test.ts` rollback case. **The storage-write compensation (8.2 upload path) is OPEN** — 6.3's PDF path already does find-or-create + upsert; 8.2 generalizes it. |
| R-808 | SEC | MIME/size/owner/lifecycle validation bypass on upload — a blocked type / oversized / foreign-owner / wrong-lifecycle file becomes usable because validation is client-only or missing | 2 | 3 | 6 | Server-side validation of MIME, size, tenant ownership, owning entity, purpose, lifecycle BEFORE the file is usable; each invalid case rejected server-side | Dev (8.2) | **OPEN (Wave 2)** — 8.1 shipped metadata-only; NO upload gate. 8.2 adds the gate. Owner/purpose/lifecycle validators already pure-tested; the MIME/size content policy is new. |
| R-809 | SEC | File existence disclosure across tenants — an upload/access/sign failure reveals whether another tenant's file exists | 2 | 3 | 6 | Cross-tenant failures return generic user-safe errors; identical error shape for not-found vs forbidden | Dev (8.2/8.3) | **PARTIAL** — 8.1's `createSignedFileAccess` already returns generic `FILE_ACCESS_DENIED` (proven). The **upload-path** no-existence-disclosure (8.2 AC3) is OPEN. |
| R-812 | DATA/BUS | Locked commitment file mutable/deletable — a sent quote's PDF/attachment link or accepted-evidence file replaceable/deletable via command OR direct own-tenant SQL because locking is command-only / UI-only | 2 | 3 | 6 | Two layers: command validation (stable lock code) AND DB trigger/constraint; deletion archive-only + audit; MUST AGREE with `QV409` (Epic 6) and `AR704` (Epic 7) | Dev (8.4) | **OPEN (Wave 2)** — 8.1 persisted `is_locked`/`locked_at` FIELDS but NO enforcement trigger. 8.4 adds the trigger on `file_links` joining the family. INT must attempt mutation via command AND direct authenticated UPDATE/DELETE. |
| R-819 | SEC/BUS | File-fixture / storage-artifact PII or raw-file leak — a committed metadata fixture, extracted test file, or golden embeds real PII/secret/orgnr or a raw customer file | 1 | 3 | 3 → held at 6-equivalent control | Anonymized metadata-shape-only fixtures; no raw customer files; EXTEND the CI golden PII/secret+ORGNR scan to file fixtures/artifacts | Dev (8.1/8.2) | **MITIGATED** — scan extended over 8.1 fixtures + `generate-quote-pdf-storage-privacy` artifacts; committed real PII/raw file remains an epic blocker regardless of score |

### Medium-Priority Risks (Score 4-5)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-810 | DATA | Metadata-first / storage-second ordering violated — access resolves the storage object before the metadata ownership check (spoof window), or UI leaks raw bucket/path | 2 | 2 | 4 | Enforce metadata-first everywhere; no raw bucket/path in UI; INT proves the ownership check precedes any storage call | Dev (8.3) | **PARTIAL** — 8.1's `loadFileForAccess` resolves metadata BEFORE `createSignedFileUrl`, and the wrapper never leaks the raw path. The **preview UX** ordering + no-raw-path rendering is 8.3 (OPEN). |
| R-811 | BUS | Upload UI error states indistinct / unsafe — blocked-type, too-large, network/server-fail, permission-fail collapse to one opaque error, or an error reveals cross-tenant existence | 2 | 2 | 4 | 8.2 AC3: four DISTINCT user-safe states; E2E per state; cross-tenant permission-fail uses the generic no-existence error (R-809); extract error-state logic into a pure `.ts` module (coverage-shape lesson) | Dev (8.2) | **OPEN (Wave 2)** |
| R-813 | OPS/DATA | Partial lock / broken archive-delete — a file locked without its audit event (or vice versa); archive converts inconsistently; a "delete" partially deletes a locked file | 2 | 2 | 4 | Lock + `file_links` lock fields + `audit_events` written consistently (transactional/verified-compensated); archive-only never hard-deletes a locked file; INT: mid-flow failure leaves a consistent, retryable state | Dev (8.4) | **OPEN (Wave 2)** |
| R-816 | BUS | File index becomes a document center / scope creep — 8.5 grows deferred-module groupings, cross-module analytics, broad workflows | 2 | 2 | 4 | 8.5 AC1 + STOP: index lists ONLY CRM/calc/quote/acceptance/job files; guardrail test asserts absence of deferred category labels; index is OPTIONAL | Dev (8.5) + Rasmus | **OPEN (Wave 2)** |
| R-817 | BUS | MIME allow-list / size limits unapproved for real pilot — conservative dev defaults reach real-pilot use without owner approval | 1 | 2 | 2 → doc under demo-data-only | DOCUMENT: dev defaults fine for demo-data-only MVP (2026-07-03); final policy is an owner Sign-Off residual re-confirmed at 8.2 create-story; 8.2 STOP if final policy materially affects pilot data | Rasmus (accept) | **OPEN residual** |
| R-822 | DATA/BUS | **8.4 lock diverges from the `QV409`/`AR704` family** — the new `file_links` lock uses a divergent mechanism/code or a *reused* code instead of a related-but-distinct sibling with the shared trigger shape → inconsistent lock behavior between the file-link (8.4) and the version/acceptance (Epic 6/7) | 2 | 2 | 4 | 8.4's file-lock trigger reuses the 6.4/7.4 trigger SHAPE (fail-closed-by-construction, custom SQLSTATE, security invoker, empty search_path, schema-qualified) with a DISTINCT-but-related lock code (a sibling of `QV409`/`AR704`); INT proves the file-side lock AGREES with the version/acceptance lock on a sent/accepted commitment | Dev (8.4) | **OPEN (Wave 2)** — the two frozen migrations *explicitly name* "Epic 8.4 locked-evidence-file" as the third family scope; 8.4 must honor it, not fork |

### Low-Priority Risks (Score 1-3)

| Risk ID | Category | Description | Prob | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- |
| R-815 | TECH | Signed-URL TTL not environment-configurable | 1 | 2 | 2 | **RESOLVED** — 8.1 shipped `SUPABASE_SIGNED_URL_TTL_SECONDS` (env-configurable, default 300s, 24h MAX). Kept for traceability. |
| R-814 | OPS | 8.1 sequencing slip re-opens Epic 6 pressure to invent a local file model | 2 | 2 | 4 | **RESOLVED** — 8.1 landed before Epic 6; 6.3 + 7.x both consume 8.1; no competing model shipped. Kept as the standing reviewer checkpoint for 8.2-8.5. |
| R-818 | BUS | Locked-evidence retention/hard-delete policy undecided | 1 | 2 | 2 | DOCUMENT with 8.4 STOP: archive-only is the Phase A default; hard-delete retention needs legal sign-off. Re-open only on a legal decision. |
| R-820 | PERF/OPS | Large-file / streaming / virus-scan edges untested | 1 | 2 | 2 | DOCUMENT: functional isolation + validation correctness is the Phase A concern; large-file/streaming is P3 exploratory; virus scanning is separately-approved-only (a STOP if requested). |
| R-821 | OPS | Coverage reporter still absent (standing NFR carry) | 1 | 2 | 2 | DOCUMENT: the standing NFR CONCERN carried Epics 2-7 (no `c8`/coverage reporter) applies here; surface for the owner schedule-or-accept decision at the Epic 8 gate. |

### Risk Category Legend

- **SEC**: Security (two-plane isolation on `files`/`file_links` + `storage.objects`, private-by-default,
  client-controlled paths, signing funnel, path spoofing, MIME/size bypass, existence disclosure, fixture PII)
- **DATA**: Data Integrity (storage↔DB atomicity/orphans, signed-URL expiry/refresh, metadata-first
  ordering, lifecycle-lock integrity + family agreement, partial lock/archive)
- **BUS**: Business/Compliance (index scope creep, MIME/size policy approval, retention policy)
- **TECH**: Technical (TTL configurability — resolved)
- **OPS**: Operations (8.1 sequencing — resolved, partial-write/archive plumbing, standing NFR carry)
- **PERF**: Performance (large-file/streaming, no SLA)

---

## Testability Notes (Epic-Level)

1. **RLS negatives across TWO planes — Wave 1 is DONE, keep it green.** `files`/`file_links` are enrolled
   in `TENANT_TABLES`; the H4 gate + shared cross-tenant/anon suites cover the **DB plane**
   automatically. The **storage-plane** matrix (`storage.objects` RLS, path-spoof, cross-tenant
   list/read/sign) is authored in `storage-object-isolation.rls.test.ts`. Wave-2 upload/preview code must
   NOT regress either; do not hand-write ad-hoc isolation tests that bypass the inventory.
2. **The signing funnel negative-first matrix is landed.** `createSignedFileAccess` rejects anon /
   cross-tenant / spoofed-path / wrong-lifecycle each with a generic `FILE_ACCESS_DENIED` (identical
   shape for not-found vs forbidden — the anti-existence-disclosure proof, R-809). 8.3's job is the
   preview/download UX and the expiry→refresh reauthorization LOOP on top of this proven command.
3. **Expiry is a real behavioral test, driven by the configurable TTL (shipped).** The low test-env TTL
   proves an expired URL is rejected WITHOUT sleeping. 8.3's refresh must re-run the FULL authorization
   check (not just re-sign) — the refresh test must assert a revoked/lifecycle-changed file is NOT
   re-signed. The MAX-TTL clamp (a fat-fingered huge env value falls back to the safe default) is unit-
   covered; keep it.
4. **Storage↔DB consistency: DB-side proven, storage-write compensation is the Wave-2 piece.** 8.1's
   `create_file_with_link` rolls back cleanly (proven). 8.2's upload path adds the object-byte write —
   its test must inject a DB failure AFTER the storage write and assert the orphan is compensated
   (cleaned/archived), reusing 6.3's find-or-create/upsert discipline (R-807 storage side).
5. **Lock enforcement is two-layer, behavioral, and must join a FAMILY (8.4).** Attempt mutation/delete
   of a locked `file_links` row through the command (assert the lock code) AND through a direct
   own-tenant authenticated UPDATE/DELETE (assert the trigger rejects). The trigger must use the same
   SHAPE as `20260707120000_quote_version_sent_lock.sql` (`QV409`) and
   `20260711120000_accepted_record_lock.sql` (`AR704`) with a DISTINCT-but-related code (R-822). A test
   that only proves the UI disables the button is not evidence. 8.4 must also prove AGREEMENT: locking a
   sent version's PDF link and an accepted acceptance's evidence link behaves consistently with the
   version/acceptance locks those files belong to.
6. **Metadata-first, storage-second — proven at the command layer; assert it at the UX layer too.**
   8.1's `loadFileForAccess` resolves `files` ownership BEFORE `createSignedFileUrl`. 8.3's preview UX
   must not reorder it into a spoof window and must not render raw bucket/path (R-810).
7. **Coverage-shape lesson applies to the Wave-2 UI logic.** Pull the four distinct upload error-state
   decisions (8.2), the signed-access-refresh decision (8.3), and the index-scope filter (8.5) OUT of
   `"use client"` components into pure `.ts` modules so the fast `node --test` gate protects them — the
   same pattern 8.1 already used for `object-path.ts`/`lifecycle.ts`/`validation.ts`/`signed-access.ts`.
8. **Golden/fixture discipline as established.** Any file-metadata or extracted-file golden lands under
   `tests/unit/**`. The PII/secret+ORGNR scan is ALREADY extended to file fixtures (R-819) — keep it
   green over any new 8.2 upload fixtures; no raw customer file committed. Origin-label file goldens so a
   real Epic 9 Lovable delta lands without a code-shape change.
9. **Two-tenant + per-run-unique + local-stack hygiene as established.** Storage suites run against the
   LOCAL Supabase CLI stack ONLY (never demo/dev/prod); `SUPABASE_TEST_REQUIRED=1` in CI hard-fails a
   missing stack. Confirm the local storage API is reachable before asserting (post-reset false-green
   trap) — 8.1's storage suites already do this; Wave-2 upload/preview suites inherit it.
10. **Resumed-run artifact discipline (retro standing practice).** Any resumed Wave-2 story re-verifies
    scaffold completeness (`describe.skip`/`notYetImplemented`), exported-but-unimplemented command
    surface, and sprint-status freshness against disk before trusting recorded state.

---

## Entry Criteria

### Story 8.1 (Wave 1) — SATISFIED ✅

- [x] Epics 1-2 merged and green (isolation harness, command envelope + `verifyOwnership`,
      `audit_events`, two-tenant fixture, service-role containment).
- [x] Local Supabase CLI stack storage API reachable; storage-reachability probe in the runner.
- [x] Private `tenant-files` bucket + server-derived paths agreed and shipped (`config.toml` + migration).
- [x] Signed-URL TTL environment-configurable (`SUPABASE_SIGNED_URL_TTL_SECONDS`, 24h MAX clamp).
- [x] Atomic metadata+link RPC under ADR-A009 (SECURITY INVOKER) shipped.
- [x] Owner types limited to Phase A entities; `quote_version`/`quote_acceptance`/`job` now ACTIVE (Epics 6/7 landed).

### Stories 8.2-8.5 (Wave 2) — READY

- [x] **Story 8.1 landed and green** — single Phase A file model exists; 6.3 + 7.x already extend it.
- [x] **Owner-entity workflows exist** — Epics 3/5 (uploads target real entities), Epic 6 (sent
      `quote_versions` + PDF), Epic 7 (accepted `quote_acceptances` + evidence) all DONE and FROZEN.
      8.4's lock matrix now has firm targets: the frozen `QV409`/`AR704` triggers (do NOT re-invent —
      join the family, R-822).
- [ ] **Conservative MIME/size defaults chosen** for dev; final policy is an owner Sign-Off residual
      (R-817), re-confirmed at 8.2 create-story; not a real-pilot blocker under demo-data-only.
- [ ] **File-index scope decision** — 8.5's index is OPTIONAL; confirm at 8.5 create-story whether entity
      panels already satisfy pilot needs (skip) or a limited index is warranted (build to strict Phase A
      scope, R-816).
- [ ] **8.2 storage-write compensation approach agreed** — the upload path extends `create_file_with_link`
      with the object-byte write + storage-success/DB-failure compensation (reuse 6.3's find-or-create).

---

## Exit Criteria

- [ ] All P0 tests passing (100%). **8.1's P0 slice is green;** the Wave-2 P0 (8.2 upload validation,
      8.4 two-layer lock) must land.
- [ ] All P1 tests passing (≥95%, waivers documented).
- [x] **`files`/`file_links` enrolled in `TENANT_TABLES`** + H4 gate green (R-801).
- [x] **Storage negative matrix green** — cross-tenant list/read/sign + path spoof + anon + expired-URL
      (low TTL) + wrong-lifecycle all rejected with generic errors (R-804/R-805/R-806/R-809).
- [x] **Private-bucket + server-derived-path construction assertions green** (R-803).
- [x] **Atomic metadata+link RPC rollback proven** (R-807 DB-side). Storage-write compensation (8.2) still to land.
- [ ] **(Wave 2) Lock enforcement proven two-layer** — command AND DB reject mutation/delete of a locked
      sent/accepted file; archive-only-on-delete + audit; AGREES with `QV409`/`AR704` (R-812/R-813/R-822).
- [ ] **(Wave 2) Upload validation green** — MIME/size/owner/lifecycle rejected server-side even when the
      client is bypassed; four distinct user-safe error states; no existence disclosure (R-808/R-809/R-811).
- [ ] **(Wave 2) Index scope guardrail green** — index lists ONLY Phase A entity files, no deferred/
      document-center labels; file audit events written with safe metadata (R-816; architecture §15).
- [x] No committed real PII / raw customer file; PII scan extended and green (R-819).
- [ ] Standing NFR CONCERN (coverage reporter, R-821) surfaced for owner schedule-or-accept at the gate.
- [ ] No open high-priority (≥6) item unmitigated; all STOP conditions respected.

---

## Test Coverage Plan

> **P0/P1/P2/P3 denote PRIORITY / RISK, not execution timing.** Execution timing is handled separately in
> **Execution Strategy** below. The binding timing rule is: run everything on the PR gate if the suite
> completes in time, defer only genuinely expensive/long-running work.

Levels: **UNIT** (`node --test`, pure logic under `tests/unit/**`), **INT** (Vitest, DB-backed under
`tests/integration/**`), **RLS** (Vitest RLS-negative), **STORAGE-NEG** (Vitest against local Supabase
Storage), **E2E** (Playwright `tests/e2e/**`), **GOLDEN** (pinned under `tests/unit/**`), **DOCS**
(review/guardrail). Counts are ranges. **DONE** marks 8.1 coverage already green in-repo.

### P0 (Critical)

**Criteria**: Blocks core file safety + High risk (≥6) + No workaround

| Requirement | Test Level | Risk Link | Test Count | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| `files`/`file_links` migration-reset + per-table policy/GRANT enumeration | INT | R-801 | 2-3 | DEV | **DONE** — `file-tables-migration-reset.int.test.ts` |
| `files`/`file_links` cross-tenant + anon-path RLS negatives via `TENANT_TABLES` | RLS | R-801 | 3-5 | DEV | **DONE** — H4 gate + shared suites |
| Link creation ownership validation — foreign file id AND foreign owner id both rejected | INT | R-802 | 3-4 | DEV | **DONE** — `file-link-ownership.int.test.ts` |
| Private-bucket + server-derived-path construction assertions (no public bucket, no client path) | INT/DOCS | R-803 | 2-3 | DEV | **DONE** — construction assertion + `object-path.test.ts` |
| `createSignedFileAccess` authorization matrix — anon / cross-tenant / wrong-lifecycle rejected | INT | R-804 | 4-6 | DEV | **DONE** — `file-signed-access.int.test.ts` |
| Storage-plane negatives — cross-tenant list/read/sign + object path spoof | STORAGE-NEG | R-805 | 4-6 | DEV | **DONE** — `storage-object-isolation.rls.test.ts` |
| Expired signed URL rejected (low test TTL) + TTL MAX clamp | INT + UNIT | R-806 | 2-3 | DEV | **DONE (foundation)** — expired-URL INT + TTL units; refresh-reauth is 8.3 |
| Atomic metadata+link RPC rollback (no orphans) | INT | R-807 | 3-4 | DEV | **DONE (DB-side)** — RPC rollback; storage-write compensation is 8.2 |
| **(8.2)** Upload MIME/size/owner/lifecycle server-side validation (client bypassed) | INT | R-808 | 4-6 | DEV | **OPEN** — the new upload GATE |
| **(8.2/8.3)** Cross-tenant failure = generic no-existence-disclosure error | INT | R-809 | 2-3 | DEV | **PARTIAL** — signing path DONE; upload path OPEN |
| **(8.4)** Locked sent/accepted file — mutation/delete rejected via command AND direct SQL; AGREES with QV409/AR704 | INT | R-812/R-822 | 4-6 | DEV | **OPEN** — the lock-enforcement trigger + family agreement |
| Fixture PII/secret + raw-file scan over file-metadata fixtures/artifacts | INT/DOCS | R-819 | 1-2 | DEV | **DONE** — scan extended, green |

**Total P0**: ~34-51 test cases — **~8 of 12 rows DONE (8.1)**; remaining Wave-2 P0 ~10-16 hours.

### P1 (High)

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Requirement | Test Level | Risk Link | Test Count | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| **(8.2)** Entity-panel upload UX — shows allowed types/size/owner/purpose; no raw path field | E2E | R-803/R-811 | 3-5 | QA | OPEN |
| **(8.2)** Four distinct user-safe upload error states (blocked-type/too-large/net-fail/perm-fail) | E2E + UNIT | R-811 | 4-6 | QA/DEV | OPEN — extract error-state logic to pure `.ts` |
| **(8.2)** Storage-success / DB-failure compensation (no orphan) | INT | R-807 | 2-3 | DEV | OPEN — extends 6.3's find-or-create/upsert |
| **(8.3)** Preview/download UX + expiry→refresh reauthorization loop | E2E | R-806 | 3-4 | QA | OPEN — on top of the proven signing command |
| **(8.3)** Metadata-first / storage-second ordering + no raw bucket/path in UI | INT + E2E | R-810 | 2-3 | DEV/QA | OPEN (command-side ordering already proven) |
| **(8.4)** Lock-warning UX + quote/acceptance lifecycle golden cases | E2E + GOLDEN | R-812/R-822 | 3-5 | QA/DEV | OPEN |
| **(8.4)** Partial-lock / archive-delete consistency + audit event present | INT | R-813 | 2-3 | DEV | OPEN |
| **(8.5)** Limited-index tenant-scoped listing (only tenant A files) + RLS negative | E2E + RLS | R-801/R-816 | 2-3 | QA/DEV | OPEN (reuses enrollment negatives) |
| **(8.5)** File audit events (upload/link/sign/archive/lock) with safe metadata | INT | architecture §15 | 2-3 | DEV | OPEN |

**Total P1**: ~23-35 test cases — ~18-30 hours (all Wave 2).

### P2 (Medium)

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| Lifecycle-state transitions (draft→linked→locked→archived→deleted) valid/invalid moves | INT | R-812/R-813 | 3-4 | DEV | State-machine edge coverage (the union is shipped) |
| a11y/keyboard on upload panels, preview controls, index (text status, not color-only) | E2E | R-811/R-816 | 2-4 | QA | Follows the epic-6 timeline a11y pattern |
| Index-absence guardrail — no deferred-module groupings / document-center workflows | E2E/DOCS | R-816 | 1-2 | QA | Asserts absence of deferred file category labels |
| Documented Lovable attachment-locking delta (behavioral oracle) | DOCS | R-812 | 1 | DEV | Compare Lovable locking, document safer Phase A delta |
| Checksum/hash-when-available metadata behavior | INT | R-807 | 1-2 | DEV | `files.checksum` column shipped; behavior when populated |

**Total P2**: ~8-13 test cases — ~6-14 hours.

### P3 (Low)

**Criteria**: Nice-to-have + Exploratory + Benchmarks

| Requirement | Test Level | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- |
| Large-file / streaming upload/download edges | E2E/INT | 1-2 | QA | Pilot-sized only; no SLA (R-820) |
| Signed-URL TTL boundary fuzz (just-expired / just-valid) | INT | 1-2 | DEV | Exploratory around the low test TTL |
| DX / error-message exploratory + residual perf notes | DOCS | 1-2 | DEV | Non-blocking |

**Total P3**: ~3-6 test cases — ~2-5 hours.

---

## Execution Strategy

Philosophy: **run everything on the PR gate** — the whole Epic 8 suite (UNIT + INT + RLS + STORAGE-NEG +
E2E) is well under 15 minutes with Playwright parallelization and Vitest's DB-backed job, so there is no
reason to defer functional coverage. 8.1's suites already run on every PR; Wave-2 suites join them.

- **Every PR (the gate):** all functional tests — the shipped 8.1 suites (migration-reset + RLS
  negatives + H4 gate, `createSignedFileAccess` matrix, storage-negative matrix, atomic RPC rollback,
  PII scan) PLUS the Wave-2 additions (upload validation, storage-write compensation, two-layer lock,
  index-scope guardrails, file audit, E2E upload/preview/lock/index). Storage suites run against the
  LOCAL Supabase CLI stack only (`SUPABASE_TEST_REQUIRED=1` hard-fails a missing stack; skip-clean
  locally).
- **Nightly (optional):** large-file/streaming edges and signed-URL TTL boundary fuzz (P3) if they grow
  beyond the PR budget — currently small enough to stay on the PR gate.
- **Weekly / on-demand:** nothing required for Phase A (no perf SLA, no chaos suite). Add only if a
  file-storage SLA or scale requirement emerges (R-820).

## Execution Order

### Smoke Tests (<5 min)

- [x] `files`/`file_links` migration-reset + H4 inventory gate green (INT) — DONE
- [x] `createSignedFileAccess` anon + cross-tenant rejection (INT) — DONE
- [x] Private-bucket construction assertion (INT/DOCS) — DONE

### P0 Tests (<10 min — PR gate)

- [x] `files`/`file_links` RLS cross-tenant + anon negatives (RLS) — DONE
- [x] Link ownership validation both-side spoof (INT) — DONE
- [x] Signed-access authorization matrix incl. expired-URL/lifecycle (INT) — DONE
- [x] Storage-plane cross-tenant list/read/sign + path spoof (STORAGE-NEG) — DONE
- [x] Atomic metadata+link RPC rollback (INT) — DONE
- [ ] (8.2) Upload validation server-side (INT) · (8.4) locked-file mutation/delete two-layer + family agreement (INT) — OPEN
- [x] Fixture PII/raw-file scan (INT/DOCS) — DONE

### P1 Tests (<30 min) — all Wave 2

- [ ] Entity-panel upload UX + four error states (E2E + UNIT) · storage-write compensation (INT)
- [ ] Preview/download + expiry→refresh (E2E) · metadata-first ordering (INT/E2E)
- [ ] Lock-warning UX + lifecycle golden (E2E + GOLDEN) · archive/audit consistency (INT)
- [ ] Limited-index listing + RLS negative (E2E + RLS) · file audit events (INT)

### P2/P3 Tests (<60 min)

- [ ] Lifecycle-state transitions (INT) · a11y (E2E) · index-absence guardrail (E2E/DOCS)
- [ ] Lovable delta doc (DOCS) · checksum behavior (INT) · large-file / TTL fuzz (INT/E2E)

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| --- | --- | --- | --- | --- |
| P0 | ~34-51 | ~0.7-0.9 | ~24-38 | **~2/3 already spent on 8.1**; ~10-16 hrs remaining (8.2 upload, 8.4 lock) |
| P1 | ~23-35 | ~0.8-1.0 | ~18-30 | All Wave 2 — upload/preview/lock/index UX + compensation + audit |
| P2 | ~8-13 | ~0.5-0.8 | ~6-14 | Edge transitions, a11y, guardrails, deltas |
| P3 | ~3-6 | ~0.4-0.7 | ~2-5 | Exploratory |
| **Total** | **~68-105** | **-** | **~50-87** | **~7-11 dev-days** — ~1/3 landed (8.1), ~2/3 is the Wave-2 remainder |

**Remaining Wave-2 effort** (8.2-8.5): ~30-55 hours — the upload GATE + entity panels (8.2), the
signed preview/download UX + expiry→refresh (8.3), the two-layer lock TRIGGER joining the QV409/AR704
family (8.4), and the optional limited index + file audit (8.5).

### Prerequisites

**Test Data:**

- Two-tenant fixture + file-metadata factory — **already exist** (8.1). EXTEND with valid /
  blocked-MIME / oversized dev fixture files for 8.2 upload/validation tests, generated at test time
  (never committed as customer data).

**Tooling:**

- Local Supabase CLI stack with the Storage service running — **already wired** (8.1's storage-
  reachability probe).
- Existing runner split (`scripts/run-tests.mjs`).
- Golden PII/secret + ORGNR scan — **already extended** to file-metadata fixtures; keep green over new
  8.2 upload fixtures.

**Environment:**

- Private `tenant-files` bucket + server-derived-path config — **shipped**.
- Env-configurable signed-URL TTL (low in test env, 24h MAX) — **shipped**.
- DB + storage suites run against the LOCAL stack ONLY; `SUPABASE_TEST_REQUIRED=1` in CI; health-poll +
  storage-reachability after reset — **wired**.

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: ≥95% (waivers required for failures)
- **P2/P3 pass rate**: ≥90% (informational)
- **High-risk (≥6) mitigations**: 100% complete or approved waivers

### Coverage Targets

- **File isolation (DB + storage plane) negatives**: 100% — **MET by 8.1** (every access route
  read/link/update/archive/list/sign/spoof proven cross-tenant + anon-denied)
- **Signed-access authorization matrix**: 100% — **MET by 8.1**
- **Upload validation (MIME/size/owner/lifecycle)**: 100% server-side — **PENDING 8.2**
- **Lifecycle-lock enforcement (Wave 2)**: 100% two-layer + family agreement — **PENDING 8.4**
- **Business/index-scope guardrails**: 100% — **PENDING 8.5**
- **Edge cases (state transitions, a11y, deltas)**: ≥50%

### Non-Negotiable Requirements

- [x] `files` + `file_links` enrolled in `TENANT_TABLES`; H4 gate green (R-801)
- [x] No public bucket, no client-controlled storage path (R-803)
- [x] Storage negative matrix (cross-tenant list/read/sign + spoof + expired) 100% green (R-804/R-805/R-806)
- [x] `createSignedFileAccess` rejects anon/cross-tenant/spoof/expired/wrong-lifecycle with generic errors (R-804/R-809)
- [x] Atomic metadata+link RPC rollback proven — no orphans DB-side (R-807)
- [ ] (Wave 2) Storage-write / DB-failure compensation proven — no orphaned object (R-807 storage side)
- [ ] (Wave 2) Locked sent/accepted files immutable at command AND DB; archive-only + audit; AGREES with QV409/AR704 (R-812/R-822)
- [x] No service-role key on any client file path; containment guards green
- [x] No committed real PII / raw customer file; PII scan green (R-819)
- [x] "Single Phase A file model" contract intact — no competing model (6.3 + 7.x consume 8.1; R-814)

---

## Mitigation Plans

Wave-1 mitigations (R-801/R-803/R-804/R-805/R-806/R-807/R-819) are **SHIPPED & VERIFIED** — see the
Status/Evidence column of the risk table for the concrete in-repo tests. The plans below focus on the
OPEN Wave-2 controls.

### R-808: Upload MIME/size/owner/lifecycle validation bypass (Score: 6) — OPEN

**Mitigation Strategy:** 8.2 adds a server-side upload gate validating MIME, size, tenant ownership,
owning entity, purpose, and lifecycle BEFORE the file is usable; each invalid case rejected server-side
even when the client is bypassed. Extract the MIME/size decision into a pure `.ts` module for the fast
gate (as 8.1 did for owner-type/purpose). Conservative dev defaults now; owner-approved policy later (R-817).
**Owner:** Dev (8.2) · **Timeline:** Story 8.2 · **Status:** Planned
**Verification:** INT rejects each invalid case server-side; UNIT covers the pure MIME/size policy.

### R-812 + R-822: Locked commitment file mutable/deletable + family divergence (Score: 6 / 4) — OPEN

**Mitigation Strategy:** 8.4 adds a `file_links` lock-ENFORCEMENT trigger reusing the SHAPE of the frozen
`20260707120000_quote_version_sent_lock.sql` (`QV409`) and `20260711120000_accepted_record_lock.sql`
(`AR704`) triggers (fail-closed-by-construction, custom SQLSTATE, security invoker, empty search_path,
schema-qualified) with a DISTINCT-but-related sibling lock code — the "one model at three scopes, shared
lock-code FAMILY not a fork" retro constraint the two migrations explicitly name. Command validation
returns a stable lock code in the family; deletion of a locked file is archive-only + audit.
**Owner:** Dev (8.4) · **Timeline:** Story 8.4 · **Status:** Planned
**Verification:** INT attempts mutation/delete of a locked sent-PDF / accepted-evidence link via command
AND direct authenticated SQL — both rejected; archive-only + audit present; AGREES with the version/
acceptance locks (the sent version's PDF link and the accepted acceptance's evidence link both lock).

### R-813: Partial lock / broken archive-delete (Score: 4) — OPEN

**Mitigation Strategy:** Lock + `file_links` lock fields + `audit_events` written consistently
(transactional or verified-compensated per ADR-A009); archive-only never hard-deletes a locked file.
**Owner:** Dev (8.4) · **Timeline:** Story 8.4 · **Status:** Planned
**Verification:** INT: mid-flow failure leaves a consistent, retryable state; audit event present for
every lock/archive.

### R-816: File index becomes a document center (Score: 4) — OPEN

**Mitigation Strategy:** 8.5's index lists ONLY CRM/calc/quote/acceptance/job files, NO deferred
groupings / document-center workflows / cross-module analytics; guardrail test asserts absence of
deferred file category labels; the index is OPTIONAL (skippable if entity panels suffice).
**Owner:** Dev (8.5) + Rasmus · **Timeline:** Story 8.5 · **Status:** Planned

---

## Assumptions and Dependencies

### Assumptions

1. Supabase Storage RLS on `storage.objects` + server-derived tenant path prefixes isolate tenants as
   strictly as Postgres RLS — **validated** by the shipped storage-negative matrix.
2. The signed-URL TTL is environment-configurable (low in test env, 24h MAX) — **shipped**.
3. Under the 2026-07-03 demo-data-only decision, conservative dev MIME/size defaults are acceptable for
   the MVP; final owner-approved policy is a post-MVP Sign-Off residual (R-817), not a current blocker.
4. All Phase A owner types are now ACTIVE — customer/facility/contact/calculation (Epics 3/5) plus
   quote_version/quote_acceptance/job (Epics 6/7 shipped). 8.2's uploads and 8.4's locks have real
   entity targets.
5. The two-runner + Playwright + two-tenant + storage harness extends cleanly to the Wave-2 upload/
   preview/lock/index suites — 8.1 already proved the storage extension.

### Dependencies

1. **Epics 1-2** (isolation harness, envelope, audit, two-tenant fixture) — satisfied by 8.1.
2. **Local Supabase Storage service** in the test stack — wired by 8.1.
3. **Story 8.1** — the single Phase A file model; all Wave-2 stories EXTEND it (done; 6.3/7.x already do).
4. **Epics 3/5** (owner entities for uploads) — done; 8.2's concrete scenarios target them.
5. **Epic 6** (sent `quote_versions`/PDF, `QV409` lock) and **Epic 7** (accepted `quote_acceptances`/
   evidence, `AR704` lock) — done and FROZEN; 8.4 joins their lock-code family and must AGREE with them.

### Risks to Plan

- **Risk**: 8.4 forks a divergent lock mechanism instead of joining the `QV409`/`AR704` family (R-822).
  - **Impact**: Divergent lock behavior between the file link (8.4) and the version/acceptance (Epic 6/7).
  - **Contingency**: 8.4 reuses the frozen trigger SHAPE with a sibling code; INT asserts AGREEMENT on a
    sent-PDF link and an accepted-evidence link. The two migrations already name 8.4 as the third scope.
- **Risk**: 8.2's storage-write compensation is under-tested (R-807 storage side), leaving orphaned
  objects on a DB-failure-after-storage-write.
  - **Impact**: Orphaned, potentially silently-accessible storage objects.
  - **Contingency**: 8.2 reuses 6.3's find-or-create/upsert discipline; INT injects a DB failure AFTER
    the storage write and asserts the object is compensated (cleaned/archived).
- **Risk**: Storage service not running locally → storage suites silently skip (false-green).
  - **Impact**: Isolation gap ships undetected.
  - **Contingency**: Storage-reachability probe + `SUPABASE_TEST_REQUIRED=1` hard-fail in CI (wired by 8.1).

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests for the OPEN Wave-2 items (8.2 upload validation, 8.4
  two-layer lock) at each story's create-story — separate workflow, not auto-run. (8.1's P0 is already
  landed.)
- Run `*automate` for broader Wave-2 coverage once each story's implementation exists.
- Run `*trace` + `*nfr` at the Epic 8 boundary (after Wave 2) for the release gate decision — 8.1's
  coverage is already mappable; the gate resolves once 8.2-8.5 land.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: {name} Date: {date}
- [ ] Tech Lead: {name} Date: {date}
- [ ] QA Lead: {name} Date: {date}

**Comments:** Wave 1 (8.1) is shipped, green, and consumed by Epics 6-7 (single-model contract held).
Wave 2 (8.2-8.5) is ready to run with firm targets — the frozen `QV409`/`AR704` triggers are the family
8.4 must join (R-822). Re-confirm the owner-approved MIME/size policy (R-817) and the optional-index
build/skip (R-816) at each create-story.

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| **`TENANT_TABLES` inventory + H4 gate** | `files`/`file_links` enrolled | `rls-inventory-gate.int.test.ts`, `cross-tenant-isolation.rls.test.ts`, `anon-path-isolation.rls.test.ts` stay green |
| **Server command envelope + `verifyOwnership`** | File commands reuse it | `envelope-*.int.test.ts`, `server-error-vs-no-access.int.test.ts` — generic-error / no-existence-disclosure preserved |
| **`audit_events` (append-only)** | 8.4/8.5 file events written through it | `audit-append-only.int.test.ts`, `audit-metadata-hygiene-e2e.int.test.ts` — no raw file content/path/PII |
| **Migration-reset suite** | `files`/`file_links` in the chain | `file-tables-migration-reset.int.test.ts` + per-table policy enumeration |
| **Epic 6 quote PDF (6.3)** | Consumes 8.1 file model | `generate-quote-pdf-storage-privacy.int.test.ts` — PDF stored through 8.1 (private, server-derived, signed access); no competing model (R-814). 8.4 locks the sent version's PDF link, agreeing with `QV409` |
| **Epic 7 acceptance evidence** | 8.4 locks accepted evidence link | 8.4 lock must AGREE with `AR704` accepted-state immutability; `accept.ts` `link_existing_file` (`quote_acceptance`/`acceptance_evidence`) is the target |
| **Frozen lock triggers `QV409`/`AR704`** | 8.4's file-lock joins the family | 8.4 trigger reuses the shape (`20260707120000`/`20260711120000`) with a sibling code (R-822); INT asserts agreement |
| **Service-role containment guards** | File paths stay anon+RLS | `verify:service-role-containment` + `verify:bundle-containment` stay green — no service-role key on client file paths; `createSignedFileAccess` signs on the RLS client |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification + gate decision rules
- `probability-impact.md` — P×I scoring (1-3 DOCUMENT, 4-5 MONITOR, 6-8 MITIGATE, 9 BLOCK)
- `test-levels-framework.md` — UNIT / INT / RLS / STORAGE-NEG / E2E / GOLDEN / DOCS selection
- `test-priorities-matrix.md` — P0-P3 prioritization + execution ordering

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd.md` (required-files FRs)
- Epic: `_bmad-output/planning-artifacts/epics.md` (Epic 8, lines 1556-1753)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (ADR-A006; ADR-A009; §5 command
  registry; §6 Storage; §9 immutable-lifecycle triggers; §14 File And Storage Model; §15 audit)
- Dependent designs: `test-design-epic-6.md` (6.3 consumes 8.1), `test-design-epic-7.md` (7.x evidence)
- Sequencing: `_bmad-output/implementation-artifacts/sprint-status.yaml` (8.1 done; Epics 6-7 done; 8.2-8.5 backlog)
- **Shipped 8.1 code**: `supabase/migrations/20260704120000_file_storage_foundation.sql`;
  `src/server/storage/{object-path,lifecycle,signed-access}.ts`;
  `src/server/commands/files/{files,file-db,validation}.ts`; `supabase/config.toml [storage.buckets.tenant-files]`
- **Frozen lock triggers (8.4 basis)**: `supabase/migrations/20260707120000_quote_version_sent_lock.sql`
  (`QV409`), `20260711120000_accepted_record_lock.sql` (`AR704`)
- Project context: `_bmad-output/project-context.md` (Testing Rules; Security Regression Harness Rules;
  RLS-by-default + GRANTs; golden PII scan; demo-data-only decision)

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `bmad-testarch-test-design`
**Version**: 4.0 (BMad v6) · Epic-Level (Phase 4) · Revision 2 (refreshed 2026-07-07)
