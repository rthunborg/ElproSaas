import { test } from "node:test";
import assert from "node:assert/strict";

type RouteResponse = { status: number; text(): Promise<string> };
type RouteHarness = {
  post(authorization?: string): Promise<RouteResponse>;
  dispatchCount(): number;
  sideEffectCount(): number;
};

const redPhaseRouteHarness = (): RouteHarness => {
  throw new Error("Story 13.1 route harness is not implemented yet.");
};

test.skip("[P0] rejects every invalid scheduler credential with one generic 401 before any side effect", async () => {
  const route = redPhaseRouteHarness();
  const responses = await Promise.all(
    [undefined, "Bearer wrong", "Bearer eyJhbGciOiJub25lIn0.e30.", "Bearer forged.jwt.token"].map((value) =>
      route.post(value),
    ),
  );

  assert.deepEqual(responses.map((response) => response.status), [401, 401, 401, 401]);
  assert.deepEqual(await Promise.all(responses.map((response) => response.text())), [
    "Unauthorized",
    "Unauthorized",
    "Unauthorized",
    "Unauthorized",
  ]);
  assert.equal(route.dispatchCount(), 0);
  assert.equal(route.sideEffectCount(), 0);
});

test.skip("[P0] dispatches once with the current CRON_SECRET and returns no secret material", async () => {
  const route = redPhaseRouteHarness();
  const response = await route.post(`Bearer ${"c".repeat(32)}`);

  assert.equal(response.status, 200);
  assert.equal(route.dispatchCount(), 1);
  assert.doesNotMatch(await response.text(), /CRON_SECRET|secret/i);
});

test.skip("[P0] accepts an eligible previous rotation secret and rejects an expired one without effects", async () => {
  const route = redPhaseRouteHarness();

  assert.equal((await route.post(`Bearer ${"p".repeat(32)}`)).status, 200);
  assert.equal(route.dispatchCount(), 1);

  const expiredRoute = redPhaseRouteHarness();
  assert.equal((await expiredRoute.post(`Bearer ${"p".repeat(32)}`)).status, 401);
  assert.equal(expiredRoute.dispatchCount(), 0);
  assert.equal(expiredRoute.sideEffectCount(), 0);
});
