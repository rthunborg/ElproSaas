/** Story 11.1 — membership_roles database authority proofs. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminInsertMembership,
  cleanupFixture,
  createTwoTenantFixture,
  makeAuthedServerClient,
  type TwoTenantFixture,
} from "../../factories/tenants";
import { adminQuery, adminSession, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

interface MembershipRow { id: string; tenant_id: string }
type PgError = Error & { code?: string };

let stackUp = false;
let fixture: TwoTenantFixture;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (stackUp) fixture = await createTwoTenantFixture();
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
  if (stackUp) await closeAdminPool();
});

async function membershipFor(userId: string): Promise<MembershipRow> {
  const rows = await adminQuery<MembershipRow>(
    "select id, tenant_id from public.tenant_memberships where user_id = $1",
    [userId],
  );
  const row = rows[0];
  if (!row) throw new Error("fixture membership was not created");
  return row;
}

async function deleteMembershipRole(membershipId: string, role: string): Promise<void> {
  await adminQuery(
    "delete from public.membership_roles where membership_id = $1 and role = $2",
    [membershipId, role],
  );
}

describe("11.1 membership_roles RLS", () => {
  it("[P0] rejects a child role whose tenant differs from the parent membership tenant", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const membershipB = await membershipFor(fixture.adminB.id);
    const thrown = await adminQuery(
      "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, 'montor')",
      [fixture.tenantA.id, membershipB.id],
    ).then(() => null, (error: Error & { code?: string }) => error);
    expect(thrown).not.toBeNull();
    expect(thrown?.code).toBe("23503");
  });

  it("[P0] prevents a parent tenant move from leaving existing child roles under the old tenant", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const membershipA = await membershipFor(fixture.adminA.id);
    await deleteMembershipRole(membershipA.id, "projektledare");
    try {
      await adminQuery(
        "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, 'projektledare')",
        [fixture.tenantA.id, membershipA.id],
      );
      const thrown = await adminQuery(
        "update public.tenant_memberships set tenant_id = $1 where id = $2",
        [fixture.tenantB.id, membershipA.id],
      ).then(() => null, (error: PgError) => error);
      expect(thrown).not.toBeNull();
      expect(thrown?.code).toBe("23503");
    } finally {
      await deleteMembershipRole(membershipA.id, "projektledare");
    }
  });

  it("[P0] serializes a concurrent child insert against a parent tenant move", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const membershipA = await membershipFor(fixture.adminA.id);
    const role = "saljare";
    await deleteMembershipRole(membershipA.id, role);

    let markChildReady!: () => void;
    let markChildFailed!: (error: unknown) => void;
    const childReady = new Promise<void>((resolve, reject) => {
      markChildReady = resolve;
      markChildFailed = reject;
    });
    let releaseChild!: () => void;
    const childMayCommit = new Promise<void>((resolve) => {
      releaseChild = resolve;
    });

    const childTransaction = adminSession(async ({ query }) => {
      await query("begin");
      try {
        await query(
          "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, $3)",
          [fixture.tenantA.id, membershipA.id, role],
        );
        markChildReady();
        await childMayCommit;
        await query("commit");
      } catch (error) {
        markChildFailed(error);
        await query("rollback");
        throw error;
      }
    });

    try {
      await childReady;
      const concurrentMove = await adminSession(async ({ query }) => {
        await query("begin");
        try {
          await query("set local lock_timeout = '750ms'");
          await query(
            "update public.tenant_memberships set tenant_id = $1 where id = $2",
            [fixture.tenantB.id, membershipA.id],
          );
          await query("rollback");
          return null;
        } catch (error) {
          await query("rollback");
          return error as PgError;
        }
      });

      // The composite FK check holds a KEY SHARE lock on the referenced
      // (id, tenant_id) key until the child transaction completes.  A parent
      // tenant move changes that key and must therefore block, not pass an
      // unlocked trigger check against the old committed snapshot.
      expect(concurrentMove?.code).toBe("55P03");
      releaseChild();
      await childTransaction;

      const committedMove = await adminQuery(
        "update public.tenant_memberships set tenant_id = $1 where id = $2",
        [fixture.tenantB.id, membershipA.id],
      ).then(() => null, (error: PgError) => error);
      expect(committedMove?.code).toBe("23503");
    } finally {
      releaseChild();
      await childTransaction.catch(() => undefined);
      await deleteMembershipRole(membershipA.id, role);
    }
  });

  it("[P0] serializes a concurrent child retarget against a parent tenant move", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const [membershipA, membershipB] = await Promise.all([
      membershipFor(fixture.adminA.id),
      membershipFor(fixture.adminB.id),
    ]);
    const role = "montor";
    await Promise.all([
      deleteMembershipRole(membershipA.id, role),
      deleteMembershipRole(membershipB.id, role),
    ]);
    const [child] = await adminQuery<{ id: string }>(
      "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, $3) returning id",
      [fixture.tenantB.id, membershipB.id, role],
    );
    if (!child) throw new Error("fixture child role was not created");

    let markChildReady!: () => void;
    let markChildFailed!: (error: unknown) => void;
    const childReady = new Promise<void>((resolve, reject) => {
      markChildReady = resolve;
      markChildFailed = reject;
    });
    let releaseChild!: () => void;
    const childMayCommit = new Promise<void>((resolve) => {
      releaseChild = resolve;
    });

    const childTransaction = adminSession(async ({ query }) => {
      await query("begin");
      try {
        await query(
          "update public.membership_roles set tenant_id = $1, membership_id = $2 where id = $3",
          [fixture.tenantA.id, membershipA.id, child.id],
        );
        markChildReady();
        await childMayCommit;
        await query("commit");
      } catch (error) {
        markChildFailed(error);
        await query("rollback");
        throw error;
      }
    });

    try {
      await childReady;
      const concurrentMove = await adminSession(async ({ query }) => {
        await query("begin");
        try {
          await query("set local lock_timeout = '750ms'");
          await query(
            "update public.tenant_memberships set tenant_id = $1 where id = $2",
            [fixture.tenantB.id, membershipA.id],
          );
          await query("rollback");
          return null;
        } catch (error) {
          await query("rollback");
          return error as PgError;
        }
      });

      expect(concurrentMove?.code).toBe("55P03");
      releaseChild();
      await childTransaction;

      const committedMove = await adminQuery(
        "update public.tenant_memberships set tenant_id = $1 where id = $2",
        [fixture.tenantB.id, membershipA.id],
      ).then(() => null, (error: PgError) => error);
      expect(committedMove?.code).toBe("23503");
    } finally {
      releaseChild();
      await childTransaction.catch(() => undefined);
      await Promise.all([
        deleteMembershipRole(membershipA.id, role),
        deleteMembershipRole(membershipB.id, role),
      ]);
    }
  });

  it("[P0] an authenticated caller cannot forge its own or another tenant's child role and independent readback is unchanged", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const [membershipA, membershipB] = await Promise.all([
      membershipFor(fixture.adminA.id), membershipFor(fixture.adminB.id),
    ]);
    const beforeRows = await adminQuery<{ tenant_id: string; membership_id: string; role: string }>(
      "select tenant_id, membership_id, role from public.membership_roles where membership_id = any($1::uuid[]) order by membership_id, role",
      [[membershipA.id, membershipB.id]],
    );
    const caller = await makeAuthedServerClient(fixture.adminA);
    for (const attempt of [
      { tenant_id: fixture.tenantA.id, membership_id: membershipA.id, role: "montor" },
      { tenant_id: fixture.tenantB.id, membership_id: membershipB.id, role: "saljare" },
    ]) {
      const { data, error } = await caller.from("membership_roles").insert(attempt).select();
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    }
    const afterRows = await adminQuery<{ tenant_id: string; membership_id: string; role: string }>(
      "select tenant_id, membership_id, role from public.membership_roles where membership_id = any($1::uuid[]) order by membership_id, role",
      [[membershipA.id, membershipB.id]],
    );
    expect(afterRows).toEqual(beforeRows);
  });

  it("[P0] duplicate membership × role assignments are rejected by a database uniqueness constraint", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const membershipA = await membershipFor(fixture.adminA.id);
    await deleteMembershipRole(membershipA.id, "projektledare");
    try {
      await adminQuery(
        "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, 'projektledare')",
        [fixture.tenantA.id, membershipA.id],
      );
      const thrown = await adminQuery(
        "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, 'projektledare')",
        [fixture.tenantA.id, membershipA.id],
      ).then(() => null, (error: PgError) => error);
      expect(thrown).not.toBeNull();
      expect(thrown?.code).toBe("23505");
    } finally {
      await deleteMembershipRole(membershipA.id, "projektledare");
    }
  });

  it("[P0] rejects an unknown child role at the database boundary", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const membershipA = await membershipFor(fixture.adminA.id);
    const thrown = await adminQuery(
      "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, 'unknown_role')",
      [fixture.tenantA.id, membershipA.id],
    ).then(() => null, (error: Error & { code?: string }) => error);
    expect(thrown).not.toBeNull();
    expect(thrown?.code).toBe("23514");
  });

  it("[P0] a non-admin active member cannot enumerate tenant-wide role assignments or forge audit records", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await adminInsertMembership({
      tenant_id: fixture.tenantA.id,
      user_id: fixture.orphanUser.id,
      role: "montor",
      status: "active",
    });
    const membershipA = await membershipFor(fixture.adminA.id);
    await deleteMembershipRole(membershipA.id, "ekonomi");
    try {
      await adminQuery(
        "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, 'ekonomi')",
        [fixture.tenantA.id, membershipA.id],
      );

      const caller = await makeAuthedServerClient(fixture.orphanUser);
      const { data, error } = await caller.from("membership_roles").select("id, membership_id, role");
      expect(error).toBeNull();
      expect(data).toEqual([]);

      const auditAttempt = await caller.rpc("record_audit_event", {
        p_tenant_id: fixture.tenantA.id,
        p_actor_user_id: fixture.orphanUser.id,
        p_command: "role.audit.forge",
        p_event_type: "role.audit.forged",
        p_target_type: "tenant",
        p_target_id: fixture.tenantA.id,
        p_correlation_id: crypto.randomUUID(),
        p_metadata: {},
        p_created_at: new Date().toISOString(),
      });
      expect(auditAttempt.data).toBeNull();
      expect(auditAttempt.error?.code).toBe("42501");
    } finally {
      await deleteMembershipRole(membershipA.id, "ekonomi");
    }
  });
});
