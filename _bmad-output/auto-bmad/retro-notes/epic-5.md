## Story epic-5
- [E2 â€” test-design] Standing NFR CONCERNS (no pnpm-audit CI gate, no coverage reporter) carried un-actioned since Epic 2 â€” the epic-5 gate should force an explicit schedule-or-accept decision rather than carry them a fourth time.

## Story 5-1-tenant-owned-calculation-schema-and-server-commands
- [Phase 3 â€” create-story] contacts has NO unique(id, tenant_id) (only customers/facilities got one in 3-1); 5-1's migration must additively add contacts_id_tenant_unique before any composite same-tenant FK to contacts â€” any later story adding such a FK hits the same wall.
- [Phase 5 â€” dev-story] Resumed-run trap: ATDD command-int scaffolds were left describe.skip with throwing placeholders while everything else was green â€” check for lingering describe.skip/notYetImplemented before trusting a resumed run ('typecheck + partial green' is not done).
- [Phase 5 â€” dev-story] Env gotcha: right after supabase db reset, Kongâ†’GoTrue 502s for ~10s, flipping isLocalStackReachable() false and silently SKIPPING all DB-backed tests locally (exit 0); poll /auth/v1/health to 200 first. CI (SUPABASE_TEST_REQUIRED=1) fails hard instead.
