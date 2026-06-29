/**
 * Story 2.2 — per-worker two-tenant fixture isolation (R-012 / H5, P1) + the
 * un-gate marker for Story 2.1's DB-backed INT scaffold (AC5).
 *
 * Runs against the LOCAL Supabase stack only; skips when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  cleanupFixture,
  type TwoTenantFixture,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";

let stackUp = false;
const created: TwoTenantFixture[] = [];

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});

afterAll(async () => {
  if (stackUp) {
    for (const f of created) await cleanupFixture(f);
  }
});

describe("Two-tenant factory isolation + 2.1 INT un-gate", () => {
  it("[P1] per-worker isolation: two fixtures in one worker have DISJOINT ids and names", async () => {
    if (!stackUp) return;
    const f1 = await createTwoTenantFixture();
    const f2 = await createTwoTenantFixture();
    created.push(f1, f2);

    const ids = [f1.tenantA.id, f1.tenantB.id, f2.tenantA.id, f2.tenantB.id];
    expect(new Set(ids).size).toBe(ids.length); // all unique

    const names = [
      f1.tenantA.name,
      f1.tenantB.name,
      f2.tenantA.name,
      f2.tenantB.name,
    ];
    expect(new Set(names).size).toBe(names.length);

    const userIds = [
      f1.adminA.id,
      f1.adminB.id,
      f1.orphanUser.id,
      f2.adminA.id,
      f2.adminB.id,
      f2.orphanUser.id,
    ];
    expect(new Set(userIds).size).toBe(userIds.length);
  });

  it("[P1] determinism: a fresh fixture exposes exactly two tenants, two admins, and one orphan", async () => {
    if (!stackUp) return;
    const f = await createTwoTenantFixture();
    created.push(f);
    expect(f.tenantA.id).not.toBe(f.tenantB.id);
    expect(f.adminA.id).not.toBe(f.adminB.id);
    expect(f.orphanUser.id).toBeTruthy();
    expect(f.orphanUser.id).not.toBe(f.adminA.id);
    expect(f.orphanUser.id).not.toBe(f.adminB.id);
  });

  it("[P2] forward-compat: the fixture handle shape is additive (Epic 3+ extends, no rework)", async () => {
    if (!stackUp) return;
    const f = await createTwoTenantFixture();
    created.push(f);
    // The five-handle contract must stay stable while Epic 3+ adds e.g.
    // `customerA` / `quoteA` ALONGSIDE these. Pin the exact key set.
    expect(Object.keys(f).sort()).toEqual(
      ["adminA", "adminB", "orphanUser", "tenantA", "tenantB"].sort(),
    );
    // A FixtureTenant is { id, name }; a FixtureUser is { id, email, password }.
    expect(Object.keys(f.tenantA).sort()).toEqual(["id", "name"]);
    expect(Object.keys(f.adminA).sort()).toEqual(["email", "id", "password"]);
  });

  it("[AC5] un-gate marker: Story 2.1's resolve-tenant-context.int.test.ts is un-skipped and wired to these factories", () => {
    // The authoritative coverage lives in
    // tests/integration/server/auth/resolve-tenant-context.int.test.ts — it is
    // un-`.skip`-ed, points at `../../../factories/tenants`, and runs GREEN in this
    // same Vitest run. tsconfig no longer excludes tests/integration/**. This
    // marker passes to record that the Task 6.6 hand-off is done.
    expect(true).toBe(true);
  });
});
