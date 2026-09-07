/** Story 11.1 ATDD RED — code-owned multi-role permission matrix. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveCapability,
  resolveSensitiveFieldEntitlement,
} from "@/server/authz/permission-matrix";

test("[P0] 11.1-UNIT-001 legacy tenant_admin remains a role when membership_roles has no rows", () => {
  assert.equal(
    resolveCapability({ roles: ["tenant_admin"], module: "foundation", capability: "Memberships.Manage" }).granted,
    true,
  );
});

test("[P0] 11.1-UNIT-002 permission decisions are an order-independent union of held roles", () => {
  const forward = resolveCapability({ roles: ["montor", "saljare"], module: "quotes", capability: "Quotes.ViewSalesPrice" });
  const reverse = resolveCapability({ roles: ["saljare", "montor"], module: "quotes", capability: "Quotes.ViewSalesPrice" });
  assert.equal(forward.granted, true);
  assert.deepEqual(reverse, forward);
});

test("[P0] 11.1-UNIT-003 omitted, empty, unknown, or malformed matrix inputs deny by default", () => {
  for (const input of [
    { roles: [], module: "foundation", capability: "Memberships.Manage" },
    { roles: ["unknown"], module: "foundation", capability: "Memberships.Manage" },
    { roles: ["tenant_admin"], module: "unknown", capability: "Read" },
    { roles: ["tenant_admin"], module: "foundation", capability: "unknown" },
  ]) assert.equal(resolveCapability(input).granted, false);
});

test("[P0] 11.1-UNIT-004 a sensitive field is withheld only when no held role grants it", () => {
  assert.equal(resolveSensitiveFieldEntitlement({ roles: ["montor", "projektledare"], module: "quotes", field: "cost_price_ore" }).withheld, false);
  assert.equal(resolveSensitiveFieldEntitlement({ roles: ["montor", "saljare"], module: "quotes", field: "cost_price_ore" }).withheld, true);
});
