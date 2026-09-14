/**
 * A fixed future due date for retry-isolated E2E records.
 *
 * This is fixture input, not an application clock. It intentionally avoids
 * deriving a calendar date from wall time, which can cross a month/year
 * boundary while global setup is running.
 */
export const RETRY_FIXTURE_DUE_DATE = "2099-01-31";
