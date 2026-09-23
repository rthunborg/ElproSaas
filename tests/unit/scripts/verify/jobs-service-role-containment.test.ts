import { test } from "node:test";
import assert from "node:assert/strict";

type ContainmentHarness = { scanClientReachability(): string[]; scanForbiddenPatterns(): string[] };
const redPhaseContainmentHarness = (): ContainmentHarness => {
  throw new Error("Story 13.1 jobs containment scanner is not implemented yet.");
};

test.skip("[P0] containment fails if a client-reachable path imports the jobs service client", () => {
  const violations = redPhaseContainmentHarness().scanClientReachability();
  assert.ok(violations.some((violation) => violation.includes("server/jobs/service-client")));
});

test.skip("[P0] containment fails on unverified JWT claim reads or an alternate jobs execution lane", () => {
  const violations = redPhaseContainmentHarness().scanForbiddenPatterns();
  assert.ok(violations.some((violation) => /unverified|decodeJwt|edge function|pg_cron|cron/i.test(violation)));
});
