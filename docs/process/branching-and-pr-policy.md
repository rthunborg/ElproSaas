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

Phase A PRs must not merge unless:

- CI passes for the required gates.
- No forbidden scope is included.
- No secrets or `.env` changes are included.
- No database migrations are present unless the PR is explicitly a migration story.
- No dependency changes are present unless explicitly approved.

## Deferred Scope Handling

If a PR touches deferred modules, it must be stopped unless there is explicit re-approval in the PR description and linked planning artifact.

Deferred in Phase A:

- Fortnox.
- Field-worker UX.
- Supplier APIs.
- AI jobs.
- HR.
- Rentals.
- Assets.
- DoU automation.
- Tender/FKU RAG.
- Full RBAC.

