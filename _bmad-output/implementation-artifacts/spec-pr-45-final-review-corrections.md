---
title: 'PR 45 final review corrections and AutoReview convergence guidance'
type: 'bugfix'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 0
baseline_commit: '1a0a54dd70235824be11f51f1044d15d9249e501'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-10-context.md'
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** PR 45 has nine substantiated follow-up defects across quote/PDF correctness and bundled BMAD tooling, plus repeated AutoReview passes that keep expanding into peripheral findings. One additional duplicate-source review comment is a false positive because the authorized database path already rejects duplicate source-row IDs.

**Approach:** Apply one bounded correction batch for the nine reachable defects, add repository-scoped review guidance that improves convergence, and verify only the affected seams. Do not start another broad automatic review round.

## Boundaries & Constraints

**Always:** Preserve sent/accepted immutability, tenant isolation, integer-öre/tax rules, archive-over-delete, PDF byte retention, deterministic audit authority, and existing valid BMAD inputs. Make file/PDF and database changes fail closed. Keep the batch compatible with the current unmerged migrations and project-local agent configuration.

**Ask First:** Any fix requiring a new product decision, a new migration rather than correction of the current unmerged Story 10.8/10.9 migrations, weakening an existing quote/file invariant, or broadening the batch beyond the nine accepted findings.

**Never:** Recompute sent snapshots, hard-delete PDF bytes, expose privileged/service-role capability, treat UI attention as authority, modify global Codex configuration, run a fourth broad review loop, or execute the prohibited Auto-BMAD self-test/live PID-liveness experiments.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| ROT allowance pair | Combined ROT/RUT amount without ROT amount | Draft cannot persist a partial person slot | Field error on the missing ROT amount |
| Reverse-charge review | V2 snapshot has buyer VAT number | Both pre-quote and frozen quote views display it | Missing value remains blocked upstream |
| Acceptance time | Browser-local `datetime-local` value | Server receives an explicit ISO instant with offset resolved in the browser | Invalid/normalized local time is rejected before submit |
| Current draft PDF archive | Generic file archive targets a reserved quote PDF | Generic archive is refused; quote invalidation workflow remains owner | Stable file-lock error; bytes and current reference remain intact |
| Invalid sprint state | Only illegal or unrecognized entries remain | `all_done` is false | Validation/recovery path remains recommended externally |
| Mixed Markdown fences | Tilde fence contains backticks/headings | Inner delimiter does not close the outer fence | Fenced headings are ignored |
| Duplicate appendix id | Two source rows use the same numeric id | Recon validation fails without overwriting either row | Duplicate ids are reported deterministically |
| Architecture labels | Prose contains “binds/prevents/rule” but labels are absent | AD lint fails | Missing structured labels are named |

</frozen-after-approval>

## Code Map

- `AGENTS.md` -- repository-level AutoReview rules; keep concise and consequence-focused.
- `supabase/migrations/20260831124310_story_10_8_quote_review_authorization.sql` -- successor authorization lock order must match successor creation.
- `src/features/calculations/form-parsing.ts` and `tests/unit/features/calculations/form-parsing.test.ts` -- paired ROT/combined allowance form boundary.
- `src/components/calculations/PreQuotePreview.tsx`, `src/components/quotes/QuoteDetailView.tsx`, and component tests -- buyer VAT number on both human review surfaces.
- `src/components/quotes/AcceptanceCaptureForm.tsx`, a pure time helper, and unit tests -- browser-local acceptance time normalization.
- `src/server/commands/files/file-db.ts`, `src/server/commands/files/files.ts`, and focused file/PDF tests -- generic archive exclusion for quote-PDF artifacts.
- `.agents/skills/bmad-sprint-planning/scripts/{sprint_plan.py,tests/test_sprint_plan.py}` -- CommonMark fence state and valid `all_done` calculation.
- `.agents/skills/bmad-deep-recon/scripts/{recon_kit.py,tests/test_recon_kit.py}` -- duplicate appendix IDs.
- `.agents/skills/bmad-architecture/scripts/{lint_spine.py,tests/test_lint_spine.py}` -- structured AD field labels.

## Tasks & Acceptance

**Execution:**
- [x] `AGENTS.md` -- add three durable Code Review Rules without mechanical lint duplication.
- [x] Story 10.8 migration and focused migration test -- lock the source quote version before calculation/source rows.
- [x] Quote/tax UI and pure tests -- enforce allowance pairing, show buyer VAT number, and submit acceptance as an explicit instant.
- [x] File command/helpers and focused tests -- prevent generic archive from invalidating a current/reserved quote PDF.
- [x] Three BMAD script/test pairs -- fix invalid completion, mixed fences, duplicate appendix IDs, and false AD label matches.

**Acceptance Criteria:**
- Given each accepted reviewer reproduction, when the corrected path is exercised, then it fails safely or preserves the required customer-visible fact without weakening downstream invariants.
- Given the duplicate-source allegation, when the existing V2 freshness predicate is inspected, then no redundant change is introduced because duplicate row IDs already make it return false.
- Given the correction batch, when targeted unit, Python, type/lint, and available focused Supabase checks run, then they pass without invoking the prohibited self-test or any persistent infrastructure.

## Spec Change Log

- 2026-09-01: Implemented the approved bounded correction batch. The duplicate-source allegation was rechecked and left unchanged because the existing V2 predicate rejects repeated source-row IDs.

## Verification

**Commands:**
- Targeted `node --test` files for lock order, form parsing, tax validation, generic archive, and acceptance-time normalization -- passed (67 relevant assertions across the final focused runs; no failures).
- Targeted Vitest component files for buyer VAT rendering and quote detail -- passed (2 files, 5 tests).
- Targeted Python pytest for sprint planning and architecture lint -- passed (67 tests); deep-recon unittest -- passed (8 tests).
- Focused borrowed-local-Supabase Story 10.8 migration/reset contract test -- passed (1 file, 4 tests).
- Direct `tsc --noEmit`, targeted ESLint, Python `py_compile`, and `git diff --check` -- passed with zero errors.

## Suggested Review Order

**Acceptance and tax correctness**

- Convert browser-local acceptance input into a validated explicit instant before submission.
  [`AcceptanceCaptureForm.tsx:63`](../../src/components/quotes/AcceptanceCaptureForm.tsx#L63)

- Reject calendar overflow and local-time normalization through component round-tripping.
  [`acceptance-time.ts:9`](../../src/features/quotes/acceptance-time.ts#L9)

- Enforce both halves of each ROT capacity declaration at the form boundary.
  [`form-parsing.ts:271`](../../src/features/calculations/form-parsing.ts#L271)

- Preserve the pairing invariant against callers bypassing the browser form.
  [`tax-input.ts:110`](../../src/lib/money/tax-input.ts#L110)

- Reuse one frozen buyer-VAT fact across both human review surfaces.
  [`BuyerVatNumberFact.tsx:1`](../../src/components/quotes/BuyerVatNumberFact.tsx#L1)

**Quote and file lifecycle**

- Match successor authorization lock order to successor creation.
  [`20260831124310_story_10_8_quote_review_authorization.sql:303`](../../supabase/migrations/20260831124310_story_10_8_quote_review_authorization.sql#L303)

- Reserve quote-PDF archival for the quote render and invalidation workflow.
  [`files.ts:463`](../../src/server/commands/files/files.ts#L463)

**Deterministic tooling and review convergence**

- Guide ReviewBot toward reachable bypasses and bounded follow-up rounds.
  [`AGENTS.md:29`](../../AGENTS.md#L29)

- Track compatible Markdown fence delimiter and length before parsing stories.
  [`sprint_plan.py:183`](../../.agents/skills/bmad-sprint-planning/scripts/sprint_plan.py#L183)

- Refuse ambiguous duplicate research appendix identifiers.
  [`recon_kit.py:118`](../../.agents/skills/bmad-deep-recon/scripts/recon_kit.py#L118)

- Require labeled architecture-decision fields rather than incidental prose words.
  [`lint_spine.py:43`](../../.agents/skills/bmad-architecture/scripts/lint_spine.py#L43)

**Focused regression evidence**

- Pin the cross-function database lock-order contract without resetting local Supabase.
  [`quote-successor-review-lock-order.test.ts:16`](../../tests/unit/guardrails/quote-successor-review-lock-order.test.ts#L16)

- Exercise both browser-facing buyer-VAT rendering states.
  [`buyer-vat-number-fact.test.ts:7`](../../tests/integration/components/buyer-vat-number-fact.test.ts#L7)
