---
stepsCompleted:
  - step-01-detect-mode
  - step-02-load-context
  - step-03-risk-and-testability
  - step-04-coverage-plan
  - step-05-generate-output
lastStep: step-05-generate-output
lastSaved: '2026-07-04'
workflowType: testarch-test-design
designLevel: epic
epicNum: 8
inputDocuments:
  - _bmad-output/planning-artifacts/epics.md (Epic 8, lines 1556-1753; stories 8.1-8.5)
  - _bmad-output/planning-artifacts/architecture.md (ADR-A006 entity-scoped private file model; ADR-A009 narrow RPC; §5 command registry generateQuotePdf/createSignedFileAccess/archiveFile; §6 Storage strategy; §12 quote PDF; §13 acceptance; §14 File And Storage Model; §15 audit)
  - _bmad-output/planning-artifacts/prd.md (required-files FRs)
  - _bmad-output/project-context.md (Testing Rules; Security Regression Harness Rules; RLS-by-default + GRANTs; TENANT_TABLES enrollment contract; golden PII scan; demo-data-only decision)
  - _bmad-output/test-artifacts/test-design-epic-6.md (house style; 8.1 dependency framing — 6.3 stores PDFs through 8.1; 6.1 persisted attachment metadata depends on 8.1)
  - _bmad-output/implementation-artifacts/sprint-status.yaml (sequencing: 8.1 Wave-1 BEFORE Epic 6; 8.2-8.5 Wave-2 AFTER Epics 6-7)
  - supabase/config.toml ([storage] present; NO buckets configured yet — 8.1 introduces the private bucket)
  - supabase/migrations/** (no files/file_links/storage migration exists yet — greenfield storage)
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES + H4 inventory gate enrollment contract)
  - tests/** (runner split: node --test units, Vitest int/rls, Playwright e2e; two-tenant factories; golden PII/secret scan)
  - knowledge: risk-governance.md, probability-impact.md, test-levels-framework.md, test-priorities-matrix.md
---

# Test Design: Epic 8 - Required Files And Private Storage

**Date:** 2026-07-04
**Author:** Rasmus
**Status:** Draft
**Design Level:** Epic-Level (Phase 4)
**Mode:** Risk-based, evidence-backed (Master Test Architect)

---

## Executive Summary

**Scope:** Epic-level test design for Epic 8 — the epic that gives Phase A **private, tenant-owned,
validated, lifecycle-aware file storage**, and nothing broader. Five stories, delivered in **two
waves**: the file-storage **foundation** (8.1 — private bucket config, `files`/`file_links` metadata,
polymorphic entity links with command-level ownership validation, server-derived paths, and the
`createSignedFileAccess` command, plus the full RLS/storage negative matrix); then, after the owner
workflows exist, **validated uploads + entity file panels** (8.2), the **tenant-authorized signed
preview/download UX** (8.3), **quote/PDF/attachment/acceptance-evidence lifecycle locks** (8.4), and an
**optional limited Phase A file index + file audit** (8.5).

**Epic goal (from epics.md):** Manage *only* Phase A-required files through private, tenant-owned,
validated, lifecycle-aware storage — no broad document center.

**Why this epic is risk-bearing:** Epic 8 is where Phase A **crosses the object-storage boundary** for
the first time. Every earlier epic kept sensitive state in Postgres under the proven RLS harness; Epic 8
adds a **second storage plane (Supabase Storage) that RLS on `storage.objects` and server-derived paths
must isolate as strictly as the database** — and it does so for exactly the artifacts a customer relies
on (quote PDFs, selected attachments, acceptance evidence). Four risk classes converge:

1. **Isolation across two planes** — `files`/`file_links` are new tenant-owned tables (need the full
   Epic 2-5 pattern: direct `tenant_id`, composite same-tenant FKs, enable+**force** RLS, `anon → none`,
   `TENANT_TABLES` enrollment) **and** the storage layer itself must deny cross-tenant list/read/sign
   and reject spoofed object paths. A tenant boundary that holds in the DB but leaks in Storage is a
   full breach.
2. **Private-by-default with no client-controlled paths** — a public bucket or a client-entered storage
   path is a direct data-exposure hole (architecture §6/§14: private buckets only, server-derived
   paths). This is a construction-time property that must be asserted, not assumed.
3. **Signed-access as the single authorization funnel** — `createSignedFileAccess` verifies tenant
   membership → file metadata ownership → lifecycle state **before** issuing a short-lived URL, and
   rejects anonymous / cross-tenant / spoofed-path / expired attempts with **generic user-safe errors**
   (no existence disclosure). This one command is the private-file access boundary for the whole app.
4. **Lifecycle immutability of commitments** — once a quote is sent or an acceptance recorded, the
   linked PDF/attachment/evidence must be **locked at command validation AND DB constraint/trigger
   level** (not disabled buttons); deletion of locked files is archive-only with an audit trail.

**The keystone dependency:** **Story 8.1 is a hard, already-sequenced dependency for Epic 6** — 6.3
(quote PDF storage) and 6.1 (persisted attachment metadata) both consume the 8.1 file model and MUST
NOT invent a competing one (epic-6 design Entry Criteria; sprint-status 2026-07-03 owner resequencing
puts 8.1 Wave-1 *before* Epic 6). This test design therefore front-loads 8.1's foundation coverage and
treats "8.1 is the single Phase A file model" as a standing contract every later story (6.3, 8.2-8.5)
inherits.

**Wave-2 reality (8.2-8.5) — deliberately partial at this design date:** 8.2-8.5 depend on owner-entity
workflows from Epics 3/5/6/7 (uploads target entities; locks target *sent quotes* and *accepted
evidence* from Epics 6-7). At the time 8.1 is implemented, Epics 6-7 are still backlog. This design
covers 8.1 to full implementable depth and covers 8.2-8.5 to **planning depth** — their risks, coverage
shape, and dependency gates are fixed here, but their concrete scenarios (which entities, which lock
rules) are re-confirmed at each story's create-story step once the owner tables and the sent/accepted
lifecycles they lock actually exist. This is intentional, not a gap: designing 8.4's exact lock matrix
before Epic 6's `quote_versions`/Epic 7's `quote_acceptances` are frozen would fork the rule table.

**Risk Summary:**

- Total risks identified: **20**
- High-priority risks (score ≥6): **11**
- Critical (score 9 / auto-BLOCK at design time): **0** — but **five controls are epic blockers
  regardless of numeric score**: (a) `files`/`file_links` unenrolled in `TENANT_TABLES` / missing
  enable+force RLS + own-tenant policies + `anon → none` (R-801 — the H4 gate makes this CI-fatal by
  design); (b) any **public bucket** or **client-controlled storage path** shipping in Phase A (R-803 —
  architecture §6/§14, an 8.1 STOP condition analog); (c) a cross-tenant or anonymous **signed-URL /
  list / read / spoof** succeeding (R-804/R-805 — the private-file access boundary); (d) a **sent/
  accepted locked file mutable/deletable** through any path or UI-only locking (R-812 — 8.4 requires
  DB-level enforcement); (e) real PII/secret / raw customer file in a committed fixture or storage
  artifact (R-819, held at mitigate-control like Epic 4/5/6 fixture risks).
- Critical categories: **SEC** (two-plane isolation, private-by-default, signed-access funnel, path
  spoofing, existence disclosure) — the dominant class this epic — then **DATA** (storage↔DB atomicity/
  orphans, lifecycle-lock integrity, metadata-first ordering), then **BUS/scope** (file-index scope
  creep into a document center, MIME/size policy owner-approval, deferred owner types).

**Coverage Summary:**

- **P0 (Critical):** ~30-44 tests — 8.1 migration-reset + `files`/`file_links` RLS negatives +
  `TENANT_TABLES` enrollment; owner-spoof on link creation (both-side ownership); private-bucket /
  server-derived-path construction assertions; `createSignedFileAccess` authorization matrix (anon
  reject, cross-tenant reject, path-spoof reject, expired-URL reject via low test TTL, lifecycle-state
  gate); atomic metadata+link RPC (ADR-A009) partial-failure/rollback; storage↔DB compensation; 8.2
  MIME/size/owner/lifecycle server validation + cross-tenant no-existence-disclosure; 8.3 full storage
  negative matrix (sign/list/read/spoof cross-tenant + anon); 8.4 sent/accepted lock at command AND DB,
  archive-only-on-delete + audit; fixture privacy scan extension to file metadata.
- **P1 (High):** ~18-28 tests — 8.2 entity-panel upload UX + distinct user-safe error states (blocked
  type / too-large / network-fail / permission-fail) + no-raw-path UI; 8.3 preview/download UX +
  expiry→refresh reauthorization loop + metadata-first-storage-second ordering; 8.4 lock-warning UX +
  quote/acceptance lifecycle golden cases; 8.5 limited-index tenant-scoped listing + file audit events
  (upload/link/sign/archive/lock) with safe metadata.
- **P2 (Medium):** ~8-14 tests — lifecycle-state edge transitions (draft→linked→locked→archived→
  deleted), a11y/keyboard on panels + preview controls + index, documented Lovable attachment-locking
  delta, index-absence guardrail (no deferred-module groupings / document-center workflows), checksum/
  hash-when-available behavior.
- **P3 (Low):** ~3-6 tests — exploratory large-file/streaming edges, signed-URL TTL boundary fuzz, DX
  error messages, residual perf notes.
- **Total:** ~59-92 tests across UNIT / INT / RLS / STORAGE-NEG / E2E / GOLDEN / DOCS levels.

---

## Two-Wave Structure & Sequencing (read this before the coverage plan)

Epic 8 does **not** run as one contiguous block. Per the 2026-07-03 owner resequencing
(`sprint-status.yaml`):

| Wave | Stories | Runs | Depends on | Test focus |
| --- | --- | --- | --- | --- |
| **Wave 1** | **8.1** | **NEXT**, before Epic 6 | Epics 1-2 only | Foundation: schema/RLS/enrollment, ownership-validated links, private bucket, server-derived paths, `createSignedFileAccess` command + full storage negative matrix. **Fully implementable now.** |
| **Wave 2** | 8.2, 8.3, 8.4, 8.5 | AFTER Epics 6-7 | 8.1 + owner-entity workflows (Epics 3/5/6/7) | Upload UX + entity panels (8.2), signed preview/download UX (8.3), sent/accepted lifecycle locks (8.4), optional limited index + file audit (8.5). **Scoped here, scenario-detailed at each create-story once owner tables + sent/accepted lifecycles exist.** |

**Why the split matters for testing:** 8.1's negatives (RLS, storage spoof, signed-access) are
**self-contained and land first** — they do not need any owner entity to be meaningful (a `file_link`
to a not-yet-existing owner type is simply inactive; the ownership-validation *mechanism* is testable
against `customer`/`facility`/`contact` owner types, which exist by Epic 3, and against a synthetic
own-tenant record for the pure-mechanism check). 8.4's lock matrix, by contrast, is only fully testable
once Epic 6 `quote_versions`/sent-state and Epic 7 `quote_acceptances`/accepted-state exist — so 8.4's
concrete lock scenarios are **cross-referenced to Epic 6/7 lifecycle**, not re-invented here.

**Standing contract this epic establishes:** *8.1 is the single Phase A file model.* Every later file
consumer — 6.3 PDF storage, 6.1 attachment metadata, 8.2 uploads, 8.4 locks — REUSES and EXTENDS
`files`/`file_links` and MUST NOT create a competing model (epics.md 8.1 tech note; epic-6 design). A
second file/storage model appearing anywhere is a design defect and a STOP condition.

---

## Inherited Foundation (what Epic 8 builds on, not rebuilds)

Epics 2-5 shipped the isolation harness Epic 8 now extends to a second storage plane. Verified in-repo;
Epic 8 must **reuse**, not re-invent:

| Inherited asset | Where | Epic 8 obligation |
| --- | --- | --- |
| Tenant-table pattern: direct `tenant_id`, composite same-tenant parent FK, enable+**force** RLS with own-tenant `is_tenant_admin` policies on the DEFINER helpers, `anon → none` GRANT, archive-over-delete, `set_updated_at()` | `supabase/migrations/20260630120000_crm_data_model.sql`, `20260702120000_calculation_data_model.sql` | `files` (direct `tenant_id`) and `file_links` (→ `files` same-tenant FK + polymorphic owner type/id validated at command level) REUSE the exact pattern. A bare/non-composite FK on `file_links.file_id` is a cross-tenant hole. |
| `TENANT_TABLES` enrollment + H4 inventory gate (compile-exhaustive `switch`+`assertNever`; FAILS CI on an unenrolled tenant table) | `tests/integration/rls/tenant-table-inventory.ts`; `rls-inventory-gate.int.test.ts` | **STANDING CONTRACT:** `files` and `file_links` MUST enroll with spoof/filter/mutation metadata BEFORE merge. R-801's automated backstop. Polymorphic `file_links` (no single FK-to-`tenants` column beyond its own `tenant_id`) still enrolls via its direct `tenant_id`. |
| Cross-tenant negative suite + anon-path suite reading the same inventory | `cross-tenant-isolation.rls.test.ts`, `anon-path-isolation.rls.test.ts` | New file tables covered automatically once enrolled — do NOT hand-write ad-hoc isolation tests that bypass the inventory. The **storage-plane** negatives (spoof/list/sign) are genuinely new and ADD to this harness. |
| Server command Result model: typed `Result<T, CommandErrorCode>`, `verifyOwnership` (zero rows ⇒ `TENANT_ACCESS_DENIED`), validation never echoes raw values, allow-listed audit metadata | `src/server/commands/envelope.ts`, `command-errors.ts` | `createSignedFileAccess`, upload commands, `archiveFile`, and link-creation REUSE this. A cross-tenant file/owner id ⇒ `TENANT_ACCESS_DENIED`; a locked-file mutation ⇒ a stable lock code (mirror `QUOTE_VERSION_LOCKED`). Cross-tenant failures return the **generic** code — no "file exists but not yours" disclosure. |
| Narrow Postgres RPC discipline (ADR-A009), proven by Epic 5's atomic reorder RPCs + designed for Epic 6's version RPCs | `supabase/migrations/2026070*` calc RPCs; epics.md 8.1/8.2 tech notes; ADR-A009 (explicitly names "atomic file metadata-plus-link creation where Story 8.1 requires it") | 8.1's atomic **metadata+link** creation uses a narrow RPC (security **invoker** unless a separately approved definer design), called only from an authenticated command after membership/input validation. Mechanism change without ADR = STOP. |
| `audit_events` append-only + own-tenant-read, allow-listed sanitized metadata, `actor_user_id` nullable `ON DELETE SET NULL`; cascade-blocked by trigger | `supabase/migrations/20260629121136_audit_events.sql`, `20260629140000_*.sql`; architecture §15 | 8.1/8.4/8.5 write file events (`file uploaded, linked, locked, archived/deleted, signed access created` — architecture §15) through this SAME table; NO raw file contents, no bucket/service-role details, no broad PII in metadata (§15 prohibition). File audit is NOT a new audit model. |
| Two-runner stack + Playwright E2E (CI-gated, `SUPABASE_TEST_REQUIRED=1`) + two-tenant fixture (unique tenant pair per test) + per-run unique ids; goldens under `tests/unit/**` (runner-glob trap); golden PII/secret + ORGNR scan | project-context Testing Rules; `scripts/run-tests.mjs`; `tests/factories/**`; `tests/support/test-env.ts` | 8.1/8.4 land INT + RLS + storage-neg; 8.2/8.3/8.5 land E2E; any file/attachment goldens land under `tests/unit/**` with origin labelling. Row-count assertions seed `crypto.randomUUID()`. Fixture PII scan EXTENDS to file-metadata fixtures + any committed file artifact. |
| Service-role containment (source + built-bundle guards) — app uses NO service-role key | `scripts/verify/check-service-role-containment.mjs`, `check-bundle-containment.mjs` | File upload/signing paths MUST stay anon+RLS on the client and server-command on the server — **no service-role key on any browser/client file path**. If a server-only privileged storage admin op is ever needed, it is documented + test-covered + never `NEXT_PUBLIC_` (Critical Don't-Miss Rule). |
| Frozen-snapshot-by-copy discipline (Epic 3→4→5→designed-for-6) | `src/lib/snapshots/**`; epic-6 design | 8.4's locked quote-attachment/PDF/evidence links snapshot or lock **by value**, consistent with the sent-version freeze Epic 6 owns — 8.4 locks the *link*, Epic 6 freezes the *snapshot*; the two must agree (cross-ref R-812/R-605). |

**What is genuinely NEW in Epic 8 (needs fresh coverage):** the `files`/`file_links` tables + their RLS
+ enrollment; **the Supabase Storage plane itself** (private bucket config, `storage.objects` RLS,
server-derived object paths); **the storage negative matrix** (cross-tenant list/read/sign, path
spoofing, expired signed URLs, blocked MIME/size) — a class no earlier epic has; `createSignedFileAccess`
(the metadata-first, lifecycle-gated, generic-error signing funnel); the **atomic metadata+link RPC**;
upload validation + entity panels (8.2); the signed preview/download UX with expiry→refresh (8.3);
**lifecycle locks enforced below the UI** (8.4); and the optional limited file index (8.5). This is a
full-stack, two-plane epic — UNIT + INT + RLS + STORAGE-NEG + E2E + GOLDEN + DOCS.

---

## Not in Scope

| Item | Reasoning | Mitigation |
| --- | --- | --- |
| **Broad document center / cross-module document workflows / deferred-module file indexing** | Epic 8 explicit non-scope; ADR-A006 IN for Phase A files only; 8.5 STOP condition | 8.5 tests assert the index lists ONLY CRM/calculation/quote/acceptance/job files with NO deferred-module groupings or document-center workflows (R-816 guardrail test). The index is *optional* and may be skipped if entity panels suffice (8.5 tech note). |
| **Public buckets / unauthenticated file access / client-entered storage paths** | Epic 8 explicit non-scope; architecture §6/§14 (private-by-default, server-derived paths); 8.1/8.3 STOP conditions | Construction-time assertions: bucket is private (R-803); paths are server-derived, never client-supplied (path-spoof negatives, R-805); no public URL surface and no unauthenticated file route (guardrail test mirrors epic-6's "no public acceptance endpoint"). |
| **Virus/malware scanning** | Epic 8 explicit non-scope "unless separately approved" | MIME + size + owner + lifecycle validation is the Phase A upload gate (8.2); scanning is a documented residual (R-820) added only on separate approval — a STOP if requested inside this epic. |
| **External document integrations (Fortnox, supplier docs, e-sign, etc.)** | Deferred (AGENTS.md); ADR-A008 SEAM-only | No external integration tables/routes/credentials; migration test asserts absence, consistent with the epic-6 "no Fortnox/invoice/portal" guardrail. |
| **Final MIME allow-list + size limits + required-file policy** | epics.md 8.2 tech note: "require owner approval before real pilot use but can use conservative defaults for development"; owner Sign-Off items | Tests pin the VALIDATION MECHANISM (a blocked type/oversized file is rejected server-side with a distinct user-safe error) against conservative dev defaults; the *final policy constants* are an owner Sign-Off residual (R-817), re-confirmed at 8.2 create-story. Under the demo-data-only decision (2026-07-03) this is not a real-pilot blocker yet. |
| **Raw legacy/customer file migration** | epics.md 8.1/8.2 migration notes: anonymized metadata fixtures only, raw customer files excluded unless approved; Lovable is oracle-only (ADR-A007) | Fixtures carry file *metadata shape* only, no raw customer files; the fixture privacy scan (R-819) blocks real PII/secrets. Raw-file migration is Epic 9 territory and owner-gated. |
| **Quote-version snapshot/immutability itself, PDF rendering pipeline, acceptance capture** | Epic 6 owns the snapshot + PDF generation source-of-truth + sent immutability; Epic 7 owns acceptance evidence + accepted state | 8.1 provides the STORAGE the PDF lands in; 8.4 provides the LOCK on the linked file. The snapshot freeze (R-603/R-605/R-606) and acceptance immutability are Epic 6/7 tests — Epic 8 cross-references them and proves only file-side locking + private storage. |
| **Retention / legal deletion policy for locked customer evidence beyond archive-only** | epics.md 8.4 STOP condition (requires legal decision) | 8.4 tests enforce archive-only-on-delete + audit as the Phase A default; any hard-delete retention rule is a STOP requiring legal sign-off (documented, R-818). |
| **File-storage performance / scale / bulk operations** | Pilot-sized NFRs only; no Phase A SLA | Single-file correctness + isolation is the concern; large-file/streaming edges are P3 exploratory (R-820); perf documented residual, add only if an SLA emerges. |

---

## Risk Assessment

Scoring per `probability-impact.md`: Probability 1 (unlikely) / 2 (possible) / 3 (likely);
Impact 1 (minor) / 2 (degraded) / 3 (critical). Score = P × I. Thresholds: 1-3 DOCUMENT,
4-5 MONITOR, 6-8 MITIGATE (CONCERNS at gate), 9 BLOCK (auto-FAIL).

**Impact rationale (why so many Impact 3):** Epic 8's artifacts are the customer-facing commitments
(quote PDFs, attachments, acceptance evidence) held on a **new storage plane**. A cross-tenant storage
leak now exposes another tenant's *documents*, not just rows; a public bucket or spoofable path is a
direct exfiltration route; an unauthorized signed URL is a durable, shareable leak; a mutable locked
evidence file destroys the audit property Epics 6-7 and the migration sign-off depend on. These are
**Impact 3**. **Probability is held at 2** for most: the DB-side isolation harness (RLS/enrollment/
negative suites) is proven five epics over, so the residual is *correct extension to the storage plane*
(the first `storage.objects` RLS, the first server-derived-path discipline, the first signing funnel).
Probability drops to 1 where an automated gate makes silent failure hard (fixture PII scan) and Impact
to 2 where failure is degraded-not-critical (index UX, status plumbing, sequencing).

### High-Priority Risks (Score ≥6)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner | Timeline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-801 | SEC | **`files`/`file_links` isolation gap** — either table ships without direct `tenant_id`, enable+**force** RLS + own-tenant policies, `anon → none`, or **unenrolled in `TENANT_TABLES`** → cross-tenant read/write of another tenant's file metadata and entity links | 2 | 3 | 6 | Reuse the proven migration pattern verbatim on both tables; enroll both in `TENANT_TABLES` with spoof/filter/mutation metadata BEFORE merge (H4 gate CI-fatal otherwise); migration-reset + cross-tenant + anon-path negatives per table | Dev (8.1) | Story 8.1 |
| R-802 | SEC | **Cross-tenant / cross-owner link creation** — `file_links` created where the file belongs to tenant A but the owner record to tenant B, or a bare `file_id` FK lets a link point at another tenant's file; polymorphic owner id not ownership-checked | 2 | 3 | 6 | Composite same-tenant FK on `file_links.file_id`; command re-validates **both** file ownership AND owner-record ownership under RLS (`verifyOwnership` semantics, zero rows ⇒ `TENANT_ACCESS_DENIED`); INT owner-spoof negatives: foreign file id AND foreign owner id both rejected; link creation for an owner type activates only once that owner table exists | Dev (8.1) | Story 8.1 |
| R-803 | SEC | **Public bucket or client-controlled storage path** — a Phase A bucket ships public, or an object path is derived from client input → direct unauthenticated exfiltration / cross-tenant path traversal | 2 | 3 | 6 | Private buckets ONLY (architecture §6/§14); server-derived object paths ONLY, never client-entered (8.2 AC "user never enters or controls raw storage paths"); construction assertion (bucket config private) + path-spoof INT negatives; a public bucket or client path is an 8.1/8.3 STOP condition | Dev (8.1) | Story 8.1 |
| R-804 | SEC | **Unauthorized signed URL issued** — `createSignedFileAccess` signs for an anonymous caller, a cross-tenant caller, or a file whose lifecycle state forbids access; or signs without the metadata-ownership check | 2 | 3 | 6 | Signing funnel verifies tenant membership → file metadata ownership → lifecycle state BEFORE issuing (epics.md 8.1 AC5; architecture §6); INT authorization matrix: anon reject, cross-tenant reject, wrong-lifecycle reject; every rejection returns a **generic user-safe error** (no existence disclosure); signing never leaves the server | Dev (8.1) | Story 8.1 |
| R-805 | SEC | **Storage-plane cross-tenant access / path spoofing** — tenant A lists, reads, or signs tenant B's `storage.objects`, or spoofs a tenant-B object path directly against Storage, bypassing `files` metadata | 2 | 3 | 6 | RLS on `storage.objects` scoped by server-derived tenant path prefix; access always resolves **metadata first, storage second** (architecture; 8.3 tech note "file access always resolves metadata first, storage second"); full **storage negative matrix**: cross-tenant list/read/sign + path spoof, all denied with generic errors; this matrix is the 8.3 deliverable and the 8.1 foundation seeds it | Dev (8.1, extended 8.3) | Story 8.1 / 8.3 |
| R-806 | DATA | **Expired signed URL not re-authorized (or never expires)** — a stale URL still works, or refresh re-issues WITHOUT a fresh authorization check → a shared/leaked URL becomes a permanent backdoor | 2 | 3 | 6 | Short-lived, environment-configurable TTL (low in test env so expiry is testable without waiting — epics.md 8.1 H2 / architecture §6); INT: expired URL rejected using a low test TTL; refresh performs a FULL fresh authorization check and re-signs only if still allowed (8.3 AC2); no long-lived/never-expiring URL path | Dev (8.1, UX 8.3) | Story 8.1 / 8.3 |
| R-807 | DATA/OPS | **Storage↔DB atomicity break / orphaned objects** — object written to Storage but `files`/`file_links` metadata not persisted (or vice versa) on a mid-flow failure → orphaned objects, dangling metadata, or a "usable" file with no valid link | 2 | 3 | 6 | Metadata+link writes that must be atomic use a narrow Postgres RPC (ADR-A009, which explicitly names 8.1's atomic metadata-plus-link creation); for the storage-success/DB-failure case define compensating cleanup/archive (epics.md 8.2 tech note); INT: mid-flow failure leaves a consistent, non-usable, cleanable state — no orphan is silently accessible | Dev (8.1/8.2) | Story 8.1 / 8.2 |
| R-808 | SEC | **MIME/size/owner/lifecycle validation bypass on upload** — a blocked type, oversized file, foreign owner, or wrong-lifecycle file becomes usable because validation is client-only or missing server-side | 2 | 3 | 6 | Server-side validation of MIME, size, tenant ownership, owning entity, purpose, AND lifecycle state BEFORE the file is usable (8.2 AC2; architecture §6); INT: each invalid case rejected server-side even when the client is bypassed; conservative dev defaults now, owner-approved policy later (R-817) | Dev (8.2) | Story 8.2 |
| R-809 | SEC | **File existence disclosure across tenants** — an upload/access/sign failure reveals whether another tenant's file exists (distinct error for "exists-but-forbidden" vs "not-found") | 2 | 3 | 6 | Cross-tenant failures return generic user-safe errors that do NOT reveal existence (8.2 AC3 "cross-tenant failures do not reveal whether another tenant's file exists"; 8.1 AC5 generic errors); INT asserts identical error shape/code for not-found vs cross-tenant-forbidden; reuse the Epic 2 `server-error-vs-no-access` discipline | Dev (8.2/8.3) | Story 8.2 / 8.3 |
| R-812 | DATA/BUS | **Locked commitment file mutable/deletable** — a sent quote's PDF/attachment link or an accepted-evidence file can be replaced or deleted through a command path OR a direct own-tenant SQL UPDATE/DELETE because locking is command-only / UI-only | 2 | 3 | 6 | Two independent layers (8.4 tech note "enforced by command validation AND database constraints/triggers, not only disabled buttons"): command validation ⇒ a stable lock code, AND DB trigger/constraint blocks mutation/delete on locked links; deletion of a locked file is archive-only + audit event (who/what/when/why/target); INT negatives attempt mutation via command AND via direct authenticated UPDATE/DELETE; UI-only locking is an 8.4 STOP; must AGREE with Epic 6 sent-immutability (R-605) and Epic 7 accepted immutability | Dev (8.4) | Story 8.4 (after Epics 6-7) |
| R-819 | SEC/BUS | **File-fixture / storage-artifact PII or raw-file leak** — a committed file-metadata fixture, an extracted test file, or a golden embeds a real name/address/personnummer/orgnr/secret or a raw customer file | 1 | 3 | 3 → held at 6-equivalent control | Anonymized metadata-shape-only fixtures; no raw customer files committed (epics.md 8.1/8.2 migration notes); EXTEND the CI golden PII/secret + ORGNR scan to file-metadata fixtures and any committed file/text artifact; committed real PII/raw file is an epic blocker regardless of score (mirrors R-411/R-516/R-615) | Dev (8.1/8.2) | Stories 8.1, 8.2 |

### Medium-Priority Risks (Score 4-5)

| Risk ID | Category | Description | Prob | Impact | Score | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| R-810 | DATA | **Metadata-first / storage-second ordering violated** — access resolves the storage object before (or instead of) the metadata ownership check, opening a spoof window; or UI leaks raw bucket/path details | 2 | 2 | 4 | Enforce metadata-first, storage-second resolution everywhere (architecture; 8.3 tech note); do NOT expose raw bucket/path in UI unnecessarily; INT proves the ownership check precedes any storage call; UI test asserts no raw path rendered | Dev (8.3) |
| R-811 | BUS | **Upload UI error states indistinct / unsafe** — blocked-type, too-large, network/server-failure, and permission-failure all collapse to one opaque error, or an error reveals cross-tenant existence | 2 | 2 | 4 | 8.2 AC3: four DISTINCT user-safe error states; E2E per state; cross-tenant permission failure uses the generic no-existence-disclosure error (R-809 link); extract error-state logic into a pure, unit-testable module per the coverage-shape lesson (don't bury it inline in a `"use client"` component) | Dev (8.2) |
| R-813 | OPS/DATA | **Partial lock / broken archive-delete** — a file locked without its audit event (or vice versa); archive converts inconsistently; a "delete" partially deletes a locked file | 2 | 2 | 4 | Lock + `file_links` lock fields + `audit_events` written consistently (transactional or verified-compensated, per ADR-A009 discipline); archive-only path never hard-deletes a locked file; INT: mid-flow failure leaves a consistent, retryable state; audit event present for every lock/archive | Dev (8.4) |
| R-814 | OPS | **Story 8.1 sequencing slip re-opens Epic 6 pressure** — if 8.1 slips, 6.3 (PDF storage) and 6.1 (attachment metadata) face pressure to invent a local file model, violating the "single Phase A file model" contract | 2 | 2 | 4 | Approved order already puts 8.1 Wave-1 BEFORE Epic 6 (sprint-status; epic-6 Entry Criteria) — CONFIRM 8.1 lands and is green before Epic 6's first file-touching story; 6.3 must NOT introduce its own file model (STOP); this design's "single file model" contract is the reviewer checkpoint | PM + Dev |
| R-815 | TECH | **Signed-URL TTL not environment-configurable** — TTL hardcoded, so expiry cannot be tested without real waiting and prod cannot tune it | 1 | 2 | 2 → track | TTL is environment-configurable by design (epics.md 8.1 H2 / architecture §6): low in test env, tuned in prod; INT expiry test relies on the low test TTL; a hardcoded TTL blocks R-806's expired-URL test and is a review reject | Dev (8.1) |
| R-816 | BUS | **File index becomes a document center / scope creep** — 8.5 grows deferred-module groupings, cross-module analytics, or broad document workflows | 2 | 2 | 4 | 8.5 AC1 + STOP condition: index lists ONLY CRM/calc/quote/acceptance/job files, NO deferred groupings / document-center workflows / cross-module analytics; guardrail test asserts absence of deferred file category labels (8.5 test req); the index is OPTIONAL (skippable if panels suffice) | Dev (8.5) + Rasmus |
| R-817 | BUS | **MIME allow-list / size limits unapproved for real pilot** — conservative dev defaults reach real-pilot use without owner approval of the final file-type/size policy | 1 | 2 | 2 → doc under demo-data-only | DOCUMENT: dev defaults are fine for demo-data-only MVP (2026-07-03 decision); final policy is an owner Sign-Off residual re-confirmed at 8.2 create-story; 8.2 STOP if final policy/required-file rules materially affect pilot data. Re-score if real-customer use is proposed | Rasmus (accept authority) |

### Low-Priority Risks (Score 1-3)

| Risk ID | Category | Description | Prob | Impact | Score | Action |
| --- | --- | --- | --- | --- | --- |
| R-818 | BUS | **Locked-evidence retention/hard-delete policy undecided** — Phase A defaults to archive-only, but a legal hard-delete/retention rule may be required later | 1 | 2 | 2 | DOCUMENT with 8.4 STOP: archive-only is the Phase A default; any hard-delete retention rule requires legal sign-off before implementation. Re-open only on a legal decision. |
| R-820 | PERF/OPS | **Large-file / streaming / virus-scan edges untested** — pilot-sized files only; no scan; no perf SLA | 1 | 2 | 2 | DOCUMENT: functional isolation + validation correctness is the Phase A concern; large-file/streaming edges are P3 exploratory; virus scanning is separately-approved-only (a STOP if requested inside this epic). |
| R-821 | OPS | **Coverage reporter still absent (standing NFR carry)** — no coverage reporter across the file suites either | 1 | 2 | 2 | DOCUMENT: the one standing NFR CONCERN carried Epics 2-6 (no `c8`/coverage reporter) also applies here; surface for the owner schedule-or-accept decision at the Epic 8 gate rather than silently carrying a further epic. |

### Risk Category Legend

- **SEC**: Security (two-plane isolation on `files`/`file_links` + `storage.objects`, private-by-default, client-controlled paths, signed-access funnel, path spoofing, MIME/size bypass, existence disclosure, fixture PII)
- **DATA**: Data Integrity (storage↔DB atomicity/orphans, signed-URL expiry/refresh, metadata-first ordering, lifecycle-lock integrity, partial lock/archive)
- **BUS**: Business/Compliance (index scope creep, MIME/size policy approval, retention policy)
- **TECH**: Technical (TTL configurability)
- **OPS**: Operations (8.1 sequencing, partial-write/archive plumbing, standing NFR carry)
- **PERF**: Performance (large-file/streaming, no SLA)

---

## Testability Notes (Epic-Level)

1. **RLS negatives BEFORE positives, and enrollment is the completeness guarantee — now across TWO
   planes.** `files` and `file_links` enroll in `TENANT_TABLES` so the H4 gate + shared cross-tenant/
   anon suites cover the **DB plane** automatically (do not hand-write ad-hoc isolation tests that
   bypass the inventory). The **storage plane is genuinely new** and needs its own negative matrix
   (`storage.objects` RLS, path-spoof, cross-tenant list/read/sign) — this is the one class no prior
   epic has, so it does not inherit an automated gate and must be authored deliberately in 8.1 and
   completed in 8.3.
2. **The signing funnel is the headline authorization test, and it is a negative-first matrix.**
   `createSignedFileAccess` must be proven to reject (a) anonymous, (b) cross-tenant, (c) spoofed-path,
   and (d) expired/wrong-lifecycle requests, each with a **generic user-safe error** — asserting the
   *same* error shape for not-found vs forbidden is the anti-existence-disclosure proof (R-809). A test
   that only proves the happy-path sign works is not evidence of the boundary.
3. **Expiry is a real behavioral test, enabled by the configurable TTL.** Use the low test-env TTL
   (epics.md 8.1 H2) to prove an expired URL is rejected WITHOUT sleeping — drive it with the TTL
   config, not a timer. Refresh must re-run the FULL authorization check (not just re-sign), so the
   refresh test asserts a revoked/lifecycle-changed file is NOT re-signed.
4. **Storage↔DB consistency is behavioral, not structural.** Prove the atomic metadata+link RPC
   (ADR-A009) rolls back cleanly on a mid-flow failure, and prove the storage-success/DB-failure case
   is compensated (no orphaned, silently-accessible object). Field-exists assertions are insufficient —
   inject a failure between the storage write and the metadata commit and assert the end state is
   consistent and non-usable (R-807).
5. **Lock enforcement is two-layer and behavioral (8.4).** Attempt mutation/delete of a locked file
   through the command (assert the lock code) AND through a direct own-tenant authenticated UPDATE/
   DELETE (assert the trigger/constraint rejects). A test that only proves the UI disables the button
   is not evidence (mirrors the Epic 6 sent-immutability discipline, R-605). 8.4's lock scenarios are
   only fully meaningful once Epic 6 sent-state and Epic 7 accepted-state exist — cross-reference, do
   not re-invent, those lifecycles.
6. **Metadata-first, storage-second is an ordering assertion.** Every access/sign path must resolve
   `files` ownership BEFORE touching Storage (architecture; 8.3 tech note). Unit/INT-pin that the
   ownership check precedes any storage call so a future refactor can't reorder it into a spoof window
   (R-810). UI must not render raw bucket/path.
7. **Coverage-shape lesson applies to upload/error/index logic.** Pull the four distinct upload
   error-state decisions, the signed-access-refresh decision, and the index-scope filter OUT of
   `"use client"` components into pure `.ts` modules so the fast `node --test` unit gate protects them
   (project-context coverage-shape lesson; the `source-options.ts` split is the standing pattern). A
   pure helper embedded in a `.tsx` escapes the fast gate and is only caught by slow e2e.
8. **Golden/fixture discipline as established.** Any file-metadata or extracted-file golden lands under
   `tests/unit/**` (runner-glob trap — a golden outside that glob is vacuous-green). EXTEND the PII/
   secret + ORGNR scan to file-metadata fixtures and any committed file/text artifact (R-819); no raw
   customer file is committed. Origin-label file goldens (new-expected vs any Lovable delta) so a real
   Epic 9 delta lands without a code-shape change.
9. **Two-tenant + per-run-unique hygiene as established.** Two-tenant fixture provisions a unique
   tenant pair per test; any row/object-count assertion seeds `crypto.randomUUID()`; DB-backed + storage
   suites run against the LOCAL Supabase CLI stack ONLY (never demo/dev/prod), `SUPABASE_TEST_REQUIRED=1`
   in CI makes a missing stack a hard fail. Poll `/auth/v1/health` to 200 after `db reset` before
   trusting a local int/storage run (post-reset 502 false-green trap). Storage tests likewise must
   confirm the local storage API is reachable before asserting, or skip-clean locally / hard-fail in CI.
10. **Resumed-run artifact discipline (retro standing practice).** Any resumed story in this epic
    re-verifies scaffold completeness (`describe.skip`/`notYetImplemented`), exported-but-unimplemented
    command surface, and sprint-status freshness against disk before trusting recorded state — five
    epics of precedent say this WILL come up.

---

## Entry Criteria

### Story 8.1 (Wave 1 — NEXT)

- [ ] Epics 1-2 merged and green in `main` — isolation harness (RLS/enrollment/negative suites), server
      command envelope + `verifyOwnership` + Result model, `audit_events` append-only, two-tenant
      fixture, service-role containment guards all live (verified: through-Epic-5 gates PASS).
- [ ] **Local Supabase CLI stack storage API reachable** for the run — `supabase start` brings up the
      storage service; the DB job's health-poll pattern extends to a storage-reachability probe so
      storage-negative suites hard-fail in CI (`SUPABASE_TEST_REQUIRED=1`) and skip-clean locally.
- [ ] **Private-bucket + server-derived-path approach agreed** — a single private Phase A bucket (or
      per-tenant-prefixed private bucket) with server-derived object paths; `storage.objects` RLS
      strategy sketched (tenant path prefix). Config lives in `supabase/config.toml` `[storage]` (today
      only commented placeholders — 8.1 introduces the real private bucket).
- [ ] **Signed-URL TTL is environment-configurable** (low test TTL) so expiry is testable (R-815).
- [ ] **Atomic metadata+link RPC approach agreed** under ADR-A009 (security invoker default; any
      definer needs separate approval + fixed `search_path` + membership checks + negative tests).
- [ ] Owner types confirmed limited to Phase A entities (customer, facility, contact, calculation,
      quote_version, quote_acceptance, job); link activation is per-entity as owner tables land.

### Stories 8.2-8.5 (Wave 2 — AFTER Epics 6-7)

- [ ] **Story 8.1 landed and green** — the single Phase A file model exists; all Wave-2 stories EXTEND
      it and MUST NOT create a competing model (standing contract; R-814).
- [ ] **Owner-entity workflows exist** — 8.2 uploads target real entities (Epics 3/5); 8.4 locks target
      **sent** quote versions (Epic 6) and **accepted** evidence (Epic 7). Do not detail 8.4's lock
      matrix before Epic 6 `quote_versions`/sent-state and Epic 7 `quote_acceptances`/accepted-state are
      frozen (avoids forking the lifecycle rule table).
- [ ] **Conservative MIME/size defaults chosen** for dev; final policy is an owner Sign-Off residual
      (R-817), re-confirmed at 8.2 create-story; not a real-pilot blocker under demo-data-only.
- [ ] **File-index scope decision** — 8.5's index is OPTIONAL; confirm at 8.5 create-story whether
      entity panels already satisfy pilot needs (skip) or a limited index is warranted (build to the
      strict Phase A scope, R-816).

---

## Exit Criteria

- [ ] All P0 tests passing (100%).
- [ ] All P1 tests passing (≥95%, waivers documented for any failure).
- [ ] **`files` and `file_links` enrolled in `TENANT_TABLES`** and the H4 inventory gate green (R-801).
- [ ] **Storage negative matrix green** — cross-tenant list/read/sign + path spoof + anon + expired-URL
      (low TTL) + wrong-lifecycle all rejected with generic user-safe errors (R-804/R-805/R-806/R-809).
- [ ] **Private-bucket + server-derived-path construction assertions green** — no public bucket, no
      client-controlled path (R-803).
- [ ] **Atomic metadata+link RPC rollback + storage↔DB compensation proven** — no orphaned objects/
      dangling metadata on mid-flow failure (R-807).
- [ ] **(Wave 2) Lock enforcement proven two-layer** — command AND DB reject mutation/delete of a
      locked sent/accepted file; archive-only-on-delete + audit event (R-812/R-813), and it AGREES with
      Epic 6/7 immutability.
- [ ] **(Wave 2) Upload validation green** — MIME/size/owner/lifecycle rejected server-side even when the
      client is bypassed; four distinct user-safe error states; no existence disclosure (R-808/R-809/R-811).
- [ ] **(Wave 2) Index scope guardrail green** — index lists ONLY Phase A entity files, no deferred/
      document-center labels; file audit events written with safe metadata (R-816; architecture §15).
- [ ] No committed real PII / raw customer file in fixtures or artifacts; PII scan extended and green (R-819).
- [ ] Standing NFR CONCERN (coverage reporter, R-821) surfaced for owner schedule-or-accept at the gate.
- [ ] No open high-priority (≥6) item unmitigated; all STOP conditions respected.

---

## Test Coverage Plan

> **P0/P1/P2/P3 denote PRIORITY / RISK, not execution timing.** The execution timing (what runs on a
> PR vs nightly) is handled separately in **Execution Strategy** below. The per-priority "Run on ..."
> phrasing in the headers is a house-style convenience aligned with prior epic designs; the binding
> timing rule is: run everything on the PR gate if the suite completes in time, defer only genuinely
> expensive/long-running work.

Levels: **UNIT** (`node --test`, pure logic under `tests/unit/**`), **INT** (Vitest, DB-backed under
`tests/integration/**`), **RLS** (Vitest RLS-negative), **STORAGE-NEG** (Vitest against local Supabase
Storage — the new class this epic adds), **E2E** (Playwright `tests/e2e/**`), **GOLDEN** (pinned under
`tests/unit/**`), **DOCS** (review/guardrail). Counts are ranges (no false precision).

### P0 (Critical) - Run on every commit (PR gate if <15 min)

**Criteria**: Blocks core file safety + High risk (≥6) + No workaround

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| `files`/`file_links` migration-reset from empty DB + per-table policy/GRANT enumeration | INT | R-801 | 2-3 | DEV | Extends the existing migration-reset suite; asserts tenant scoping, force RLS, `anon → none` |
| `files`/`file_links` cross-tenant + anon-path RLS negatives via `TENANT_TABLES` enrollment | RLS | R-801 | 3-5 | DEV | Enroll both tables with spoof/filter/mutation metadata; H4 gate green |
| Link creation ownership validation — foreign file id AND foreign owner id both rejected | INT | R-802 | 3-4 | DEV | `verifyOwnership` semantics both sides; `TENANT_ACCESS_DENIED`; per active owner type |
| Private-bucket + server-derived-path construction assertions (no public bucket, no client path) | INT/DOCS | R-803 | 2-3 | DEV | Bucket config private; path derivation server-side; path-spoof negative |
| `createSignedFileAccess` authorization matrix — anon / cross-tenant / wrong-lifecycle rejected | INT | R-804 | 4-6 | DEV | Generic user-safe error each; metadata-ownership check precedes signing |
| Storage-plane negatives — cross-tenant list/read/sign + object path spoof | STORAGE-NEG | R-805 | 4-6 | DEV | `storage.objects` RLS + metadata-first ordering; the new negative class |
| Expired signed URL rejected (low test TTL) + refresh re-authorizes | INT | R-806 | 2-3 | DEV | No sleep — driven by TTL config; refresh re-runs full auth check |
| Atomic metadata+link RPC rollback + storage↔DB compensation (no orphans) | INT | R-807 | 3-4 | DEV | ADR-A009 RPC; inject mid-flow failure; end state consistent + non-usable |
| **(8.2)** Upload MIME/size/owner/lifecycle server-side validation (client bypassed) | INT | R-808 | 4-6 | DEV | Each invalid case rejected server-side; conservative dev defaults |
| **(8.2/8.3)** Cross-tenant failure = generic no-existence-disclosure error | INT | R-809 | 2-3 | DEV | Same error shape for not-found vs forbidden; reuse `server-error-vs-no-access` |
| **(8.4)** Locked sent/accepted file — mutation/delete rejected via command AND direct SQL | INT | R-812 | 4-6 | DEV | Two-layer; archive-only-on-delete + audit; AGREES with Epic 6/7 (cross-ref) |
| Fixture PII/secret + raw-file scan extended to file-metadata fixtures/artifacts | INT/DOCS | R-819 | 1-2 | DEV | Extend existing golden PII+ORGNR scan; no raw customer file committed |

**Total P0**: ~34-51 test cases (~30-44 hard, some paired) — ~24-38 hours

### P1 (High) - Run on PR to main

**Criteria**: Important features + Medium risk (3-4) + Common workflows

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| **(8.2)** Entity-panel upload UX — shows allowed types/size/owner/purpose; no raw path field | E2E | R-803/R-811 | 3-5 | QA | User never enters/controls a storage path (8.2 AC1) |
| **(8.2)** Four distinct user-safe upload error states (blocked-type/too-large/net-fail/perm-fail) | E2E + UNIT | R-811 | 4-6 | QA/DEV | Extract error-state logic to pure `.ts` for the unit gate (coverage-shape lesson) |
| **(8.3)** Preview/download UX + expiry→refresh reauthorization loop | E2E | R-806 | 3-4 | QA | Fresh auth on retry; new signed URL only if allowed (8.3 AC2) |
| **(8.3)** Metadata-first / storage-second ordering + no raw bucket/path in UI | INT + E2E | R-810 | 2-3 | DEV/QA | Ownership check precedes any storage call; UI leaks no path |
| **(8.4)** Lock-warning UX + quote/acceptance lifecycle golden cases | E2E + GOLDEN | R-812 | 3-5 | QA/DEV | Lock UX shows locked state; golden pins lock/archive transitions |
| **(8.4)** Partial-lock / archive-delete consistency + audit event present | INT | R-813 | 2-3 | DEV | Consistent/retryable mid-flow state; audit for every lock/archive |
| **(8.5)** Limited-index tenant-scoped listing (only tenant A files) + RLS negative | E2E + RLS | R-801/R-816 | 2-3 | QA/DEV | Tenant B metadata not visible; reuses enrollment negatives |
| **(8.5)** File audit events (upload/link/sign/archive/lock) with safe metadata | INT | architecture §15 | 2-3 | DEV | Through existing `audit_events`; no raw file content/path/PII in metadata |

**Total P1**: ~21-32 test cases — ~18-28 hours

### P2 (Medium) - Run nightly/weekly

**Criteria**: Secondary features + Low risk (1-2) + Edge cases

| Requirement | Test Level | Risk Link | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- | --- |
| Lifecycle-state transitions (draft→linked→locked→archived→deleted) valid/invalid moves | INT | R-812/R-813 | 3-4 | DEV | State-machine edge coverage |
| a11y/keyboard on upload panels, preview controls, index (text status, not color-only) | E2E | R-811/R-816 | 2-4 | QA | Follows the epic-6 timeline a11y pattern |
| Index-absence guardrail — no deferred-module groupings / document-center workflows | E2E/DOCS | R-816 | 1-2 | QA | Asserts absence of deferred file category labels (8.5 test req) |
| Documented Lovable attachment-locking delta (behavioral oracle, not copied) | DOCS | R-812 | 1 | DEV | Compare Lovable locking, document safer Phase A delta (8.4 migration note) |
| Checksum/hash-when-available metadata behavior | INT | R-807 | 1-2 | DEV | architecture §14 "checksum/hash when available" |

**Total P2**: ~8-13 test cases — ~6-14 hours

### P3 (Low) - Run on-demand

**Criteria**: Nice-to-have + Exploratory + Benchmarks

| Requirement | Test Level | Test Count | Owner | Notes |
| --- | --- | --- | --- | --- |
| Large-file / streaming upload/download edges | E2E/INT | 1-2 | QA | Pilot-sized only; no SLA (R-820) |
| Signed-URL TTL boundary fuzz (just-expired / just-valid) | INT | 1-2 | DEV | Exploratory around the low test TTL |
| DX / error-message exploratory + residual perf notes | DOCS | 1-2 | DEV | Non-blocking |

**Total P3**: ~3-6 test cases — ~2-5 hours

---

## Execution Strategy

Philosophy: **run everything on the PR gate** — the whole Epic 8 suite (UNIT + INT + RLS + STORAGE-NEG +
E2E) is well under 15 minutes with Playwright parallelization and Vitest's DB-backed job, so there is no
reason to defer functional coverage. Only genuinely expensive work is deferred.

- **Every PR (the gate):** all functional tests — `files`/`file_links` migration-reset + RLS negatives +
  H4 gate, `createSignedFileAccess` authorization matrix, the storage-negative matrix (cross-tenant
  list/read/sign + path spoof + expired-URL via low TTL), atomic metadata+link RPC rollback/compensation,
  upload validation, lifecycle-lock two-layer checks, index-scope guardrails, file audit assertions,
  E2E upload/preview/lock/index flows. Storage suites run against the LOCAL Supabase CLI stack only
  (`SUPABASE_TEST_REQUIRED=1` hard-fails a missing stack in CI; skip-clean locally).
- **Nightly (optional):** large-file/streaming edges and signed-URL TTL boundary fuzz (P3) if they grow
  beyond the PR budget — currently small enough to stay on the PR gate.
- **Weekly / on-demand:** nothing required for Phase A (no perf SLA, no chaos suite). Add only if a
  file-storage SLA or scale requirement emerges (R-820).

## Execution Order

### Smoke Tests (<5 min)

**Purpose**: Fast feedback, catch build-breaking + isolation regressions

- [ ] `files`/`file_links` migration-reset + H4 inventory gate green (INT)
- [ ] `createSignedFileAccess` anon + cross-tenant rejection (INT)
- [ ] Private-bucket construction assertion (INT/DOCS)

### P0 Tests (<10 min — PR gate)

**Purpose**: File-safety critical path — isolation, signing funnel, storage negatives, atomicity, locks

- [ ] `files`/`file_links` RLS cross-tenant + anon negatives (RLS)
- [ ] Link ownership validation both-side spoof (INT)
- [ ] Signed-access authorization matrix incl. expired-URL/lifecycle (INT)
- [ ] Storage-plane cross-tenant list/read/sign + path spoof (STORAGE-NEG)
- [ ] Atomic metadata+link RPC rollback + compensation (INT)
- [ ] (8.2) Upload validation server-side (INT) · (8.4) locked-file mutation/delete two-layer (INT)
- [ ] Fixture PII/raw-file scan (INT/DOCS)

### P1 Tests (<30 min)

**Purpose**: Upload/preview/lock/index UX + audit coverage

- [ ] Entity-panel upload UX + four error states (E2E + UNIT)
- [ ] Preview/download + expiry→refresh (E2E) · metadata-first ordering (INT/E2E)
- [ ] Lock-warning UX + lifecycle golden (E2E + GOLDEN) · archive/audit consistency (INT)
- [ ] Limited-index listing + RLS negative (E2E + RLS) · file audit events (INT)

### P2/P3 Tests (<60 min)

**Purpose**: Full regression + exploratory

- [ ] Lifecycle-state transitions (INT) · a11y (E2E) · index-absence guardrail (E2E/DOCS)
- [ ] Lovable delta doc (DOCS) · checksum behavior (INT) · large-file / TTL fuzz (INT/E2E)

---

## Resource Estimates

### Test Development Effort

| Priority | Count | Hours/Test | Total Hours | Notes |
| --- | --- | --- | --- | --- |
| P0 | ~34-51 | ~0.7-0.9 | ~24-38 | Complex: storage-plane setup, signing funnel, atomicity, two-layer locks |
| P1 | ~21-32 | ~0.8-1.0 | ~18-28 | Upload/preview/lock/index UX + audit |
| P2 | ~8-13 | ~0.5-0.8 | ~6-14 | Edge transitions, a11y, guardrails, deltas |
| P3 | ~3-6 | ~0.4-0.7 | ~2-5 | Exploratory |
| **Total** | **~66-102** | **-** | **~50-85** | **~7-11 dev-days** (spread across two waves) |

Effort is **split by wave**: 8.1 alone carries the bulk of P0 storage/RLS/signing work (~18-28 hrs);
8.2-8.5 carry the upload/preview/lock/index UX + Wave-2 P0 locks (~30-55 hrs), scheduled after Epics 6-7.

### Prerequisites

**Test Data:**

- Two-tenant fixture (existing `tests/factories/**`) EXTENDED with a file-metadata factory
  (faker-based, per-run unique ids, auto-cleanup) — anonymized metadata only, NO raw customer files.
- A small set of dev fixture files (valid + blocked-MIME + oversized) for upload/validation tests,
  generated at test time (not committed as customer data).

**Tooling:**

- Local Supabase CLI stack **with the Storage service running** (`supabase start`) — the new
  requirement this epic adds beyond the DB stack; storage-reachability probe added to the runner.
- Existing runner split (`scripts/run-tests.mjs`: `node --test` units + Vitest int/rls + Playwright e2e).
- Golden PII/secret + ORGNR scan EXTENDED to file-metadata fixtures + any committed file/text artifact.

**Environment:**

- Private bucket + server-derived-path config in `supabase/config.toml` `[storage]` (8.1 introduces it).
- Environment-configurable signed-URL TTL (low in test env) so expiry is testable without waiting.
- DB + storage suites run against the LOCAL stack ONLY (never demo/dev/prod); `SUPABASE_TEST_REQUIRED=1`
  in CI hard-fails a missing stack; health-poll (`/auth/v1/health` 200 + storage reachable) after reset.

---

## Quality Gate Criteria

### Pass/Fail Thresholds

- **P0 pass rate**: 100% (no exceptions)
- **P1 pass rate**: ≥95% (waivers required for failures)
- **P2/P3 pass rate**: ≥90% (informational)
- **High-risk (≥6) mitigations**: 100% complete or approved waivers

### Coverage Targets

- **File isolation (DB + storage plane) negatives**: 100% — every access route (read/link/update/
  archive/delete/list/sign/spoof) proven cross-tenant + anon-denied
- **Signed-access authorization matrix**: 100% (anon/cross-tenant/spoof/expired/lifecycle)
- **Upload validation (MIME/size/owner/lifecycle)**: 100% server-side
- **Lifecycle-lock enforcement (Wave 2)**: 100% two-layer (command + DB)
- **Business/index-scope guardrails**: 100% (no document-center scope creep)
- **Edge cases (state transitions, a11y, deltas)**: ≥50%

### Non-Negotiable Requirements

- [ ] `files` + `file_links` enrolled in `TENANT_TABLES`; H4 gate green (R-801)
- [ ] No public bucket, no client-controlled storage path (R-803)
- [ ] Storage negative matrix (cross-tenant list/read/sign + spoof + expired) 100% green (R-804/R-805/R-806)
- [ ] `createSignedFileAccess` rejects anon/cross-tenant/spoof/expired/wrong-lifecycle with generic errors (R-804/R-809)
- [ ] Storage↔DB atomicity/compensation proven — no orphans (R-807)
- [ ] (Wave 2) Locked sent/accepted files immutable at command AND DB; archive-only + audit (R-812)
- [ ] No service-role key on any client file path; containment guards green
- [ ] No committed real PII / raw customer file; PII scan green (R-819)
- [ ] "Single Phase A file model" contract intact — no competing file/storage model anywhere (R-814)

---

## Mitigation Plans

### R-801: `files`/`file_links` isolation gap (Score: 6)

**Mitigation Strategy:** Reuse the five-epoch-proven tenant-table migration pattern verbatim (direct
`tenant_id`, composite same-tenant FK on `file_links.file_id`, enable+**force** RLS with own-tenant
policies on the DEFINER helpers, `anon → none` GRANT, `set_updated_at()`); enroll BOTH tables in
`TENANT_TABLES` with spoof/filter/mutation metadata BEFORE merge so the compile-exhaustive H4 gate and
the shared cross-tenant/anon suites cover them.
**Owner:** Dev (8.1) · **Timeline:** Story 8.1 · **Status:** Planned
**Verification:** Migration-reset INT + cross-tenant/anon RLS negatives + H4 inventory gate all green.

### R-803: Public bucket / client-controlled storage path (Score: 6)

**Mitigation Strategy:** Configure a private-by-default bucket in `supabase/config.toml`; derive all
object paths server-side from tenant + file identity (never client input); assert both properties at
construction and prove path spoofing is rejected.
**Owner:** Dev (8.1) · **Timeline:** Story 8.1 · **Status:** Planned
**Verification:** Bucket-private construction assertion + server-derived-path INT test + path-spoof
negative; a public bucket or client path is an 8.1/8.3 STOP.

### R-804 / R-805 / R-806: Signed-access + storage-plane authorization (Score: 6 each)

**Mitigation Strategy:** `createSignedFileAccess` funnels ALL access through tenant-membership →
metadata-ownership → lifecycle-state checks before signing, returning generic errors on any failure;
`storage.objects` RLS + metadata-first-storage-second ordering deny cross-tenant list/read/sign and
spoofed paths; the low test-env TTL makes expiry testable and refresh re-runs full authorization.
**Owner:** Dev (8.1, extended 8.3) · **Timeline:** Story 8.1 (foundation) / 8.3 (full matrix + UX) ·
**Status:** Planned
**Verification:** Authorization matrix INT (anon/cross-tenant/lifecycle) + storage-negative matrix
(list/read/sign/spoof) + expired-URL (low TTL) + refresh-reauth, all green with generic errors.

### R-807: Storage↔DB atomicity / orphaned objects (Score: 6)

**Mitigation Strategy:** Atomic metadata+link creation via a narrow Postgres RPC (ADR-A009); define
compensating cleanup/archive for the storage-success/DB-failure case; never leave a silently-accessible
orphan.
**Owner:** Dev (8.1/8.2) · **Timeline:** Story 8.1 / 8.2 · **Status:** Planned
**Verification:** INT injects a mid-flow failure and asserts a consistent, non-usable, cleanable end
state; RPC rollback proven.

### R-812: Locked commitment file mutable/deletable (Score: 6)

**Mitigation Strategy:** Enforce locks at BOTH command validation (stable lock code) AND DB trigger/
constraint; deletion of a locked file is archive-only with an audit event; lock behavior must AGREE
with Epic 6 sent-immutability and Epic 7 accepted immutability.
**Owner:** Dev (8.4) · **Timeline:** Story 8.4 (after Epics 6-7) · **Status:** Planned (Wave 2)
**Verification:** INT attempts mutation/delete via command AND direct authenticated SQL — both rejected;
archive-only + audit event present; UI-only locking is an 8.4 STOP.

### R-819: File-fixture / storage-artifact PII leak (Score: 3, held at 6-equivalent control)

**Mitigation Strategy:** Anonymized metadata-shape-only fixtures; no committed raw customer files;
extend the CI golden PII/secret + ORGNR scan to file-metadata fixtures and any committed file/text
artifact.
**Owner:** Dev (8.1/8.2) · **Timeline:** Stories 8.1, 8.2 · **Status:** Planned
**Verification:** PII/secret scan green over all file fixtures/artifacts; a committed real PII/raw file
is an epic blocker regardless of score.

---

## Assumptions and Dependencies

### Assumptions

1. Supabase Storage RLS on `storage.objects` + server-derived tenant path prefixes can isolate tenants
   as strictly as Postgres RLS (architecture §6 basis; validated by the new storage-negative matrix).
2. The signed-URL TTL is environment-configurable (low in test env) so expiry is testable without
   waiting (epics.md 8.1 H2 / architecture §6).
3. Under the 2026-07-03 demo-data-only decision, conservative dev MIME/size defaults are acceptable for
   the MVP; final owner-approved policy is a post-MVP Sign-Off residual (R-817), not a current blocker.
4. `file_links` link creation for an owner type activates only once that owner table exists — 8.1's
   ownership-validation *mechanism* is testable now against existing owner types (customer/facility/
   contact) and a synthetic own-tenant record; quote_version/quote_acceptance/job links activate with
   Epics 6/7.
5. The existing two-runner + Playwright + two-tenant harness extends cleanly to storage suites once the
   local Storage service is running and a storage-reachability probe is added.

### Dependencies

1. **Epics 1-2** (isolation harness, command envelope, audit, two-tenant fixture) — required by 8.1.
2. **Local Supabase Storage service** running in the test stack — required by all storage-negative
   suites (new beyond the DB stack).
3. **Story 8.1** — hard dependency for Epic 6 (6.1 attachment metadata, 6.3 PDF storage) AND for all
   Wave-2 stories (8.2-8.5). Sequenced Wave-1-before-Epic-6 (sprint-status 2026-07-03).
4. **Epics 3/5** (owner entities for uploads) — required by 8.2 concrete scenarios.
5. **Epic 6** (sent quote_versions/PDF) and **Epic 7** (accepted quote_acceptances/evidence) — required
   by 8.4's concrete lock matrix; 8.4 cross-references, does not re-invent, those lifecycles.

### Risks to Plan

- **Risk**: 8.4's lock scenarios are detailed before Epic 6/7 lifecycles are frozen, forking the rule table.
  - **Impact**: Divergent lock behavior between the file link (8.4) and the snapshot/acceptance (Epic 6/7).
  - **Contingency**: Keep 8.4 at planning depth here; re-confirm the exact lock matrix at 8.4 create-story
    against the frozen Epic 6 sent-state and Epic 7 accepted-state; assert AGREEMENT with R-605/Epic 7.
- **Risk**: 8.1 slips, pressuring Epic 6 to invent a local file model (R-814).
  - **Impact**: A competing file/storage model violates the single-model contract.
  - **Contingency**: Confirm 8.1 lands green before any Epic 6 file-touching story; 6.3 must NOT create
    its own model (STOP); the single-model contract is the reviewer checkpoint.
- **Risk**: Storage service not running locally → storage suites silently skip (false-green).
  - **Impact**: Isolation gap ships undetected.
  - **Contingency**: Storage-reachability probe + `SUPABASE_TEST_REQUIRED=1` hard-fail in CI; skip-clean
    only locally, never in CI.

---

## Follow-on Workflows (Manual)

- Run `*atdd` to generate failing P0 tests for 8.1 (storage negatives + signing funnel) — separate
  workflow, not auto-run.
- Run `*automate` for broader coverage once 8.1 implementation exists.
- Run `*trace` + `*nfr` at the Epic 8 boundary (after Wave 2) for the release gate decision.

---

## Approval

**Test Design Approved By:**

- [ ] Product Manager: {name} Date: {date}
- [ ] Tech Lead: {name} Date: {date}
- [ ] QA Lead: {name} Date: {date}

**Comments:** Wave-2 (8.2-8.5) scenarios are intentionally at planning depth pending Epics 6-7; re-confirm
at each create-story. 8.1 is fully implementable now and is the keystone dependency for Epic 6.

---

## Interworking & Regression

| Service/Component | Impact | Regression Scope |
| --- | --- | --- |
| **`TENANT_TABLES` inventory + H4 gate** | Two new tenant tables enroll | `rls-inventory-gate.int.test.ts`, `cross-tenant-isolation.rls.test.ts`, `anon-path-isolation.rls.test.ts` must stay green with `files`/`file_links` added |
| **Server command envelope + `verifyOwnership`** | New file commands reuse it | `envelope-*.int.test.ts`, `server-error-vs-no-access.int.test.ts` — generic-error / no-existence-disclosure discipline preserved |
| **`audit_events` (append-only)** | File events written through it | `audit-append-only.int.test.ts`, `audit-metadata-hygiene-e2e.int.test.ts` — no raw file content/path/PII in metadata |
| **Migration-reset suite** | New migration in the chain | `migration-reset.int.test.ts` + the per-table policy enumeration must include `files`/`file_links` |
| **Epic 6 quote PDF / attachment (6.1, 6.3)** | Consume 8.1 file model | 6.3 PDF stored through 8.1 (private, server-derived, signed access); 6.1 attachment metadata reuses `files`/`file_links` — no competing model (R-814); their tests cross-reference 8.1's storage negatives |
| **Epic 7 acceptance evidence** | 8.4 locks accepted evidence | 8.4 lock behavior must AGREE with Epic 7 accepted-state immutability (cross-ref) |
| **Service-role containment guards** | File paths stay anon+RLS | `verify:service-role-containment` + `verify:bundle-containment` stay green — no service-role key on client file paths |

---

## Appendix

### Knowledge Base References

- `risk-governance.md` — Risk classification + gate decision rules
- `probability-impact.md` — P×I scoring methodology (thresholds: 1-3 DOCUMENT, 4-5 MONITOR, 6-8 MITIGATE, 9 BLOCK)
- `test-levels-framework.md` — UNIT / INT / RLS / STORAGE-NEG / E2E / GOLDEN / DOCS selection
- `test-priorities-matrix.md` — P0-P3 prioritization + execution ordering

### Related Documents

- PRD: `_bmad-output/planning-artifacts/prd.md` (required-files FRs)
- Epic: `_bmad-output/planning-artifacts/epics.md` (Epic 8, lines 1556-1753)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (ADR-A006 entity-scoped private file model; ADR-A009 narrow RPC; §5 command registry; §6 Storage strategy; §14 File And Storage Model; §15 audit)
- Dependent design: `_bmad-output/test-artifacts/test-design-epic-6.md` (6.1/6.3 consume 8.1; Entry Criteria)
- Sequencing: `_bmad-output/implementation-artifacts/sprint-status.yaml` (8.1 Wave-1 before Epic 6; 8.2-8.5 Wave-2)
- Project context: `_bmad-output/project-context.md` (Testing Rules; Security Regression Harness Rules; RLS-by-default + GRANTs; golden PII scan; demo-data-only decision)

---

**Generated by**: BMad TEA Agent - Test Architect Module
**Workflow**: `bmad-testarch-test-design`
**Version**: 4.0 (BMad v6) · Epic-Level (Phase 4)
