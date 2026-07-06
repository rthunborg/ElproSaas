# Epic 6 — Integration Code Review Findings

**Epic:** epic-6 (Quote versions, PDF, and lifecycle — stories 6.1–6.5, all landed)
**Date:** 2026-07-06
**Review roster:** CHUNKED adversarial review — the epic diff split into 5 story-scoped chunks, each run
under 3 lenses (Blind Hunter, Edge Case Hunter, Acceptance Auditor) across 2 reviewer models
(primary + secondary) = 30 lens files; plus ONE whole-epic security review (auto-bmad-local,
0 HIGH / 0 MEDIUM / 2 LOW). Triaged here into Decision / Patch / Defer (Dismiss dropped, counted in
the chat report). Verdict: **Approve.**

Notes on the pass:
- No lens LAYER failed (every lens produced findings for at least one chunk; every one of the 30 files
  was non-empty).
- Very heavy overlap as expected (30 independent files over overlapping code + a security pass).
  Deduplicated aggressively; the vast majority of raw findings were either already-tracked story
  deferrals, resolved-by-a-later-story mid-epic seams, or blind-lens misreadings verified false
  against the assembled code.

## Review Findings

- [x] [Review][Defer][Med] (auto-resolved [Review][Decision] → defer, epic mode, per triage recommendation) Correction + PDF affordances render on EVERY non-draft version, including terminal states — `CreateNewVersionButton` and `QuotePdfPanel` are mounted for any `selected.status !== "draft"` (`src/components/quotes/QuoteDetailView.tsx:409,442`; the panel is outside the draft branch), and neither the `createNewQuoteVersion` command (only guards a `draft` parent — `src/server/commands/quotes/new-version.ts:75`) nor `generateQuotePdf` (no lifecycle gate at all — `src/server/commands/quotes/generate-pdf.ts`) restricts the action to a live `sent`/`draft` commitment, so a `superseded`/`rejected`/`expired` (and the future Epic-7 `accepted`) version offers a live "Skapa ny version" and "Generera PDF"/"Försök igen". Architecture §12 scopes PDF retry to "draft/sent"; the epic intent for new-version is "correct a live commitment". Verified harmless today: the new-version RPC always supersedes the highest `sent` version below the new one (the real live commitment, correct even off a stale parent) and only flips the exempt `status`; PDF retry writes only the 6.4-exempt derived columns; `accepted` is unreachable in Phase A (no acceptance flow ships). Surfaced by 6 lens instances (auditor@secondary/6-2, blind@primary+auditor@primary+auditor@secondary/6-3, blind@primary+blind@secondary+auditor@primary+auditor@secondary/6-5). Recommended: defer: log as an Epic-7 acceptance-boundary hardening item — gate both affordances (command + UI) to draft/sent (and never `accepted`) when the acceptance flow lands; no change now (behavior is safe, snapshots immutable, no reachable `accepted`).

- [x] [Review][Decision][Low] (dismissed as won't-fix — auto-resolved, epic mode, per triage recommendation) `evaluateSendGate` threads a `signOff` posture then discards it (`void input.signOff`) — the send-gate reads `requires_sign_off`/`terms_approved_at` off the row, passes them in, and the function voids them (`src/features/quotes/send-gate.ts:103`); the ~10-line "SERVER-TRUTH RE-DERIVATION" doc block describes an enforcement the code does not perform today, and the exported `KNOWN_BLOCKER_CODES` constant is referenced by nothing. This is the intentional demo-data-only accepted posture (MEMORY 2026-07-03: tax/terms sign-off deferred; `requiresSignOff` framing kept, never a send blocker) — the field is inert precisely because nothing should gate on it in demo-data mode, and the security review confirmed a forged persisted boolean has no effect (no security consequence). Surfaced by blind@primary/6-4 + blind@secondary/6-4 + auditor@primary/6-4. Recommended: dismiss: keep the plumbing as the documented future-real-customer seam (it is aligned with the deferred tax sign-off owner decision); a future real-customer sign-off story wires `signOff` into the gate and STOP-re-scores. No action now.

- [x] [Review][Defer][Low] Signed-URL preview accepts any own-tenant `file_id`, not just the version's own PDF [src/features/quotes/actions.ts:2026] — deferred, security-sourced LOW; `previewQuotePdfAction` forwards the client-supplied hidden `file_id` into `createSignedFileAccess`, whose envelope binds it to the caller's own tenant and signs under caller RLS (no cross-tenant exposure; a tenant admin already holds full own-tenant file read). Intra-tenant hardening only, no privilege escalation, mirrors the established Story 8.x signing-funnel posture — not an Epic-6 regression.

- [x] [Review][Defer][Low] Child-lock parent-status lookup is unfiltered by tenant (relies on RLS + FK, not an explicit predicate) [supabase/migrations/20260707120000_quote_version_sent_lock.sql] — deferred, security-sourced LOW; `enforce_quote_version_child_sent_lock` reads the parent status with no `tenant_id` predicate. Because the trigger is SECURITY INVOKER, a cross-tenant parent is RLS-invisible → NULL → the composite same-tenant child FK (23503) rejects the write regardless, so there is no reachable bypass. Defense-in-depth: add `and qv.tenant_id = <child tenant_id>` so the trigger's own predicate is self-sufficient rather than carried by the surrounding FK/RLS.
