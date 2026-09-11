import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEffectivePermissions, buildRoleCatalogue } from "@/server/authz/role-catalogue";

test("[P0] role catalogue contains the five stored roles and only active manifest modules", () => {
  const catalogue = buildRoleCatalogue({ tenant_admin: 2, saljare: 1 });
  assert.equal(catalogue.roles.length, 5);
  assert.deepEqual(catalogue.roles.map((role) => role.activeMemberLabel), Array(5).fill("Aktiva medlemmar"));
  assert.equal(catalogue.roles.find((role) => role.role === "tenant_admin")?.activeMemberCount, 2);
  assert.equal(catalogue.roles.find((role) => role.role === "saljare")?.activeMemberCount, 1);
  assert.ok(catalogue.roles.flatMap((role) => role.grants).every((grant) => grant.wave !== "B1b"));
  assert.match(catalogue.arbetsledareGuidance, /inom ett jobb/i);
});

test("[P0] effective permissions are a unique union with deterministic granting role labels", () => {
  const grants = buildEffectivePermissions(["saljare", "projektledare", "saljare"]);
  assert.equal(new Set(grants.map((grant) => `${grant.module}:${grant.capability}`)).size, grants.length);
  const quoteView = grants.find((grant) => grant.module === "quotes" && grant.capability === "Quotes.View");
  assert.deepEqual(quoteView?.grantingRoles, ["Projektledare", "Säljare"]);
  assert.deepEqual(buildEffectivePermissions(["unknown"]), []);
});
