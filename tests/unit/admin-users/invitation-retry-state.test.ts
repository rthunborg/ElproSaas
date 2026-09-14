import assert from "node:assert/strict";
import { test } from "node:test";

test("[P0] keeps an unobserved uncertain operation id and rotates only after reconciliation permits a fresh invitation", async () => {
  const { operationIdForAdminUsersSubmit } = await import("@/features/admin-users/action-state");
  const current = "durable-uncertain-operation";
  const generated = () => "fresh-operation-after-reconciliation";

  assert.equal(operationIdForAdminUsersSubmit({ status: "error", message: "could not reconcile" }, current, generated), current);
  assert.equal(operationIdForAdminUsersSubmit({ status: "error", message: "reconciled uncertain", retryWithNewOperation: true }, current, generated), "fresh-operation-after-reconciliation");
});
