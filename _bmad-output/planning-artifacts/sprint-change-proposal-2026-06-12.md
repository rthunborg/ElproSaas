---
date: 2026-06-12
project: ElproSaas
workflow: correct-course
mode: planning-correction-only
trigger: test-design-architecture.md (2026-06-11) - blockers B1-B3, recommendations H1-H5, Epic 8 sequencing confirmation
scope_classification: Minor (docs-only planning edit)
status: approved-and-applied
approved_by: Rasmus (pre-approved mandate in correction request)
applied: 2026-06-12
constraints:
  - no code implementation
  - no migrations
  - no new dependencies
  - no .env changes
  - no network commands
  - no deferred-scope activation
---

# Sprint Change Proposal - Test Design Blockers Into Planning Artifacts

## Section 1: Issue Summary

**Problem statement:** The system-level test design (2026-06-11) identified three pre-implementation blockers (B1 test-data factory/seeding contract, B2 test-user auth method, B3 transaction mechanism) and five recommendations (H1 time discipline, H2 signed-URL TTL, H3 PDF determinism, H4 RLS table-inventory gate, H5 per-worker tenant isolation) that existed only in test artifacts, not in the planning artifacts that sprint planning and story implementation consume. Left unfixed, the first implementation stories would start without a factory contract, an automatable auth method, or a pinned transaction mechanism — exactly the gaps the test design flagged as blocking test development.

**Discovery:** TEA `testarch-test-design` run, documented in `_bmad-output/test-artifacts/test-design-architecture.md` (Quick Guide: 3 blockers, 5 recommendations) and `test-design-qa.md` (Dependencies & Test Blockers).

**Evidence:** Before this correction, grep over planning artifacts found zero occurrences of factory/per-worker/password/injectable-clock/TTL/inventory-gate decisions. AR21 still listed three alternative transaction mechanisms ("a narrow Postgres RPC, a direct server DB transaction adapter, or an approved ADR"), and Stories 6.4/6.5 carried the "or approved transaction adapter" hedge.

## Section 2: Impact Analysis

**Epic impact:** No epic added, removed, renumbered, or resequenced. Story count unchanged (41). Edits are confined to Additional Requirements (AR21, AR23), story Technical Notes and Test Requirements (1.2, 2.1, 2.2, 2.3, 6.3, 6.4, 6.5, 7.2, 8.1), and one new acceptance-criteria block (Story 2.4, the H4 CI gate — a genuinely new verifiable behavior).

**Epic 8 sequencing (required correction #9):** Already resolved by the approved sprint-change-proposal-2026-06-11 (Story 8.1 file-foundation wave before Epics 5-6; Story 6.3 reuses the foundation, no competing model). **Verified intact and explicitly preserved** — no further edits needed; this proposal builds on it (8.1 atomic operations now reference ADR-A009).

**Artifact conflicts:**

- **PRD:** None. No FR/NFR text touched. All nine corrections are test-infrastructure and mechanism decisions already compatible with NFR35-41.
- **Architecture:** Extended, not conflicted. New ADR-A009 resolves the AR21 open choice the architecture itself left open (§24 deliberately excluded it; AR22's security-definer rules are incorporated into ADR-A009 unchanged).
- **UX:** None. No UX-DR is affected; no UX edits made.
- **Test design docs:** Become consistent with planning — B1-B3/H1-H5 now have planning-artifact homes, which closes the "wait for blockers" entry criteria in test-design-qa.md at the planning level.
- **Sprint status:** N/A — sprint planning has not run; no sprint-status.yaml exists.

**Technical impact:** Docs-only. No code, migrations, dependencies, `.env`, network, or deferred scope. Security guardrails strengthened: the H4 inventory gate makes the existing "cross-tenant negative tests required" rule structurally enforced rather than reviewer-dependent.

## Section 3: Recommended Approach

**Direct Adjustment** (Option 1) — applied. Targeted edits to architecture.md (4) and epics.md (11) within the existing structure.

- **Rationale:** Pre-code is the cheapest moment to pin these decisions; every one of them was already the recommended option in the test design and consistent with existing guardrails. Rollback and MVP review are non-applicable (nothing implemented, scope untouched).
- **Effort:** Low — 15 targeted edits. **Risk:** Low — additive decisions, no scope movement. **Timeline impact:** None; prevents a blocked start of E1/E2 test work.

## Section 4: Detailed Change Proposals (applied)

### Architecture changes (`_bmad-output/planning-artifacts/architecture.md`) — 4 edits

1. **New ADR-A009 (after ADR-A008): Narrow Postgres RPC For Transaction-Sensitive Commands** — resolves B3. RPCs for at least `createQuoteVersionFromCalculation`, `markQuoteVersionSent`, `acceptQuoteAndCreateJob` (and Story 8.1 atomic metadata+link). Server command: auth/session/membership/input validation. RPC: row locks, uniqueness, multi-row persistence, event/audit writes, rollback. `SECURITY INVOKER` default; `SECURITY DEFINER` requires separate approval, fixed `search_path`, explicit membership checks, negative tests.
2. **§5 command pattern** — step 6 now references ADR-A009; new **Time discipline** paragraph (H1): single command timestamp (injectable clock or DB `now()` captured once), RPCs accept explicit timestamp parameters, tests must not rely on sleeps.
3. **§6 Storage** — signed-URL TTL is environment-configurable; low TTL allowed in test environments (H2).
4. **§18 Test Strategy** — new **Test Infrastructure Decisions** subsection: B1 (test-only factories for tenants/users/memberships/CRM/calculations/quotes/files; seed.sql minimal deterministic baseline only), H5 (per-worker tenant pairs, no shared mutable fixtures), local-Supabase-only for automated tests, B2 (password/admin-created test users, no magic-link automation, test-only keys never in app/client code), H4 (RLS table-inventory CI gate).

### Epics changes (`_bmad-output/planning-artifacts/epics.md`) — 11 edits

| # | Location | Change | Correction |
| --- | --- | --- | --- |
| 1 | AR21 | OLD: three alternative mechanisms. NEW: pinned to narrow Postgres RPC per ADR-A009 with command/RPC responsibility split and named commands | B3 |
| 2 | AR23 | Added environment-configurable TTL (low TTL in test envs) to signed-URL requirement | H2 |
| 3 | Story 1.2 Tech Notes + Test Reqs | Local-Supabase-only rule for automated tests; seed.sql = minimal deterministic baseline; factories (2.2) own business test data | B1 |
| 4 | Story 2.1 Tech Notes + Test Reqs | B2 auth method: password-based or local admin-created test users; no magic-link-only automation; test-setup keys test-only and never in app/client code, with containment check | B2 |
| 5 | Story 2.2 Tech Notes + Test Reqs | B1 factory contract (tenants, auth users, memberships; extensible to CRM/calcs/quotes/files); H5 per-worker tenant pairs; RLS suite runs on factory-created pairs | B1, H5 |
| 6 | Story 2.3 Tech Notes + Test Reqs | H1 single command timestamp / injectable clock in the envelope; RPC timestamp parameters; no sleep-based tests | H1 |
| 7 | Story 2.4 **new AC block** + Tech Notes + Test Reqs | H4 inventory gate: CI compares tenant-owned tables vs RLS-suite enrollment and fails on gaps; data-driven suite; scratch-branch gate verification | H4 |
| 8 | Story 6.3 Tech Notes + Test Reqs | H3 determinism: pinned renderer version, embedded/pinned fonts, stable locale formatting, injected render timestamp; text extraction primary / visual snapshot secondary; repeated-render stability test | H3 |
| 9 | Story 6.4 Tech Notes | Hedge removed — pinned to narrow RPC per ADR-A009 with explicit sent-timestamp parameter | B3, H1 |
| 10 | Story 6.5 Tech Notes | Hedge removed — reuses Story 6.1 RPC pattern per ADR-A009 | B3 |
| 11 | Story 7.2 Tech Notes; Story 8.1 Tech Notes + Test Reqs | 7.2: ADR-A009 reference + explicit `accepted_at`/command timestamp parameters. 8.1: atomic ops per ADR-A009; H2 configurable TTL + expired-URL test with low test TTL | B3, H1, H2 |

## Section 5: FR Coverage Confirmation

**FR coverage remains 100% and unchanged.** No FR was added, removed, reworded, or remapped; the FR Coverage Map (FR1-FR61) in epics.md is untouched. All edits are Technical Notes, Test Requirements, two Additional Requirements rewordings (AR21/AR23), and one additive acceptance-criteria block (Story 2.4) that adds a verification behavior without changing any FR's home.

**Scope boundaries preserved:** Phase A only. No Fortnox, supplier APIs, AI jobs, field-worker UX, HR/rentals/assets/DoU/tender/FKU, full RBAC, or public privileged endpoints introduced. All explicit deferred scope intact. Security guardrails (service-role containment, RLS mandates, private storage, no-secrets) strengthened, not relaxed.

## Section 6: Implementation Handoff

- **Scope classification:** Minor — docs-only planning edits, applied in this session under the pre-approved mandate.
- **Files changed:**
  - `_bmad-output/planning-artifacts/architecture.md` (ADR-A009, §5 time discipline, §6 TTL, §18 test-infrastructure decisions)
  - `_bmad-output/planning-artifacts/epics.md` (AR21, AR23, Stories 1.2, 2.1, 2.2, 2.3, 2.4, 6.3, 6.4, 6.5, 7.2, 8.1)
  - `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-12.md` (this document)
- **Not changed:** prd.md, ux-design-specification.md, test-design docs (already aligned), sprint-status.yaml (does not exist yet).
- **Success criteria:** B1-B3 and H1-H5 each have a planning-artifact home consumable by `create-story`/`dev-story`; no "or transaction adapter" hedge remains for the three named commands; Epic 8 wave sequencing intact; FR coverage map untouched.
- **Next step:** Run `bmad-sprint-planning`. Story execution order is unchanged from the 2026-06-11 proposal: E1 → E2 → E3 → E4 → Story 8.1 → E5 → E6 → E7 → Stories 8.2-8.5 → E9.

## Implementation-Readiness Rerun?

**A full rerun is not required.** This correction is additive (test-infrastructure decisions and one mechanism pinning) and resolves — rather than creates — readiness gaps; FR coverage, epic structure, and sequencing are unchanged. Recommended lightweight action: annotate the 2026-06-11 readiness report that test-design blockers B1-B3/H1-H5 are now reflected in planning artifacts. Rerun the full IR check only if further structural epic/story changes occur before sprint planning.
