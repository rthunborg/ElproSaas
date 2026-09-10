# Story 11.3 Handoff

Status: **backlog — not started**. Start a new session with
`/auto-bmad --story 11-3`.

## Read first

- [Epic 11 context](../../_bmad-output/implementation-artifacts/epic-11-context.md)
- [Phase B epics](../../_bmad-output/planning-artifacts/epics-phase-b.md)
- [Story 11.2 hosted PDF verification](../quality/story-11-2-hosted-pdf-verification.md)

**Decision — IN:** Stories 11.1 and 11.2 are complete prerequisites. Story
11.3 is the approved Admin user-management story; Story 11.4 follows it. Take
future scope only from the approved planning artifacts and the active manifest.

**SEAM:** Supabase Auth invitations are the sanctioned path. No blanket user
authorization exists for future emails; a custom email path remains deferred
until its story and notification/email posture authorize it.

## Operating constraints

Use the standing local authorization and resource-lifecycle guard rules. Do
not run CI or regression suites against the hosted demo. The existing Seller
DPAPI credential may be privately loaded only when an explicitly authorized,
controlled hosted smoke requires it; never print its password or persist a
session token. Do not assume a resource or profile is owned merely because it
exists; use guarded resources when a new managed resource is needed.

## Closeout preflight (2026-09-10)

The closeout branch preflight passed with exit 0, `hard_stop=false`, and no
warnings. It accepted only the expected dirty closeout-branch allowance; this
is not a final clean-main recheck. Python 3.14.7 and uv 0.12.6 are available,
all nine required core/TEA skills were found, Codex CLI is available, `gh` is
authenticated to GitHub, Terra/Sol V2 nesting is allowed, and
configuration/security/cross-model review layers were fresh and valid. Story
resolution found exactly
`11-3-admin-user-management`, with no existing specification or candidates;
11.1/11.2 are done, 11.4 is backlog, and the next story is the third of four
in the in-progress Epic 11.

For Python helper invocations, prefer `python -X utf8` or a process-scoped
`PYTHONUTF8=1`: ordinary Python 3.14 `--help` encountered a Windows cp1252
UnicodeEncodeError. Do not change global encoding settings. The new session
must still perform its own readiness and scope checks before implementation.
