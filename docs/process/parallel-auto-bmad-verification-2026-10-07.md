# Parallel Auto-BMAD verification — 2026-10-07

Verified in the isolated parallel-bmad-plan worktree. No live product worker was dispatched and neither existing user session was modified by this implementation.

## Local evidence

- Behavioral helper suite: 29 passed in 275.431 seconds; a subsequently added custom-output configuration regression and mirror check passed 2/2 (one repeated mirror test). 30 unique behavioral tests covered.
- Actual CLI lifecycle suite: 7 passed in 114.566 seconds, including committed coordinator bootstrap, two workers, blocked-worker independence, serialized integration, inherited state, stale evidence refusal and final gates.
- Existing routing regression suite: 25 passed.
- Existing external CLI process suite: 10 passed.
- Total: 72 unique tests passed, no skipped tests in these suites.
- Codex/Claude helper, test and protocol mirrors verified identical.
- Independent High-effort review completed three passes, followed by targeted verification of the last fix. Consequential findings addressed: repository-wide ownership, recovered merge scope, assignment heartbeat identity and registered inherited-state provenance.

Tests use temporary local Git repositories and no database/browser services. Windows local evidence does not substitute for the added Ubuntu/Windows Python 3.12 CI matrix.

## Adoption limits

The implemented pilot validates mechanics with synthetic stories. A real Phase B product pilot and measured speedup remain outstanding. Adopt only after integration of this tooling and a clean checkpoint; prepare approved ready specs and reserve existing work before starting workers. The first version supports one host/shared Git repository, sprint stories and at most two concurrent workers.

See [the operator guide](parallel-auto-bmad.md) and [the CLI contract](parallel-auto-bmad-contract.md).
