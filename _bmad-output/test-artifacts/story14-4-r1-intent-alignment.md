I read all 68 changed files in the supplied diff, including complete product/test/migration changes and parsed evidence reports. The SHA256 matches the supplied value.

1. **Host-scoped capability reading:** Contract D defines the current exposed surfaces: toolbar creation and job/customer-connected editor entries. Standalone and connected create/update are supported by the common editor/command protocol; person/time prefill remains a reusable seam. Calendar click/drag belongs to 15.1.

2. **Complete current-host lifecycle reading:** Contract D defers only calendar click/drag. The problem statement and “Standalone/connected — valid create/update” expectation still imply users can reopen and edit standalone bookings through a currently exposed responsive editor.

3. **Logical latest-candidate reading:** Racing previews must never restore obsolete warnings or acknowledgment. The intent specifies the result, without requiring actual reversed network delivery in browser verification. A stronger evidence reading would expect the complete asynchronous interaction to be exercised in-browser.

The diff principally implements reading 1 and the logical guarantee in reading 3. It adds actual toolbar/job/customer hosts, the responsive editor, sanitized server preview, separate authenticated review receipt, selective whole-group acceptance, and atomic command/SQL persistence and replay. The acceptance tests exercise candidate-related selected groups, unselected/open groups, unrelated exclusion, stale review, rollback, current authorization and historical replay.

The material surface differences are:

| Intent expectation | Changed surface and exercised evidence |
|---|---|
| Standalone and connected create/edit through the editor | Standalone creation has browser coverage; connected bookings have browser reopen/edit coverage. [BookingEntry](/C:/DEV/ElproSaas/src/components/resources/BookingEntry.tsx:39) hides summaries and edit buttons on the toolbar. An unconnected booking therefore has no exposed reopen/edit entry in this diff. Standalone update exists at the command/editor capability boundary. This diverges from reading 2. |
| Retained person/time prefill | [Component coverage](/C:/DEV/ElproSaas/tests/integration/components/booking-editor.test.ts:77) renders supplied prefill. No actual calendar click/drag or calendar host is changed or exercised. This matches Contract D’s stated deferral; it does not establish calendar entry-point completion. |
| Latest warning set wins when previews race | [Browser coverage](/C:/DEV/ElproSaas/tests/e2e/booking-editor.e2e.spec.ts:329) releases obsolete work before the queued newest response because Next actions serialize. Reverse delivery is exercised through the production state function in [component tests](/C:/DEV/ElproSaas/tests/integration/components/booking-editor.test.ts:111). The logical guarantee is covered across these surfaces; actual reversed browser transport is not. |
| Connected failure/retry behavior | Editor preview/save failures and explicit retries have browser coverage. Host-read failure is asserted at the read DTO boundary, but [BookingEntry](/C:/DEV/ElproSaas/src/components/resources/BookingEntry.tsx:32) returns `null` when that failure DTO has both permissions false, before rendering its error/retry block. Thus read-layer “unknown/error” evidence does not establish visible host retry behavior. |

The recorded 92 named obligations span 58 command/API cases, 13 browser cases, nine original component cases, 11 input units and one scope case. Their passing reports support those exercised boundaries; they do not erase the distinctions between command capability, rendered editor seams, current host lifecycle and deferred calendar interaction.