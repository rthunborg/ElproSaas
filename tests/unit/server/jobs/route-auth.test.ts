import { test } from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedCronRequest } from "@/server/jobs/auth";

const current = "c".repeat(32);
const previous = "p".repeat(32);
const fixedNow = new Date("2030-01-01T00:00:00.000Z");
const relativeExpiry = (offsetMs: number) => new Date(fixedNow.getTime() + offsetMs).toISOString();

test("[P0] rejects every invalid scheduler credential before dispatch configuration is considered", (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: fixedNow });
  const env = { CRON_SECRET: current, CRON_PREVIOUS_SECRET: previous, CRON_PREVIOUS_SECRET_EXPIRES_AT: relativeExpiry(-60_000) };
  for (const credential of [null, "", "Bearer wrong", "Bearer eyJhbGciOiJub25lIn0.e30.", "Bearer forged.jwt.token"]) assert.equal(isAuthorizedCronRequest(credential, env), false);
  assert.equal(isAuthorizedCronRequest(`Bearer ${previous}`, env), false);
});
test("[P0] accepts only a current or unexpired previous secret of sufficient length", (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: fixedNow });
  const future = relativeExpiry(60_000);
  assert.equal(isAuthorizedCronRequest(`Bearer ${current}`, { CRON_SECRET: current }), true);
  assert.equal(isAuthorizedCronRequest(`Bearer ${previous}`, { CRON_SECRET: current, CRON_PREVIOUS_SECRET: previous, CRON_PREVIOUS_SECRET_EXPIRES_AT: future }), true);
  assert.equal(isAuthorizedCronRequest("Bearer short", { CRON_SECRET: "short" }), false);
  assert.equal(isAuthorizedCronRequest(`Bearer ${previous}`, { CRON_PREVIOUS_SECRET: previous, CRON_PREVIOUS_SECRET_EXPIRES_AT: future }), false);
});

test("[P0] rejects equal-character UTF-8 byte mismatches without throwing for either rotation secret", (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: fixedNow });
  const multibyteCandidate = "é".repeat(32);
  assert.doesNotThrow(() => isAuthorizedCronRequest(`Bearer ${multibyteCandidate}`, {
    CRON_SECRET: current,
    CRON_PREVIOUS_SECRET: previous,
    CRON_PREVIOUS_SECRET_EXPIRES_AT: relativeExpiry(60_000),
  }));
  assert.equal(isAuthorizedCronRequest(`Bearer ${multibyteCandidate}`, {
    CRON_SECRET: current,
    CRON_PREVIOUS_SECRET: previous,
    CRON_PREVIOUS_SECRET_EXPIRES_AT: relativeExpiry(60_000),
  }), false);
});
