---
stepsCompleted:
  - 'step-01-preflight-and-context'
  - 'step-02-generation-mode'
  - 'step-03-test-strategy'
  - 'step-04-generate-tests'
  - 'step-05-validate-and-complete'
lastStep: 'step-05-validate-and-complete'
lastSaved: '2026-07-06'
story_id: '7.2'
inputDocuments:
  - '_bmad-output/implementation-artifacts/7-2-idempotent-accept-quote-and-create-job-command.md'
  - '_bmad-output/test-artifacts/test-design-epic-7.md'
  - '_bmad/tea/config.yaml'
  - '_bmad/bmm/config.yaml'
  - 'tests/integration/commands/capture-quote-acceptance.int.test.ts'
  - 'tests/integration/commands/mark-quote-version-sent.int.test.ts'
  - 'tests/e2e/quotes/quote-acceptance-capture.e2e.spec.ts'
  - 'tests/unit/features/quotes/acceptance-price.test.ts'
  - 'tests/unit/lib/money/golden-pack.test.ts'
  - 'tests/factories/tenants.ts'
  - 'tests/fixtures/golden/money/accepted-price-deltas.json'
---

# ATDD Red-Phase Checklist — Story 7.2 (Idempotent Accept Quote & Create Job)

**Role:** Master Test Architect (TEA) · **Mode:** Create · **TDD phase:** RED
**Story:** `_bmad-output/implementation-artifacts/7-2-idempotent-accept-quote-and-create-job-command.md`

## Step 1 — Preflight & Context

- **Stack detected:** `fullstack` — Next.js (React) app + Supabase Postgres backend. Manifests: `package.json`, `playwright.config.ts`, `vitest.config.ts`.
- **Test frameworks configured:** Vitest (DB-backed INT/RLS against the local Supabase stack), `node --test` (pure UNIT + GOLDEN under `tests/unit/**`), Playwright (E2E). ✅ prerequisites met.
- **Story status:** `ready-for-dev` with 6 clear acceptance criteria (AC1–AC6) and an authoritative test spec (test-design-epic-7.md, story-7.2 rows). ✅
- **Confirmed genuinely RED:** `acceptQuoteAndCreateJob` command, the `accept_quote_and_create_job` RPC migration, the `jobs`/`job_events` read-back factory helpers, and the accepted-version affordance-gating do NOT yet exist. Predecessor 7.1 assets (`captureQuoteAcceptance`, `acceptance-price.ts`, the acceptance/jobs schema + uniqueness backstops + table enrollment) are landed and reused.
- **TEA config:** `tea_execution_mode: auto`, `tea_use_playwright_utils: true`, `test_stack_type: auto`, `communication_language: English`, `test_artifacts: _bmad-output/test-artifacts`.

## Step 2 — Generation Mode

- **Mode: AI generation** (fullstack; acceptance criteria clear; the load-bearing surface is DB-backed transaction behavior, not novel UI recording). No browser recording needed — the E2E states mirror the existing `quote-acceptance-capture.e2e.spec.ts` UI contract. Scaffolds authored directly against this project's existing harness conventions (the substantive deliverable is real, convention-matching test files, not intermediate JSON).

## Step 3 — Test Strategy (AC → level → priority)

| AC | Behavior | Level(s) | Priority | Test IDs |
| --- | --- | --- | --- | --- |
| AC1 | Atomic accept-and-create-job happy path (acceptance + `sent→accepted` + job + quote/job/audit events, committed together) | INT + E2E + GOLDEN | P0 / P1 | 7.2-INT-01, 7.2-E2E-01, 7.2-GOLDEN-01 |
| AC2 | Idempotent retry + concurrency + DB uniqueness backstops (existing ids returned, never a second job) | INT | P0 | 7.2-INT-02, 7.2-INT-03, 7.2-INT-06, 7.2-INT-08 |
| AC3 | Atomicity / behavioral rollback on injected mid-transaction failure (no partial state, NFR20) | INT | P0 | 7.2-INT-04 |
| AC4 | Sent-precondition + cross-tenant/anon rejection (server truth, before any write) | INT/RLS | P0 | 7.2-INT-05 |
| AC5 | Adjusted accepted price gated + öre discipline (reason required server-side; öre delta via `@/lib/money`) | GOLDEN + UNIT (+ INT) | P1 / P2 | 7.2-GOLDEN-01, 7.2-UNIT-01 |
| AC6 | Immutable job source refs (accepted version id + acceptance id; no cost/margin/invoice/Fortnox/field-worker column) | INT + GOLDEN | P0 / P1 | 7.2-INT-01 (source-ref + scope-guard asserts), 7.2-GOLDEN-01 |
| — | H1 determinism (explicit `p_accepted_at` + injected command clock, no wall-clock) | UNIT | P2 | 7.2-UNIT-01 |
| — | Event/audit completeness + no-duplicate-on-retry, allow-listed metadata | INT | P1 | 7.2-INT-07 |
| — | Affordance-gating carry: new-version/PDF-retry gated off `accepted` (Task 5) | E2E | P1 | 7.2-E2E-02 |

- **Level rationale:** the transaction (idempotency + atomicity/rollback + concurrency + cross-tenant/anon) is proven at INT (DB-backed, below the command) — the epic Testability notes 2/3/6 require behavioral proofs, not field-exists checks. Money/öre + determinism are proven at the fast pure gate (GOLDEN/UNIT). UI states (repeat-shows-existing, affordance gating) are E2E-only and never assert DB persistence (architecture §9). No duplicate coverage across levels.
- **RPC-swap coverage inversion (Testability note 10):** the LIVE acceptance path moves from `captureQuoteAcceptance` → `acceptQuoteAndCreateJob`; all idempotency/privilege/cross-tenant negatives target the LIVE entry point (`acceptQuoteAndCreateJob`), NOT the superseded 7.1 capture command. ✅ enforced in the INT scaffold.

## Step 4 — Generated RED-Phase Scaffolds

| File | Level / Runner | IDs covered | Red-phase mechanism | State |
| --- | --- | --- | --- | --- |
| `tests/integration/commands/accept-quote-and-create-job.int.test.ts` | INT / Vitest (local stack) | 7.2-INT-01..08 | `describe.skip` + commented expected-behavior bodies + `expect.fail("RED: …")`; imports the not-yet-exported command (commented) | 14 tests, all skipped ✅ |
| `tests/unit/server/commands/accept-and-create-job-timestamp.test.ts` | UNIT / `node --test` (pure) | 7.2-UNIT-01 | per-test `{ skip }` marker; imports the not-yet-built RPC-arg adapter (commented) | 4 tests, all skipped ✅ |
| `tests/unit/features/quotes/accept-quote-to-job-golden.test.ts` | GOLDEN / `node --test` (pure) | 7.2-GOLDEN-01 | LIVE oracle over the extended fixture — GREEN now (goldens have no red-phase gate; a fixture-shape + arithmetic deliverable) | 25 tests, 25 pass ✅ |
| `tests/fixtures/golden/money/accepted-price-deltas.json` | GOLDEN fixture (extended, additive) | 7.2-GOLDEN-01 | ADDED `transactionCases` + `transactionPolicy` block (accepted-price-vs-sent-total delta + immutable job source refs + documented Lovable transactional delta); 4.4 `deltaCases` untouched | valid JSON ✅ |
| `tests/e2e/quotes/quote-accept-create-job.e2e.spec.ts` | E2E / Playwright | 7.2-E2E-01/02 | `test.describe.skip` until the Task-4 re-point + Task-5 gating land | follows project global-setup fixture convention (identical to sibling specs) ✅ |

**Verification run (this session):**
- Golden: `25 pass / 0 fail` (`npx tsx --test tests/unit/features/quotes/accept-quote-to-job-golden.test.ts`).
- INT: `14 skipped` under `npx vitest run …` (collects cleanly, no stack required while skipped).
- UNIT: `4 skipped` under `node --test`.
- E2E: collection deferred to global-setup (top-level `readFileSync(fixture.json)` is the established project pattern — the existing `quote-acceptance-capture.e2e.spec.ts` behaves identically under a bare `--list`; not a defect).

## Step 5 — Validation & Completion

- [x] Prerequisites satisfied (stack, frameworks, clear ACs, authoritative test spec).
- [x] Test files created at project-correct locations (INT → `tests/integration/commands/**`, pure → `tests/unit/**`, E2E → `tests/e2e/quotes/**`, fixture → `tests/fixtures/golden/money/**`).
- [x] Checklist maps every AC to a level + priority + test ID; no orphan ACs.
- [x] Tests designed to FAIL before implementation (INT/UNIT/E2E skipped with `expect.fail`/`{skip}`/`describe.skip`; the golden is a legitimately-GREEN fixture oracle).
- [x] Harness conventions honored: per-run `crypto.randomUUID()`, BYPASSRLS raw-pg readback (bigint öre → STRING), `skipUnlessStack` per-test skip, `SUPABASE_TEST_REQUIRED=1` CI hard-fail, real sent fixture via the landed `mark_quote_version_sent` RPC, non-zero frozen `accepted_price_ore`, sleep-free `Promise.all` concurrency, öre < 10 digits, no PII/clock in the golden.
- [x] No orphaned browser/CLI sessions; temp artifacts confined to `{test_artifacts}/`.

### Dev handoff — build these to turn the scaffolds GREEN

1. **Migration** `supabase/migrations/20260710120000_accept_quote_and_create_job.sql` — the narrow SECURITY INVOKER RPC (lock version + parent quote `FOR UPDATE`, re-assert `status='sent'`, idempotent existing-record return, insert acceptance, flip `sent→accepted` [status ALONE — sent-lock trigger co-mutation trap], insert job + `job_events`, `quote_events` accepted, rollback; revoke-from-public/grant-authenticated+service_role).
2. **Command** `src/server/commands/quotes/accept-and-create-job.ts` (+ `validation.ts`, `index.ts` export) — `acceptQuoteAndCreateJob`; expose a PURE `buildAcceptAndCreateJobRpcArgs(input, clock)` seam for 7.2-UNIT-01.
3. **Factory read-back helpers** in `tests/factories/tenants.ts`: `adminSelectJobRow`, `adminSelectJobsForAcceptance`, `adminSelectJobEventsForJob` (mirror `adminSelectQuoteAcceptanceRow`/`adminSelectAcceptancesForVersion`); an anon (no-session) client helper for the UNAUTHENTICATED negative.
4. **Fault-injection seam** for 7.2-INT-04 (a command/RPC hook OR a crafted mid-txn constraint violation) — the behavioral rollback proof.
5. **Error code** `ACCEPTANCE_ALREADY_RECORDED` in `command-errors.ts` IF a genuinely-unresolvable concurrency race must surface (prefer the idempotent return per AC2).
6. **UI re-point (Task 4)** + **affordance-gating (Task 5)** — testids the E2E asserts: `quote-acceptance-accepted`, `acceptance-error` (absent), `create-new-version`/`quote-pdf-status` absent on `accepted`.

Then: remove `.skip` / `expect.fail` / uncomment the command import + assertion bodies; run the full gate (UNIT/GOLDEN seconds, INT on the local stack, E2E within the 15-min bar).

### Key risks / assumptions

- **Assumption (7.2 Decision default (a)):** the acceptance INSERT moves INSIDE the 7.2 transaction; the live UI re-points from `captureQuoteAcceptance` to `acceptQuoteAndCreateJob` (7.1's capture command may stay exported for its green INT tests). Scaffolds target the LIVE `acceptQuoteAndCreateJob` entry point.
- **Assumption:** the idempotent concurrency loser MAY either idempotent-return the winner's records OR fail cleanly with `COMMAND_CONFLICT`/`ACCEPTANCE_ALREADY_RECORDED` (7.2-INT-06 accepts both; NEVER two jobs).
- **Golden = pilot assumption** (Sign-Off Q8 open, demo-data-only): the transaction öre shapes are `new-expected`/`documented-delta` labelled, nothing production-approved. STOP (needs-human) only if the transaction mechanism must change from the narrow SECURITY INVOKER RPC (ADR-A009), if public/customer acceptance is requested, or if real customer quote data is needed for a fixture — none apply here.

**Next recommended workflow:** `dev-story` (implement 7.2), then remove the red-phase markers and re-run the gate; optionally `trace` for the epic-7 traceability matrix once green.
