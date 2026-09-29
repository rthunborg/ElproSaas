# Epic 13 quote-delivery preference focused review

Date: 2026-09-27  
Reviewer role: independent security follow-up  
Commit: `83da25f`  
Parent: `b75b155`  
Branch: `epic/13-wave-b1a-notifications-and-email-infrastructure`  
Review scope: regressions in the latest preference-removal fix and unresolved serious findings only, under the post-round-three review rule.

## Verdict

Pass for the focused change. No concrete production-reachable correctness, security, tenant-isolation, data-integrity, or customer-output defect was identified.

The approved removal is coherent across the UI, API, registry, and database boundary. `quote.delivery` remains active manifest/registry taxonomy for the outbox and recipient-scoped suppression, while it is excluded from personal preferences. Existing inert preference rows are retained by decision, hidden from the eligible API result and UI, and cannot be newly inserted or updated as `quote.delivery`.

## Verified security paths

| Path | Caller and authority | Invariant checked | Evidence |
| --- | --- | --- | --- |
| Preferences UI | Authenticated app user | Neither the in-app nor email `quote.delivery` toggle is rendered | `NotificationPreferences` derives rows from `activeNotificationPreferenceCategories`; the changed browser assertions require both `Offertleverans` controls to be absent. |
| Preferences API read | Authenticated, request-bound Supabase client after tenant-context resolution | Legacy `quote.delivery` rows cannot reappear in the supported preference surface | `GET /api/notifications/preferences` filters by tenant, user, and the preference-eligible registry projection. |
| Preferences API write | Authenticated, request-bound Supabase client after tenant-context resolution | The API cannot create or change an ineffective `quote.delivery` preference | `PUT` resolves through `notificationPreferenceCategory`; `quote.delivery` returns `null` before the upsert. |
| Direct table write | Authenticated PostgREST caller or privileged server caller | Inserts, upserts, and updates whose resulting category is `quote.delivery` fail at the database boundary | Migration `20260927100000_remove_quote_delivery_preferences.sql` installs a `BEFORE INSERT OR UPDATE` trigger that raises SQLSTATE `23514`; required integration assertions passed for authenticated insert and upsert attempts. |
| Existing rows | Existing tenant/user-scoped rows created before this migration | Rows remain available for audit/retention without influencing the supported UI/API | The migration contains no data rewrite or delete. The API category filter hides them, and the trigger prevents further writes that retain or create `quote.delivery`. Existing RLS continues to restrict direct reads to the row owner in an active tenant. |
| Public unsubscribe | Anonymous holder of a valid token capability | Suppression remains recipient-, tenant-, and category-scoped and cannot reactivate delivery | `consume_email_unsubscribe_token` derives tenant, recipient hash, and category from the locked token row and writes `email_suppressions`. `processEmailOutbox` calls `suppress_queued_email_outbox` before release evaluation or claim, and the SQL transition matches the same tenant, recipient hash, and category tuple. The new preference trigger does not touch these tables or functions. |
| Scope governance | Manifest and server registry consumers | Removing the preference controls does not remove the live outbox category or public unsubscribe surface | The notifications module remains active with `quote.delivery` and `unsubscribe`; `activeNotificationCategories()` still returns `quote.delivery`, while the new preference projection excludes it. |

No authorization level or caller was found that can create the ineffective preference while staying within the supported API, authenticated PostgREST grants, or service paths. PostgreSQL triggers remain enforced for service-role writes; the new trigger performs no cross-tenant lookup or mutation and does not weaken the existing forced-RLS policies.

## Evidence

Independently executed on the checked-out commit:

- Registry unit test: 3 passed, 0 failed, 0 skipped.
- Required database tests for notification preferences and email activation: 2 files, 17 passed, 0 failed, 0 skipped with `SUPABASE_TEST_REQUIRED=1`.
- Required database test for the public unsubscribe capability: 1 file, 3 passed, 0 failed, 0 skipped with `SUPABASE_TEST_REQUIRED=1`.
- Downstream suppression composition: the unsubscribe test proved that a `quote.delivery` token creates the exact tenant/category suppression and cannot remove it through the legacy reactivation argument; the email-activation suite proved that a matching suppression transitions queued work to `suppressed` before rendering or provider submission. The shared SQL predicate is category-generic and unchanged by this commit.
- `git show --check 83da25f`: no whitespace errors.
- Suggested Review Order validator: full-trail candidate, 47 references, 0 errors.

Author-reported evidence recorded in the final story trail:

- Typecheck passed.
- Lint passed.
- Registry unit tests passed 3 tests.
- Required database tests passed 17 tests with 0 skips.
- The changed local browser assertions were not run.

Remote checks at review time:

- `verify`: passed.
- Vercel preview deployment and preview comments: passed.
- `db`, `e2e`, and `recovery-storage-loader`: pending.

## Findings and limitations

No production-reachable findings.

Local browser evidence is absent for the two removed controls. The focused static path and database boundaries are verified, and remote E2E is pending; final merge readiness still depends on the remote required checks completing successfully.

The author-written `Suggested Review Order` matches the final preference-removal diff and accurately identifies the retained-row and browser-evidence limits. The pre-existing modification to `_bmad-output/auto-bmad/state/epic/epic-13.yaml` was not changed by this review.
