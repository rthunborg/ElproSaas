# Epic 14 Story Ownership — Contract C

## Recorded owner approval — 2026-10-06

The owner explicitly approved contract C to resolve the Story 14.2/14.3 intent gap recorded in `_bmad-output/auto-bmad/reports/epic-14.md` and the blocked Story 14.2 spec. Keep the original story order: 14.1 → 14.2 → 14.3 → 14.4. This decision changes acceptance ownership and sequencing only; it preserves every Epic 14 acceptance obligation and does not waive any quality gate.

## Story ownership

Story 14.2 retains booking, assignee and conflict-workflow schema, RLS, authorization, same-tenant references, idempotency, rollback, and atomic booking/assignee/idempotency/audit persistence. It supplies the transaction foundation for later detection integration. Its completion must not claim derived-conflict refresh, authoritative current-row detection, or preview/save equivalence.

Story 14.3 solely owns the shared pure, I/O-free, clock-free conflict engine and its integration into the authoritative create/update transaction. It re-reads current facts and persists derived conflict rows atomically with booking, assignees, idempotency and audit. Editor preview later uses the same engine. There must be no stub detector, hardcoded empty-conflict success, duplicated conflict rules, or client-supplied detection authority.

| Original test obligation | Retained in 14.2 | Transferred to 14.3 |
| --- | --- | --- |
| 14.2-INT-001 (P0) | One booking, assignees, idempotency outcome and one audit event commit atomically. | 14.3-INT-003 (P0): derived conflict rows commit in that same transaction; exact durable state and audit counts. |
| 14.2-INT-002 (P1) | Atomic replacement of mutable booking fields and assignees. | 14.3-INT-004 (P1): update re-derives conflicts and removes stale derived rows atomically. |
| 14.2-INT-007 (P1) | Fault after assignee preparation rolls back every business/idempotency/audit row. | 14.3-INT-005 (P1): fault after conflict preparation rolls back every booking/assignee/conflict/idempotency/audit row. |
| 14.2-INT-008 (P0) | No current-row detection claim in 14.2. | 14.3-INT-006 (P0): a conflict committed after preview is detected inside authoritative save. |

The split retains the original priorities and acceptance; the test design names 77 checks instead of 74 because three combined foundation/conflict rows are separated. This is traceability granularity, not new product scope.

## Mandatory sequencing and exposure gate

Complete Story 14.3 detector integration and all transferred checks, including equivalent mandatory P0 checks, before any Story 14.4 work and before the Epic PR. Every transferred check is mandatory at this boundary, including the original P1 update/fault checks. Required integration/RLS evidence uses `SUPABASE_TEST_REQUIRED=1`; explicitly skipped tests do not satisfy the gate. Retain independent review, ATDD, automation, cumulative regression, and all existing Epic gates.

No user-facing booking entry point may exist before the detector is integrated into the authoritative transaction. Story 14.2 foundation commands are internal and have no booking route, UI, or user-facing action. Story 14.4 entry points remain dependent on the completed 14.3 gate.

`resources` remains active and owns Epic 14 schema/capabilities. `scheduling` remains pending with empty live surfaces until Epic 15. This decision authorizes no E15/Phase C surfaces, hosted action, infrastructure change, or merge.

## Planning recovery

Recover the existing blocked Story 14.2 spec in place as `status: draft`, preserve the historical blocker, and append this resolution. The installed `bmad-build-auto` Step 1 routes an explicitly supplied draft to Step 2 planning; a supplied blocked spec halts. Draft means re-planning input, not ready for development or completed acceptance. The root orchestrator first commits the preparation changes and satisfies the clean-tree gate, then resumes the saved spec through normal planning/build/review gates. No build workflow or implementation is performed by this preparation.

## References

- [Epic story authority](../../_bmad-output/planning-artifacts/epics-phase-b.md)
- [Epic 14 test design](../../_bmad-output/test-artifacts/test-design-epic-14.md)
- [Recovered Story 14.2 draft](../../_bmad-output/implementation-artifacts/spec-14-2-bookings-and-assignees-schema-and-transactional-commands.md)
- [Recorded blocker and continuation evidence](../../_bmad-output/auto-bmad/reports/epic-14.md)
