import { test } from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedCronRequest } from "@/server/jobs/auth";

const current = "c".repeat(32);
const previous = "p".repeat(32);
const future = "2026-10-01T00:00:00.000Z";

test("[P0] rejects every invalid scheduler credential before dispatch configuration is considered", () => {
  const env = { CRON_SECRET: current, CRON_PREVIOUS_SECRET: previous, CRON_PREVIOUS_SECRET_EXPIRES_AT: "2020-01-01T00:00:00.000Z" };
  for (const credential of [null, "", "Bearer wrong", "Bearer eyJhbGciOiJub25lIn0.e30.", "Bearer forged.jwt.token"]) assert.equal(isAuthorizedCronRequest(credential, env), false);
});
test("[P0] accepts only a current or unexpired previous secret of sufficient length", () => {
  assert.equal(isAuthorizedCronRequest(`Bearer ${current}`, { CRON_SECRET: current }), true);
  assert.equal(isAuthorizedCronRequest(`Bearer ${previous}`, { CRON_SECRET: current, CRON_PREVIOUS_SECRET: previous, CRON_PREVIOUS_SECRET_EXPIRES_AT: future }), true);
  assert.equal(isAuthorizedCronRequest("Bearer short", { CRON_SECRET: "short" }), false);
  assert.equal(isAuthorizedCronRequest(`Bearer ${previous}`, { CRON_PREVIOUS_SECRET: previous, CRON_PREVIOUS_SECRET_EXPIRES_AT: future }), false);
});
