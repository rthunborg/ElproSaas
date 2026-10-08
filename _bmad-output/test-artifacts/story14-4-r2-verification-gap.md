### Stale-save recovery can retain obsolete human acknowledgment without a failing test

- **Changed surface:** `src/components/resources/BookingEditor.tsx:120` clears the human decision and requests a fresh preview after `PREVIEW_STALE`.
- **Impacted consumer or site:** The mounted editor opened by `BookingEntry` at `src/components/resources/BookingEntry.tsx:40`; its save handler constructs the next decision from current warnings and component state at `BookingEditor.tsx:113`.
- **Existing test evidence:** Regression gap. `tests/integration/commands/booking-editor.int.test.ts:284` asserts stale rejection and durable no-op, then explicitly invokes another preview; it never mounts the editor. Browser tests at `tests/e2e/booking-editor.e2e.spec.ts:320` and `:349` exercise aborted requests and lost committed responses. The preview-invalidation case at `:402` changes an input rather than receiving a stale save result. Repository symbol/import searches for `PREVIEW_STALE`, `BookingEditor`, and `booking-actions` found no additional mounted stale-save test.
- **Missing verification:** Assert that a stale save refreshes warnings, clears acknowledgment, selection and reason, and requires a new deliberate review before retry can persist.
- **Demonstration:** Remove `setReviewed(false)` and `setReason("")` from the stale-result branch while retaining the fresh-preview request. With an initially empty selection, refreshed warnings receive a new receipt and current logical IDs, but the next save carries the previous acknowledgment and reason. None of the tests read exercises this component branch.
- **Consequence:** Changed warnings can be saved using acknowledgment supplied for the previous warning set.
- **Suggested test shape:** Hold a real browser save, change scheduling facts, release it to obtain `PREVIEW_STALE`, and assert cleared review controls and a durable no-op until the user reviews the refreshed set.

### All-day conversion is verified only with change flags supplied directly

- **Changed surface:** The Heldag checkbox at `src/components/resources/BookingEditor.tsx:151` marks both endpoints changed so `prepareBookingTimes` converts their displayed dates to Stockholm midnight.
- **Impacted consumer or site:** The mounted editor’s candidate builder at `src/components/resources/BookingEditor.tsx:74`.
- **Existing test evidence:** Regression gap. `tests/unit/features/resources/booking-editor-input.test.ts:97` and `:104` verify DST bounds by passing `startChanged: true` and `endChanged: true` directly. Component tests render static markup without invoking checkbox events. The sole browser reference to `booking-all-day`, at `tests/e2e/booking-editor.e2e.spec.ts:149`, asserts it is initially unchecked. Repository searches by `prepareBookingTimes`, `booking-all-day`, `BookingEditor`, and their imports found no additional mounted conversion test.
- **Missing verification:** Assert that toggling Heldag on an existing timed booking converts both endpoints and persists the intended exclusive-end interval.
- **Demonstration:** Remove `setStartChanged(true)` from the checkbox handler. Reopen a booking starting at 09:00, enable Heldag, and change only the end date to tomorrow. The candidate retains the original 09:00 start instead of midnight, so preview validation fails. The helper tests still supply the correct flag themselves, and existing browser tests never toggle Heldag.
- **Consequence:** Users cannot convert a timed booking to an all-day booking through the displayed controls.
- **Suggested test shape:** Reopen a timed booking, enable Heldag, change only its end date, save, and assert exact Stockholm midnight UTC bounds and `all_day=true` through SQL readback.
