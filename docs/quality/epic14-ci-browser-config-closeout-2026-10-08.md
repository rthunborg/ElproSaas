# Epic 14 CI browser runner configuration closeout — 2026-10-08

Author: `/root/merge_review`, `gpt-6.1-sol` High, because the fixture executes the real signed booking review and authorized command path. This is a bounded CI configuration repair; it consumes no broad story review round.

## Observed failure and cause

CI run `37769139173` on `e1e663ce` executed the whole browser suite: **193 passed / 4 failed**. Both the initial attempts and configured retries of the four failing Story 14.4 cases stopped with `booking detection is not configured`. The saved ignored diagnostic is `tmp/epic14-closeout-stack/ci-e1e663ce-e2e-api.log`; its failures retain the original test locations `booking-editor.e2e.spec.ts:310`, `:420`, `:473` and `:511`.

Those four cases seed reviewed bookings through `createReviewed()` in the Playwright worker. It calls the real `previewBookingEditor()` and booking command, including `bookingConflictKeyFromEnv()`. The E2E job supplied no booking attestation pair to that worker. `playwright.config.ts` supplied the existing synthetic pair only to the separate Next `webServer` child, which explains why app-driven booking journeys could succeed while the reviewed fixture setup failed. The exception occurs at the explicit missing-configuration check, before preview/commit; it is distinct from the earlier local transport and database-capacity failures.

## Repair and validation

The E2E job environment now includes only the two existing synthetic local/CI booking attestation variables. They match `tests/support/test-env.ts`, the Playwright web server and `supabase/seed.sql`'s local Vault fixture. No production configuration, fallback, public environment variable, signing implementation, test assertion, retry, timeout or budget changed. The values are already committed synthetic fixture material; this document records no runtime credentials or proof payloads.

Executed source/static checks:

- Installed `js-yaml` parsed the complete workflow. Removing the two new E2E variables produced deep equality with the workflow at `HEAD`, proving all other parsed workflow settings remained unchanged.
- Both values matched the canonical test constants and web-server bindings; the HMAC value also matched the existing Vault seed.
- An isolated in-memory execution of the actual attestation source preserved the missing-configuration rejection, accepted the workflow pair and verified a synthetic signing round trip. No network, database or managed resource was used and no signature was printed.
- `git diff --check` passed for the workflow and this evidence document.

The initial validation probe expected the optional `yaml` package, which is absent; it failed before checking the workflow. Validation then used the installed `js-yaml` parser successfully. This setup probe is not runtime coverage.

Fresh CI E2E execution of the repaired head is **pending** at this author update. The failed `e1e663ce` run remains counterevidence; static checks do not turn it into a pass. The earlier parent-owned local 23/23 browser result used a configured runner environment and remains separate evidence. Full required integration, representative performance, physical/daylight review and Story 15.1 calendar limitations retain their separately recorded disposition.

## Suggested Review Order

### Worker configuration matches the existing application and database fixture

The job environment supplies the same private synthetic pair to the worker that already seeds real reviewed bookings; it does not replace that flow with a fabricated receipt or direct fixture acceptance.

- `.github/workflows/ci.yml:370` — explanatory comment and the two E2E job variables.
- `playwright.config.ts:79` — existing pair supplied to the separate app child.
- `tests/support/test-env.ts:52` — canonical synthetic booking fixture pair.
- `supabase/seed.sql:158` — matching local/CI Vault fixture.

### Actual caller and fail-closed boundary explain the four failures

The caller needs explicit configuration because it invokes production preview and commit code in the worker process. The production accessor keeps its original fail-closed behavior.

- `tests/e2e/support/booking-editor-atdd.ts:202` — `const createReviewed`: retains authenticated current authority, validated input, real preview and command assertions.
- `src/server/bookings/conflict-attestation.ts:22` — `bookingConflictKeyFromEnv()` still rejects missing or malformed configuration.

Independent review and fresh runtime gate results belong to the coordinator; this author does not self-approve publication or release completion.
