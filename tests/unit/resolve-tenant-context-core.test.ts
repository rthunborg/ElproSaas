/**
 * Pure-logic unit tests for `resolveTenantContextCore` (Story 2.1, AC1-AC4).
 *
 * These exercise every decision branch with the user + membership row supplied directly
 * (no Supabase SDK, no DB) — exactly the coverage that is testable NOW, before Story 2.2's
 * local Supabase stack exists (test-design "Critical Prerequisite"). The authoritative
 * DB-backed INT/RLS tests (active membership resolves correct tenant against a real DB,
 * cross-tenant denial, anonymous rejection at the DB/command boundary) are owned by Story
 * 2.2's stack and are intentionally NOT attempted here.
 *
 * Coverage map (test-design-epic-2.md):
 *   - no re-validated user            -> UNAUTHENTICATED              (AC3 / R-003)
 *   - no membership row               -> TENANT_MEMBERSHIP_REQUIRED   (AC2 / R-004)
 *   - status invited/disabled         -> TENANT_MEMBERSHIP_REQUIRED   (AC2 / R-004, distinct case)
 *   - role not tenant_admin           -> TENANT_MEMBERSHIP_REQUIRED   (AC2 / R-005-adjacent)
 *   - active tenant_admin             -> Ok(context), membership-derived tenant (AC1 / R-004)
 *   - client tenant_id mismatch       -> IGNORED; resolves membership tenant (AC4 / R-004)
 *   - client tenant_id match/absent   -> ignored; resolution unchanged (AC4 / R-004)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveTenantContextCore,
  type MembershipRow,
  type ResolvedUser,
} from "@/server/auth/resolve-tenant-context-core";

const USER: ResolvedUser = { id: "user-1", email: "admin@example.test" };
const ACTIVE_ADMIN: MembershipRow = {
  tenant_id: "tenant-A",
  role: "tenant_admin",
  status: "active",
  tenant_name: "Acme Elektro AB",
};

test("AC3: no re-validated user -> UNAUTHENTICATED", () => {
  const result = resolveTenantContextCore({ user: null, membership: null });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "UNAUTHENTICATED");
});

test("AC3: user with empty id -> UNAUTHENTICATED", () => {
  const result = resolveTenantContextCore({
    user: { id: "", email: null },
    membership: ACTIVE_ADMIN,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "UNAUTHENTICATED");
});

test("AC2: authenticated but no membership row -> TENANT_MEMBERSHIP_REQUIRED", () => {
  const result = resolveTenantContextCore({ user: USER, membership: null });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TENANT_MEMBERSHIP_REQUIRED");
});

test("AC2: invited membership -> TENANT_MEMBERSHIP_REQUIRED (distinct no-access case)", () => {
  const result = resolveTenantContextCore({
    user: USER,
    membership: { ...ACTIVE_ADMIN, status: "invited" },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TENANT_MEMBERSHIP_REQUIRED");
});

test("AC2: disabled membership -> TENANT_MEMBERSHIP_REQUIRED (distinct no-access case)", () => {
  const result = resolveTenantContextCore({
    user: USER,
    membership: { ...ACTIVE_ADMIN, status: "disabled" },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TENANT_MEMBERSHIP_REQUIRED");
});

// NOTE: `MembershipRow.status` is now the narrowed `MembershipStatus` union — the core can
// no longer be handed an arbitrary string like "suspended" (it would not type-check). An
// UNKNOWN raw DB status is coerced to a denying value at the DB edge
// (`normalizeMembershipStatus` in resolve-tenant-context.ts) and is asserted in the
// resolver test ("unknown DB status -> denied"). Here we cover the two non-active union
// members (invited/disabled above), which is the full set the pure core can ever see.

test("AC2: non-tenant_admin role is rejected even when active", () => {
  const result = resolveTenantContextCore({
    user: USER,
    membership: { ...ACTIVE_ADMIN, role: "member" },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "TENANT_MEMBERSHIP_REQUIRED");
});

test("AC1: active tenant_admin -> Ok with membership-derived tenant + presentational fields", () => {
  const result = resolveTenantContextCore({ user: USER, membership: ACTIVE_ADMIN });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.data, {
      userId: "user-1",
      tenantId: "tenant-A",
      role: "tenant_admin",
      status: "active",
      userEmail: "admin@example.test",
      tenantName: "Acme Elektro AB",
    });
  }
});

test("AC1: tenantName defaults to null when the joined tenant name is absent", () => {
  const result = resolveTenantContextCore({
    user: USER,
    membership: { tenant_id: "tenant-A", role: "tenant_admin", status: "active" },
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.tenantName, null);
});

test("AC4: matching client tenant_id is ignored — resolution stays membership-derived", () => {
  const result = resolveTenantContextCore({
    user: USER,
    membership: ACTIVE_ADMIN,
    clientTenantId: "tenant-A",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.tenantId, "tenant-A");
});

test("AC4: empty-string client tenant_id is treated as absent (ignored)", () => {
  const result = resolveTenantContextCore({
    user: USER,
    membership: ACTIVE_ADMIN,
    clientTenantId: "",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.tenantId, "tenant-A");
});

test("AC4: mismatched/spoofed client tenant_id is IGNORED — resolves the membership tenant, never denied", () => {
  // A stale/spoofed client value must never lock a rightful admin out of their own tenant.
  // The resolver ignores it and resolves from the server-side membership row (AC4 "ignored").
  const result = resolveTenantContextCore({
    user: USER,
    membership: ACTIVE_ADMIN,
    clientTenantId: "tenant-B",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.tenantId, "tenant-A");
});

test("AC4: a spoofed client tenant_id can never select a different tenant", () => {
  // Even if the client claims tenant-B, the resolved tenant MUST be the membership tenant
  // (tenant-A), never the client-supplied tenant-B — the client value can never widen or
  // redirect access.
  const result = resolveTenantContextCore({
    user: USER,
    membership: ACTIVE_ADMIN,
    clientTenantId: "tenant-B",
  });
  assert.equal(result.ok, true, "spoofed tenant id must not deny a rightful admin");
  if (result.ok) {
    assert.equal(result.data.tenantId, "tenant-A");
    assert.notEqual(result.data.tenantId, "tenant-B");
  }
});
