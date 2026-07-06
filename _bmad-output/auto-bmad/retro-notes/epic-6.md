## Story 6-1-quote-snapshot-schema-and-server-side-version-creation
- [Phase 3 â€” create-story] Epic-5 retro's pnpm-audit 'fifth-carry' action item is stale â€” project-context.md records it RESOLVED (blocking high-level CI gate, owner decision 2026-07-03); downstream gate/NFR work should trust project-context, not the retro's pre-resolution framing.
- [Phase 5 â€” dev-story] 8.1's file-tables-migration-reset name-shape allowlist legitimately caught quote_version_attachments; resolved by excluding the sanctioned Epic-6 owner explicitly â€” attachment-named Epic-6 tables trip 8.1's guard, later stories should expect this.
- [Phase 5 â€” dev-story] Pre-authored ATDD golden fixture's source shape differed from the final builder input; adapted via a fixture->builder-input adapter instead of rewriting the fixture â€” pattern to reuse when scaffolds pre-date the implementation.
- [Phase 7 â€” code review] Golden pack copies warning codes as free strings with no validation against the real ReadinessCode union, so it can pin fictional codes â€” representativeness trap for Epic-9 Lovable-delta reconciliation; standing golden-hardening item epic-wide.

## Story 6-2-draft-quote-version-review-and-timeline-ux
- [Phase 3 â€” create-story] QUOTE_VERSION_LOCKED is NOT yet in CommandErrorCode â€” it is introduced by 6.4; 6.2's draft-only guard uses VALIDATION_FAILED or an additive QUOTE_VERSION_NOT_DRAFT, never borrows the 6.4 code. Later stories: don't reference 6.4 error codes before 6.4 lands.
- [Phase 5 â€” dev-story] 6.2-E2E-03 authored as a fast-gate route/surface presence-scan (node --test) instead of Playwright â€” epic test-design trace should map E2E-03 to a unit-tier guardrail.
- [Phase 5 â€” dev-story] adminInsertQuoteVersion extended additively with status/intro_text seed cols to build real multi-version fixtures â€” 6.3/6.4/6.5 can reuse these.

## Story 6-3-quote-pdf-generation-from-snapshot
- [Phase 3 â€” create-story] 6.3 is materially heavier than the sibling UI stories: additive pdf_status migration, gated renderer dependency, and the FIRST story to write real object bytes to storage (8.1 was metadata-first, 8.2 never landed) â€” the epic's '6.3 just reuses 8.1' assumption understated this.
- [Phase 3 â€” create-story] Forward obligation for 6.4: the sent-immutability trigger MUST exempt pdf_status/pdf_file_id/pdf_generated_at (6.3 keeps them mutable for retry on sent versions).
- [Phase 4 â€” ATDD] Renderer selection is a live Stop Condition for dev-story: a headless-browser PDF engine (heavy binary) requires human approval â€” scaffolds assume a lightweight text-emitting Node lib (pdf-lib/pdfkit) so the text-extraction golden stays viable.
- [Phase 5 â€” dev-story] quote_events.event_type CHECK had to be widened (pdf_generated/pdf_failed) â€” story scope note claimed 'only schema change is pdf_status' but AC3's mandated lifecycle event forced a second additive change; epic retro should reconcile the scope-note wording.
- [Phase 5 â€” dev-story] pdf-parse@1.1.1's bundled pdf.js cannot parse modern pdf-lib output â€” text extractor uses pdfjs-dist legacy build instead; trap for any future PDF-text story.
- [Phase 5 â€” dev-story] 6.3 is the first story writing real object bytes and inserting files rows with an explicit server-generated id (id-in-path parity) â€” an 8.2 upload story should consolidate this into a shared helper.
- [Phase 7 â€” code review] The rot-with-tillval-hidden-and-attachments golden shipped a hidden row with an EMPTY mustNotAppear, so the text-extraction golden provided zero negative-assertion coverage and the hidden-row PDF leak passed all green gates â€” a golden with mustNotAppear: [] guards nothing; require negative assertions on every leakage-sensitive fixture.

## Story 6-4-mark-quote-version-sent-and-enforce-immutability
- [Phase 3 â€” create-story] AC1's 'record sent timestamp/channel/reference if supported' has no sent_* columns on quote_versions â€” story routes it through the existing quote_events sent row (occurred_at/channel/reference) to avoid a schema change; a real delivery-status/channel-enum model is a needs-human STOP.
