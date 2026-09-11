import assert from "node:assert/strict";
import { test } from "node:test";
import { TENANT_ROLES } from "@/server/authz/roles";
import { activeRoleHarnessObligations, buildRoleHarnessCases } from "../../../support/authz/role-harness";
import { defineCommand } from "@/server/commands/envelope";

test("[P0] role harness generates exactly one case per seed role and active obligation", () => {
  const obligations = activeRoleHarnessObligations();
  const cases = buildRoleHarnessCases();
  assert.equal(cases.length, TENANT_ROLES.length * obligations.length);
  assert.equal(new Set(cases.map((entry) => `${entry.role}:${entry.id}`)).size, cases.length);
  assert.ok(cases.some((entry) => entry.kind === "command" && entry.expected === "denied"));
});

test("[P0] an unregistered command fails closed before it can enter the envelope", () => {
  assert.throws(() => defineCommand({
    command: "unknown.active.command",
    auditable: false,
    eventType: "test",
    targetType: "test",
    validateInput: () => ({ ok: true as const, data: {} }),
    execute: () => ({ ok: true }),
  }), /command capability enrollment missing/);
});
