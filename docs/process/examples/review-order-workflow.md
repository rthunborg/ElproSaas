# Completed process-change review-order example

This is the implementation authors' review trail for the review-order
convention itself. It demonstrates the format on a completed documentation and
workflow change; it is not a backfilled historical story, an approval, or proof
of correctness.

## Intent

Give future implementation authors a concise, author-owned reading guide that
checkpoint-preview can consume, while keeping rationale and final spec editing
inside the implementation/fix delegate.

## Suggested Review Order

Author: implementation authors of this process change. Refreshed against the
final process-change working tree; no fixed baseline is embedded because the
convention is intended to travel across branches.

### Start where future authors receive the convention

Project instructions and the normal workflow introduce the requirement before a
story reaches review. This keeps the trail an author responsibility and leaves
the Test Architect and reviewer with their separate evidence and verification
roles.

- `AGENTS.md:31` — `Suggested Review Order`: makes the future-story requirement visible to reviewers and authors.
- `docs/process/agent-workflow.md:31` — `implementation/fix author`: places authoring and final verification in the standard flow.
- `docs/quality/definition-of-done.md:45` — `author-written Suggested Review Order`: records the completion expectation and its limits.

### Follow delegated authoring through the BMAD boundary

The supported team overrides load the persistent convention and hand it to the
implementer. Completion reconciliation stays inside Build or Build Auto, so the
auto-bmad root does not author story code or spec content.

- `_bmad/custom/bmad-build.toml:4` — `implementation_handoff`: gives the implementation author the scaffold and refresh duty.
- `_bmad/custom/bmad-build.toml:10` — `on_complete`: limits reconciliation to the delegated Build run.
- `_bmad/custom/bmad-build-auto.toml:6` — `implementation_handoff`: carries the same author-owned duty through headless dispatch.

### Finish with freshness evidence and operating limits

The checker validates supplied path-and-line stops without judging rationale or
coverage. Its focused tests cover stale references and containment; rendering
and source inspection show compatibility, but do not execute an unattended
epic or prove host hook behavior.

- `scripts/verify/check-review-order.mjs:31` — `parseSuggestedReviewOrder`: finds one exact author-provided H2 outside fenced examples.
- `scripts/verify/check-review-order.mjs:171` — `validateSuggestedReviewOrder`: checks supplied files, lines, and literal anchors.
- `tests/unit/scripts/verify/check-review-order.test.ts:61` — `colon-delimited literal anchor`: exercises a moved-anchor failure in the documented stop format.

Evidence: the focused checker suite passes with 6 tests, 0 failures, and 0
skips; the reference checker validates all 9 stops above. Limits: these tests
use temporary synthetic files and do not prove authorship, prose quality,
acceptance-criterion coverage, runtime checkpoint execution, or external
service behavior. The post-terminal hook and unavailable-author limitations are
recorded in the project convention.
