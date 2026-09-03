# Story 10.7: Phase B Connected Field Posture and Phase C PWA/Offline Deferral

Status: done

## Story

As the product owner and delivery team,
I want the Phase B planning corpus and sprint history to reflect a connected field-web posture and the complete Phase C PWA/offline deferral,
so that field epics can proceed without an accidental offline dependency or a false claim that halted functionality was delivered.

## Course-Correction Authority

- Owner decision received 2026-09-03: Phase B remains responsive and phone-usable at 360×640 but requires connectivity; the complete PWA/installability and genuine offline-operation package moves to Phase C.
- Owner approval received 2026-09-03: **“Approve all four increments.”**
- Sprint Change Proposal: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-03.md`.
- ADR-B009 is current. ADR-B007 and the exact 2026-07-26 N-3 owner answer remain historical evidence.
- The original Auto-BMAD run halted `blocked` on `intent gap`; no implementation started.

## Acceptance Criteria

### AC1 — Current decision and historical chain

ADR-B009 is the operative Phase B field decision. ADR-B007 and the 2026-07-26 N-3 answer are retained, labelled historical/superseded, and point to ADR-B009 without rewriting history.

### AC2 — Phase B posture

Every current authoritative artifact describes Phase B as a responsive connected web application whose field workflows work at the 360×640 viewport floor. Phase B does not include PWA installation/manifest, service-worker caching, durable offline device storage, offline reads/writes, local operation/attachment queues, synchronization/replay/offline-conflict states, or background/reconnect-driven offline synchronization. Native mobile remains out of scope.

### AC3 — E14–E18 preserved without the technical prerequisite

E14–E18 remain in Phase B with scheduling, time reporting, jobs, materials, diary entries, deviations, photos, checklists/egenkontroller, and completion intact as connected workflows. They contain no Story 10.7 or ADR-B007 technical prerequisite.

### AC4 — Transient-failure contract

Field forms use component state, suitable minimized `sessionStorage` drafts, and in-memory photo retention where appropriate; show connection-required, submitting/uploading, failure, and explicit retry states; and show `Submitted`/`Saved` only after server-confirmed persistence. Retained client input is an unsent draft, never a submitted record.

### AC5 — Complete Phase C deferral

The Phase C ledger contains the whole PWA/installability and genuine offline package and explicitly defers the concrete read/write surfaces, device retention/purge, attachment limits, signature/legal posture, authorization after access changes, operation ordering/replay/conflict behavior, supported browser/platform behavior, and security/recovery test matrix. Phase B records durable neutral seams only and does not preselect Phase C implementation architecture.

### AC6 — Scope manifest unchanged

PWA/offline is not represented as a scope-manifest module. No manifest entry is invented or changed, and the pre/post SHA-256 hashes of `src/scope/manifest.ts` and `src/scope/manifest-schema.ts` match.

### AC7 — Truthful halted-run disposition

The original blocked specification remains `status: blocked`; its exact Auto-BMAD state is archived under `state/superseded/`; the report gains an append-only disposition; and sprint status tracks this governance story separately without claiming that PWA/offline functionality was implemented.

### AC8 — Repository-wide verification

Repository searches for `ADR-B007`, `NFR53`, `Story 10.7`, `PWA`, `offline`, `offline-capable`, `offline sync`, and `N-3` classify every remaining occurrence as current connected posture, explicit Phase C deferral, or clearly labelled historical evidence. E14–E18 remain connected and Phase C contains the complete deferred package.

## Tasks / Subtasks

- [x] Record the approved Sprint Change Proposal and exact approval evidence (AC1).
- [x] Align the PRD, product brief, owner decisions, project context, baseline plans, and kickoff guidance (AC1, AC2, AC5).
- [x] Add ADR-B009, retain ADR-B007 as history, and align architecture, UX, epics, Story 10.7, and E14–E18 (AC1–AC5).
- [x] Reconcile the halted specification, Auto-BMAD report/state, and sprint tracker without false completion (AC7).
- [x] Run and record the full search, dependency, manifest-hash, state-coherence, diff-scope, and formatting verification (AC6, AC8).

## Constraints

- Documentation/governance work only.
- Do not modify product code, migrations, dependencies, lockfiles, `.env` files, or scope-manifest source.
- Do not resume the blocked implementation specification or mark PWA/offline functionality as delivered.
- Do not commit, push, open a PR, deploy, or perform an external action.

## Completion Notes

- The owner approved all four increments on 2026-09-03, and the approved planning, decision-history, UX, architecture, epic, sprint, and Auto-BMAD bookkeeping edits were applied.
- A final 106-assertion course-correction check passed. It covers current-versus-historical authority, the complete Phase C package, E14–E18 scope and dependencies, the replacement Story 10.7, state disposition, and unchanged scope-manifest hashes.
- Repository-wide searches for `ADR-B007`, `NFR53`, `Story 10.7`, `PWA`, `offline`, `offline-capable`, `offline sync`, and `N-3` were reviewed. Remaining affected-artifact occurrences are current connected-posture exclusions, explicit Phase C deferral, or labelled historical evidence; unrelated uses describe local/offline test execution or registry checks rather than product offline capability.
- `src/scope/manifest.ts` remains SHA-256 `2C512A73B0DD2A151C50B7BEF44A5EDEDBFE6C0ECD9AA514834EEFB4EF4B0B3F`; `src/scope/manifest-schema.ts` remains `0015923A28D87F5E4D268C2652C3042AE7D381B47B5E633640C301581403BA51`.
- The exact 4,419-byte halted state is archived with SHA-256 `7D92A2923A5B1F157AF03D444513EC1D82709819186CF66833B31671C177424C`; the active Auto-BMAD state scanner reports zero in-flight stories and does not select the obsolete key.
- Runtime scans found no PWA manifest, service-worker registration/caching, PWA dependency, offline store, operation queue, or superseded offline state taxonomy. Diff-scope inspection found documentation/planning/bookkeeping changes only, and `git diff --check` passed.
- No product code, migration, dependency, lockfile, `.env`, or manifest source was changed. After the verified correction, the owner separately authorized its local commit with “Proceed with that.” No push, PR, merge, deployment, or external action was performed.

## File List

- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-03.md`
- `_bmad-output/planning-artifacts/prd-phase-b.md`
- `_bmad-output/planning-artifacts/product-brief-phase-b.md`
- `_bmad-output/planning-artifacts/owner-signoff-questions.md`
- `docs/discovery/phase-b-owner-answers-2026-07-26.md`
- `docs/discovery/phase-b-owner-questions-sv.md`
- `_bmad-output/project-context.md`
- `docs/planning/saas-rebuild-phased-plan-2026-06-07.md`
- `docs/planning/post-phase-a-plan-2026-07-08.md`
- `_bmad-output/planning-artifacts/next-session-prompt.md`
- `_bmad-output/planning-artifacts/architecture-phase-b.md`
- `_bmad-output/planning-artifacts/ux-design-specification-phase-b.md`
- `_bmad-output/planning-artifacts/epics-phase-b.md`
- `_bmad-output/implementation-artifacts/epic-10-context.md`
- `_bmad-output/implementation-artifacts/spec-10-7-pwa-offline-field-capability.md`
- `_bmad-output/auto-bmad/reports/10-7-pwa-offline-field-capability.md`
- `_bmad-output/auto-bmad/state/superseded/10-7-pwa-offline-field-capability.yaml`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
