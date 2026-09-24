/** Story 13.2 database and producer acceptance coverage. */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { adminInsertCalculation, adminInsertCustomer, adminInsertQuote, adminInsertQuoteFollowUp, adminInsertQuoteVersion, adminUpdateQuoteVersionStatus, cleanupFixture, createTwoTenantFixture, makeAuthedServerClient } from "../../factories/tenants";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { emitDueFollowUpNotifications } from "@/server/notifications/follow-up-producer";
import { isLocalStackReachable, LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

type NotificationRow = { id: string; tenant_id: string; recipient_user_id: string; category: "quote.follow_up_due"; title: string; body: string; route: string; read_at: string | null };
let stackUp = false;
beforeAll(async () => { stackUp = await isLocalStackReachable(); });
afterAll(async () => { await closeAdminPool(); });

function serviceClient() {
  return createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function seedDueFollowUp(tenantId: string): Promise<string> {
  const customerId = await adminInsertCustomer({ tenant_id: tenantId, customer_type: "company", display_name: "Notification projection" });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const calculationId = await adminInsertCalculation({ tenant_id: tenantId, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({ tenant_id: tenantId, quote_id: quoteId, calculation_id: calculationId, company_name: "Notification tenant" });
  await adminUpdateQuoteVersionStatus(versionId, "sent");
  return adminInsertQuoteFollowUp({ tenant_id: tenantId, quote_id: quoteId, quote_version_id: versionId, due_date: "2026-09-23" });
}

describe("Story 13.2 notification data, producer, and personal RLS contracts", () => {
  test("[P0][AC1][13.2-INT-001] emits recipient-projected content and stores the route", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const followUpId = await seedDueFollowUp(fixture.tenantA.id);
      await emitDueFollowUpNotifications(serviceClient(), fixture.tenantA.id, "2026-09-23");
      const rows = await adminQuery<NotificationRow>("select id,tenant_id,recipient_user_id,category,title,body,route,read_at from public.notifications where tenant_id=$1 and logical_subject_id=$2", [fixture.tenantA.id, followUpId]);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ tenant_id: fixture.tenantA.id, recipient_user_id: fixture.adminA.id, category: "quote.follow_up_due", read_at: null });
      expect(rows[0]?.title).not.toMatch(/kostnad|marginal|pris/i);
      expect(rows[0]?.body).not.toMatch(/kostnad|marginal|pris/i);
      expect(rows[0]?.route).toMatch(/^\/quotes\/[0-9a-f-]+$/);
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0][AC2][13.2-INT-002] concurrent due scans deduplicate and terminal work emits nothing", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const followUpId = await seedDueFollowUp(fixture.tenantA.id);
      await Promise.all(Array.from({ length: 6 }, () => emitDueFollowUpNotifications(serviceClient(), fixture.tenantA.id, "2026-09-23")));
      expect((await adminQuery<{ count: number }>("select count(*)::int as count from public.notifications where tenant_id=$1 and logical_subject_id=$2", [fixture.tenantA.id, followUpId]))[0]?.count).toBe(1);
      const terminalFollowUpId = await seedDueFollowUp(fixture.tenantA.id);
      const terminalVersion = await adminQuery<{ quote_version_id: string }>("select quote_version_id from public.quote_follow_ups where id=$1", [terminalFollowUpId]);
      await adminUpdateQuoteVersionStatus(terminalVersion[0]!.quote_version_id, "accepted");
      await emitDueFollowUpNotifications(serviceClient(), fixture.tenantA.id, "2026-09-23");
      expect((await adminQuery<{ count: number }>("select count(*)::int as count from public.notifications where tenant_id=$1 and logical_subject_id=$2", [fixture.tenantA.id, terminalFollowUpId]))[0]?.count).toBe(0);
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0][AC3][13.2-RLS-001] recipient reads and acknowledgements stay personal", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const [own, foreign] = await adminQuery<NotificationRow>("insert into public.notifications (tenant_id,recipient_user_id,category,title,body,route) values ($1,$2,'quote.follow_up_due','Own','Safe','/notifications'),($1,$3,'quote.follow_up_due','Foreign','Safe','/notifications') returning id,tenant_id,recipient_user_id,category,title,body,route,read_at", [fixture.tenantA.id, fixture.adminA.id, fixture.orphanUser.id]);
      const recipient = await makeAuthedServerClient(fixture.adminA);
      expect((await recipient.from("notifications").select("id,recipient_user_id").eq("tenant_id", fixture.tenantA.id)).data).toEqual([{ id: own!.id, recipient_user_id: fixture.adminA.id }]);
      expect((await recipient.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", own!.id).is("read_at", null)).error).toBeNull();
      expect((await recipient.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", own!.id).is("read_at", null)).error).toBeNull();
      expect((await recipient.from("notifications").update({ id: crypto.randomUUID() }).eq("id", own!.id)).error?.code).toBe("42501");
      const persisted = await adminQuery<Pick<NotificationRow, "id" | "read_at">>("select id,read_at from public.notifications where id in ($1,$2)", [own!.id, foreign!.id]);
      expect(persisted.find((row) => row.id === own!.id)?.read_at).not.toBeNull();
      expect(persisted.find((row) => row.id === foreign!.id)?.read_at).toBeNull();
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0][AC3] raw writes, cross-tenant reads, and anonymous reads are denied", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const userA = await makeAuthedServerClient(fixture.adminA);
      expect((await userA.from("notifications").select("id").eq("tenant_id", fixture.tenantB.id)).data ?? []).toEqual([]);
      expect((await userA.from("notifications").insert({ tenant_id: fixture.tenantB.id, recipient_user_id: fixture.adminB.id, category: "quote.follow_up_due", title: "forged", body: "forged", route: "/forged" })).error?.code).toBe("42501");
      const anonymous = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
      expect((await anonymous.from("notifications").select("id")).data ?? []).toEqual([]);
    } finally { await cleanupFixture(fixture); }
  });

  test("[P0][AC5][13.2-INT-003] essential preferences remain enabled while the activated delivery email preference is permitted", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const user = await makeAuthedServerClient(fixture.adminA);
      expect((await user.from("notification_preferences").select("id").eq("tenant_id", fixture.tenantA.id)).data).toEqual([]);
      expect((await user.from("notification_preferences").insert({ tenant_id: fixture.tenantA.id, user_id: fixture.adminA.id, category: "quote.follow_up_due", channel: "in_app", enabled: true })).error).toBeNull();
      expect(await adminQuery<{ enabled: boolean }>("select enabled from public.notification_preferences where tenant_id=$1 and user_id=$2 and category='quote.follow_up_due' and channel='in_app'", [fixture.tenantA.id, fixture.adminA.id])).toEqual([{ enabled: true }]);
      expect((await user.from("notification_preferences").insert({ tenant_id: fixture.tenantA.id, user_id: fixture.adminA.id, category: "quote.follow_up_due", channel: "email", enabled: true })).error).toBeNull();
      expect((await user.from("notification_preferences").insert({ tenant_id: fixture.tenantA.id, user_id: fixture.adminA.id, category: "quote.follow_up_due", channel: "in_app", enabled: false })).error?.code).toBe("23514");
      expect((await user.from("notification_preferences").upsert({ tenant_id: fixture.tenantA.id, user_id: fixture.adminA.id, category: "quote.follow_up_due", channel: "email", enabled: false }, { onConflict: "tenant_id,user_id,category,channel" })).error?.code).toBe("23514");
      expect((await user.from("notification_preferences").insert({ tenant_id: fixture.tenantA.id, user_id: fixture.adminA.id, category: "quote.delivery", channel: "email", enabled: false })).error).toBeNull();
      expect((await user.from("notification_preferences").upsert({ tenant_id: fixture.tenantA.id, user_id: fixture.adminA.id, category: "quote.delivery", channel: "email", enabled: true }, { onConflict: "tenant_id,user_id,category,channel" })).error).toBeNull();
      expect(await adminQuery<{ enabled: boolean }>("select enabled from public.notification_preferences where tenant_id=$1 and user_id=$2 and category='quote.delivery' and channel='email'", [fixture.tenantA.id, fixture.adminA.id])).toEqual([{ enabled: true }]);
    } finally { await cleanupFixture(fixture); }
  });

  test("[P1][AC6] notification tables retain forced-RLS fresh-schema contracts", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    expect(await adminQuery<{ table_name: string; relforcerowsecurity: boolean }>("select c.relname as table_name,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('notifications','notification_preferences') order by c.relname")).toEqual([{ table_name: "notification_preferences", relforcerowsecurity: true }, { table_name: "notifications", relforcerowsecurity: true }]);
  });
});
