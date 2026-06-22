/**
 * Story 2.1 — unit tests for the `Result` primitive (`src/lib/result/result.ts`).
 *
 * `resolveTenantContext` and every later Epic-2 server command return this typed
 * discriminated union instead of throwing across the boundary (architecture §5/§22). The
 * helpers are tiny but load-bearing: the `ok`/`code` discriminant is the exact contract
 * the resolver tests assert on, and a failure must carry a STABLE machine code + a
 * user-safe message and NEVER leak a `data` field. These tests pin that shape so a future
 * "convenience" edit (e.g. attaching `data` to an `err`, or dropping the `readonly`
 * discriminant) is caught.
 *
 * Pure-logic, no I/O — runs NOW under the dependency-free `node --test` runner; adds no
 * test framework (tests/README.md).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, err, type Result } from "@/lib/result/result";

test("ok() produces a success carrying the data and the `ok: true` discriminant", () => {
  const result = ok({ tenantId: "tenant-A" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { tenantId: "tenant-A" });
});

test("ok() preserves primitive and falsy payloads verbatim (0 / '' / null are valid data)", () => {
  assert.equal(ok(0).data, 0);
  assert.equal(ok("").data, "");
  assert.equal(ok(null).data, null);
  assert.equal(ok(false).data, false);
});

test("err() produces a failure with the `ok: false` discriminant, the stable code, and the message", () => {
  const result = err("UNAUTHENTICATED", "Du måste vara inloggad för att fortsätta.");
  assert.equal(result.ok, false);
  assert.equal(result.code, "UNAUTHENTICATED");
  assert.equal(result.message, "Du måste vara inloggad för att fortsätta.");
});

test("err() carries NO `data` field — a failure must never leak a payload across the boundary", () => {
  const result = err("TENANT_MEMBERSHIP_REQUIRED", "no access");
  assert.equal("data" in result, false);
});

test("the discriminant narrows the union: `ok` guards data access, `!ok` guards code/message", () => {
  // This mirrors how the resolver callers consume a Result; the test fails to even run if
  // the discriminant stops narrowing (a regression in the type would surface at compile time
  // via tsc, and the runtime branch here proves the values line up).
  const success: Result<number, "E"> = ok(42);
  const failure: Result<number, "E"> = err("E", "boom");

  if (success.ok) {
    assert.equal(success.data, 42);
  } else {
    assert.fail("ok() must narrow to the success branch");
  }

  if (!failure.ok) {
    assert.equal(failure.code, "E");
    assert.equal(failure.message, "boom");
  } else {
    assert.fail("err() must narrow to the failure branch");
  }
});
