import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { cleanupFixture, createTwoTenantFixture, makeAuthedServerClient } from "../../factories/tenants";
import { isLocalStackReachable, LOCAL_SUPABASE_ANON_KEY, LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

let stackUp = false;
beforeAll(async () => { stackUp = await isLocalStackReachable(); });
afterAll(async () => { await closeAdminPool(); });

describe("Story 13.3 email outbox forced-RLS and authorization contracts", () => {
  test("[P0][AC5][13.3-RLS-001] enrolls all three direct tenant tables with forced RLS, grants, policies, and H4 metadata", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const rows = await adminQuery("select c.relname, c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('email_outbox','email_delivery_events','email_suppressions') order by c.relname");
    expect(rows).toEqual([{ relname: "email_delivery_events", relrowsecurity: true, relforcerowsecurity: true }, { relname: "email_outbox", relrowsecurity: true, relforcerowsecurity: true }, { relname: "email_suppressions", relrowsecurity: true, relforcerowsecurity: true }]);
    const { TENANT_TABLES } = await import(["./tenant-table-inventory"].join("")); expect(TENANT_TABLES).toEqual(expect.arrayContaining(["email_outbox", "email_delivery_events", "email_suppressions"]));
  });
  test("[P0][AC5][13.3-RLS-002] blocks direct outbox writes, cross-tenant reads, event mutation, and non-admin queue reads", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const adminA = await makeAuthedServerClient(fixture.adminA); const outbox = await seedOutbox(fixture.tenantA.id);
      for (const table of ["email_outbox", "email_delivery_events", "email_suppressions"] as const) expect((await adminA.from(table).select("*")).error?.code).toBe("42501");
      expect((await adminA.from("email_outbox").insert(forgedOutbox(fixture.tenantA.id))).error?.code).toBe("42501");
      expect((await adminA.from("email_outbox").select("id").eq("tenant_id", fixture.tenantB.id)).data ?? []).toEqual([]);
      expect((await adminA.from("email_delivery_events").update({ event_type: "sent" }).eq("outbox_id", outbox.id)).error?.code).toBe("42501");
      const { readEmailOutboxQueue } = await loadEmailReadModel(); await expect(readEmailOutboxQueue({ roles: ["saljare"] }, { client: adminA as never })).resolves.toMatchObject({ error: { code: "FORBIDDEN" } });
    } finally { await cleanupFixture(fixture); }
  });
  test("[P0][AC3][13.3-RLS-003] keeps suppression scoped by tenant plus recipient hash plus category", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const fixture = await createTwoTenantFixture();
    try {
      const suppressedA = await seedOutbox(fixture.tenantA.id, { recipientHash: "a".repeat(64), category: "quote.follow_up_due" }); const differentCategory = await seedOutbox(fixture.tenantA.id, { recipientHash: "a".repeat(64), category: "other" }); const tenantB = await seedOutbox(fixture.tenantB.id, { recipientHash: "a".repeat(64), category: "quote.follow_up_due" });
      await seedSuppression(fixture.tenantA.id, "a".repeat(64), "quote.follow_up_due"); const { processDarkEmailOutbox } = await loadOutbox(); await processDarkEmailOutbox(deps(), { tenantId: fixture.tenantA.id });
      expect(await outboxState(suppressedA.id)).toBe("suppressed"); expect(await outboxState(differentCategory.id)).toBe("queued"); expect(await outboxState(tenantB.id)).toBe("queued");
    } finally { await cleanupFixture(fixture); }
  });
  test("[P1][AC5][13.3-RLS-004] gives anon no table access and prevents recipient/body/detail disclosure from Admin queue rows", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const anon = createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } }); expect((await anon.from("email_outbox").select("id")).data ?? []).toEqual([]);
    const { readEmailOutboxQueue } = await loadEmailReadModel(); const projection = await readEmailOutboxQueue({ roles: ["tenant_admin"] }, { client: deps().client as never }); expect(JSON.stringify(projection.data)).not.toMatch(/recipient|template_body|failure_detail/i); expect(JSON.stringify(projection.data)).not.toMatch(/activation|send now/i);
  });
});
function deps() { return { client: createClient(LOCAL_SUPABASE_URL, LOCAL_SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } }) }; }
async function seedOutbox(tenantId: string, overrides: Record<string, string> = {}): Promise<{ id: string }> { return (await adminQuery<{ id: string }>("insert into public.email_outbox (tenant_id,recipient_hash,category,subject_type,subject_id,logical_period,template_key,template_version,template_params) values ($1,$2,$3,'quote_follow_up',gen_random_uuid(),'2026-09-23','dark',1,'{\"recipientUserId\":\"user\",\"displayName\":\"Ada\",\"locale\":\"sv-SE\"}'::jsonb) returning id", [tenantId, overrides.recipientHash ?? "a".repeat(64), overrides.category ?? "quote.follow_up_due"]))[0]!; }
async function loadOutbox(): Promise<any> { return import(["@/server/email/outbox"].join("")); }
async function loadEmailReadModel(): Promise<any> { return import(["@/server/read-models/email-outbox"].join("")); }
function forgedOutbox(tenantId: string) { return { tenant_id: tenantId, recipient_hash: "b".repeat(64), category: "quote.follow_up_due", subject_type: "quote_follow_up", subject_id: crypto.randomUUID(), logical_period: "2026-09-23", template_key: "quote-follow-up", template_version: 1, template_params: {} }; }
async function seedSuppression(tenantId: string, recipientHash: string, category: string): Promise<void> { await adminQuery("insert into public.email_suppressions (tenant_id,recipient_hash,category) values ($1,$2,$3)", [tenantId, recipientHash, category]); }
async function outboxState(id: string): Promise<string> { return (await adminQuery<{ state: string }>("select state from public.email_outbox where id=$1", [id]))[0]!.state; }