## Story 8-1-file-storage-foundation-private-bucket-metadata-links-rls-and-signed-access-command
- [Phase 2 â€” epic test design] 8.1 is THE single Phase A file model (6.1 attachment metadata + 6.3 PDF storage consume it); no competing model â€” standing contract + STOP condition R-814
- [Phase 2 â€” epic test design] Epic 8 adds a new test class: storage-plane negative matrix (storage.objects RLS, cross-tenant list/read/sign, path spoof, expired URL) â€” no H4-style auto gate exists; runner needs a storage-service-reachability probe or storage suites false-green skip locally
- [Phase 3 â€” create-story] is_tenant_admin verified SECURITY DEFINER + fixed empty search_path, sound for storage.objects RLS policies â€” but its EXECUTE grant reaching the storage-policy evaluation context is the one storage-plane unknown to confirm during dev
- [Phase 5 â€” dev-story] Local Docker/WSL2 outage stalled DB-backed verification mid-story (wedged AF_UNIX socket files; fixed by Docker Desktop update + stale-file cleanup); implementation then passed all 388 integration tests first-run with zero fixes â€” deferral was purely environmental
- [Phase 5 â€” dev-story] Task-8.6 storage-reachability probe worked as designed: SUPABASE_TEST_REQUIRED=1 forces the new storage-negative class to execute, closing the R-2 false-green gap
- [Phase 5 â€” dev-story] Task 9's CI golden PII/ORGNR scan has no standalone script in repo â€” satisfied by construction (anonymized metadata-only fixtures); confirm whether a dedicated scan is expected epic-wide
- [Phase 7 â€” code review] Local supabase db reset intermittently leaves kong returning 502 on /auth/v1/* only (stale upstream; auth container healthy) â€” docker restart supabase_kong_ElproSaas clears it; can false-fail local reachability probes
- [Phase 7 â€” code review] When a review fix rewires production off an RPC (create_file_with_link -> link_existing_file), the old RPC's privilege negatives silently stop covering the live surface â€” iteration 3 caught this coverage inversion; check negative-test targets after any fix that swaps a privileged entry point

## Story epic-8
- [Phase 2 â€” test-design] Single Phase A file model contract (R-814) held under real pressure â€” 6.3 generateQuotePdf and 7.x accept both consume 8.1's bucket/paths/file_links with no competing model; sequencing win worth affirming in retro.
- [Phase 2 â€” test-design] 8.4 file-lock is a known-shape task: frozen 6.4/7.4 migrations name 'Epic 8.4 locked-evidence-file' as third scope of the shared lock-code family â€” 8.4 must reuse the trigger shape with a sibling code (R-822), not invent a mechanism.

## Story 8-2-validated-upload-and-entity-file-panels
- [Phase 3 â€” create-story] 8.1 create_file_with_link RPC self-allocates the file id and does no content validation â€” object path cannot bind the id through it; 8.2 upload must reuse 6.3's direct explicit-id RLS insert, not that RPC (trap called out in Task 3.3).
- [Phase 3 â€” create-story] /files route + 'Filer' nav already exist as Epic-8 PagePlaceholder stub; 8.2 delivers per-entity panels only (central index stays optional 8.5) â€” don't build the wrong surface or touch nav.
- [Phase 5 â€” dev-story] ATDD scaffolds drove the impl to green with zero assertion changes (only two mechanical fixes) â€” red-phase scaffolding paid off; keep the pattern.

## Story 8-3-tenant-authorized-signed-file-access
- [Phase 7 â€” Tier-A review] Story's headline UX behavior (expiry->refresh) shipped with its E2E deferred (test.fixme + vacuous-capable denial check) â€” proof rests on INT-by-equivalence; invest in a low-TTL/clock-seam test-DX before Epic 8 closes rather than accumulating across 8.x.

## Story 8-4-quote-pdf-attachment-and-acceptance-evidence-locks
- [Phase 3 â€” create-story] 6.3 PDF-retry file_id re-point is the load-bearing edge case: pre-send re-point must stay allowed, post-send rejected (FL823) â€” asymmetry vs QV409 (which exempts pdf_* render columns while the file-LINK carries commitment identity once sent); don't break 6.3 suites.
- [Phase 3 â€” create-story] Both evidence/PDF link create paths are FROZEN RPCs â€” parent-state-keyed trigger is the only clean lock-apply mechanism avoiding edits to frozen code; this drove the task design.
- [Phase 4 â€” atdd] Red scaffolds for not-yet-existing exports/modules must use typed local stubs, not static imports â€” a static import of a missing export fails at collection even under describe.skip, breaking the every-PR gate; green-phase real import left as a comment to uncomment.
- [Phase 5 â€” dev-story] The story's preferred file_links-write trigger alone was insufficient: mark_quote_version_sent and the accept RPC flip parent status WITHOUT re-writing file_links, so links created while draft would never lock â€” needed two parent-side lock-apply triggers (quote_versions draft->non-draft, quote_acceptances insert). Non-obvious gap in the 2.1 design note.
- [Phase 5 â€” dev-story] now() = transaction_timestamp() within a txn made a naive lock-apply idempotency guard mask an is_locked=false disarm as a same-tuple no-op â€” the apply trigger must key skip-re-locking on OLD.is_locked (UPDATE arm), not NEW.is_locked, so a disarm reaches the enforce trigger.
- [Phase 7 â€” Tier-A review] A test whose title over-claims relative to its body is a coverage-honesty trap: the AC4 'atomicity' INT test proved lock precision, not fault-injection â€” reads as green AC coverage while the literal case is never exercised; renamed + cited the real atomic-by-construction proof (8.4-RLS-04).
