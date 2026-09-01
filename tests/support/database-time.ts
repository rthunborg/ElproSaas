import { expect } from "vitest";

import { adminQuery } from "../factories/admin-sql";

/** Sample the authoritative database clock for bounded lifecycle/audit assertions. */
export async function readDatabaseNow(): Promise<Date> {
  const rows = await adminQuery<{ database_now: string | Date }>(
    `select statement_timestamp() as database_now`,
  );
  const value = rows[0]?.database_now;
  const timestamp = new Date(value instanceof Date ? value.toISOString() : String(value));
  expect(Number.isNaN(timestamp.getTime())).toBe(false);
  return timestamp;
}

/**
 * Prove a persisted timestamp was assigned by Postgres during the bounded command window and was
 * not copied from the caller-controlled command clock.
 */
export function expectDatabaseOwnedTimestamp(
  value: unknown,
  before: Date,
  after: Date,
  callerControlledIso: string,
): void {
  const timestamp = new Date(value instanceof Date ? value.toISOString() : String(value));
  expect(Number.isNaN(timestamp.getTime())).toBe(false);
  expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime() - 5_000);
  expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime() + 5_000);
  expect(timestamp.toISOString()).not.toBe(callerControlledIso);
}
