/**
 * Story 2.1 — additional edge-case coverage for the pure decision core
 * `resolveTenantContextCore` (`src/server/auth/resolve-tenant-context-core.ts`),
 * complementing the primary branch suite (`tests/unit/resolve-tenant-context-core.test.ts`).
 *
 * Focus areas the primary suite does not pin:
 *   - the user-safe MESSAGE contract: every failure carries the exact generic message and
 *     NEVER leaks the resolved/spoofed tenant id, the user id, the email, or which case it
 *     was (UX §11 "no cross-tenant leakage"; architecture §5 stable codes + user-safe msgs);
 *   - `clientTenantId` boundary forms (whitespace-only, the membership's own id) that the
 *     "mismatch only ever denies" rule must classify correctly (AC4 / R-004);
 *   - presentational fields (`userEmail`, `tenantName`) passing through verbatim / defaulting
 *     without ever influencing the authority decision.
 *
 * Pure-logic, no I/O — runs NOW under `node --test`; adds no test framework (tests/README.md).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveTenantContextCore,
  type MembershipRow,
  type ResolvedUser,
} from "@/server/auth/resolve-tenant-context-core";
import { TENANT_CONTEXT_MESSAGES } from "@/server/auth/tenant-context";

const USER: ResolvedUser = { id: "user-1", email: "admin@example.test" };
const ACTIVE_ADMIN: MembershipRow = {
  tenant_id: "tenant-A",
  role: "tenant_admin",
  status: "active",
  tenant_name: "Acme Elektro AB",
};

test("UNAUTHENTICATED failure carries the exact user-safe message (no internal detail)", () => {
  const result = resolveTenantContextCore({ user: null, membership: null });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "UNAUTHENTICATED");
    assert.equal(result.message, TENANT_CONTEXT_MESSAGES.UNAUTHENTICATED);
  }
});

test("TENANT_MEMBERSHIP_REQUIRED failure carries the exact generic message", () => {
  const result = resolveTenantContextCore({ user: USER, membership: null });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "TENANT_MEMBERSHIP_REQUIRED");
    assert.equal(
      result.message,
      TENANT_CONTEXT_MESSAGES.TENANT_MEMBERSHIP_REQUIRED,
    );
  }
});

test("a denied spoof NEVER leaks the spoofed tenant id, the real tenant id, or the user id in the message", () => {
  const result = resolveTenantContextCore({
    user: USER,
    membership: ACTIVE_ADMIN, // real tenant: tenant-A
    clientTenantId: "tenant-B-spoof", // forged
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.doesNotMatch(result.message, /tenant-A/);
    assert.doesNotMatch(result.message, /tenant-B-spoof/);
    assert.doesNotMatch(result.message, /user-1/);
    // The message is identical to every other no-access case — the failure mode itself
    // must not be distinguishable to the client (no membership vs disabled vs spoof).
    assert.equal(
      result.message,
      TENANT_CONTEXT_MESSAGES.TENANT_MEMBERSHIP_REQUIRED,
    );
  }
});

test("the no-access message is IDENTICAL across no-row / disabled / non-admin / spoof (indistinguishable)", () => {
  const messages = [
    resolveTenantContextCore({ user: USER, membership: null }),
    resolveTenantContextCore({
      user: USER,
      membership: { ...ACTIVE_ADMIN, status: "disabled" },
    }),
    resolveTenantContextCore({
      user: USER,
      membership: { ...ACTIVE_ADMIN, role: "member" },
    }),
    resolveTenantContextCore({
      user: USER,
      membership: ACTIVE_ADMIN,
      clientTenantId: "tenant-Z",
    }),
  ].map((r) => (r.ok ? "OK" : r.message));

  assert.deepEqual(new Set(messages).size, 1, "all no-access messages must be identical");
});

test("AC4: a whitespace-only client tenant_id is a real value and (mismatching) DENIES", () => {
  // "   " is non-empty and never equals the membership tenant id, so it is a mismatch and
  // must deny — it must NOT be coerced to "absent" and silently pass.
  const result = resolveTenantContextCore({
    user: USER,
    membership: ACTIVE_ADMIN,
    clientTenantId: "   ",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TENANT_MEMBERSHIP_REQUIRED");
});

test("AC4: an explicit null client tenant_id is treated as absent (ignored) and resolves", () => {
  const result = resolveTenantContextCore({
    user: USER,
    membership: ACTIVE_ADMIN,
    clientTenantId: null,
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.tenantId, "tenant-A");
});

test("AC1: presentational fields pass through verbatim and do not affect authority", () => {
  const result = resolveTenantContextCore({
    user: { id: "user-9", email: "carl@example.test" },
    membership: {
      tenant_id: "tenant-X",
      role: "tenant_admin",
      status: "active",
      tenant_name: "Volt & Co",
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.userId, "user-9");
    assert.equal(result.data.tenantId, "tenant-X");
    assert.equal(result.data.userEmail, "carl@example.test");
    assert.equal(result.data.tenantName, "Volt & Co");
    assert.equal(result.data.role, "tenant_admin");
    assert.equal(result.data.status, "active");
  }
});

test("AC1: an active admin with a null email still resolves; userEmail passes through as null", () => {
  const result = resolveTenantContextCore({
    user: { id: "user-2", email: null },
    membership: ACTIVE_ADMIN,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.userEmail, null);
    assert.equal(result.data.tenantId, "tenant-A");
  }
});

test("AC1: explicit `tenant_name: null` on the row resolves tenantName to null (no fabrication)", () => {
  const result = resolveTenantContextCore({
    user: USER,
    membership: {
      tenant_id: "tenant-A",
      role: "tenant_admin",
      status: "active",
      tenant_name: null,
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.tenantName, null);
});

test("returned success status is always the literal 'active' (only path that reaches Ok)", () => {
  const result = resolveTenantContextCore({ user: USER, membership: ACTIVE_ADMIN });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.status, "active");
});
