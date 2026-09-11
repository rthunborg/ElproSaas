import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEffectivePermissions, buildRoleCatalogue, effectivePermissionsForMembership, resolveMembershipRoles } from "@/server/authz/role-catalogue";
import { PERMISSION_MATRIX } from "@/server/authz/permission-matrix";
import type { TenantRole } from "@/server/authz/roles";
import { SCOPE_MANIFEST } from "@/scope/manifest";

test("[P0] role catalogue contains the five stored roles and only active manifest modules", () => {
  const catalogue = buildRoleCatalogue({ tenant_admin: 2, saljare: 1 });
  assert.equal(catalogue.roles.length, 5);
  assert.deepEqual(catalogue.roles.map((role) => role.activeMemberLabel), Array(5).fill("Aktiva medlemmar"));
  assert.equal(catalogue.roles.find((role) => role.role === "tenant_admin")?.activeMemberCount, 2);
  assert.equal(catalogue.roles.find((role) => role.role === "saljare")?.activeMemberCount, 1);
  assert.ok(catalogue.roles.flatMap((role) => role.grants).every((grant) => grant.wave !== "B1b"));
  const activeModuleIds = new Set(SCOPE_MANIFEST.modules.filter((module) => module.status === "active").map((module) => module.id));
  assert.ok(catalogue.roles.flatMap((role) => role.sensitiveEntitlements).every((entitlement) => activeModuleIds.has(entitlement.split(".")[0] ?? "")));
  assert.match(catalogue.arbetsledareGuidance, /inom ett jobb/i);
});

test("[P0] effective permissions are a unique union with deterministic granting role labels", () => {
  const grants = buildEffectivePermissions(["saljare", "projektledare", "saljare"]);
  assert.equal(new Set(grants.map((grant) => `${grant.module}:${grant.capability}`)).size, grants.length);
  const quoteView = grants.find((grant) => grant.module === "quotes" && grant.capability === "Quotes.View");
  assert.deepEqual(quoteView?.grantingRoles, ["Projektledare", "Säljare"]);
  const matrix = PERMISSION_MATRIX as Record<string, Record<string, { readonly roles: readonly TenantRole[] }>>;
  const expected = Object.entries(matrix)
    .filter(([module]) => SCOPE_MANIFEST.modules.some((entry) => entry.id === module && entry.status === "active"))
    .flatMap(([module, capabilities]) => Object.entries(capabilities)
      .filter(([, row]) => row.roles.some((role: TenantRole) => role === "saljare" || role === "projektledare"))
      .map(([capability, row]) => ({
        key: `${module}:${capability}`,
        grantingRoles: row.roles.filter((role: TenantRole) => role === "saljare" || role === "projektledare").map((role: TenantRole) => role === "saljare" ? "Säljare" : "Projektledare").sort((a: string, b: string) => a.localeCompare(b, "sv")),
      })))
    .sort((a, b) => a.key.localeCompare(b.key));
  assert.deepEqual(grants.map((grant) => ({ key: `${grant.module}:${grant.capability}`, grantingRoles: grant.grantingRoles })).sort((a, b) => a.key.localeCompare(b.key)), expected);
  assert.deepEqual(buildEffectivePermissions(["unknown"]), []);
});

test("[P0] inactive and legacy memberships project truthful effective permissions", () => {
  assert.deepEqual(resolveMembershipRoles("projektledare", []), ["projektledare"]);
  assert.deepEqual(resolveMembershipRoles("projektledare", ["saljare"]), ["saljare"]);
  assert.deepEqual(effectivePermissionsForMembership("disabled", ["projektledare"]), []);
  assert.ok(effectivePermissionsForMembership("active", ["projektledare"]).length > 0);
});
