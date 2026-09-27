# Epic 13 Narrow Final Convergence Review — 2026-09-27

## Review contract

This is the owner-approved post-third-round convergence review. It is restricted to regressions in the remediation chain and unresolved consequential findings at the four finished Story 13 boundaries:

- Story 13.1 scheduler authorization, rotated-secret expiry, registry enrollment, invocation budget, durable cursor authority, bounded same-tenant work, and later-tenant progress;
- Story 13.2 tenant/recipient notification isolation and the approved personal-preference projection;
- Story 13.3 enqueue deduplication, suppression ordering, lease ownership, and bounded runner dispatch;
- Story 13.4 linked recipients, correction/reissue, terminal revalidation, exact send-role authority, immutable PDF access, UUID canonicalization, and durable recovery evidence.

The reviewed code head is `d770780`. The final remediation chain is `e11d24a`, `61f2394`, `4024cbe`, `b75b155`, `83da25f`, `b06c3ca`, `2664d7b`, `8a1eb8c`, `2f374f9`, `f226415`, `46d9b67`, and `d770780`. This record does not claim that the unavailable historical whole-epic cross-model pass occurred.

## Structured outcome

| Story | Focused disposition | Current invariant |
| --- | --- | --- |
| 13.1 | PASS at source and focused-test level; exact-head CI pending | Both HTTP methods authenticate before privileged setup. Rotation expiry is clock deterministic. The route supplies an internal invocation deadline and abort signal. The runner resumes an exact tenant/producer tuple and each active follow-up invocation bounds due-follow-up, recipient, status, preference, and write work with a durable producer cursor. A failed page retains its input checkpoint and later tenants still progress. |
| 13.2 | PASS | Notification reads and acknowledgements remain tenant plus recipient scoped. `quote.delivery` stays live registry/outbox metadata but is excluded from personal preference API/UI eligibility; supported API and direct database writes cannot recreate the ineffective setting, retained rows are ignored, and token suppression stays recipient/category scoped. |
| 13.3 | PASS | Ordinary enqueue retry remains permanently deduplicated at delivery sequence 1; only queued recipient correction creates a later sequence. Suppression precedes release evaluation, claim, artifact access, render, and provider work. Queue mutation remains service-worker only, lease scoped, and tenant explicit. |
| 13.4 | PASS at source and focused-test level; exact-head CI pending | The recipient is linked and frozen; correction is queued-only cancel plus a fresh sequence; claimed delivery rechecks terminal quote/fingerprint state. Validated UUIDs are canonical at both HMAC boundaries. PDF challenge/private verification and recovery evidence admit exactly `Quotes.Send`; immutable bytes use the request-bound exact-object read where authorized and the existing server-only exact-path broker only after a classified RLS denial, while raw salesperson Storage and general review/financial authority remain closed. |

## Consequential findings and resolutions

### Recovery evidence excluded valid send roles

**Reachable path:** `markQuoteVersionSent` admits tenant administrators, project managers, and salespeople through `Quotes.Send`. Its failure path called a recovery recorder that admitted only tenant administrators. A valid project-manager or salesperson command that failed during artifact preparation or finalization could lose required recovery evidence and surface the recorder error instead of the originating failure.

**Resolution:** `2664d7b` aligns recovery recording with the exact `Quotes.Send` role set while retaining authenticated actor equality, active same-tenant membership, and target ownership. The command preserves its original error if evidence persistence also fails.

### The first role repair exposed direct recovery forgery

**Reachable path:** the authenticated five-argument recorder accepted caller assertions. A same-tenant `Quotes.Send` user could append a false recovery row for an existing quote version without a failed command.

**Resolution:** `8a1eb8c` removes that endpoint and requires a five-minute, domain-separated HMAC over tenant, actor, quote version, correlation, failure stage, root fingerprint, and time window. The database separately rechecks authenticated actor equality, exact role set, tenant target, canonical times, and signature. The recovery-only subkey derives from the existing server-side quote-PDF root; no new credential is required, and neither root nor signature is exposed to the browser. The honest malformed PDF key-ID failure remains recordable because recovery uses the existing root independently of that malformed ID.

### UUID text diverged across Node and PostgreSQL signatures

**Reachable path:** UUID validation accepted uppercase text, Node signed the preserved text, and PostgreSQL reconstructed lowercase UUID text. A valid uppercase identifier could fail PDF attestation and then fail recovery attestation.

**Resolution:** `2f374f9` canonicalizes validated quote-version and recipient UUIDs before ownership, PDF, finalization, or recovery work. Unit coverage asserts normalized values; the command integration path supplies uppercase IDs.

### Active follow-up work could exhaust one invocation without progress

**Reachable path:** the production jobs route supplied no deadline. `quotes.follow-up-reminders` read every due follow-up and every membership before chunking writes. A large tenant could exceed the serverless invocation window before returning or persisting a producer cursor and could delay all later tenants on every retry.

**Resolution:** `f226415` adds a 45-second internal containment budget and abort signal, not a production SLO. The runner persists a tenant/producer tuple for inter-producer deadline stops and loads a producer cursor only when that producer's latest authoritative run outcome is `partial`; later `completed` or `failed` outcomes prevent an older partial from being resurrected. The follow-up producer uses a two-dimensional UUID cursor, bounded follow-up and membership pages, one-row latest-status reads per bounded quote, bounded preference lookup, bounded notification upserts, and abort propagation. A partial producer no longer prevents the runner from giving later tenants one bounded turn.

### A failed producer page discarded its durable checkpoint

**Reachable path:** after `f226415`, a partial producer cursor was durable, but the next failed or aborted page wrote a newer cursorless `failed` row. The latest-outcome loader correctly refused to resurrect the older partial, so the next invocation restarted at page one. Repeated failure on a later page could replay already completed work indefinitely instead of advancing that tenant.

**Resolution:** `46d9b67` copies the page's input cursor onto its failed row and treats the latest failed row with a cursor as retry authority. A first-page failure has no cursor. A completed outcome still carries no cursor and clears prior retry state. The database lifecycle check now allows an optional cursor for failed, still requires one for partial, and forbids one for running/completed. Deterministic coverage proves partial progress, later-page failure, retry from the same checkpoint, and later-tenant progress throughout.

### PDF challenge retained an older reviewer-only role gate

**Reachable path:** the send command and finalization wrapper authorize exact `Quotes.Send`, but both `prepare_quote_pdf_send_attestation` and its private verifier called the older tenant-admin-only review helper. The required database test reached the real project-manager/salesperson command and returned `TENANT_ACCESS_DENIED` before the intended finalization failure and recovery path.

**Resolution:** `f226415` changes only those two send-attestation functions to the existing exact `tenant_admin` / `projektledare` / `saljare` role assertion. It keeps fixed search paths, the authenticated challenge grant, and a private verifier with no application-role execute grant. General quote reviewer and financial authority do not change. The command obtains only the database-issued immutable object path and uses the existing server-only quote-PDF broker to fetch those bytes for hashing and finalization. Raw salesperson Storage list/download/sign, general files, arbitrary uploads, the hardened predicate, and cross-tenant broker use remain denied.

### The broker repair broke normal request-bound send paths

**Reachable path:** `f226415` made the server-only broker unconditional. Normal Administrator mark-sent integration paths use an authenticated request-bound client and intentionally do not expose a global service-role credential to the command test context. The broker threw `Quote PDF signing is not configured`; CI run `36343176057` consequently failed 86 database tests that seed a sent quote through the real command, even though the five recovery-focused tests supplied the credential locally and passed.

**Resolution:** `d770780` first downloads the database-issued exact object through the request-bound client. Roles with existing exact Storage authority therefore retain their normal path and require no new credential. Only a classified 401/403 or Storage-concealed 404 after the database challenge can use the existing exact-path broker; null/unclassified/transient/network failures do not elevate, corrupt bytes still fail size/SHA-256 validation, and a deletion race still fails broker signing. The salesperson keeps no raw list/download/sign authority.

No other production-reachable correctness, security, tenant-isolation, data-integrity, or customer-output defect remains in the narrowed source boundaries.

## Independent layer

An independent Luna/xhigh leaf is rechecking only the final fixes and unresolved serious boundaries. Its evidence is persisted in `docs/quality/epic-13-independent-luna-convergence-2026-09-27.md`. The final metadata decision remains held until that record covers `d770780` and exact-head CI finishes.

## Verification

### Existing primary evidence

CI run `36339205329` at `83da25f` passed:

- verify: 1,896 unit tests, zero failures, zero skips, plus typecheck, lint, build, dependency audit, source containment, and built-bundle containment;
- required database/RLS: 1,205 passed, zero failed, one explicit isolated-recovery skip;
- isolated recovery loader: 1 passed, zero skipped;
- production-server E2E: 172 passed, four explicit skips, zero failures;
- Vercel preview: success;
- trace gate: 26/26 P0 criteria FULL.

At `2f374f9`, CI run `36341895859` passed verify, E2E, isolated recovery, clean migration replay, and all new attestation/canonicalization cases except the real project-manager/salesperson command path. That single required database failure exposed the PDF send-role mismatch fixed in `f226415`. CI run `36343176057` at `f226415` then passed verify and isolated recovery but exposed the unconditional broker regression across normal mark-sent database suites; `d770780` fixes that path.

### Focused final-source evidence

- runner, route, bounded follow-up, send validation, recovery attestation, and route-auth units at `46d9b67`: 32 passed, zero failed/skipped;
- required job-runs integration after applying `20260927140000_preserve_failed_job_checkpoints.sql`: 1 passed, zero failed/skipped, including the lifecycle predicate;
- normal Administrator mark-sent dependent `accept-quote-and-create-job.int.test.ts` at `d770780`: 14 passed, zero failed/skipped, reversing the reproduced 13-of-14 failure;
- required `quote-delivery-finalization-failure.int.test.ts`: 5 passed, zero failed/skipped for rollback, malformed key, forgery/cross-tenant denial, and all three real send roles;
- focused salesperson reserved-PDF case: passed, including the raw Storage/general-file/direct-predicate/arbitrary-upload/cross-tenant denials;
- `pnpm exec tsc --noEmit`: passed;
- focused ESLint, service-role containment, and `git diff --check`: passed.

Exact-head CI for `d770780` is pending. It is the remaining execution gate for clean migration replay and the complete required database/E2E suite.

## Recorded limits

- Numeric production runtime, throughput, fairness, backlog-age, freshness, capacity, retention, and recovery targets remain owner/deployment contracts. The internal 45-second route budget and 25-by-25 follow-up page are containment defaults only.
- Retained legacy `quote.delivery` personal-preference rows are inert and hidden; deletion requires a separate retention decision.
- Real-recipient sending, production provider identity/credentials, provider-side acceptance idempotency, and provider-rendered unsubscribe URLs remain gated or deferred under ADR-B011.
- Shared E2E clock/random fixture cleanup remains advisory; this narrowed review found no current reachable defect from it.

## Verdict

**PAUSED CHECKPOINT — source and independent review PASS; exact-head `d770780` CI pending.** The user paused the workflow before the final CI receipt. Keep all four `followup_review_recommended` flags `true`; this checkpoint does not claim final convergence completion.
