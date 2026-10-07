### Per-person availability values are not verified

- **Changed surface:** `previewBookingEditor` derives each assignee’s `available` value at `src/server/bookings/editor-preview.ts:48`.
- **Impacted consumer or site:** The editor uses these values for its overall availability label at `src/components/resources/BookingEditor.tsx:88` and each person’s hint at `:140`.
- **Existing test evidence:** **Broken-verification gap.** `tests/integration/commands/booking-editor.int.test.ts:79` checks availability person IDs, but never their states. `tests/e2e/booking-editor.e2e.spec.ts:35` checks only that the availability element is visible. `tests/integration/components/booking-editor.test.ts:62` searches the complete rendered HTML for “Tillgänglig”; its preview label is supplied directly, and it does not assert a person-row hint. Repository-wide searches for `previewBookingEditor`, `editor-preview`, `BookingEditor` and `availability` found no additional assertions covering these values.
- **Missing verification:** Assert available/busy states for identified assignees and their corresponding rendered hints.
- **Demonstration:** Replacing the calculation with `available: true` would retain every person ID and conflict warning. The inspected API and browser assertions would still pass, while conflicted people would display “Tillgänglig.”
- **Consequence:** Incorrect availability hints can ship despite the apparent availability coverage.
- **Suggested test shape:** Preview a mixed free/busy assignee fixture, assert both states, and verify each person’s label in the actual editor.

### Full-day conversion is verified only outside the editor caller

- **Changed surface:** The Heldag handler and date controls at `src/components/resources/BookingEditor.tsx:142` pass state into `prepareBookingTimes` through `candidate()` at `:70`.
- **Impacted consumer or site:** Toolbar/job/customer saves through the mounted editor and `saveBookingAction`.
- **Existing test evidence:** **Regression gap.** `tests/unit/features/resources/booking-editor-input.test.ts:81` and `:88` directly supply `timeChanged: true` and `allDay: true` to verify 23/25-hour conversions. The browser tests all save timed bookings; their sole `booking-all-day` assertion, at `tests/e2e/booking-editor.e2e.spec.ts:95`, checks that it remains unchecked. Repository-wide searches for `BookingEditor`, `prepareBookingTimes`, `booking-all-day`, `Heldag` and `allDay` found helper/command coverage but no test exercising the editor’s full-day interaction.
- **Missing verification:** Toggle Heldag, enter date-only bounds, submit through the actual editor, and assert persisted full-day Stockholm instants.
- **Demonstration:** Hard-coding `allDay: false` in the editor’s `prepareBookingTimes` call would leave the direct helper tests and existing timed browser flows passing. Full-day date-only input would then fail conversion in its real caller.
- **Consequence:** The exposed full-day booking flow can become unusable without the checked verification failing.
- **Suggested test shape:** Add a browser full-day save across a Stockholm DST boundary with SQL readback of `all_day`, `starts_at` and `ends_at`.

## Other findings

- Booking read failures hide their own error/retry UI. `readBookingHost` catches a booking/conflict query failure and returns `emptyHost(ERROR)` at `src/features/resources/bookings-read.ts:101`; `emptyHost` sets both capabilities false at `:19`. The actual page passes that result to `BookingEntry`, whose early return at `src/components/resources/BookingEntry.tsx:32` suppresses the alert and retry button defined at `:38`. An entitled user encountering a transient read failure therefore sees the booking section disappear without its intended failure explanation or retry action.