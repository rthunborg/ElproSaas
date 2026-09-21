/**
 * Coverage expansion — Story 10.1 real-manifest structural invariants + derived deny-list consumer
 * (bmad-testarch-automate). Complements the ATDD suite (which pins the 7/24/7 unions) by locking the
 * STRUCTURAL properties the four derivations silently depend on, plus the shipped consumer function
 * `isForbiddenDeferredCategory` (0 prior direct tests).
 *
 * Why these matter:
 *   - `deferredFileToken` must live ONLY on `pending` modules — the whole "a token drops out of the
 *     deny-list automatically on activation" (§5.5 / FR129) guarantee breaks if an active module
 *     carries one, and the coherence validator does NOT check token placement.
 *   - The 7 deny tokens must map 1:1 to token-bearing pending modules (no token on two modules, no
 *     duplicate) — otherwise the derived deny-list count is a coincidence, not an invariant.
 *   - EB-A10: a PLATFORM-scoped entry must be EXPRESSIBLE and coherent (the E12 operator console);
 *     the `provisioning` module is the enumerated exception, and the schema/validator must tolerate
 *     the scope class without any 10.1 active module using it.
 *   - `isForbiddenDeferredCategory` (the runtime consumer of the derived deny-list) must be
 *     case-insensitive and reject non-deferred categories.
 *
 * [Source: story 10.1 AC2/AC3, Task 2.2/4; architecture-phase-b.md §5.3, §5.5; Constraints EB-A10
 *  (platform scope), deny-list derivation nuance (7 token-bearing modules, no others).]
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { SCOPE_MANIFEST } from "@/scope/manifest";
import {
  activeModules,
  pendingModules,
  fileOwnerTypesFromManifest,
  validateManifestCoherence,
} from "@/scope/manifest-schema";
import type { ScopeManifest, ScopeModule } from "@/scope/manifest-schema";
import {
  FORBIDDEN_DEFERRED_CATEGORIES,
  isForbiddenDeferredCategory,
} from "@/features/files/deferred-categories";
import {
  PERMISSION_MATRIX,
  resolveCapability,
} from "@/server/authz/permission-matrix";

const PINNED_OWNER_TYPES = [
  "customer",
  "facility",
  "contact",
  "calculation",
  "quote_version",
  "quote_acceptance",
  "job",
];
const PINNED_DENY_TOKENS = ["fortnox", "supplier", "asset", "rental", "hr", "dou", "upphandling"];
const sortedUnique = (xs: string[]) => [...new Set(xs)].sort();

// ── deferredFileToken placement + 1:1 mapping ─────────────────────────────────────────────────
test("10.1-UNIT-INV-01: every module carrying a deferredFileToken is `pending` (never active)", () => {
  for (const m of SCOPE_MANIFEST.modules) {
    if (m.deferredFileToken) {
      assert.equal(
        m.status,
        "pending",
        `module "${m.id}" carries deny token "${m.deferredFileToken}" but is not pending — it would never drop out of the deny-list on activation`,
      );
    }
  }
  // Symmetric: no active module carries a token.
  assert.deepEqual(
    activeModules(SCOPE_MANIFEST).filter((m) => (m as ScopeModule).deferredFileToken).map((m) => m.status),
    [],
  );
});

test("10.1-UNIT-INV-02: the 7 deny tokens map 1:1 to token-bearing pending modules (no dup, no orphan token)", () => {
  const tokenBearers = pendingModules(SCOPE_MANIFEST)
    .map((m) => (m as ScopeModule).deferredFileToken)
    .filter((t): t is string => typeof t === "string");
  assert.equal(tokenBearers.length, 7, "exactly 7 pending modules may declare a deny token");
  assert.equal(new Set(tokenBearers).size, 7, "no deny token may be declared by two modules");
  assert.deepEqual(sortedUnique(tokenBearers), sortedUnique(PINNED_DENY_TOKENS));
});

// ── fileOwnerTypesFromManifest grounded against the pinned 7 (through the shipped selector) ────
test("10.1-UNIT-INV-03: fileOwnerTypesFromManifest(SCOPE_MANIFEST) equals the 7 Phase-A owner types (pinned, non-circular)", () => {
  assert.deepEqual(
    sortedUnique(fileOwnerTypesFromManifest(SCOPE_MANIFEST)),
    sortedUnique(PINNED_OWNER_TYPES),
  );
});

// ── EB-A10 platform scope: expressible + coherent, and only on the enumerated pending module ──
test("[P0] 12.1-STATIC-000 (EB-A10): the ONLY platform-scoped module is active `provisioning`", () => {
  const platform = SCOPE_MANIFEST.modules.filter((m) => (m as ScopeModule).scope === "platform");
  assert.deepEqual(platform.map((m) => m.id), ["provisioning"]);
  assert.equal(platform[0].status, "active", "the Epic 12 operator console must remain active");
});

test("10.1-UNIT-INV-05 (EB-A10): a platform-scoped ACTIVE module with surface validates coherent (scope class is expressible)", () => {
  // Proves the schema + validator tolerate a future platform-scoped LIVE entry (E12 activation),
  // i.e. `scope` is orthogonal to the coherence rules.
  const m: ScopeManifest = {
    modules: [
      {
        id: "operators",
        label: "Platform Operators",
        wave: "B1a",
        status: "active",
        epic: "E12",
        activatedAt: "2026-09-01",
        scope: "platform",
        navItems: [{ route: "/platform/operators" }],
        tenantTables: ["platform_operators"],
        widgets: [],
        notificationCategories: [],
        publicSurfaces: [],
        fileOwnerTypes: [],
      },
    ],
  };
  assert.deepEqual(validateManifestCoherence(m), []);
});

// ── The real manifest stays coherent (defence-in-depth alongside COH-00) + deny-list consumer ─
test("10.1-UNIT-INV-06: isForbiddenDeferredCategory is case-insensitive over the derived deny-list", () => {
  for (const token of FORBIDDEN_DEFERRED_CATEGORIES) {
    assert.equal(isForbiddenDeferredCategory(token), true, `${token} must be forbidden`);
    assert.equal(isForbiddenDeferredCategory(token.toUpperCase()), true, `${token.toUpperCase()} must be forbidden (case-insensitive)`);
  }
});

test("10.1-UNIT-INV-07: isForbiddenDeferredCategory rejects active Phase-A categories and unknown tokens", () => {
  for (const allowed of ["customer", "job", "calculation", "quote_version", "", "assetregistry"]) {
    assert.equal(
      isForbiddenDeferredCategory(allowed),
      false,
      `"${allowed}" is not a deferred-module deny token and must not be forbidden`,
    );
  }
});

test("[P0] 12.1-STATIC-001 provisioning activates only as a platform module and its metadata is non-granting to every tenant role", () => {
  const provisioning = SCOPE_MANIFEST.modules.find(
    (module) => module.id === "provisioning",
  );
  assert.equal(provisioning?.status, "active");
  assert.equal(provisioning?.scope, "platform");

  const platformRow = (
    PERMISSION_MATRIX as unknown as Record<
      string,
      Record<string, Record<string, unknown>>
    >
  ).provisioning?.["Platform.Operator.Access"];
  assert.deepEqual(platformRow, {
    roles: [],
    scope: "platform",
    tenantGrantable: false,
    tenantRoles: [],
  });

  for (const role of [
    "tenant_admin",
    "projektledare",
    "montor",
    "saljare",
    "ekonomi",
  ]) {
    assert.equal(
      resolveCapability({
        roles: [role],
        module: "provisioning",
        capability: "Platform.Operator.Access",
      }).granted,
      false,
      `${role} must not receive platform authority from tenant RBAC`,
    );
  }
});
