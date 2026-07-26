# Branching And PR Policy

## Branch Types

| Type | Pattern | Use |
| --- | --- | --- |
| Docs/process | `docs/<short-topic>` | Process, ADR, planning, quality, security docs |
| Chore/config | `chore/<short-topic>` | Tooling/config without product behavior |
| Feature | `feature/<approved-story-id>` | Product work only after approved story |
| Fix | `fix/<approved-issue-id>` | Bug/security fixes |
| Spike | `spike/<short-topic>` | Read-only research or disposable investigation |

## PR Requirements

Every PR must include:

- Scope statement and phase.
- Link to approved story, ADR, or process task.
- List of changed files.
- Tests/checks run.
- Security/RLS impact statement.
- Data migration impact statement.
- Deferred-scope confirmation.

## Review Order

1. Phase scope review.
2. Security/RLS review if auth, tenant, storage, server, or database behavior is touched.
3. Money/tax review if calculations, quotes, VAT, ROT, grön teknik, or pricing are touched.
4. Test gap review.
5. General PR review.

## Merge Gates

PRs must not merge unless:

- CI passes for the required gates.
- No out-of-scope surface is included: any product surface (route, table, widget, public surface, file owner type) must belong to a module that is `active` in `src/scope/manifest.ts`, or be part of that module's same-PR activation (per-epic activation, FR129). The manifest coherence validator must pass.
- No secrets or `.env` changes are included.
- No Phase C hard-exclusion (below) is brought into scope.

## Deferred Scope Handling

Scope is manifest-governed: a `pending` module's surface must not land except as part of that module's activation PR (flip `pending → active` with an epic ref + date, in the same PR as its first schema/nav change). If a PR touches a Phase C hard-exclusion, it must be stopped unless there is an explicit new owner decision in the PR description and linked planning artifact.

Deferred to Phase C (hard exclusions — the Phase C ledger, PRD §14):

- All AI flows (DoU/self-inspection/tender/panel-image/KNX/supplier AI parsing, RAG chat, any AI job or mutation).
- Live supplier vendor APIs (file import only in Phase B).
- Customer portal / online acceptance (BankID/portal signing).
- Bookkeeping integrations beyond Fortnox.
- The public anonymous suggestion endpoint (P70).
- Net-new features beyond parity + the two sanctioned additions (Fortnox, multi-tenant productization).
- The full-release legal/GDPR program (`A22`-tax disclaimer wording, retention program, authoritative tax-number ownership).
- A native mobile app.
- Self-serve tenant signup (until N-2).

