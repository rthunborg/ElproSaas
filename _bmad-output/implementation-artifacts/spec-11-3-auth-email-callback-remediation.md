---
title: 'Story 11.3 follow-up: Auth email callback remediation'
type: 'security-and-correctness-follow-up'
created: '2026-09-14'
status: 'in-review'
baseline_commit: '0314be056a44ccaafd1c20b640c9a4fcbd6a122c'
context:
  - '_bmad-output/implementation-artifacts/spec-11-3-admin-user-management.md'
  - '_bmad-output/implementation-artifacts/spec-11-3-invitation-identity-binding-remediation.md'
  - 'docs/process/local-setup.md'
  - 'docs/process/review-order.md'
authorization: 'User authorized the Epic 11 closure work, merge sequence, and deployment on 2026-09-14.'
---

## Intent

Repair the real Auth email callback path for Story 11.3. Supabase's standard local invite and recovery emails return the session as an implicit-flow URL fragment. A Next route handler cannot receive that fragment, so the former route treated a valid email callback as absent credentials and sent the browser to login. The fix keeps server verification for code and token-hash callbacks, while moving only implicit-flow session consumption to a browser page using the established public Supabase client.

## Acceptance

- Given a real Auth invitation email with the configured callback, when its link is opened in a browser, then the browser establishes the authenticated session, reaches the matching invitation acceptance form, and database-confirmed activation makes the intended membership active.
- Given a real Auth recovery email with the configured callback, when its link is opened, then the browser establishes a recovery session, reaches password update, and the submitted password can authenticate the user afterwards.
- Given a PKCE `code` or token-hash callback reaches the existing server route, when it succeeds or fails, then its current server-side verification and destinations remain intact.
- Given a callback has no server-visible credential because its session is in a fragment, when the route delegates to the completion page, then it forwards only `membershipId` and `attempt` on the same origin; it never forwards an untrusted destination or introduces a privileged endpoint.
- Given Playwright uses the supported production-mode local hosts, when an Admin service creates a callback URL, then the configured application URL and local Auth redirect allow-list agree at ports 3000 and 3100.

## Scope

The active RBAC/Admin-user surface only: the existing callback route, an unauthenticated browser completion page that consumes a normal public Auth session, callback destination selection, local callback configuration, focused unit tests, real Mailpit-to-browser tests, and this artifact. This adds no service-role client to a browser path, no new database procedure, no Auth policy change, and no customer portal or Phase C capability.

## Tasks

- [x] Route fragment-only callbacks to a same-origin browser completion page while preserving code and token-hash handling.
- [x] Initialize the existing browser Auth client before routing an established session to recovery or invitation acceptance.
- [x] Derive callback URLs from the configured Playwright base URL and align the exact local Auth redirect entries.
- [x] Add real local Auth/Mailpit browser evidence for invitation activation and recovery password persistence, with tracing disabled.
- [x] Add focused destination-selection unit coverage and record final author review order.

## Verification

- `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/admin-users/auth-email-callback.test.ts` — 3 passed, 0 failed.
- `pnpm exec tsc --noEmit --pretty false` — passed.
- `pnpm build` — passed; the new completion page is included as a static route.
- `pnpm exec eslint src/app/auth/invite/confirm/route.ts src/app/auth/invite/complete/page.tsx src/features/admin-users/auth-email-callback.ts tests/unit/admin-users/auth-email-callback.test.ts tests/e2e/auth/auth-mail-callback.e2e.spec.ts playwright.config.ts` — passed.
- A bounded Auth-to-Mailpit transport probe sent a disposable local invite using the production test callback shape, then recorded only origin/path/query-key names. Auth returned HTTP 303 from `/auth/v1/verify` to `/auth/invite/confirm` with both `membershipId` and `attempt` present. The probe deleted its created Auth user. This confirms the exact callback allow-list accepts the opaque query state.
- An initial guarded browser run executed 2 tests: recovery passed and invitation failed before activation. It exposed a harness defect: globally URL-decoding the full email verification URL corrupted the nested `redirect_to` query. That run is not claimed as coverage. The helper now decodes HTML entities only, preserving the actual mailed URL.
- `SUPABASE_TEST_REQUIRED=1 CI=1 E2E_PORT=3000 pnpm exec playwright test tests/e2e/auth/auth-mail-callback.e2e.spec.ts` — replacement root-owned guarded production-browser run passed 2/2 tests with 0 skips (12.4s): actual Auth invitation → Mailpit → browser session → database membership activation, and actual recovery email → browser recovery session → persisted password update. Tracing remained disabled and no callback URL/token was printed.
- `node scripts/verify/check-review-order.mjs "_bmad-output/implementation-artifacts/spec-11-3-auth-email-callback-remediation.md"` — 13 references, 0 errors.

Limits: the browser proof uses the local Auth/Mailpit stack only and does not send email through a hosted provider. Hosted Supabase Auth redirect and template settings remain an operational configuration check; the application change does not rewrite, fabricate, or log verification URLs.

## Suggested Review Order

Author: Story 11.3 Auth-callback remediation implementation author.
Refreshed against the final working tree based on `0314be056a44ccaafd1c20b640c9a4fcbd6a122c`.

### Keep credentials at the browser boundary and callback routing same-origin

The route continues its existing code/token-hash server verification. It delegates only the fragment-only case to a client component, where the public browser client can consume the fragment and persist its session cookie. Destination selection has no caller-provided external URL.

- `src/app/auth/invite/confirm/route.ts:6` — uses the deployment-owned application origin and fails closed for an unconfigured production callback, rather than forwarding a browser fragment to a request-derived host.
- `src/app/auth/invite/confirm/route.ts:12` — recognizes the fragment-only server request and copies only established invitation context to `/auth/invite/complete`.
- `src/app/auth/invite/complete/page.tsx:33` — removes the fragment before the PKCE-configured browser client is created, so one-time credentials do not persist in browser history or enter the wrong parser.
- `src/app/auth/invite/complete/page.tsx:39` — persists the explicit implicit-flow session through the public client, then revalidates the authenticated user before navigation.
- `src/features/admin-users/auth-email-callback.ts:5` — maps recovery to password update and otherwise constructs the fixed same-origin acceptance route.
- `src/features/admin-users/auth-email-callback.ts:19` — accepts only HTTP(S) deployment configuration and denies a missing production origin.
- `tests/unit/admin-users/auth-email-callback.test.ts:16` — pins deployment-origin selection and fail-closed production behavior.

### Prove the actual email-to-browser journeys at the real security boundary

The browser test creates local Auth accounts, receives actual provider messages through Mailpit, opens the real verification URLs without logging them, and proves the final database/account state. It disables tracing because one-time credentials can appear in callback fragments.

- `tests/e2e/auth/auth-mail-callback.e2e.spec.ts:22` — disables traces for this token-bearing email flow.
- `tests/e2e/auth/auth-mail-callback.e2e.spec.ts:41` — decodes Mailpit HTML entities without URL-decoding nested `redirect_to` state.
- `tests/e2e/auth/auth-mail-callback.e2e.spec.ts:92` — invitation proof inserts the durable matching invitation, follows actual Auth mail, then asserts authenticated database activation.
- `tests/e2e/auth/auth-mail-callback.e2e.spec.ts:154` — recovery proof follows actual Auth mail, updates the password, and authenticates with the new password using the anon client.

### Keep local callback configuration aligned with the actual production-mode runner

The Playwright web server declares its own public app URL, and the local Auth allow-list has exact callback paths for both supported local production-mode ports. No test redirects toward the shared demo project.

- `playwright.config.ts:65` — passes the current test host as `NEXT_PUBLIC_APP_URL`.
- `supabase/config.toml:190` — permits only the two exact local callback URLs used by the documented runner configurations.
