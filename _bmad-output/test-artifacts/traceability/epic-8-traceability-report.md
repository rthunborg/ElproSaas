---
stepsCompleted:
  - step-01-load-context
  - step-02-discover-tests
  - step-03-map-criteria
  - step-04-analyze-gaps
  - step-05-gate-decision
lastStep: step-05-gate-decision
lastSaved: '2026-07-07'
workflowType: testarch-trace
gateType: epic
epicNum: 8
decisionMode: deterministic
coverageBasis: acceptance_criteria
oracleConfidence: high
oracleResolutionMode: formal_requirements
externalPointerStatus: not_used
tempCoverageMatrixPath: 'scratchpad/tea-trace-coverage-matrix-epic8.json'
inputDocuments:
  - _bmad-output/test-artifacts/test-design-epic-8.md (revision 2, 21 risks R-801..R-822; 11 high-priority ≥6; 5 non-negotiable epic controls; two-wave P0-P3 coverage plan; 8.1 SHIPPED baseline + Wave-2 OPEN rows)
  - _bmad-output/planning-artifacts/epics.md (Epic 8, Stories 8.1-8.5, lines 1556-1753; required-files FRs)
  - _bmad-output/implementation-artifacts/8-1..8-5 story files (8.1 done; 8.2/8.3/8.4/8.5 review; 26 ACs across 5 stories; all tasks [x]; Review Findings all resolved/dispositioned)
  - _bmad-output/implementation-artifacts/sprint-status.yaml (epic-8 in-progress; 8-1 done; 8-2..8-5 review; last_updated 2026-07-07)
  - supabase/migrations/20260704120000_file_storage_foundation.sql (files/file_links + storage.objects RLS + composite same-tenant FKs + private tenant-files bucket + create_file_with_link/link_existing_file RPCs)
  - supabase/migrations/20260712120000_file_link_lock.sql (8.4 two-layer lock — FL823 → FILE_LINK_LOCKED; enforce_file_link_lock/enforce_file_lock + apply_file_link_lock/apply_lock_on_quote_version_transition/apply_lock_on_acceptance_insert; joins the frozen QV409/AR704 family, additive: NO new table/column/policy)
  - supabase/migrations/20260707120000_quote_version_sent_lock.sql (QV409), 20260711120000_accepted_record_lock.sql (AR704) — the frozen parent locks 8.4 AGREES with
  - tests/integration/rls/tenant-table-inventory.ts (TENANT_TABLES — files/file_links enrolled + H4 inventory gate)
  - tests/integration/rls/{file-tables-migration-reset,storage-object-isolation,file-index-isolation,file-link-lock}.* + rls-inventory-gate.int.test.ts
  - tests/integration/commands/{file-signed-access,file-signed-access-refresh,file-link-ownership,file-upload,file-link-lock,file-audit-events,generate-quote-pdf-storage-privacy}.int.test.ts
  - tests/unit/{server/storage/{object-path,upload-policy,upload-object,upload-error-classifier},server/commands/files/{validate-upload-file,validate-archive-file,file-write-error-mapping},server/commands/file-validation,features/files/{file-index,file-lock-predicate,file-lock-lifecycle-golden,signed-access-state,upload-action-state,upload-form-parsing,archive-action-state},components/files/entity-file-panel-owner-type,guardrails/file-index-non-scope}.test.ts
  - tests/e2e/files/{entity-file-panel,entity-file-preview,file-lock-panel,file-index-scope}.e2e.spec.ts
  - src/server/{storage/**,commands/files/**,commands/command-errors.ts}, src/features/files/**, src/components/files/**
  - recorded suite state (story debug logs + automation-summary-8-5): 8.4 run = 1203 unit + 693 INT = 1896 pass / 0 skipped; 8.5 = 1237 unit (+15) / 0 fail, INT/RLS re-verified 8 pass; E2E 6 pass + 1 test.fixme (8.3-E2E-04) + lock-panel/index-scope E2E un-skipped green
---

# Traceability Report — Epic 8: Required Files And Private Storage

**Date:** 2026-07-07
**Author:** Rasmus (via BMad TEA — Master Test Architect)
**Gate Type:** Epic-level (Phase 4, epic boundary)
**Decision Mode:** Deterministic (rule-based: P0 100% required / P1 ≥90% PASS · 80–89% CONCERNS / overall ≥80%)
**Coverage Oracle:** formal requirements (Epic 8's 26 story acceptance criteria across Stories 8.1-8.5 +
the 21-risk / 5-control Epic 8 test design's two-wave P0-P3 coverage plan) — **high confidence**
(formal, non-synthetic; active in-source test cases verified against the real migrations, the
`TENANT_TABLES` RLS inventory, the two-layer lock trigger + command code, the signing funnel, and the
test source — not merely the story records).

---

## Gate Decision: PASS

**Rationale:** P0 coverage is **100%** (16/16 epic P0 acceptance criteria) and P1 coverage is **100%**
(10/10), so overall coverage is **100%** (26/26 mapped ACs FULL) — above every deterministic threshold
(P0 100% required, P1 ≥90% PASS target, overall ≥80%). All eleven high-priority Epic 8 risks (score ≥6:
R-801..R-809, R-812, R-819) are mitigated and proven by real, in-source, active tests, and **every one of
the five Non-Negotiable epic controls** in the Epic 8 test design is met and verified against the actual
migrations, the RLS inventory, the RPC/trigger definitions, and the test source:

1. **`files`/`file_links` have direct `tenant_id` + enable+force RLS + own-tenant `is_tenant_admin`
   policies + `anon → none` + composite same-tenant FK, and are ENROLLED in `TENANT_TABLES`** — R-801.
   Verified: `20260704120000_file_storage_foundation.sql`; `tenant-table-inventory.ts` enrolls both;
   the H4 gate (`rls-inventory-gate.int.test.ts`) fails CI on any unenrolled tenant table by design;
   `file-tables-migration-reset.int.test.ts` proves per-table policy/GRANT enumeration and (upgraded
   from a 3-literal denylist to an **allowlist**) asserts `public` gained ONLY `files`/`file_links` — a
   deferred-module index table under ANY name is caught (AC1 no-broad-index guardrail).
2. **No public bucket / no client-controlled storage path** — R-803. Verified: `tenant-files`
   `public=false` in BOTH `config.toml` and the migration; `deriveObjectPath` is tenant-first,
   NFC-normalized, traversal- and surrogate-sanitized (`object-path.test.ts`); the storage-plane
   spoof negatives are green (`storage-object-isolation.rls.test.ts`).
3. **A cross-tenant/anon/spoof/expired signed-URL, list, or read is rejected with a generic user-safe
   error** — R-804/R-805/R-806/R-809. Verified: `createSignedFileAccess` runs metadata-first on the
   anon-key RLS client (NO service-role); `file-signed-access.int.test.ts` covers anon / cross-tenant /
   wrong-lifecycle / expired (low test TTL); `storage-object-isolation.rls.test.ts` covers cross-tenant
   list/read/sign + path spoof + anon; identical `TENANT_ACCESS_DENIED`/`FILE_ACCESS_DENIED` shape for
   not-found vs forbidden (no existence disclosure).
4. **Sent/accepted commitment files are immutable at BOTH the command AND the DB layer, joining the
   frozen QV409/AR704 family, and locked-file deletion is archive-only** — R-812/R-822/R-813. Verified:
   `20260712120000_file_link_lock.sql` lands `enforce_file_link_lock` + `enforce_file_lock` (custom
   SQLSTATE `FL823` → command `FILE_LINK_LOCKED`) plus three parent-state-keyed lock-apply triggers;
   the shape mirrors `QV409`/`AR704` verbatim (fail-closed exempt-then-tuple, SECURITY INVOKER, empty
   `search_path`, schema-qualified) — the family is joined, NOT forked. `file-link-lock.int.test.ts` +
   `file-link-lock.rls.test.ts` prove mutation/delete rejected via command AND direct own-tenant SQL,
   the sent-PDF/attachment lock AGREES with `QV409`, the accepted-evidence lock AGREES with `AR704`,
   and `archiveFile` converts a locked-file delete to archive-only with a single clean `file.archived`
   audit row (`file-audit-events.int.test.ts`).
5. **Fixture privacy is enforced by the CI PII/secret + ORGNR scan over the file fixtures/artifacts,
   and no raw customer file is committed** — R-819. Verified: the 4.4 anonymization scan is extended
   over the 8.1 file-metadata fixtures + the `generate-quote-pdf-storage-privacy` artifacts;
   file-metadata fixtures carry shape only; an epic blocker regardless of numeric score.

**Recorded suite state (from the Epic 8 story debug logs + `automation-summary-8-5`):** the last full
run recorded (Story 8.4) was **1203 unit + 693 integration = 1896 pass / 0 skipped**; Story 8.5 then
added **+15 unit tests → 1237 unit / 0 fail** with the `file-audit-events` + `file-index-isolation`
INT/RLS suites re-verified **8 pass** live under `SUPABASE_TEST_REQUIRED=1`; E2E `tests/e2e/files/`
runs **6 pass + 1 `test.fixme`** (`8.3-E2E-04`, dispositioned below), with the previously red-phase
`file-lock-panel.e2e.spec.ts` and `file-index-scope.e2e.spec.ts` now **un-skipped and green**. A grep of
the entire Epic-8 test surface for active `test.skip`/`describe.skip`/`.only` call sites returns **only
the single `8.3-E2E-04` `test.fixme`** — every other Wave-2 red-phase ATDD scaffold has been flipped to
an active, executing test. All five stories are at `Status: review` (8.1 `done`) with every task `[x]`,
and every recorded Review Finding is resolved or explicitly dispositioned (dismiss/defer).

---

## Coverage Summary

- **Total mapped requirement groups:** 26 (all story ACs — 8.1×8, 8.2×5, 8.3×3, 8.4×5, 8.5×5)
- **Fully covered (FULL):** 26 (100%)
- **Partial / Unit-only / None:** 0
- **P0 coverage:** 16/16 = **100%** (required: 100%) → MET
- **P1 coverage:** 10/10 = **100%** (PASS target: ≥90%) → MET
- **Overall coverage:** 26/26 = **100%** (minimum: 80%) → MET

**Wave-1-vs-Wave-2 reconciliation:** the Epic 8 test design tracked 8.1 (Wave 1) as SHIPPED and 8.2-8.5
(Wave 2) as OPEN. This trace confirms **every OPEN Wave-2 row is now closed by an active in-source
test** — the upload validation gate (R-808), storage↔DB compensation (R-807 storage side), the
expiry→refresh authorization loop (R-806, INT/unit teeth), metadata-first UX ordering (R-810), the
two-layer lock trigger + family agreement (R-812/R-822), archive/audit consistency (R-813), the limited
file-index scope guardrail (R-816), and file audit events (§15) all landed. No P0/P1 requirement is
uncovered; no competing file/storage model appeared (R-814 held — 8.2 upload, 8.3 preview, 8.4 lock, and
8.5 index all EXTEND the single 8.1 `files`/`file_links` model).

---

## Traceability Matrix (AC → Tests)

Coverage status: **FULL** = requirement proven by at least one active, in-source test at an appropriate
level; source references verified against migrations / RLS inventory / RPC-trigger defs / test source.

### Story 8.1 — File Storage Foundation (Status: done)

| AC | Requirement | Priority | Tests | Coverage |
| --- | --- | --- | --- | --- |
| 8.1-AC1 | Migration-reset schema (`files`/`file_links` tenant-owned; no broad file-index table) | P0 | file-tables-migration-reset.int (per-table policy/GRANT enum + allowlist no-broad-index guardrail) | FULL |
| 8.1-AC2 | Cross-tenant DB isolation (read/link/update/archive/delete rejected, generic) | P0 | shared cross-tenant + anon-path RLS via `TENANT_TABLES`; file-link-ownership.int | FULL |
| 8.1-AC3 | Link ownership validation both-side (foreign file id AND foreign owner id rejected) | P0 | file-link-ownership.int (`describe.each` over all 4 active owner types; pinned `TENANT_ACCESS_DENIED`) | FULL |
| 8.1-AC4 | Private storage config + server-derived paths (no public bucket / no client path) | P0 | migration-reset private-bucket construction; object-path.test | FULL |
| 8.1-AC5 | Signed-access funnel — metadata-first; anon/cross-tenant/spoof rejected generic | P0 | file-signed-access.int (anon/cross-tenant/lifecycle/expired matrix) | FULL |
| 8.1-AC6 | Storage-plane negatives — cross-tenant list/read/sign + path spoof + expired URL | P0 | storage-object-isolation.rls (list/read/sign/spoof/anon/low-TTL expiry) | FULL |
| 8.1-AC7 | Atomicity — atomic metadata+link RPC rolls back on injected fault (no orphans) | P0 | file-link-ownership.int (`create_file_with_link` rollback) | FULL |
| 8.1-AC8 | Enrollment (H4 gate) + audit with allow-listed metadata (no secrets/PII/path) | P0 | rls-inventory-gate H4; positive allow-list audit no-leak; PII/secret scan | FULL |

### Story 8.2 — Validated Upload + Entity File Panels (Status: review)

| AC | Requirement | Priority | Tests | Coverage |
| --- | --- | --- | --- | --- |
| 8.2-AC1 | Entity file panel shows types/size/owner/purpose; no raw path field | P1 | 8.2-E2E-01 (entity-file-panel); 8.2-UNIT no-raw-path; EntityFilePanel owner-type compile pin | FULL |
| 8.2-AC2 | Server-side upload validation gate (MIME/size/owner/purpose/lifecycle; client-bypassed) | P0 | 8.2-INT-02 (blocked-MIME + oversized reject with client bypassed); validate-upload-file; upload-policy units | FULL |
| 8.2-AC3 | Four distinct user-safe error states + no existence disclosure | P1 | 8.2-UNIT (classifyUploadError all branches); 8.2-INT (R-809 generic PERMISSION); 8.2-E2E error regions | FULL |
| 8.2-AC4 | Storage↔DB compensation — no orphan on storage-success/DB-failure | P1 | 8.2-INT-05 (compensation: no usable files/file_links row survives); upload-object.test | FULL |
| 8.2-AC5 | File becomes attachable — `lifecycle_state='linked'` + own-tenant `file_links`; no competing model | P0 | 8.2-INT (linked + link bound + own-tenant list); reuses 8.1 model (R-814) | FULL |

### Story 8.3 — Tenant-Authorized Signed File Access (Status: review)

| AC | Requirement | Priority | Tests | Coverage |
| --- | --- | --- | --- | --- |
| 8.3-AC1 | Metadata-first funnel before any signed URL; UI never renders raw bucket/path | P0 | file-signed-access.int (ownership before sign); 8.3-INT-01; no-raw-path E2E + signed-access-state units | FULL |
| 8.3-AC2 | Expiry→refresh re-runs FULL auth (not a bare re-sign); lifecycle-changed file NOT re-signed | P1 | 8.3-INT-01a (archive-then-retry → `FILE_ACCESS_DENIED`); signed-access-state (`isSignedUrlExpired`/`shouldReauthorize` every branch) | FULL |
| 8.3-AC3 | Full storage negative matrix — cross-tenant sign/list/read/spoof/anon/expired generic | P0 | storage-object-isolation.rls; file-signed-access.int (generic not-found=forbidden, no existence disclosure) | FULL |

### Story 8.4 — Quote/PDF/Attachment/Acceptance-Evidence Locks (Status: review)

| AC | Requirement | Priority | Tests | Coverage |
| --- | --- | --- | --- | --- |
| 8.4-AC1 | Sent-version PDF/attachment link LOCKED; replace/mutate/delete blocked BOTH layers; AGREES with QV409 | P0 | 8.4-INT-01 (sent lock apply); file-link-lock.rls (`FL823` direct UPDATE/DELETE reject); QV409 agreement | FULL |
| 8.4-AC2 | Accepted evidence link LOCKED; mutation/delete rejected command+DB; AGREES with AR704 | P0 | 8.4-INT-02 (post-accept evidence lock); `FL823`/`FILE_LINK_LOCKED`; AR704 agreement | FULL |
| 8.4-AC3 | Locked-file delete is archive-only + one full `file.archived` audit event (§15-clean) | P0 | 8.4-INT (archive-only-on-delete); file-audit-events.int (exactly one clean row) | FULL |
| 8.4-AC4 | Partial-lock/broken archive leaves consistent retryable state (atomic/compensated) | P1 | 8.4-RLS-04 (rejected write leaves row byte-unchanged = atomic-by-construction, BEFORE trigger in the triggering txn) | FULL |
| 8.4-AC5 | Cross-tenant locked-file attacks denied generic; `FL823` RAISE never leaks target detail | P0 | file-link-lock.rls (cross-tenant lock/mutate/archive/delete → `TENANT_ACCESS_DENIED`; generic RAISE) | FULL |

### Story 8.5 — Limited File Index + File Audit (Status: review)

| AC | Requirement | Priority | Tests | Coverage |
| --- | --- | --- | --- | --- |
| 8.5-AC1 | Limited `/files` index — ONLY Phase A owner-type files, tenant-scoped, no document-center; no raw path | P1 | 8.5-UNIT-01 (owner-category map/filter/deny-list); 8.5-E2E-01 (index scope guardrail); file-index-non-scope source guardrail | FULL |
| 8.5-AC2 | Every file lifecycle event = tenant-scoped `audit_events` with safe metadata; closed §15 set | P1 | 8.5-INT-01 (exactly one `file.archived` clean `{targetId,reason?}`; idempotent re-archive none; §15 four-event set) | FULL |
| 8.5-AC3 | Index search/filter strictly own-tenant; RLS proves tenant B metadata invisible | P0 | 8.5-RLS-01/02/03/04 (file-index-isolation: own-tenant set + concrete B-absence; cross-owner-id zero rows; archived drop; real injectable read) | FULL |
| 8.5-AC4 | Panel lock-notice + archive-only; replace/delete never render on a locked file; lock is command+DB not UI-only | P1 | 8.4-E2E-01 (file-lock-panel un-skipped + green: notice + archive-only + no replace/delete); file-lock-predicate units | FULL |
| 8.5-AC5 | Cross-tenant/crafted index+archive denied generic; locked hard-delete → `FILE_LINK_LOCKED` | P1 | 8.5-INT (cross-tenant archive/preview → `TENANT_ACCESS_DENIED`); classifyArchiveError units (R-809) | FULL |

---

## Gaps & Non-Gating Items

**No P0 or P1 acceptance criterion is uncovered.** The following recorded items are each dispositioned;
none gates:

| Item | Priority | Disposition |
| --- | --- | --- |
| `8.3-E2E-04` expiry→refresh end-to-end (`test.fixme`) | P1 (AC2) | **Non-gating (defer/low)** — the AC2 authorization TEETH (a lifecycle-changed file is NOT re-signed on retry) are proven at the INT layer (`8.3-INT-01a` archive-then-retry → `FILE_ACCESS_DENIED`) and the client expiry verdict is fully unit-covered (`isSignedUrlExpired`/`shouldReauthorize`, every branch). Only the CLIENT wiring (timer flip → re-open control → re-submit) is unproven end-to-end; it needs a low-TTL E2E env or a deterministic clock seam. AC2 remains FULL via INT+unit. |
| `8.4-INT-05` "atomic" test injects no fault (over-titled) | P1 (AC4) | **Non-gating (documentation)** — the genuine atomicity proof exists (`8.4-RLS-04`: a rejected write leaves the row byte-unchanged, and the lock-apply is a pure BEFORE trigger in the triggering write's own txn = atomic-by-construction). The flagged test proves lock PRECISION, not fault-injection rollback; the reviewer recommendation is a rename + citation, not new coverage. AC4 remains FULL. |
| `8.4-E2E` (`file-lock-panel`) was `test.skip` in 8.4 | P1 (AC4) | **Closed** — Story 8.5 un-skipped it (fixture seed added to `global-setup.ts`); it is now active and green. Recorded here because it was an open 8.4 deferral that 8.5 explicitly landed. |
| `8.4-AC3` `archiveFileLink` / `target_type='file_link'` audit target not implemented | P0 (AC3) | **Non-gating (dismissed at review)** — AC3 uses a `file_link`/`file` disjunction; only `archiveFile` (`target_type='file'`) ships and a locked file's links cascade on the file archive. No un-archivable locked link is reachable; the deviation is documented. AC3 remains FULL via the file-level archive + audit. |

**Owner-gated residuals (not test gaps, restated per Exit Criteria):**

- **R-817** (final MIME allow-list + size limits) — conservative dev defaults (`upload-policy.ts`:
  pdf/png/jpeg/webp/gif/txt/csv/doc(x)/xls(x), 25 MiB) are pinned by unit tests; the exact real-pilot
  policy + byte-level content sniffing is an owner Sign-Off residual, acceptable under the demo-data-only
  decision (2026-07-03). The MIME check is against the client-declared `File.type` gated by a fail-closed
  allow-list that excludes all active-content types; the security review cleared the exploit path (0
  HIGH/MED/LOW). Re-open on any move to real-customer files.
- **R-818** (locked-evidence retention / hard-delete) — archive-only is the Phase A default; a
  hard-delete retention rule needs legal sign-off. Not built (a STOP), documented.
- **R-822** family follow-up — the `archiveFile(hardDelete:true)` code returns `FILE_LINK_LOCKED` even
  for an UNLOCKED file (a crafted-request-only surface with no UI affordance; functionally safe,
  archive-over-delete preserved). A future refinement surfaces a distinct code; not a coverage gap.

**Standing NFR carry (R-821):** the coverage reporter (`c8` over `test:unit`, report-only) remains the
single LOW standing residual carried since Epic 2 — a dated calendar item, not test effort. Restated so
it is not a silent carry. The `pnpm audit --audit-level=high` half of the standing NFR was resolved in
Epic 6.

---

## Next Actions

1. **PASS — proceed.** No remediation is required to clear the epic-boundary traceability gate; all P0
   and P1 acceptance criteria are FULLY covered by active, in-source, verified-green tests, and all five
   non-negotiable epic controls are met.
2. **(LOW, post-merge, optional)** Land the `8.3-E2E-04` expiry→refresh end-to-end once a low-TTL E2E env
   or a deterministic clock seam exists; rename the over-titled `8.4-INT-05` to "lock precision" and cite
   `8.4-RLS-04` as the atomic-by-construction proof. Neither gates.
3. **(LOW, calendar)** Keep the standing NFR carry (R-821 coverage reporter) dated in the retro/backlog
   rather than silently carried.
4. **(Owner)** Re-confirm the R-817 upload policy (MIME allow-list / size / byte-sniffing) and R-818
   locked-evidence retention residuals at any move away from demo-data-only; both are documented, not
   silent. The immutability model AGREES across Epic 6 (sent-version freeze, QV409), Epic 7 (accepted
   record lock, AR704), and now Epic 8.4 (locked evidence/PDF/attachment file link, FL823) — the family
   is joined, not forked.

---

## Gate Decision Summary

- **Decision:** PASS
- **P0 Coverage:** 100% (16/16) — Required 100% → MET
- **P1 Coverage:** 100% (10/10) — PASS target ≥90% → MET
- **Overall Coverage:** 100% (26/26) — Minimum 80% → MET
- **High-priority risks (≥6):** 11/11 mitigated and proven by active tests (R-801..R-809, R-812, R-819)
- **Non-negotiable epic controls:** 5/5 met and verified (two-plane isolation + enrollment; private
  bucket / server-derived path; signing-funnel negative matrix; two-layer lock joining QV409/AR704 +
  archive-only; fixture PII scan)
- **Critical gaps:** 0
- **Decision date:** 2026-07-07

✅ GATE: PASS — the Epic 8 required-files-and-private-storage epic meets the epic-boundary traceability
standard; coverage is complete across two-plane isolation (DB + `storage.objects`), private-by-default
storage with server-derived paths, the metadata-first signing funnel, upload validation +
storage↔DB compensation, the two-layer lifecycle lock joining the QV409/AR704 family, archive-only
deletion + file audit events, the limited-index scope guardrail, and fixture privacy.
