---
stepsCompleted:
  - step-01-load-context
  - step-02-define-thresholds
  - step-03-gather-evidence
  - step-04-evaluate-and-score
  - step-04e-aggregate-nfr
  - step-05-generate-report
lastStep: step-05-generate-report
lastSaved: '2026-07-07'
workflowType: testarch-nfr-assess
assessmentLevel: epic
epicNum: 8
executionMode: sequential
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-8.md (revision 2; 21 risks R-801..R-822; 11 high-priority ≥6; 5 non-negotiable epic controls; two-wave P0-P3 coverage plan; 8.1 SHIPPED baseline + Wave-2 rows)
  - _bmad-output/test-artifacts/traceability/epic-8-traceability-report.md (gate PASS; P0 100% 16/16, P1 100% 10/10, overall 100% 26/26; suite 1237 unit / 693 int / 8 int-rls re-verified / 6 e2e + 1 test.fixme)
  - _bmad-output/test-artifacts/nfr-assessment-epic-7.md (format + the single standing CONCERNS carried since Epic 2; pnpm audit resolved Epic 6)
  - _bmad-output/planning-artifacts/epics.md (Epic 8, Stories 8.1-8.5; required-files FRs; architecture §6/§9/§14/§15)
  - _bmad-output/auto-bmad/state/epic/epic-8.yaml (4 Wave-2 stories landed; 8.1 in base; auto_decisions; open_questions R-816/R-817)
  - _bmad-output/implementation-artifacts/8-1..8-5 story files (8.1 done; 8.2/8.3/8.4/8.5 review; all tasks [x]; Review Findings resolved/dispositioned)
  - supabase/migrations/20260704120000_file_storage_foundation.sql (files/file_links + storage.objects RLS + composite same-tenant FKs + private tenant-files bucket public=false + create_file_with_link/link_existing_file RPCs SECURITY INVOKER)
  - supabase/migrations/20260712120000_file_link_lock.sql (8.4 two-layer lock — FL823 → FILE_LINK_LOCKED; enforce_file_link_lock/enforce_file_lock immutability + apply_file_link_lock/apply_lock_on_quote_version_transition/apply_lock_on_acceptance_insert; fail-closed exempt-then-tuple; SECURITY INVOKER + empty search_path; joins the frozen QV409/AR704 family, additive: NO new table/column/policy)
  - supabase/migrations/20260707120000_quote_version_sent_lock.sql (QV409), 20260711120000_accepted_record_lock.sql (AR704) — the frozen parent locks 8.4 AGREES with
  - src/server/storage/upload-policy.ts (ALLOWED_MIME_TYPES closed allow-list pdf/png/jpeg/webp/gif/txt/csv/doc(x)/xls(x); MAX_UPLOAD_SIZE_BYTES = 25 MiB ≤ 50 MiB config bound; fail-closed isAllowedMimeType)
  - src/server/commands/command-errors.ts (stable codes live: TENANT_ACCESS_DENIED, FILE_ACCESS_DENIED, FILE_LINK_LOCKED (FL823 sibling of QV409/AR704), VALIDATION_FAILED, COMMAND_CONFLICT reserved)
  - src/server/{storage/**,commands/files/**} ; src/features/files/** ; src/components/files/**
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES — files/file_links enrolled + H4 inventory gate)
  - tests/integration/rls/{file-tables-migration-reset,storage-object-isolation,file-index-isolation,file-link-lock}.* + rls-inventory-gate.int.test.ts
  - tests/integration/commands/{file-signed-access,file-signed-access-refresh,file-link-ownership,file-upload,file-link-lock,file-audit-events,generate-quote-pdf-storage-privacy}.int.test.ts
  - tests/unit/{server/storage/{object-path,upload-policy,upload-object,upload-error-classifier},server/commands/files/{validate-upload-file,validate-archive-file,file-write-error-mapping},features/files/{file-index,file-lock-predicate,file-lock-lifecycle-golden,signed-access-state,upload-action-state,archive-action-state},guardrails/file-index-non-scope}.test.ts
  - tests/e2e/files/{entity-file-panel,entity-file-preview,file-lock-panel,file-index-scope}.e2e.spec.ts
  - .github/workflows/ci.yml (verify job: pnpm audit --audit-level=high BLOCKING at line 72; service-role containment source+built-bundle guards; db job SUPABASE_TEST_REQUIRED=1; no c8/coverage step)
  - knowledge: adr-quality-readiness-checklist.md, ci-burn-in.md, test-quality.md, error-handling.md, playwright-config.md
---

# NFR Assessment - Epic 8: Required Files And Private Storage

**Date:** 2026-07-07
**Epic:** 8 (Stories 8.1-8.5) — the file-storage **foundation** (8.1 — private `tenant-files` bucket, `files`/`file_links` metadata + polymorphic links, server-derived paths, the `createSignedFileAccess` funnel + storage negative matrix); **validated uploads + entity file panels** (8.2); the **tenant-authorized signed preview/download UX** (8.3); **quote-PDF/attachment/acceptance-evidence lifecycle locks** enforced at command AND DB level, joining the frozen QV409/AR704 family (8.4); and an **optional limited Phase A file index + file audit** (8.5)
**Overall Status:** PASS (advisory) ✅ — with **one** remaining standing forward-looking CONCERNS (no line-coverage reporter — LOW, carried since Epic 2). The `pnpm audit --audit-level=high` gate remains present and blocking (confirmed `.github/workflows/ci.yml:72`); Epic 8 adds no new runtime dependency, so it needs no extension and stays green. Runtime performance/load, availability/DR/MTTR remain deferred N/A for Phase A (no SLA, single pilot tenant, no production SLO). The owner-gated MIME/size real-pilot policy + byte-level content sniffing (R-817) and locked-evidence retention (R-818) residuals are dated, surfaced items — not coverage gaps.

---

Note: This assessment summarizes existing evidence; it does not run tests or CI workflows. The Epic 8 recorded suite state (last full run Story 8.4 = 1203 unit + 693 INT = 1896 pass / 0 skipped; Story 8.5 → +15 unit = 1237 unit / 0 fail, `file-audit-events` + `file-index-isolation` INT/RLS re-verified 8 pass on the live stack; E2E 6 pass + 1 `test.fixme` `8.3-E2E-04`) is per the story automation records and the epic-8 traceability report. INT/RLS/STORAGE-NEG/E2E are CI-gated (`SUPABASE_TEST_REQUIRED=1`). Several load-bearing source-level claims were re-verified directly for this audit — `tenant-files` `public=false` in the migration; `files`/`file_links` enrolled in `TENANT_TABLES`; the `create_file_with_link`/`link_existing_file` RPCs `SECURITY INVOKER`; the two-layer `file_links` lock (`enforce_file_link_lock` immutability + `apply_*` lock-apply triggers, custom SQLSTATE `FL823`, `SECURITY INVOKER` + empty `search_path`, fail-closed exempt-then-tuple, in `20260712120000_file_link_lock.sql`); the `ALLOWED_MIME_TYPES` closed allow-list + `MAX_UPLOAD_SIZE_BYTES = 25 MiB` in `upload-policy.ts`; the `FILE_ACCESS_DENIED`/`FILE_LINK_LOCKED` (FL823 → the third scope of the QV409/AR704 family) stable codes in `command-errors.ts`; and the blocking `pnpm audit --audit-level=high` at `.github/workflows/ci.yml:72` with no `c8`/coverage step — see each section's Evidence line.

## Executive Summary

**Assessment:** 8 PASS, 1 CONCERNS, 0 FAIL across the in-scope categories.

**Blockers:** 0. Every one of the **five Non-Negotiable epic controls** in the Epic 8 test design is met and test-proven (see the dedicated table below): (1) `files`/`file_links` carry direct `tenant_id` + enable+**force** RLS + own-tenant `is_tenant_admin` policies + `anon → none` + composite same-tenant FK + `TENANT_TABLES` enrollment (H4 gate CI-fatal otherwise); (2) no public bucket / no client-controlled storage path (private `tenant-files`, server-derived `{tenant_id}/{file_id}/{safe_name}` paths); (3) a cross-tenant/anon/spoof/expired signed URL, list, or read is rejected with a generic user-safe error (no existence disclosure); (4) sent/accepted commitment files are immutable at BOTH the command (`FILE_LINK_LOCKED`) AND the DB (`FL823` trigger) layer, joining the frozen `QV409`/`AR704` family, with locked-file deletion archive-only; (5) fixture privacy is enforced by the CI PII/secret + ORGNR scan over the file-metadata fixtures/artifacts. All eleven high-priority Epic 8 risks (score ≥6: R-801..R-809, R-812, R-819) are mitigated and proven by running tests (epic-8-traceability-report.md, gate PASS — P0 100% 16/16 / P1 100% 10/10 / overall 100% 26/26, all 26 mapped ACs FULL).

**High Priority Issues:** 0. No new HIGH-priority NFR issue introduced.

**What changed vs Epic 7 (why this is the first two-plane epic):** Epic 7 was the riskiest transaction — atomically creating multiple immutable records across multiple Postgres tables in one call, safe to call twice. **Epic 8 is the first — and only — Phase A epic that crosses the object-storage boundary**, adding a **second storage plane (Supabase Storage) that RLS on `storage.objects` + server-derived paths must isolate as strictly as the database** — for exactly the artifacts a customer relies on (quote PDFs, attachments, acceptance evidence). This upgrades the security class to its most consequential Phase A form (a tenant boundary that holds in the DB but leaks in Storage is a full breach) and adds a new data-integrity class: **storage↔DB atomicity** (an object written but no metadata, or vice versa) and **signed-access as the single authorization funnel** (metadata-ownership → lifecycle gate BEFORE any short-lived URL). The lifecycle-lock class inherited from Epics 6/7 gets its THIRD scope: the `file_links` lock (`FL823`) that must AGREE with the frozen sent-lock (`QV409`) and accepted-lock (`AR704`) rather than fork. Two domains remain deliberately deferred N/A for Phase A: file-storage performance/scale/bulk + large-file streaming (no SLA, pilot-sized — R-820) and availability/DR/MTTR (no deployed production runtime with an SLO). Inherited RLS/anon/service-role/audit/money gates from Epics 2-7 remain green as standing regression, now **extended** (not forked) to `files`/`file_links` + `storage.objects` via the shared `TENANT_TABLES` inventory + H4 gate.

**The standing-concern posture is unchanged and stable at one.** Epic 6 closed the `pnpm audit --audit-level=high` dependency-scan gate as a blocking CI step; Epic 7 added no new dependency; **Epic 8 adds no new runtime dependency either** (the upload/preview/lock/index surfaces are `@supabase/*` storage + Postgres triggers + existing TypeScript), so that gate stays green with nothing to extend. That leaves exactly **one** standing CONCERNS unchanged: the line-coverage reporter (`c8`/`nyc`), which remains absent and LOW-priority (priority-weighted trace coverage, **100%** this epic, remains the governing metric). Verified: no `c8`/`nyc`/coverage step in CI or `package.json` (grep-confirmed absent).

**Recommendation:** **PASS (advisory).** Epic 8 crosses the object-storage boundary with the correct posture on every axis. Two-plane isolation is enforced structurally: `files`/`file_links` reuse the enable+force-RLS + own-tenant-policy + composite-same-tenant-FK + mandatory-`TENANT_TABLES`-enrollment pattern (H4 gate FAILS CI on an unenrolled table), AND the storage plane keys `storage.objects` RLS on the uuid-guarded first path segment with a full cross-tenant list/read/sign + path-spoof + anon negative matrix. Private-by-default is enforced (`tenant-files` `public=false` in both `config.toml` and the migration; server-derived `deriveObjectPath` is tenant-first, NFC-normalized, traversal- and surrogate-sanitized — no client path ever trusted). The signing funnel resolves membership → metadata-ownership → lifecycle state BEFORE issuing a short-lived URL on the anon-key RLS client (NO service-role), rejecting anon/cross-tenant/spoof/wrong-lifecycle each with a generic `FILE_ACCESS_DENIED`/`TENANT_ACCESS_DENIED` (identical shape for not-found vs forbidden — the anti-existence-disclosure proof), with an env-configurable TTL (default 300s, 24h MAX clamp) and permanent-vs-transient error classification. Upload validation is a server-side gate (MIME allow-list + size + owner + purpose + lifecycle) that holds even when the client is bypassed, with storage-success/DB-failure compensation (no orphan). Lifecycle-lock immutability is enforced at TWO independent layers (command `FILE_LINK_LOCKED` + DB trigger `FL823`), fail-closed by construction, joining — not forking — the frozen `QV409`/`AR704` family, with locked-file deletion archive-only + a single clean `file.archived` audit row. The limited `/files` index lists ONLY Phase A owner-type files, tenant-scoped, with a guardrail test asserting the absence of deferred-module/document-center groupings. The one remaining CONCERNS — no line-coverage reporter — does not weaken any Epic-8 exit criterion. The R-817 MIME/size real-pilot policy (+ byte-level content sniffing) and R-818 locked-evidence retention are **surfaced-for-decision residuals with named owners under the demo-data-only decision (2026-07-03), not coverage gaps** — the dedicated security review cleared the client-declared-MIME exploit path (0 HIGH/MED/LOW; the closed allow-list excludes all active-content types + files live in a private bucket).

---

## Findings Summary (ADR Quality Readiness Checklist — 8 categories)

| # | Category | Epic-8 evidence | Status |
| - | -------- | --------------- | ------ |
| 1 | Testability & Automation | Full pyramid — UNIT (`node --test`) + INT/RLS (Vitest/local Supabase) + STORAGE-NEG (Vitest against local Supabase Storage) + E2E (Playwright) + GOLDEN. Pure logic (`object-path`, `upload-policy`, `upload-object`, `upload-error-classifier`, `signed-access-state`, `file-index` scope filter, `file-lock-predicate`, `archive-action-state`) extracted OUT of `"use client"` islands into pure `.ts` and unit-pinned (the coverage-shape lesson applied verbatim). Recorded: 1237/1237 unit+golden green; full INT 693 tests / 0 fail; `file-audit-events` + `file-index-isolation` INT/RLS re-verified 8 pass on the live stack; E2E 6 pass + 1 `test.fixme`. A grep of the whole Epic-8 surface for active `test.skip`/`describe.skip`/`.only` returns ONLY the single `8.3-E2E-04` `test.fixme` — every other Wave-2 red-phase ATDD scaffold flipped active/green. Every test-design P0/P1 ID present in-source and behavior-asserting | PASS ✅ |
| 2 | Test Data Strategy | Two-tenant factory extended with file-metadata + link seeds; anonymized shape-only file fixtures; the 4.4 PII/secret + ORGNR scan EXTENDED (not forked) over the 8.1 file-metadata fixtures + `generate-quote-pdf-storage-privacy` artifacts; count-asserting tests seed `crypto.randomUUID()`; goldens (`file-lock-lifecycle-golden`) under `tests/unit/**` (avoids the runner-glob vacuous-green trap); storage suites run against the LOCAL Supabase CLI stack ONLY, with a storage-reachability probe (post-reset false-green trap avoided) | PASS ✅ |
| 3 | Scalability & Availability (harness/schema) | `files`/`file_links` + `storage.objects` RLS absorbed by the existing dual-runner + RLS/H4 inventory with zero rework (enrollment mandatory, H4 CI-fatal on an unenrolled table); the new STORAGE-NEG level added cleanly. Product runtime scalability/availability + large-file/streaming = N/A/deferred (no SLA, single pilot tenant, R-820) | PASS ✅ (harness) / N/A (runtime) |
| 4 | Disaster Recovery | N/A this epic — no deployed production runtime / SLO; the new storage plane + tables add persisted state but no live runtime to fail over in Phase A | N/A (deferred) ⚠️→✅ |
| 5 | Security | Two-plane isolation: `files`/`file_links` direct `tenant_id` + enable+**force** RLS + own-tenant policies + `anon → none` + composite same-tenant FK + `TENANT_TABLES` enrollment AND `storage.objects` own-tenant policies keyed on the uuid-guarded first path segment; private `tenant-files` (`public=false`) + server-derived paths (no client path); the signing funnel is metadata-first on the anon-key RLS client (NO service-role); upload gate re-validates MIME/size/owner/purpose/lifecycle server-side; generic user-safe errors (no existence disclosure); allow-listed audit metadata (targetId-only, no raw path/bucket/PII); no PII in any fixture (CI scan) | PASS ✅ |
| 6 | Monitorability / Debuggability / Manageability | Typed `FILE_ACCESS_DENIED`/`FILE_LINK_LOCKED`/`TENANT_ACCESS_DENIED`/`VALIDATION_FAILED`/`SERVER_ERROR`; the file write-error mapper maps `FL823`/`23505`/`23503`/`42501`/`22P02` with no raw pg message leak; the four distinct upload error states (`BLOCKED_TYPE`/`TOO_LARGE`/`PERMISSION`/`NETWORK_OR_SERVER`) are a pure classifier; file lifecycle events (uploaded/linked/locked/archived/signed) write a single allow-listed `{targetId, reason?}` audit row through the shared `audit_events` table; permanent-vs-transient signed-URL error classification keeps a retryable 5xx from masquerading as a permanent denial | PASS ✅ |
| 7 | QoS / QoE (commitment-file integrity = the "quality of service") | The quote PDF, selected attachments, and acceptance evidence are customer-facing commitments on a new storage plane — stored private, accessed only through the metadata-first signing funnel, and LOCKED immutable once the parent quote is sent / acceptance recorded (`FL823`), never replaceable/deletable (archive-only); the file-lock-lifecycle golden pins the lock transitions + the documented Lovable attachment-locking delta; 6.3's PDF + 7.x's evidence both already consume the single 8.1 model (no competing model — R-814 held) | PASS ✅ |
| 8 | Deployability | Two new migrations (`20260704120000` foundation, `20260712120000` lock) reset cleanly with per-table policy/GRANT enumeration + an ALLOWLIST guardrail (public gained ONLY `files`/`file_links` — a deferred-module index table under ANY name is caught); the 8.4 lock is ADDITIVE (NO new table/column/policy); `verify` job (lockfile, **blocking `pnpm audit --audit-level=high`**, source + built-bundle service-role containment, typecheck, lint, unit, build) + `db` job (`test:int`, `SUPABASE_TEST_REQUIRED=1`) + `e2e` job all present and green; Epic 8 adds NO new runtime dependency | PASS ✅ |

**Also standing:** **Vulnerability management** — 0 critical / 0 high is enforced by the blocking `pnpm audit --audit-level=high` step in the CI `verify` job (`.github/workflows/ci.yml:72`, resolved Epic 6). Epic 8 adds **no new runtime dependency** (storage via `@supabase/*` already present; the lock is pure Postgres; the upload/preview/index surfaces are existing TypeScript), so the gate needs no extension and stays green. The vulnerability-management category remains **PASS**.

---

## Performance Assessment

### Response Time (p95) / Throughput / Resource Usage / Scalability (runtime)

- **Status:** N/A (deferred) ⚠️→✅
- **Threshold:** UNKNOWN — no Phase-A SLA/SLO defined for file upload/download latency, signed-URL minting throughput, large-file streaming, or bulk file operations (test-design R-820: "large-file / streaming / virus-scan edges untested — pilot-sized, no SLA").
- **Actual:** File operations are single-file, pilot-sized, for a single pilot tenant. Upload validation (`isAllowedMimeType` + a size length check) and the signed-access ordering are pure synchronous transforms before the storage call. `createSignedFileAccess` resolves one metadata row (RLS-narrowed) then mints one short-lived URL; the upload path is one object write + one atomic `create_file_with_link` RPC txn + storage-success/DB-failure compensation. Deliberately narrow (ADR-A009), incidentally cheap. No load/latency SLA exists to measure against; large-file/streaming and bulk operations are Epic 8 non-scope. The signed-URL TTL is env-configurable (default 300s) with a 24h MAX clamp so a fat-fingered huge value fails toward tighter, not looser.
- **Evidence:** `src/server/storage/{object-path,upload-policy,upload-object,signed-access}.ts` (pure, no I/O in the decision logic); `supabase/migrations/20260704120000_file_storage_foundation.sql` (narrow single-txn RPC); test-design R-820; epic-8-traceability "File-storage performance / scale / bulk operations — pilot-sized NFRs, no Phase A SLA."
- **Findings:** Correctly deferred. Functional correctness (two-plane isolation + private-by-default + the signing funnel + upload validation + storage↔DB compensation + two-layer lock) — not throughput/latency — is the Phase-A concern. **Carried-forward action (post-pilot):** if a file-storage SLA or scale requirement emerges, add large-file/streaming edges + a signed-URL-minting micro-benchmark; the existing STORAGE-NEG matrix + pure-function seams would extend, not rework.

---

## Security Assessment

### Two-Plane Tenant Isolation — `files`/`file_links` (DB) AND `storage.objects` (Storage) (R-801/R-805)

- **Status:** PASS ✅ — the headline control of this epic (the first Phase A crossing of the object-storage boundary; a boundary that holds in the DB but leaks in Storage is a full breach).
- **Threshold:** `files`/`file_links` must carry direct `tenant_id` + enable+**force** RLS + own-tenant SELECT/INSERT/UPDATE policies + `anon → none` + composite same-tenant FK + **`TENANT_TABLES` enrollment** (H4 gate must green). The storage plane must deny cross-tenant list/read/sign and reject spoofed object paths.
- **Actual:** Verified. `20260704120000_file_storage_foundation.sql` creates both tables with a DIRECT `tenant_id`, enable+force RLS + own-tenant `is_tenant_admin(tenant_id)` policies (no delete — archive via `lifecycle_state`), and the composite same-tenant FK `file_links(file_id, tenant_id) → files(id, tenant_id)` (R-802 both-side). `tenant-table-inventory.ts` enrolls both; the shared cross-tenant + anon suites + the compile-exhaustive H4 gate (`rls-inventory-gate.int.test.ts`) cover them automatically — an unenrolled tenant table FAILS CI. `file-tables-migration-reset.int.test.ts` proves per-table policy/GRANT enumeration and — upgraded from a 3-literal denylist to an ALLOWLIST — asserts `public` gained ONLY `files`/`file_links` (a deferred-module index table under ANY name is caught, AC1 no-broad-index guardrail). On the storage plane, `storage.objects` own-tenant SELECT/INSERT/UPDATE policies are scoped to `bucket_id='tenant-files'` AND `is_tenant_admin((foldername(name))[1]::uuid)`, guarded by a uuid-shape regex so a malformed/absent first segment denies BEFORE the cast; `anon` gets no policy. `storage-object-isolation.rls.test.ts` proves cross-tenant list/read/sign + path spoof + anon are all rejected.
- **Evidence:** `supabase/migrations/20260704120000_file_storage_foundation.sql`; `tests/integration/rls/tenant-table-inventory.ts`; `file-tables-migration-reset.int.test.ts`; `rls-inventory-gate.int.test.ts` (H4); `storage-object-isolation.rls.test.ts`; `file-link-ownership.int.test.ts` (554 lines — foreign-file AND foreign-owner both rejected); `file-index-isolation.rls.test.ts` (8.5-RLS: own-tenant set + concrete tenant-B absence).
- **Findings:** Structurally correct and machine-enforced across BOTH planes. Isolating another tenant's private files + links is the highest-impact control in the epic; it is proven, not asserted — including the storage-plane spoof (the novel residual this epic introduced), now closed.

### Private-by-Default + No Client-Controlled Path (R-803)

- **Status:** PASS ✅
- **Threshold:** Private bucket only; server-derived storage paths only; a public bucket or a client-entered path is a direct data-exposure hole (architecture §6/§14).
- **Actual:** `tenant-files` is `public=false` in BOTH `supabase/config.toml [storage.buckets.tenant-files]` AND the migration `insert into storage.buckets ... public=false` (belt-and-braces, load-order-independent). `deriveObjectPath({tenantId, fileId, displayName})` is tenant-first (verbatim from `ctx.tenantContext.tenantId`), NFC-normalized + traversal-sanitized (`../`, `/`, `\`, control chars, surrogate-split all handled), never client-trusted. There is no path/bucket field on any panel; the UI renders only display-safe fields (name, size).
- **Evidence:** `config.toml` + migration (private-bucket construction assertion); `src/server/storage/object-path.ts` (pure); `tests/unit/server/storage/object-path.test.ts`; `storage-object-isolation.rls.test.ts` (path-spoof negatives).
- **Findings:** Correct. Private-by-default is enforced load-order-independently, and no client-controlled path is ever trusted; the path-spoof negatives are green.

### Signed-Access Funnel — metadata-first, generic denial, no existence disclosure (R-804/R-809/R-810)

- **Status:** PASS ✅
- **Threshold:** `createSignedFileAccess` must verify tenant membership → file-metadata ownership → lifecycle state BEFORE issuing a short-lived URL, rejecting anon/cross-tenant/spoofed-path/wrong-lifecycle each with a generic user-safe error; identical error shape for not-found vs forbidden (no existence disclosure); no raw bucket/path rendered in the UI. Runs on the anon-key RLS client (no service-role).
- **Actual:** Proven. `createSignedFileAccess` runs `loadFileForAccess` (metadata ownership) → `isAccessEligibleLifecycle` (archived/deleted rejected, fail-closed) → sign, on the request-bound anon-key RLS client (NO service-role). `file-signed-access.int.test.ts` (259 lines) covers anon / cross-tenant / wrong-lifecycle / expired (low test TTL); a cross-tenant or not-found id resolves to an identical `FILE_ACCESS_DENIED`/`TENANT_ACCESS_DENIED` — the anti-existence-disclosure proof. `file-signed-access-refresh.int.test.ts` (8.3-INT-01a) proves an archived-then-retry file is NOT re-signed (refresh re-runs the FULL authorization, not a bare re-sign). The preview UX resolves metadata BEFORE any storage call and never renders raw bucket/path (`signed-access-state` units + no-raw-path E2E).
- **Evidence:** `src/server/commands/files/{files,file-db}.ts`, `src/server/storage/{signed-access,lifecycle}.ts`; `file-signed-access.int.test.ts`; `file-signed-access-refresh.int.test.ts`; `tests/unit/features/files/signed-access-state.test.ts` (`isSignedUrlExpired`/`shouldReauthorize` every branch); `entity-file-preview.e2e.spec.ts` (no-raw-path).
- **Findings:** The single authorization funnel is proven negative-first, metadata-first, on the RLS client. The expiry→refresh authorization TEETH (a lifecycle-changed file is not re-signed) are proven at the INT layer even though the end-to-end client wiring (`8.3-E2E-04`) is a `test.fixme` (dispositioned non-gating below) — AC2 remains FULL via INT + unit.

### Upload Validation Gate — MIME/size/owner/purpose/lifecycle, client-bypassed (R-808) + the R-817 MIME nuance

- **Status:** PASS ✅ — with a documented owner-gated residual (R-817), cleared by the dedicated security review.
- **Threshold:** Server-side validation of MIME, size, tenant ownership, owning entity, purpose, and lifecycle BEFORE the file is usable; each invalid case rejected server-side even when the client is bypassed.
- **Actual:** The upload gate re-validates on the server (`validateUploadFile` against the closed `ALLOWED_MIME_TYPES` allow-list + `MAX_UPLOAD_SIZE_BYTES = 25 MiB` measured from the parsed bytes + owner/purpose/lifecycle). `8.2-INT-02` posts a blocked-MIME + an oversized file with the client bypassed and asserts server-side rejection; `upload-policy`/`validate-upload-file` units cover the allow-list + size branches; `8.2-INT` (R-809) asserts a foreign owner_id / random UUID both return the identical generic `PERMISSION` error (no existence disclosure). **The honest nuance (R-817):** the MIME check is against the client-declared multipart `File.type`, NOT content-sniffed magic bytes — the story review (`8-2`, finding RESOLVED 2026-07-07) corrected the earlier "re-derived from the file itself" wording to state this truth. The dedicated security review examined this exact surface and cleared it as NOT a reachable exploit (**0 HIGH/MED/LOW**): `ALLOWED_MIME_TYPES` is a CLOSED allow-list that excludes every active-content/XSS-capable type (`text/html`, `image/svg+xml`, `application/octet-stream`, executables), files live in a private bucket, and the download path is signed-access-gated. Byte-level content sniffing is logged as an owner-gated R-817 follow-up; under demo-data-only (2026-07-03) it is not a real-pilot blocker.
- **Evidence:** `src/server/storage/upload-policy.ts` (closed allow-list + 25 MiB); `src/server/commands/files/validate-upload-file.ts`; `file-upload.int.test.ts` (8.2-INT-02/05); `tests/unit/server/storage/upload-policy.test.ts`; `8-2` story Review Findings (client-declared-MIME RESOLVED; security review 0 HIGH/MED/LOW); epic-8-traceability Gaps (R-817 residual).
- **Findings:** The gate is server-authoritative and fail-closed (an empty/garbage/opaque MIME is rejected). The allow-list — not byte-sniffing — is the enforced Phase A guarantee, and the security review confirmed the exploit path is closed. The single residual (allowed-declared-MIME + disallowed-real-bytes) is a documented owner-gated follow-up, not a coverage gap that changes the Phase-A verdict; re-open on any move to real-customer files.

### Storage↔DB Atomicity + Compensation — no orphans (R-807)

- **Status:** PASS ✅
- **Threshold:** An object written but no metadata (or vice versa) on a mid-flow failure must be prevented; the metadata+link is atomic (narrow RPC), and the storage-object write is compensated on a DB failure (no usable orphan).
- **Actual:** `create_file_with_link` + `link_existing_file` are narrow, `SECURITY INVOKER` (caller RLS, own-tenant, no service-role), fixed empty `search_path`, schema-qualified, single-txn (both persist or neither). `file-link-ownership.int.test.ts` proves the RPC rolls back cleanly. The 8.2 upload path adds the object-byte write with storage-success/DB-failure compensation; `8.2-INT-05` asserts no usable `files`/`file_links` row survives after a DB failure following the object write (the orphan is compensated), reusing 6.3's find-or-create/upsert discipline.
- **Evidence:** `supabase/migrations/20260704120000` (single-txn RPCs, `revoke ... from public` then grant to authenticated/service_role only); `file-link-ownership.int.test.ts` (rollback); `file-upload.int.test.ts` 8.2-INT-05 (compensation); `src/server/storage/upload-object.ts`.
- **Findings:** Defense-in-depth: the metadata+link is atomic by construction, and the storage-object write is compensated so no half-written state becomes usable. No orphaned object survives a mid-flow DB failure.

### Fixture / Storage-Artifact Privacy (R-819)

- **Status:** PASS ✅
- **Threshold:** No personnummer/orgnr/name/email/secret in any file-metadata fixture or extracted-file golden; no raw customer file committed; öre values under the 10-digit orgnr-scan boundary.
- **Actual:** The 4.4 anonymization scan (personnummer `\d{6}-\d{4}`, orgnr `\d{10}`, non-`example.test` email, secret/password/api_key/bearer) is EXTENDED over the 8.1 file-metadata fixtures + the `generate-quote-pdf-storage-privacy` artifacts — as an epic blocker regardless of numeric score, REUSING (not forking) the 4.4 scan. File-metadata fixtures carry shape only; no raw customer file is committed.
- **Evidence:** the extended golden PII/secret + ORGNR scan (part of `pnpm test:unit` in the CI `verify` job); `generate-quote-pdf-storage-privacy.int.test.ts` artifacts.
- **Findings:** Strong. The SEC control that keeps the file fixtures safe to commit runs on every PR. Consistent with the Epic 4/5/6/7 fixture-privacy discipline, extended (not forked) to file metadata.

### Input Validation / Vulnerability Management

- **Status (input validation):** PASS ✅ — the upload gate re-validates MIME/size/owner/purpose/lifecycle server-side (a crafted POST with an oversized allow-listed file or a foreign owner_id is rejected server-side, R-809); the four distinct user-safe upload error states are a pure classifier; the file write-error mapper maps `FL823`/`23505`/`23503`/`42501`/`22P02` with no raw pg-message leak; the raw invalid value is never echoed.
- **Status (vulnerability management):** PASS ✅ — the blocking `pnpm audit --audit-level=high` gate (resolved Epic 6) remains present; Epic 8 adds NO new runtime dependency, so the gate needs no extension.
- **Threshold:** 0 critical / 0 high dependency vulnerabilities, gated in CI; every invalid/boundary path returns a typed, user-safe failure.
- **Actual:** The CI `verify` job carries the blocking `pnpm audit --audit-level=high` step (`.github/workflows/ci.yml:72`) PLUS source + built-bundle service-role containment guards (the app uses NO service-role key — `createSignedFileAccess` and the upload/preview paths all run on the anon-key RLS client). Epic 8's new surface is `@supabase/*` storage (already present) + two Postgres migrations + existing TypeScript — no new dependency.
- **Evidence:** `.github/workflows/ci.yml:72` + `:74`/`:94` (audit + source/built-bundle service-role containment); `command-errors.ts` union (`FILE_ACCESS_DENIED`, `FILE_LINK_LOCKED`, `VALIDATION_FAILED`, `TENANT_ACCESS_DENIED`); `upload-error-classifier`/`file-write-error-mapping`/`archive-action-state` units.
- **Findings:** Both a strength. Input validation is strong (server truth, closed fail-closed allow-list, four distinct user-safe error states, no raw-value/pg-message leak); vulnerability management remains covered by the Epic-6 blocking gate with no new dependency this epic; service-role containment (a headline of the two-plane crossing) is doubly gated (source + built bundle).

---

## Reliability Assessment

### Two-Layer Lifecycle Lock joining the QV409/AR704 Family (R-812/R-822) — the headline data-integrity property of this epic

- **Status:** PASS ✅
- **Threshold:** Once a quote is sent or an acceptance recorded, the linked PDF/attachment/evidence must be immutable at command validation (⇒ stable lock code `FILE_LINK_LOCKED`) AND at the DB (trigger/constraint reject a direct own-tenant authenticated UPDATE/DELETE) — UI-only locking is a story STOP. The `file_links` lock must AGREE with the frozen Epic 6 sent-lock (`QV409`) and Epic 7 accepted-lock (`AR704`), using the shared trigger SHAPE with a DISTINCT-but-related code (not a reused code, not a fork). Locked-file deletion is archive-only + audit.
- **Actual:** Proven at both layers, fail-closed by construction. `20260712120000_file_link_lock.sql` lands `enforce_file_link_lock` + `enforce_file_lock` (immutability guards, custom SQLSTATE `FL823` → command `FILE_LINK_LOCKED`) PLUS three parent-state-keyed lock-APPLY triggers (`apply_file_link_lock`, `apply_lock_on_quote_version_transition`, `apply_lock_on_acceptance_insert`) that set `is_locked`/`locked_at` + flip the referenced `files` row to `lifecycle_state='locked'` WHEN the parent is locked (a sent quote_version's `quote_pdf`/`quote_attachment_snapshot` link, or a quote_acceptance's `acceptance_evidence` link) — locking BY CONSTRUCTION regardless of which frozen create RPC wrote the link. The immutability guard is fail-closed exempt-then-tuple (only `archived_at`/`updated_at` exempt; everything else — identity, lock fields, file_id re-point [the 6.3-retry hazard], owner/purpose — locked-by-default), `SECURITY INVOKER` + empty `search_path` + schema-qualified — mirroring `QV409`/`AR704` verbatim. `file-link-lock.int.test.ts` + `file-link-lock.rls.test.ts` prove mutation/delete rejected via command AND direct own-tenant SQL, the sent-PDF/attachment lock AGREES with `QV409`, the accepted-evidence lock AGREES with `AR704`, and a locked-file delete converts to archive-only with a single clean `file.archived` audit row (`file-audit-events.int.test.ts`).
- **Evidence:** `supabase/migrations/20260712120000_file_link_lock.sql` (three lock-apply + two immutability triggers, `FL823`, fail-closed comment verbatim, "the shared lock-code FAMILY, not a fork"); `command-errors.ts` (`FILE_LINK_LOCKED` — "the THIRD scope" — a sibling of `QV409`/`AR704`); `file-link-lock.int.test.ts` + `file-link-lock.rls.test.ts` (command + direct-SQL reject; QV409/AR704 agreement); `file-audit-events.int.test.ts` (one clean archive row).
- **Findings:** Excellent — the immutability model now AGREES across three scopes (Epic 6 sent-version freeze `QV409`, Epic 7 accepted-record lock `AR704`, Epic 8.4 locked evidence/PDF/attachment file link `FL823`), joined not forked, as the standing contract required. Proven at both layers, fail-closed by allow-list, with locked-file deletion archive-only. The two frozen parent migrations explicitly named "Epic 8.4 locked-evidence-file" as the third family scope; 8.4 honored it. UI-only locking (a story STOP) was correctly avoided — the panel `role=note` lock notice is presentation over the DB truth, never the guarantee.

### Partial-Lock / Archive-Delete Consistency (R-813)

- **Status:** PASS ✅
- **Threshold:** A file must not be locked without its audit event (or vice versa); archive must convert consistently; a locked-file "delete" must never partially delete. A mid-flow failure must leave a consistent, retryable state.
- **Actual:** The lock-apply is a pure BEFORE trigger in the triggering write's own transaction (atomic-by-construction — a rejected write leaves the row byte-unchanged, `8.4-RLS-04`); `archiveFile` converts a locked-file delete to archive-only + exactly one clean `file.archived` audit row, idempotent on re-archive (`8.5-INT-01`). No partial lock/archive state is reachable.
- **Evidence:** `20260712120000` (BEFORE trigger, in-txn); `file-link-lock.rls.test.ts` 8.4-RLS-04 (byte-unchanged on reject); `file-audit-events.int.test.ts` (one clean row + idempotent re-archive).
- **Findings:** Correct. Lock + archive + audit are consistent by construction (in-transaction BEFORE triggers); a rejected write mutates nothing, and archive is idempotent.

### Signed-URL Expiry + Refresh Re-authorization (R-806)

- **Status:** PASS ✅
- **Threshold:** An expired signed URL must be rejected; the URL must never be unbounded; a refresh must re-run the FULL authorization (not a bare re-sign) — a revoked/lifecycle-changed file must NOT be re-signed.
- **Actual:** `resolveSignedUrlTtlSeconds` (default 300s, 24h MAX clamp — fail-toward-tighter) computes `expiresAt`; the expired-URL INT via low test TTL proves rejection without sleeping; `file-signed-access-refresh.int.test.ts` (8.3-INT-01a) archives a file then retries and asserts `FILE_ACCESS_DENIED` (the refresh re-ran the full auth). The client expiry verdict (`isSignedUrlExpired`/`shouldReauthorize`) is fully unit-covered every branch.
- **Evidence:** `src/server/storage/signed-access.ts` (`resolveSignedUrlTtlSeconds`, `isPermanentStorageDenial`); `file-signed-access.int.test.ts` (expired via low TTL); `file-signed-access-refresh.int.test.ts` (archive-then-retry); `signed-access-state.test.ts` (every branch).
- **Findings:** The authorization TEETH are proven at the INT + unit layer. Only the end-to-end client wiring (timer flip → re-open control → re-submit, `8.3-E2E-04`) is a `test.fixme` — dispositioned non-gating (needs a low-TTL E2E env or a deterministic clock seam); AC2 remains FULL via INT + unit.

### Error Handling / Fault Tolerance

- **Status:** PASS ✅
- **Threshold:** Every invalid/boundary path returns a typed, user-safe failure; multi-step writes never partially apply; the file-link lock is fail-closed; retryable-vs-permanent failures are distinguished.
- **Actual:** Commands return typed `Result<T, CommandErrorCode>` (never throw); the file-link lock trigger is fail-closed by construction; the upload path is atomic + compensated (no orphan); the signed-access path classifies permanent-vs-transient (retryable 408/425/429 + 5xx → `SERVER_ERROR`, never masked as a permanent denial); the four upload error states are distinct + user-safe; the file write-error mappers never leak a raw pg message.
- **Evidence:** `file-link-lock.int.test.ts`; `file-upload.int.test.ts` (compensation); `signed-access.ts` (`isPermanentStorageDenial`); `upload-error-classifier.test.ts`; `file-write-error-mapping.test.ts`; the error-handling knowledge fragment.
- **Findings:** Strong fault isolation across the new storage plane. Failures are observable (typed codes + audit events), not swallowed; the lock defaults to locked, not open; the upload is provably compensated; a transient storage 5xx is never mistaken for a permanent denial.

### Availability / MTTR / Disaster Recovery

- **Status:** N/A (deferred) ⚠️→✅ — no deployed production runtime/SLO in Phase A; the new storage plane + tables add persisted state but no live runtime to fail over.
- **Findings:** Correctly out of scope for Phase A, consistent with Epics 2-7.

### CI Burn-In (Stability)

- **Status:** PASS ✅
- **Threshold:** Deterministic, non-flaky suite; 100% pass; INT/RLS/STORAGE-NEG/E2E hard-fail on a missing stack (no silent false-green); the local storage API reachable before asserting (post-reset false-green trap avoided).
- **Actual:** Recorded suite state: the last full run (Story 8.4) was **1203 unit + 693 INT = 1896 pass / 0 skipped**; Story 8.5 added **+15 unit → 1237 unit / 0 fail** with `file-audit-events` + `file-index-isolation` INT/RLS re-verified **8 pass** live under `SUPABASE_TEST_REQUIRED=1`; E2E `tests/e2e/files/` runs **6 pass + 1 `test.fixme`** (`8.3-E2E-04`), with the previously red-phase `file-lock-panel.e2e.spec.ts` and `file-index-scope.e2e.spec.ts` now un-skipped and green. A grep of the whole Epic-8 surface for active `test.skip`/`describe.skip`/`.only` returns ONLY the single `8.3-E2E-04` `test.fixme`. Storage suites run against the LOCAL Supabase CLI stack ONLY, with a storage-reachability probe (post-reset false-green trap avoided); count-asserting tests seed `crypto.randomUUID()`; goldens live under `tests/unit/**`.
- **Evidence:** `automation-summary-8-4/8-5-*.md`; epic-8-traceability-report.md ("Recorded suite state"); `.github/workflows/ci.yml` (`db` job `SUPABASE_TEST_REQUIRED: "1"`).
- **Findings:** Deterministic across the suite. The re-verified-RUN-not-skipped storage/audit suites on the live stack are exactly the guard the epic retro's post-reset-false-green lesson called for; the single `8.3-E2E-04` `test.fixme` is the only non-executing test and is dispositioned non-gating with INT/unit teeth behind it.

---

## Maintainability Assessment

### Test Coverage (priority-weighted)

- **Status:** PASS ✅ (trace-coverage) / CONCERNS ⚠️ (line-coverage reporter absent)
- **Threshold:** P0 100% / P1 ≥90% / overall ≥80% priority-weighted (test-design gate); RLS negatives 100% of the two planes; upload validation / signed-access / two-layer lock / index-scope 100% of their classes.
- **Actual:** Priority-weighted trace coverage is **100%** (26/26 mapped ACs FULL; P0 100% = 16/16, P1 100% = 10/10) — above every deterministic threshold (epic-8-traceability-report.md, gate PASS). Every Wave-2 OPEN row from the test design is now closed by an active in-source test (upload gate R-808, storage↔DB compensation R-807, expiry→refresh R-806, metadata-first ordering R-810, two-layer lock + family agreement R-812/R-822, archive/audit R-813, index scope R-816, file audit §15). No line-coverage % is computed (no `c8`/`nyc` reporter wired) — the same minor forward gap carried since Epics 2-7; priority-weighted trace coverage remains the governing metric.
- **Evidence:** epic-8-traceability-report.md (Coverage Summary + Gate Decision, PASS — 26/26 FULL); no `c8`/`nyc`/coverage step in `package.json`/CI (grep-confirmed absent).
- **Findings:** Coverage of the critical two-plane-isolation + private-by-default + signing-funnel + upload-validation + storage↔DB-compensation + two-layer-lock + index-scope contract is exhaustive at the correct levels (RLS/STORAGE-NEG/INT for isolation & the funnel & the lock; UNIT/GOLDEN for the pure policy/classifier/predicate logic; E2E for the journeys). The missing reporter is a low-priority ergonomics gap, not a correctness gap — **the single remaining standing CONCERNS**, unchanged since Epic 2 (the `pnpm audit` twin was resolved Epic 6 and stays green).

### Code Quality / Technical Debt

- **Status:** PASS ✅
- **Threshold:** typecheck 0 errors, lint clean; single-source-of-truth (ONE file/storage model — no competing model; reuse the shared RLS inventory, the Epic 6/7 lock-code family, the command envelope); upload/signed-access/lock/index logic extracted OUT of client islands into pure functions.
- **Actual:** typecheck/lint/build green per the story records + traceability. There is ONE Phase A file model — 8.2 upload, 8.3 preview, 8.4 lock, and 8.5 index all EXTEND the single 8.1 `files`/`file_links` model (R-814 held; 6.3 PDF + 7.x evidence already consume it, no competing model). The 8.4 lock is a SIBLING code in the `QV409`/`AR704` family (not a fork), and the lock migration is ADDITIVE (NO new table/column/policy). Pure functions (`object-path`, `upload-policy`, `upload-object`, `upload-error-classifier`, `signed-access-state`, `file-index` scope filter, `file-lock-predicate`, `archive-action-state`) are extracted from the `"use client"` islands and unit-pinned (the coverage-shape lesson applied verbatim, the same pattern 8.1 used for `object-path.ts`).
- **Evidence:** 8.1-8.5 implementation-artifacts (verify green); `src/server/storage/**`, `src/features/files/**`; `command-errors.ts` (`FL823`→`FILE_LINK_LOCKED` sibling of the family); epic-8-traceability ("no competing file/storage model appeared — R-814 held").
- **Findings:** Low technical debt. The single-authority discipline (one file/storage model, one RLS inventory, one lock-code family, one command envelope) prevents the fork/drift the test design targets. The `FL823`/`FILE_LINK_LOCKED` code is deliberately a sibling of `QV409`/`AR704` — reuse-with-distinct-scope, not a fork.

### Documentation Completeness

- **Status:** PASS ✅
- **Actual:** Each story's Dev Agent Record documents scope guardrails (no broad document center / deferred-module groupings; no public bucket / client path; no virus/malware scanning; the R-816 index-scope STOP; the R-818 locked-evidence retention STOP), the narrow-RPC decisions (ADR-A009), the two-layer lock design (fail-closed-by-construction, verbatim in the migration header), the documented Lovable attachment-locking delta, the R-817 client-declared-MIME nuance (corrected wording + the security-review 0 HIGH/MED/LOW clearance + the byte-sniffing follow-up), and reviewer-resolved/dispositioned findings. The test-design + traceability reports enumerate the sanctioned scope decisions and route the owner-gated residuals.
- **Evidence:** 8.1-8.5 implementation-artifacts; test-design-epic-8.md; epic-8-traceability-report.md; migration headers `20260704120000`/`20260712120000`.
- **Findings:** Complete and reconciled; deferred/owner-gated items (R-816 index scope, R-817 MIME/size + byte-sniffing, R-818 retention) are logged with owners, not lost. The R-817 documentation-drift finding was explicitly resolved (comment corrected to the truth) rather than papered over.

### Test Quality (from trace/automation review)

- **Status:** PASS ✅
- **Actual:** Tests are mechanism-asserting: two-plane isolation proven at RLS/STORAGE-NEG (DB cross-tenant + storage list/read/sign/spoof/anon); the signing funnel proven negative-first (anon/cross-tenant/spoof/wrong-lifecycle/expired, identical not-found=forbidden shape); upload validation proven with the client BYPASSED; storage↔DB compensation proven by a DB failure after the object write; the two-layer lock proven via command AND direct own-tenant SQL with QV409/AR704 agreement; archive-only + one clean audit row + idempotent re-archive. No happy-path-only criterion detected; no vacuous-green trap (goldens under `tests/unit/**`, count tests seed random UUIDs, storage suites probe reachability, live-stack re-verified RUN-not-skipped).
- **Evidence:** epic-8-traceability-report.md (Traceability Matrix — all 26 FULL; Gaps table); the UNIT/INT/RLS/STORAGE-NEG/E2E/GOLDEN inventory.
- **Findings:** High test quality — negatives before positives, two-plane isolation oracles, client-bypassed upload validation, storage↔DB compensation, both-layer lock proofs with cross-epic family agreement, live-stack RUN-not-skipped verification, no vacuous-green traps. The two dispositioned items (`8.3-E2E-04` `test.fixme`; the over-titled `8.4-INT-05` "atomic" test — a rename + citation, the genuine atomicity proof being `8.4-RLS-04`) are documentation/wiring, not coverage gaps.

---

## Custom NFR Assessments (Epic-8-specific)

### Two-Plane Tenant Isolation Across DB + Object Storage (the defining NFR of Epic 8)

- **Status:** PASS ✅
- **Threshold:** The tenant boundary must hold identically on the database plane (`files`/`file_links`) AND the object-storage plane (`storage.objects` + server-derived paths + the signing funnel). A boundary that holds in the DB but leaks in Storage is a full breach.
- **Actual:** DB plane: enable+force RLS + own-tenant policies + composite same-tenant FK + `TENANT_TABLES` enrollment (H4 CI-fatal). Storage plane: `storage.objects` own-tenant policies keyed on the uuid-guarded first path segment; private `tenant-files`; server-derived tenant-first paths; the metadata-first signing funnel on the anon-key RLS client (no service-role, doubly gated in CI). Proven by `file-tables-migration-reset`, `storage-object-isolation.rls`, `file-signed-access.int`, `file-index-isolation.rls`, and the shared cross-tenant/anon suites + H4 gate.
- **Evidence:** `20260704120000_file_storage_foundation.sql`; `storage-object-isolation.rls.test.ts`; `file-signed-access.int.test.ts`; `tenant-table-inventory.ts` + `rls-inventory-gate.int.test.ts`.
- **Findings:** This is the defining NFR guarantee of Epic 8 — the first Phase A crossing of the object-storage boundary, isolated as strictly on the storage plane as on the database plane, machine-enforced (H4 gate + STORAGE-NEG matrix), with the signing funnel as the single authorization path on the RLS client. No single-plane trust.

### Commitment-File Immutability by Two Independent Layers, joining the QV409/AR704 family

- **Status:** PASS ✅
- **Threshold:** A sent quote's PDF/attachment link and an accepted acceptance's evidence link must be immutable through the command layer AND at the database (fail-closed, locked-by-default), joining the frozen `QV409`/`AR704` family with a distinct-but-related code; locked-file deletion archive-only + audit.
- **Actual:** Command guard (`FILE_LINK_LOCKED`) + DB triggers (`enforce_file_link_lock` + `enforce_file_lock`, `FL823`) fail-closed by construction (only `archived_at`/`updated_at` exempt; identity + lock fields + file_id re-point + owner/purpose all locked-by-default), plus three parent-state-keyed lock-APPLY triggers that lock by construction regardless of which frozen create RPC wrote the link. `file-link-lock.int/rls` prove command + direct-SQL rejection and `QV409`/`AR704` agreement; `archiveFile` converts a locked-file delete to archive-only + one clean `file.archived` audit row. The UI lock-notice is presentation over the DB truth, never the guarantee (a story STOP avoided).
- **Evidence:** `20260712120000_file_link_lock.sql`; `command-errors.ts` (`FILE_LINK_LOCKED` — the THIRD family scope); `file-link-lock.int.test.ts` + `file-link-lock.rls.test.ts`; `file-audit-events.int.test.ts`.
- **Findings:** The immutability model now spans three scopes (`QV409` sent-version, `AR704` accepted-record, `FL823` file-link) — one model, joined not forked. Proven at both layers, fail-closed by construction, archive-only-on-delete. AGREES with Epics 6/7 as the standing contract required.

---

## Quick Wins

1 quick win identified for immediate implementation:

1. **Wire a coverage reporter (`c8`) over `test:unit`** (Maintainability) — LOW — ~1-2 h
   - Emit line-coverage for the pure `src/server/storage/**` + `src/server/commands/files/**` + `src/features/files/**` surfaces so the pure-logic target has a machine number alongside the (already-100%) priority-weighted trace coverage. Report-only; do not gate on it initially. This is the sole remaining item from the two standing CONCERNS carried since Epic 2 — the other (`pnpm audit`) was closed in Epic 6.

---

## Recommended Actions

### Immediate (Before Release) — CRITICAL/HIGH Priority

None. No CRITICAL/HIGH NFR issue; no release blocker for the Epic-8 deliverable. All five Non-Negotiable epic controls met and test-proven, including two-layer file-link immutability (`FILE_LINK_LOCKED` + `FL823`) verified via command AND direct SQL on the live stack, and the storage-plane negative matrix (cross-tenant list/read/sign + spoof + anon).

### Short-term (Next Milestone) — MEDIUM Priority

1. **Keep the R-817 / R-818 owner-gated residuals visible** — MEDIUM — Owner
   - The final MIME allow-list + size limits + **byte-level content sniffing** (R-817) and the locked-evidence retention / hard-delete policy (R-818) ship with conservative dev defaults / archive-only, acceptable under the demo-data-only decision (2026-07-03). The client-declared-MIME exploit path was cleared by the dedicated security review (0 HIGH/MED/LOW; closed allow-list excludes active-content types, private bucket). **Re-confirm both at any move away from demo-data-only** — byte-sniffing hardening + the exact real-pilot MIME/size policy for R-817, and a legal sign-off for any hard-delete retention rule (R-818). Both are documented, not silent; a decision/entry-condition, not a code fix this epic.

### Long-term (Backlog) — LOW Priority

1. **Coverage reporter** — LOW — ~1-2 h — Dev (report-only; the single remaining standing CONCERNS).
2. **Land `8.3-E2E-04` + rename the over-titled `8.4-INT-05`** — LOW — Dev — wire the expiry→refresh end-to-end once a low-TTL E2E env or a deterministic clock seam exists (AC2 already FULL via INT+unit), and rename `8.4-INT-05` to "lock precision" citing `8.4-RLS-04` as the atomic-by-construction proof. Neither gates.
3. **File-storage performance / large-file / streaming micro-benchmark (R-820)** — LOW — Dev — only if a Phase-A/post-pilot file-storage SLA or scale requirement emerges; the STORAGE-NEG matrix + pure-function seams would extend, not rework.
4. **`file_links` dedupe on evidence re-link** — LOW — Dev — 8.1 has no `file_links` dedupe uniqueness (an idempotent retry short-circuits, appending no duplicate link); if find-or-create-vs-constraint semantics are later wanted, decide with any future evidence re-link path (carried 8.1 deferral).

---

## Monitoring Hooks

Runtime monitoring is **N/A for Phase A** (no deployed runtime/SLO). The applicable "monitoring" is the CI full-pyramid gate + the file-lock-lifecycle golden oracle + the H4 inventory gate + the STORAGE-NEG matrix + the dependency-scan gate:

- [x] **File-lock-lifecycle golden + the two-layer lock suite (`file-link-lock.int/rls`)** — the recurring regression oracle; a failure points at a lock-family divergence. **Owner:** Dev. **Runs:** every PR (`test:unit` golden + `test:int`, `SUPABASE_TEST_REQUIRED=1`).
- [x] **H4 `TENANT_TABLES` inventory gate + the no-broad-index ALLOWLIST guardrail** — `files`/`file_links` left unenrolled, OR a deferred-module index table under ANY name, FAILS CI (compile-exhaustive). **Owner:** Dev. **Runs:** every PR (`test:int`).
- [x] **Storage-plane negative matrix (`storage-object-isolation.rls`)** — a cross-tenant list/read/sign or a path spoof succeeding FAILS CI. **Owner:** Dev. **Runs:** every PR (`test:int`, against the local Supabase Storage stack).
- [x] **File-metadata fixture PII/secret + ORGNR scan** — CI unit gate detects any PII/secret/raw-file introduced into a file fixture. **Owner:** Dev.
- [x] **Source + built-bundle service-role containment guards** — a service-role key on any client path FAILS CI. **Owner:** Dev. **Runs:** every PR (`verify` job, post-build bundle grep).
- [x] **`pnpm audit --audit-level=high` gate** — detects a newly-disclosed dependency CVE before merge. **Owner:** Ops/Dev. **Runs:** every PR. *(Resolved Epic 6; no new Epic-8 dependency to cover.)*

---

## Fail-Fast Mechanisms

- [x] **Two-plane isolation gates (Security):** enable+force RLS + own-tenant policies + composite same-tenant FK + mandatory `TENANT_TABLES` enrollment (H4) on `files`/`file_links` AND `storage.objects` own-tenant policies keyed on the uuid-guarded path segment — an unenrolled table or a storage-plane leak fails CI. Present.
- [x] **Private-by-default gate (Security):** `tenant-files` `public=false` (config + migration) + server-derived tenant-first paths — no public bucket / no client path. Present.
- [x] **Signing-funnel gate (Security):** metadata-first membership→ownership→lifecycle before any signed URL, on the anon-key RLS client, generic denial — anon/cross-tenant/spoof/wrong-lifecycle/expired rejected. Present.
- [x] **Upload-validation gate (Security):** server-side MIME allow-list + size + owner + purpose + lifecycle, fail-closed, client-bypass-proof + storage↔DB compensation (no orphan). Present.
- [x] **Immutability gates (Data integrity):** two-layer file-link lock (`FILE_LINK_LOCKED` + `FL823`) fail-closed by construction, joining the `QV409`/`AR704` family; locked-file delete archive-only + audit — a locked commitment file is unmutable through any path. Present.
- [x] **Index-scope guardrail (Business/scope):** the `/files` index lists ONLY Phase A owner-type files; a deferred-module/document-center label fails the guardrail test. Present.
- [x] **Dependency-scan + service-role containment gates (Deployability/Security):** blocking `pnpm audit --audit-level=high` + source/built-bundle service-role guards in CI. Present *(audit resolved Epic 6; no new dependency this epic)*.
- [x] **Smoke/fast gate (Maintainability):** the pure `test:unit` suite (1237 unit+golden) is the fast fail-fast gate on every PR. Present.
- [ ] **Rate limiting / circuit breakers:** N/A — no external-facing runtime service surface in Epic 8 (no public bucket / unauthenticated file access / webhook by design).

---

## Evidence Gaps

1 evidence gap identified — LOW priority, deliberately deferred (not action-required for the Epic-8 gate):

- [ ] **Line-coverage report** (Maintainability) — **Owner:** Dev — **Deadline:** backlog — **Suggested Evidence:** `c8` lcov over `test:unit` — **Impact:** LOW — priority-weighted trace coverage is 100% (P0 100%); this is an ergonomics number, not a correctness gap. **This is the last of the two concerns carried since Epic 2** (the `pnpm audit` twin was closed in Epic 6 and stays green).

**Still resolved (carried-closed from Epic 6):** dependency-vulnerability scan — the blocking `pnpm audit --audit-level=high` CI step (`.github/workflows/ci.yml:72`) enforces 0 high/critical on every PR; Epic 8 adds no new runtime dependency, so nothing to extend.

**Documented residual (not an evidence gap):** file-storage performance / large-file / streaming / bulk operations (R-820) — pilot-sized only, no Phase A SLA; add a micro-benchmark + large-file edges only if an SLA emerges.

**Documented, dated owner-gated residuals (not evidence gaps):** the final MIME allow-list + size limits + byte-level content sniffing (R-817 — the closed allow-list is the enforced Phase A guarantee; the security review cleared the client-declared-MIME exploit path 0 HIGH/MED/LOW; byte-sniffing is the owner-gated hardening follow-up) and the locked-evidence retention / hard-delete policy (R-818 — archive-only is the Phase A default; a hard-delete rule needs legal sign-off) — conservative defaults acceptable under demo-data-only (2026-07-03); re-confirm at any move to real-customer use. The R-822 `archiveFile(hardDelete:true)`-returns-`FILE_LINK_LOCKED`-on-an-unlocked-file refinement (a crafted-request-only surface, no UI affordance, functionally safe — archive-over-delete preserved) is a future code-cleanliness item, not a coverage gap.

---

## Findings Summary

**Based on ADR Quality Readiness Checklist (8 categories)**

| Category | Overall Status |
| -------- | -------------- |
| 1. Testability & Automation | PASS ✅ |
| 2. Test Data Strategy | PASS ✅ |
| 3. Scalability & Availability | PASS ✅ (harness) / N/A runtime (deferred) |
| 4. Disaster Recovery | N/A (deferred) ⚠️→✅ |
| 5. Security | PASS ✅ |
| 6. Monitorability / Debuggability / Manageability | PASS ✅ |
| 7. QoS & QoE (commitment-file integrity) | PASS ✅ |
| 8. Deployability | PASS ✅ |
| **Vulnerability Management (cross-cutting)** | **PASS ✅ (resolved Epic 6; no new dependency this epic)** |
| **Maintainability — line-coverage reporter** | **CONCERNS ⚠️ (sole remaining standing carry, unchanged)** |
| **Overall** | **PASS (advisory) ✅ — 8 PASS, 1 CONCERNS, 0 FAIL** |

**Scoring:** In-scope categories: 8 PASS, 1 CONCERNS (no line-coverage reporter — LOW priority), 0 FAIL. Runtime performance/load/large-file/streaming (R-820) and availability/DR are N/A — deferred for the internal pilot (no SLA/production runtime yet). No new HIGH-priority NFR issue.

---

## Non-Negotiable Epic Controls (test-design gate) — all MET

| Control | Status | Proven by (verified in-source) |
| --- | --- | --- |
| `files`/`file_links`: direct `tenant_id` + enable+force RLS + own-tenant policies + `anon → none` + composite same-tenant FK + `TENANT_TABLES` enrollment (H4 green) | MET | migration `20260704120000`; `tenant-table-inventory.ts`; `file-tables-migration-reset.int.test.ts` (allowlist no-broad-index guardrail); `rls-inventory-gate.int.test.ts` H4; `file-link-ownership.int.test.ts` |
| No public bucket / no client-controlled storage path (private `tenant-files` + server-derived paths) | MET | `config.toml` + migration (`public=false`); `object-path.ts` (tenant-first, traversal-sanitized) + `object-path.test.ts`; `storage-object-isolation.rls.test.ts` (spoof) |
| A cross-tenant/anon/spoof/expired signed URL, list, or read rejected with a generic user-safe error (no existence disclosure) | MET | `createSignedFileAccess` metadata-first on the RLS client; `file-signed-access.int.test.ts` (anon/cross-tenant/wrong-lifecycle/expired); `storage-object-isolation.rls.test.ts` (list/read/sign/spoof/anon); identical not-found=forbidden shape |
| Sent/accepted commitment files immutable at command AND DB, joining the QV409/AR704 family; locked-file delete archive-only | MET | `20260712120000_file_link_lock.sql` (`enforce_file_link_lock`/`enforce_file_lock` + three lock-apply triggers, `FL823`, fail-closed); `file-link-lock.int/rls.test.ts` (command + direct SQL; QV409/AR704 agreement); `file-audit-events.int.test.ts` (one clean archive row) |
| Fixture privacy enforced by the CI PII/secret + ORGNR scan over the file fixtures/artifacts | MET | the 4.4 scan EXTENDED over the 8.1 file-metadata fixtures + `generate-quote-pdf-storage-privacy` artifacts (R-819), REUSING (not forking) the 4.4 scan |

---

## Gate YAML Snippet

```yaml
nfr_assessment:
  date: '2026-07-07'
  epic: 8
  feature_name: 'Required Files And Private Storage'
  assessment_level: epic
  trace_coverage: '26/26 FULL (100%; P0 16/16=100%, P1 10/10=100%)'
  categories:
    testability_automation: PASS
    test_data_strategy: PASS
    scalability_availability: PASS # harness; runtime N/A (deferred)
    disaster_recovery: N/A # deferred (no production runtime/SLO)
    security: PASS
    monitorability: PASS
    qos_qoe: PASS
    deployability: PASS
    vulnerability_management: PASS # resolved Epic 6; no new dependency this epic
    maintainability_coverage_reporter: CONCERNS # line-coverage reporter absent (LOW, since Epic 2)
  overall_status: PASS # advisory — 8 PASS, 1 CONCERNS, 0 FAIL
  critical_issues: 0
  high_priority_issues: 0
  medium_priority_issues: 0
  concerns: 1 # no line-coverage reporter (LOW)
  blockers: false
  quick_wins: 1
  evidence_gaps: 1 # line-coverage report (LOW)
  non_negotiable_controls: '5/5 MET'
  high_priority_risks_mitigated: '11/11 (R-801..R-809, R-812, R-819)'
  owner_gated_residuals: # documented, dated — not gaps
    - 'R-817: final MIME allow-list/size + byte-level content sniffing (security review cleared client-declared-MIME 0 HIGH/MED/LOW; allow-list is the enforced guarantee)'
    - 'R-818: locked-evidence retention / hard-delete (archive-only default; needs legal sign-off)'
    - 'R-820: file-storage performance / large-file / streaming (no Phase A SLA)'
  recommendations:
    - 'PASS (advisory) — no remediation required to clear the Epic 8 NFR gate'
    - 'Wire a c8 coverage reporter over test:unit (report-only, LOW) — the single standing CONCERNS'
    - 'Re-confirm R-817 (byte-sniffing + real-pilot MIME/size) and R-818 (retention) at any move away from demo-data-only'
```

---

## Related Artifacts

- **Story Files:** `_bmad-output/implementation-artifacts/8-1..8-5-*.md`
- **Test Design:** `_bmad-output/test-artifacts/test-design-epic-8.md` (revision 2)
- **Traceability:** `_bmad-output/test-artifacts/traceability/epic-8-traceability-report.md` (gate PASS)
- **Prior NFR (format + standing carry):** `_bmad-output/test-artifacts/nfr-assessment-epic-7.md`
- **Migrations:** `supabase/migrations/20260704120000_file_storage_foundation.sql`; `20260712120000_file_link_lock.sql`; the frozen `20260707120000_quote_version_sent_lock.sql` (QV409) + `20260711120000_accepted_record_lock.sql` (AR704) it AGREES with
- **Source:** `src/server/storage/**`, `src/server/commands/files/**`, `src/features/files/**`, `src/components/files/**`, `src/server/commands/command-errors.ts`
- **Evidence Sources:**
  - Test Results: recorded suite state (story automation records + `automation-summary-8-4/8-5-*.md`) — 1237 unit / 693 int / 8 int-rls re-verified / 6 e2e + 1 test.fixme
  - CI Config: `.github/workflows/ci.yml` (`pnpm audit --audit-level=high` blocking at :72; source + built-bundle service-role containment; `db` job `SUPABASE_TEST_REQUIRED=1`; no c8/coverage step)

---

## Recommendations Summary

**Release Blocker:** None. No CRITICAL/HIGH NFR issue; all five Non-Negotiable epic controls met and test-proven; all eleven high-priority risks (≥6) mitigated.

**High Priority:** None.

**Medium Priority:** Keep the R-817 (byte-sniffing + real-pilot MIME/size) and R-818 (locked-evidence retention) owner-gated residuals visible; re-confirm at any move away from demo-data-only.

**Next Steps:** Proceed to the epic release gate. The single standing CONCERNS (no line-coverage reporter, LOW) does not weaken any exit criterion; wire `c8` report-only when convenient.

---

## Sign-Off

**NFR Assessment:**

- Overall Status: PASS (advisory) ✅
- Critical Issues: 0
- High Priority Issues: 0
- Concerns: 1 (no line-coverage reporter — LOW, standing since Epic 2)
- Evidence Gaps: 1 (line-coverage report — LOW)

**Gate Status:** PASS ✅

**Next Actions:**

- If PASS ✅: Proceed to the epic release gate. Keep the R-817/R-818/R-820 residuals dated; wire the `c8` reporter (report-only) when convenient.

**Generated:** 2026-07-07
**Workflow:** testarch-nfr v4.0 (epic-level, sequential)

---

<!-- Powered by BMAD-CORE™ -->
