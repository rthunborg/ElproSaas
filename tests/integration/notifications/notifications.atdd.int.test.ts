/**
 * Story 13.2 — API/DB ATDD scaffold (RED phase).
 *
 * These cases deliberately name the server contracts required by the story before
 * the notification tables, commands, and producer exist. Each is individually
 * skipped so this scaffold documents the expected implementation without making
 * the current suite claim a green notification feature.
 */
import { describe, expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createTwoTenantFixture, cleanupFixture, makeAuthedServerClient } from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable, LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_URL } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

type NotificationRow = {
  id: string;
  tenant_id: string;
  recipient_user_id: string;
  category: "quote.follow_up_due";
  title: string;
  body: string;
  route: string;
  read_at: string | null;
};

/**
 * Intended command/producer boundary. The implementation must replace this
 * scaffold with imports from the contained server notification API; no client
 * route builder or raw table mutation is an acceptable substitute.
 */
type NotificationContracts = {
  emitFollowUpDue(input: { tenantId: string; recipientUserId: string; followUpId: string; period: string }): Promise<NotificationRow>;
  runDueFollowUpProducer(input: { tenantId: string; period: string }): Promise<void>;
  markRead(input: { notificationId: string }): Promise<void>;
  markAllRead(): Promise<void>;
  updatePreference(input: { category: string; channel: "in_app" | "email"; enabled: boolean }): Promise<void>;
};

const notifications = undefined as unknown as NotificationContracts;

describe("Story 13.2 notification API and database contracts (ATDD RED)", () => {
  test.skip("[P0][AC1][13.2-INT-001] emits only a recipient-projected title/body and persists the emit-time route", async (testCtx) => {
    const up = await isLocalStackReachable(); if (skipUnlessStack(testCtx, up)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const emitted = await notifications.emitFollowUpDue({ tenantId: fixture.tenantA.id, recipientUserId: fixture.adminA.id, followUpId: crypto.randomUUID(), period: "2026-09-23" });
      expect(emitted).toMatchObject({ tenant_id: fixture.tenantA.id, recipient_user_id: fixture.adminA.id, category: "quote.follow_up_due", read_at: null });
      expect(emitted.title).not.toMatch(/kostnad|marginal|pris/i);
      expect(emitted.body).not.toMatch(/kostnad|marginal|pris/i);
      expect(emitted.route).toMatch(/^\/(quotes|notifications)\//);
      const persisted = await adminQuery<NotificationRow>("select id,tenant_id,recipient_user_id,category,title,body,route,read_at from public.notifications where id=$1", [emitted.id]);
      expect(persisted).toEqual([emitted]);
    } finally { await cleanupFixture(fixture); }
  });

  test.skip("[P0][AC1] reads the stored route and never requires client-side route reconstruction", async (testCtx) => {
    const up = await isLocalStackReachable(); if (skipUnlessStack(testCtx, up)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const [seeded] = await adminQuery<NotificationRow>(
        "insert into public.notifications (tenant_id,recipient_user_id,category,title,body,route) values ($1,$2,'quote.follow_up_due','Påminnelse','Säker projektinformation','/quotes/stored-target') returning id,tenant_id,recipient_user_id,category,title,body,route,read_at",
        [fixture.tenantA.id, fixture.adminA.id],
      );
      const recipient = await makeAuthedServerClient(fixture.adminA);
      const { data, error } = await recipient.from("notifications").select("id,route").eq("id", seeded.id).single();
      expect(error).toBeNull();
      expect(data).toEqual({ id: seeded.id, route: "/quotes/stored-target" });
    } finally { await cleanupFixture(fixture); }
  });

  test.skip("[P0][AC2][13.2-INT-002] retry and concurrent due scans create one notification for each logical follow-up period", async (testCtx) => {
    const up = await isLocalStackReachable(); if (skipUnlessStack(testCtx, up)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const period = "2026-09-23";
      await Promise.all(Array.from({ length: 8 }, () => notifications.runDueFollowUpProducer({ tenantId: fixture.tenantA.id, period })));
      const rows = await adminQuery<{ count: number }>("select count(*)::int as count from public.notifications where tenant_id=$1 and category='quote.follow_up_due' and logical_period=$2", [fixture.tenantA.id, period]);
      expect(rows[0]?.count).toBe(1);
    } finally { await cleanupFixture(fixture); }
  });

  test.skip("[P0][AC2] terminal quote or completed follow-up suppresses the due reminder before it is persisted", async (testCtx) => {
    const up = await isLocalStackReachable(); if (skipUnlessStack(testCtx, up)) return;
    const fixture = await createTwoTenantFixture();
    try {
      await notifications.runDueFollowUpProducer({ tenantId: fixture.tenantA.id, period: "2026-09-23" });
      const rows = await adminQuery<{ count: number }>("select count(*)::int as count from public.notifications where tenant_id=$1 and category='quote.follow_up_due'", [fixture.tenantA.id]);
      expect(rows[0]?.count).toBe(0);
    } finally { await cleanupFixture(fixture); }
  });

  test.skip("[P0][AC3][13.2-RLS-001] allows each authenticated recipient to read only own-user rows in the current tenant", async (testCtx) => {
    const up = await isLocalStackReachable(); if (skipUnlessStack(testCtx, up)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const own = await makeAuthedServerClient(fixture.adminA);
      const { data, error } = await own.from("notifications").select("id,recipient_user_id");
      expect(error).toBeNull();
      expect(data?.every((row) => row.recipient_user_id === fixture.adminA.id)).toBe(true);
    } finally { await cleanupFixture(fixture); }
  });

  test.skip("[P0][AC3] rejects cross-user, cross-tenant, anonymous, raw direct-write, and arbitrary-recipient escalation attempts without changing protected rows", async (testCtx) => {
    const up = await isLocalStackReachable(); if (skipUnlessStack(testCtx, up)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const userA = await makeAuthedServerClient(fixture.adminA);
      const userB = await makeAuthedServerClient(fixture.adminB);
      const foreignBefore = await adminQuery<Pick<NotificationRow, "id" | "read_at">>("select id,read_at from public.notifications where tenant_id=$1", [fixture.tenantB.id]);
      const crossTenantRead = await userA.from("notifications").select("id").eq("tenant_id", fixture.tenantB.id);
      const directInsert = await userA.from("notifications").insert({ tenant_id: fixture.tenantB.id, recipient_user_id: fixture.adminB.id, category: "quote.follow_up_due", title: "forged", body: "forged", route: "/forged" });
      const crossUserMutation = await userB.from("notifications").update({ read_at: new Date().toISOString() }).eq("tenant_id", fixture.tenantA.id);
      const anonymous = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
      const anonymousRead = await anonymous.from("notifications").select("id");
      expect(crossTenantRead.data ?? []).toEqual([]);
      expect(directInsert.error?.code).toBe("42501");
      expect(crossUserMutation.error?.code).toBe("42501");
      expect(anonymousRead.data ?? []).toEqual([]);
      expect(await adminQuery<Pick<NotificationRow, "id" | "read_at">>("select id,read_at from public.notifications where tenant_id=$1", [fixture.tenantB.id])).toEqual(foreignBefore);
    } finally { await cleanupFixture(fixture); }
  });

  test.skip("[P0][AC4][13.2-INT-004] mark-one changes only the current recipient row and replay remains idempotent", async (testCtx) => {
    const up = await isLocalStackReachable(); if (skipUnlessStack(testCtx, up)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const [row] = await adminQuery<Pick<NotificationRow, "id">>("insert into public.notifications (tenant_id,recipient_user_id,category,title,body,route) values ($1,$2,'quote.follow_up_due','Påminnelse','Body','/quotes/one') returning id", [fixture.tenantA.id, fixture.adminA.id]);
      await notifications.markRead({ notificationId: row.id });
      const [first] = await adminQuery<Pick<NotificationRow, "read_at">>("select read_at from public.notifications where id=$1", [row.id]);
      await notifications.markRead({ notificationId: row.id });
      const [replay] = await adminQuery<Pick<NotificationRow, "read_at">>("select read_at from public.notifications where id=$1", [row.id]);
      expect(first.read_at).not.toBeNull();
      expect(replay).toEqual(first);
    } finally { await cleanupFixture(fixture); }
  });

  test.skip("[P0][AC4] mark-all affects only current-user unread rows and injected command failure reloads persisted truth", async (testCtx) => {
    const up = await isLocalStackReachable(); if (skipUnlessStack(testCtx, up)) return;
    const fixture = await createTwoTenantFixture();
    try {
      await notifications.markAllRead();
      const own = await adminQuery<{ count: number }>("select count(*)::int as count from public.notifications where tenant_id=$1 and recipient_user_id=$2 and read_at is null", [fixture.tenantA.id, fixture.adminA.id]);
      const foreign = await adminQuery<{ count: number }>("select count(*)::int as count from public.notifications where tenant_id=$1 and recipient_user_id<>$2 and read_at is null", [fixture.tenantA.id, fixture.adminA.id]);
      expect(own[0]?.count).toBe(0);
      expect(foreign[0]?.count).toBeGreaterThan(0);
      // With a forced command/audit failure, the next DB read must retain unread state for retry.
      expect((await adminQuery<{ count: number }>("select count(*)::int as count from public.notifications where tenant_id=$1 and recipient_user_id=$2 and read_at is null", [fixture.tenantA.id, fixture.adminA.id]))[0]?.count).toBeGreaterThan(0);
    } finally { await cleanupFixture(fixture); }
  });

  test.skip("[P0][AC5][13.2-INT-003] absent preferences resolve category defaults while a non-essential in-app choice persists per user", async (testCtx) => {
    const up = await isLocalStackReachable(); if (skipUnlessStack(testCtx, up)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const before = await adminQuery<{ count: number }>("select count(*)::int as count from public.notification_preferences where tenant_id=$1 and user_id=$2 and category='quote.follow_up_due'", [fixture.tenantA.id, fixture.adminA.id]);
      expect(before[0]?.count).toBe(0);
      await notifications.updatePreference({ category: "quote.follow_up_due", channel: "in_app", enabled: true });
      const persisted = await adminQuery<{ enabled: boolean }>("select enabled from public.notification_preferences where tenant_id=$1 and user_id=$2 and category='quote.follow_up_due' and channel='in_app'", [fixture.tenantA.id, fixture.adminA.id]);
      expect(persisted).toEqual([{ enabled: true }]);
    } finally { await cleanupFixture(fixture); }
  });

  test.skip("[P0][AC5] server rejects disabling an essential in-app category and rejects email changes while email is inactive", async () => {
    await notifications.updatePreference({ category: "quote.follow_up_due", channel: "in_app", enabled: false });
    await notifications.updatePreference({ category: "quote.follow_up_due", channel: "email", enabled: true });
    const forbidden = await adminQuery<{ count: number }>("select count(*)::int as count from public.notification_preferences where category='quote.follow_up_due' and ((channel='in_app' and enabled=false) or channel='email')");
    expect(forbidden[0]?.count).toBe(0);
  });

  test.skip("[P1][AC6] fresh-schema notification tables and preference rows retain tenant/user/category constraints under producer history states", async (testCtx) => {
    const up = await isLocalStackReachable(); if (skipUnlessStack(testCtx, up)) return;
    const columns = await adminQuery<{ table_name: string }>("select table_name from information_schema.tables where table_schema='public' and table_name in ('notifications','notification_preferences') order by table_name");
    expect(columns.map((row) => row.table_name)).toEqual(["notification_preferences", "notifications"]);
  });
});
