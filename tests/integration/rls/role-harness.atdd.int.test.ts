import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildEffectivePermissions } from "@/server/authz/role-catalogue";
import { roleCatalogueForAdminUsers, type AdminUserRow } from "@/features/admin-users/read";
import { TENANT_ROLES, type TenantRole } from "@/server/authz/roles";
import { activeRoleHarnessObligations, buildRoleHarnessCases, runCommandHarnessProbe, tableRlsProjectionAdapter } from "../../support/authz/role-harness";
import type { TenantTableName } from "./tenant-table-inventory";
import { adminInsertAuditEvent } from "../../factories/audit-events";
import {
  adminInsertArticle, adminInsertCalculation, adminInsertCompanySettings, adminInsertContact,
  adminInsertCustomer, adminInsertFacility, adminInsertFile, adminInsertFileLink,
  adminInsertJob, adminInsertJobEvent, adminInsertMembership, adminInsertQuote,
  adminInsertQuoteAcceptance, adminInsertQuoteEvent, adminInsertQuoteFollowUp,
  adminInsertQuoteLostReason, adminInsertQuoteReviewAuthorization, adminInsertQuoteTerms,
  adminInsertQuoteVersion, adminInsertQuoteVersionAttachment, adminInsertSection,
  adminInsertTenantCounter, adminInsertWorkRole, adminInsertRow, adminSelectQuoteVersionLines,
  adminUpdateQuoteVersionStatus, cleanupRoleAwarePhaseAFixture, createRoleAwarePhaseAFixture,
  makeAuthedServerClient, type RoleAwarePhaseAFixture, type TestServerClient,
} from "../../factories/tenants";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

let stackUp = false;
let fixture: RoleAwarePhaseAFixture;
let clients: Record<TenantRole, TestServerClient>;
let ownTableIds: Record<TenantTableName, string>;
let foreignTableIds: Record<TenantTableName, string>;
let selfTableIds: Record<TenantRole, Pick<Record<TenantTableName, string>, "tenant_memberships" | "membership_roles">>;
let personalTableIds: Record<TenantRole, Pick<Record<TenantTableName, string>, "notifications" | "notification_preferences">>;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createRoleAwarePhaseAFixture();
  await adminQuery("update public.tenant_memberships set invitation_expires_at = now() - interval '1 day' where tenant_id = $1 and user_id = $2", [fixture.base.tenantA.id, fixture.invitedUser.id]);
  await Promise.all([
    adminInsertMembership({ tenant_id: fixture.base.tenantA.id, user_id: fixture.base.adminB.id, role: "montor", status: "revoked", invited_email: fixture.base.adminB.email }),
    adminInsertMembership({ tenant_id: fixture.base.tenantA.id, user_id: fixture.base.orphanUser.id, role: "ekonomi", status: "ended", invited_email: fixture.base.orphanUser.email }),
  ]);
  clients = Object.fromEntries(await Promise.all(TENANT_ROLES.map(async (role) => [role, await makeAuthedServerClient(fixture.users[role])] as const))) as Record<TenantRole, TestServerClient>;
  selfTableIds = Object.fromEntries(await Promise.all(TENANT_ROLES.map(async (role) => {
    const membership = (await adminQuery<{ id: string }>("select id from public.tenant_memberships where tenant_id = $1 and user_id = $2", [fixture.base.tenantA.id, fixture.users[role].id]))[0]?.id;
    if (!membership) throw new Error(`role harness seed: ${role} membership missing`);
    const membershipRole = (await adminQuery<{ id: string }>(
      "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, $3) on conflict (membership_id, role) do update set role = excluded.role returning id",
      [fixture.base.tenantA.id, membership, role],
    ))[0]?.id;
    if (!membershipRole) throw new Error(`role harness seed: ${role} membership role missing`);
    return [role, { tenant_memberships: membership, membership_roles: membershipRole }] as const;
  }))) as Record<TenantRole, Pick<Record<TenantTableName, string>, "tenant_memberships" | "membership_roles">>;
  ownTableIds = await seedEveryTenantTable(fixture.base.tenantA.id, fixture.base.adminA.id);
  foreignTableIds = await seedEveryTenantTable(fixture.base.tenantB.id, fixture.base.adminB.id);
  personalTableIds = Object.fromEntries(await Promise.all(TENANT_ROLES.map(async (role) => {
    const userId = fixture.users[role].id;
    const notification = (await adminQuery<{ id: string }>("insert into public.notifications (tenant_id, recipient_user_id, category, title, body, route, logical_subject_id, logical_period) values ($1, $2, 'quote.follow_up_due', 'Role harness', 'Personal notification', '/notifications', gen_random_uuid(), current_date) returning id", [fixture.base.tenantA.id, userId]))[0]?.id;
    const preference = (await adminQuery<{ id: string }>("insert into public.notification_preferences (tenant_id, user_id, category, channel, enabled) values ($1, $2, 'quote.follow_up_due', 'in_app', true) on conflict (tenant_id,user_id,category,channel) do update set enabled = excluded.enabled returning id", [fixture.base.tenantA.id, userId]))[0]?.id;
    if (!notification || !preference) throw new Error(`role harness seed: personal notification rows missing for ${role}`);
    return [role, { notifications: notification, notification_preferences: preference }] as const;
  }))) as Record<TenantRole, Pick<Record<TenantTableName, string>, "notifications" | "notification_preferences">>;
});
afterAll(async () => {
  if (stackUp && fixture) await cleanupRoleAwarePhaseAFixture(fixture);
  if (stackUp) await closeAdminPool();
});


async function seedEveryTenantTable(tenantId: string, actorId: string): Promise<Record<TenantTableName, string>> {
  const customer = await adminInsertCustomer({ tenant_id: tenantId, customer_type: "company", display_name: `role-harness ${crypto.randomUUID()}` });
  const facility = await adminInsertFacility({ tenant_id: tenantId, customer_id: customer, name: "role-harness facility" });
  const contact = await adminInsertContact({ tenant_id: tenantId, customer_id: customer, facility_id: facility, name: "role-harness contact" });
  const companySettings = await adminInsertCompanySettings({ tenant_id: tenantId, company_name: `Role harness ${crypto.randomUUID()}` });
  const quoteTerms = await adminInsertQuoteTerms({ tenant_id: tenantId, terms_text: "Role harness terms" });
  const workRole = await adminInsertWorkRole({ tenant_id: tenantId, display_name: "Role harness work role" });
  const article = await adminInsertArticle({ tenant_id: tenantId, name: "Role harness article" });
  const calculation = await adminInsertCalculation({ tenant_id: tenantId, customer_id: customer, title: "Role harness calculation" });
  const calculationSection = await adminInsertSection({ tenant_id: tenantId, calculation_id: calculation, title: "Role harness section" });
  const calculationRow = await adminInsertRow({ tenant_id: tenantId, section_id: calculationSection, row_type: "labor", unit_cost_ore: 100, unit_sell_ore: 200 });
  const file = await adminInsertFile({ tenant_id: tenantId, display_name: "role-harness.pdf", lifecycle_state: "linked" });
  const fileLink = await adminInsertFileLink({ tenant_id: tenantId, file_id: file, owner_type: "customer", owner_id: customer, purpose: "crm_document" });
  const counter = await adminInsertTenantCounter({ tenant_id: tenantId, counter_name: `role_harness_${crypto.randomUUID()}`, current_value: 1 });
  const quote = await adminInsertQuote({ tenant_id: tenantId, customer_id: customer });
  const quoteVersion = await adminInsertQuoteVersion({ tenant_id: tenantId, quote_id: quote, calculation_id: calculation, company_name: "Role harness", accepted_price_ore: 125_000 });
  const quoteVersionLine = String((await adminSelectQuoteVersionLines(quoteVersion))[0]?.id ?? "");
  if (!quoteVersionLine) throw new Error("role harness seed: quote version line missing");
  const quoteVersionAttachment = await adminInsertQuoteVersionAttachment({ tenant_id: tenantId, quote_version_id: quoteVersion, file_id: file, display_name: "role-harness.pdf" });
  const quoteEvent = await adminInsertQuoteEvent({ tenant_id: tenantId, quote_id: quote, quote_version_id: quoteVersion, event_type: "created" });
  const quoteReviewAuthorization = await adminInsertQuoteReviewAuthorization({ tenant_id: tenantId, actor_user_id: actorId, quote_id: quote, quote_version_id: quoteVersion });
  await adminUpdateQuoteVersionStatus(quoteVersion, "sent");
  const quoteAcceptance = await adminInsertQuoteAcceptance({ tenant_id: tenantId, quote_id: quote, quote_version_id: quoteVersion, accepted_price_ore: 125_000, source_sent_total_ore: 125_000 });
  const quoteLostReason = await adminInsertQuoteLostReason({ tenant_id: tenantId, quote_id: quote, quote_version_id: quoteVersion, outcome: "forlorad", category: "pris" });
  const quoteFollowUp = await adminInsertQuoteFollowUp({ tenant_id: tenantId, quote_id: quote, quote_version_id: quoteVersion, due_date: "2026-12-31", note: "role harness", status: "open" });
  const job = await adminInsertJob({ tenant_id: tenantId, quote_acceptance_id: quoteAcceptance, quote_version_id: quoteVersion, customer_id: customer, title: "Role harness job" });
  const jobEvent = await adminInsertJobEvent({ tenant_id: tenantId, job_id: job, event_type: "created" });
  const auditEvent = await adminInsertAuditEvent({ tenant_id: tenantId, actor_user_id: actorId, command: "role.harness.seed", event_type: "seeded", target_type: "tenant", target_id: tenantId, correlation_id: crypto.randomUUID(), metadata: {} });
  const jobRun = (await adminQuery<{ id: string }>("insert into public.job_runs (tenant_id, producer, window_started_at, started_at, finished_at, outcome, correlation_id) values ($1, 'notifications.runner', now(), now(), now(), 'completed', gen_random_uuid()) returning id", [tenantId]))[0]?.id;
  if (!jobRun) throw new Error("role harness seed: job run missing");
  const notification = (await adminQuery<{ id: string }>("insert into public.notifications (tenant_id, recipient_user_id, category, title, body, route) values ($1, $2, 'quote.follow_up_due', 'Role harness', 'Notification seed', '/notifications') returning id", [tenantId, actorId]))[0]?.id;
  const notificationPreference = (await adminQuery<{ id: string }>("insert into public.notification_preferences (tenant_id, user_id, category, channel, enabled) values ($1, $2, 'quote.follow_up_due', 'in_app', true) returning id", [tenantId, actorId]))[0]?.id;
  if (!notification || !notificationPreference) throw new Error("role harness seed: notification rows missing");
  const emailOutbox = (await adminQuery<{ id: string }>(
    "insert into public.email_outbox (tenant_id, recipient_hash, category, subject_type, subject_id, logical_period, template_key, template_version, template_params) values ($1, repeat('a', 64), 'quote.follow_up_due', 'quote_follow_up', gen_random_uuid(), current_date, 'role-harness', 1, '{\"recipientUserId\":\"system\",\"displayName\":\"Role harness\",\"locale\":\"sv-SE\"}'::jsonb) returning id",
    [tenantId],
  ))[0]?.id;
  if (!emailOutbox) throw new Error("role harness seed: email outbox row missing");
  const emailDeliveryEvent = (await adminQuery<{ id: string }>(
    "insert into public.email_delivery_events (tenant_id, outbox_id, event_type) values ($1, $2, 'queued') returning id",
    [tenantId, emailOutbox],
  ))[0]?.id;
  const emailSuppression = (await adminQuery<{ id: string }>(
    "insert into public.email_suppressions (tenant_id, recipient_hash, category) values ($1, repeat('b', 64), 'quote.follow_up_due') returning id",
    [tenantId],
  ))[0]?.id;
  const emailDeliveryArtifact = (await adminQuery<{ id: string }>(
    "insert into public.email_delivery_artifacts (tenant_id, outbox_id, quote_version_id, content_fingerprint, pdf_bytes) values ($1, $2, $3, repeat('d', 64), decode('25504446', 'hex')) returning id",
    [tenantId, emailOutbox, quoteVersion],
  ))[0]?.id;
  const emailUnsubscribeToken = (await adminQuery<{ id: string }>("insert into public.email_unsubscribe_tokens (tenant_id, token_hash, recipient_hash, category) values ($1, encode(gen_random_bytes(32), 'hex'), repeat('e', 64), 'quote.delivery') returning id", [tenantId]))[0]?.id;
  const emailUnsubscribeRateLimit = (await adminQuery<{ id: string }>("insert into public.email_unsubscribe_rate_limits (tenant_id, token_hash, ip_hash, window_started_at) values ($1, encode(gen_random_bytes(32), 'hex'), repeat('f', 64), now()) returning id", [tenantId]))[0]?.id;
  if (!emailDeliveryEvent || !emailSuppression || !emailDeliveryArtifact || !emailUnsubscribeToken || !emailUnsubscribeRateLimit) throw new Error("role harness seed: email support rows missing");
  const membership = (await adminQuery<{ id: string }>("select id from public.tenant_memberships where tenant_id = $1 and user_id = $2", [tenantId, actorId]))[0]?.id;
  if (!membership) throw new Error("role harness seed: actor membership missing");
  const membershipRole = (await adminQuery<{ id: string }>(
    "insert into public.membership_roles (tenant_id, membership_id, role) values ($1, $2, 'tenant_admin') on conflict (membership_id, role) do update set role = excluded.role returning id",
    [tenantId, membership],
  ))[0]?.id;
  if (!membershipRole) throw new Error("role harness seed: membership role missing");
  const membershipOperation = (await adminQuery<{ id: string }>("insert into public.membership_admin_operations (id, tenant_id, actor_user_id, membership_id, action, outcome) values (gen_random_uuid(), $1, $2, $3, 'invite', 'succeeded') returning id", [tenantId, actorId, membership]))[0]?.id;
  if (!membershipOperation) throw new Error("role harness seed: membership operation missing");
  const provisioningRequest = (await adminQuery<{ request_id: string }>("insert into public.tenant_provisioning_requests (request_id, canonical_request_hash, tenant_id, actor_user_id, preview_hash) values (gen_random_uuid(), repeat('a',64), $1, $2, repeat('b',64)) returning request_id", [tenantId, actorId]))[0]?.request_id;
  const provisioningInvite = (await adminQuery<{ tenant_id: string }>("insert into public.tenant_provisioning_invites (tenant_id, membership_id, token_hash, normalized_email) values ($1, $2, repeat('c',64), 'role-harness@example.test') returning tenant_id", [tenantId, membership]))[0]?.tenant_id;
  if (!provisioningRequest || !provisioningInvite) throw new Error("role harness seed: provisioning rows missing");
  return {
    tenants: tenantId, tenant_memberships: membership, membership_roles: membershipRole,
    membership_admin_operations: membershipOperation, audit_events: auditEvent, job_runs: jobRun,
    notifications: notification, notification_preferences: notificationPreference,
    email_outbox: emailOutbox, email_delivery_events: emailDeliveryEvent, email_suppressions: emailSuppression,
    email_delivery_artifacts: emailDeliveryArtifact, email_unsubscribe_tokens: emailUnsubscribeToken,
    email_unsubscribe_rate_limits: emailUnsubscribeRateLimit,
    customers: customer, facilities: facility, contacts: contact, company_settings: companySettings,
    quote_terms: quoteTerms, work_roles: workRole, articles: article, calculations: calculation,
    calculation_sections: calculationSection, calculation_rows: calculationRow, files: file,
    file_links: fileLink, tenant_counters: counter, quotes: quote, quote_versions: quoteVersion,
    quote_version_lines: quoteVersionLine, quote_version_attachments: quoteVersionAttachment,
    quote_events: quoteEvent, quote_review_authorizations: quoteReviewAuthorization,
    quote_acceptances: quoteAcceptance, quote_lost_reasons: quoteLostReason,
    quote_follow_ups: quoteFollowUp, jobs: job, job_events: jobEvent,
    tenant_provisioning_requests: provisioningRequest, tenant_provisioning_invites: provisioningInvite,
  };
}

describe("Story 11.4 role harness", () => {
  test("[P0] derives unique seeded-role × active table/command obligations", () => {
    const obligations = activeRoleHarnessObligations();
    const cases = buildRoleHarnessCases();
    expect(obligations.length).toBeGreaterThan(0);
    expect(cases).toHaveLength(TENANT_ROLES.length * obligations.length);
    expect(new Set(obligations.map((entry) => entry.id)).size).toBe(obligations.length);
    expect(new Set(cases.map((entry) => `${entry.role}:${entry.id}`)).size).toBe(cases.length);
  });

  test("[P0] every generated table � role case executes its seeded safe RLS projection and rejects a concrete foreign row", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const tableCases = buildRoleHarnessCases().filter((entry) => entry.kind === "table");
    expect(tableCases).toHaveLength(TENANT_ROLES.length * Object.keys(ownTableIds).length);
    for (const obligation of tableCases) {
      const table = obligation.id.split(":").at(-1)! as TenantTableName;
      const adapter = tableRlsProjectionAdapter(table);
      const ownId = table === "tenant_memberships" || table === "membership_roles"
        ? selfTableIds[obligation.role][table]
        : table === "notifications" || table === "notification_preferences"
          ? personalTableIds[obligation.role][table]
        : ownTableIds[table];
      const own = await adapter.read(clients[obligation.role] as never, ownId);
      if (adapter.directReadDenied) {
        expect(own.error, obligation.id).not.toBeNull();
        const foreign = await adapter.read(clients[obligation.role] as never, foreignTableIds[table]);
        expect(foreign.error, `${obligation.id}:foreign`).not.toBeNull();
        continue;
      }
      expect(own.error, obligation.id).toBeNull();
      expect((own.data ?? []).length > 0, obligation.id).toBe(obligation.expected === "allowed");
      const foreign = await adapter.read(clients[obligation.role] as never, foreignTableIds[table]);
      expect(foreign.error, `${obligation.id}:foreign`).toBeNull();
      expect(foreign.data ?? [], `${obligation.id}:foreign`).toEqual([]);
    }
  });

  test("[P0] each seeded role has an authenticated RLS membership boundary", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    for (const role of TENANT_ROLES) {
      const result = await clients[role].from("tenant_memberships").select("id, tenant_id").eq("tenant_id", fixture.base.tenantA.id);
      expect(result.error).toBeNull();
      const rows = result.data ?? [];
      if (role === "tenant_admin") expect(rows.length).toBeGreaterThanOrEqual(TENANT_ROLES.length);
      else expect(rows).toHaveLength(1);
    }
  });

  test("[P0] every generated command role boundary executes through the production envelope without denied audit effects", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const before = await adminQuery<{ count: string }>("select count(*)::text as count from public.audit_events where tenant_id = $1", [fixture.base.tenantA.id]);
    for (const obligation of buildRoleHarnessCases().filter((entry) => entry.kind === "command")) {
      const result = await runCommandHarnessProbe({ command: obligation.id.slice("command:".length), client: clients[obligation.role] as never });
      expect(result.ok, obligation.id).toBe(obligation.expected === "allowed");
      if (!result.ok) expect(result.code, obligation.id).toBe("PERMISSION_DENIED");
    }
    const after = await adminQuery<{ count: string }>("select count(*)::text as count from public.audit_events where tenant_id = $1", [fixture.base.tenantA.id]);
    expect(after[0]?.count).toBe(before[0]?.count);
  });

  test("[P1] database lifecycle rows project exact active-only role counts and deterministic effective unions", async (ctx) => {
    if (skipUnlessStack(ctx, stackUp)) return;
    const memberships = await clients.tenant_admin.from("tenant_memberships").select("id, invited_email, status, role, created_at").eq("tenant_id", fixture.base.tenantA.id);
    expect(memberships.error).toBeNull();
    const ids = (memberships.data ?? []).map((row) => row.id);
    const roleRows = await clients.tenant_admin.from("membership_roles").select("membership_id, role").in("membership_id", ids);
    expect(roleRows.error).toBeNull();
    const rolesByMembership = new Map<string, string[]>();
    for (const row of roleRows.data ?? []) rolesByMembership.set(row.membership_id, [...(rolesByMembership.get(row.membership_id) ?? []), row.role]);
    const rows: AdminUserRow[] = (memberships.data ?? []).map((row) => ({ id: row.id, email: row.invited_email, status: row.status, role: row.role, roles: rolesByMembership.get(row.id) ?? [row.role], createdAt: row.created_at }));
    const catalogue = roleCatalogueForAdminUsers(rows);
    expect(catalogue.roles.map((role) => role.activeMemberLabel)).toEqual(Array(5).fill("Aktiva medlemmar"));
    expect(Object.fromEntries(catalogue.roles.map((role) => [role.role, role.activeMemberCount]))).toEqual({ tenant_admin: 2, projektledare: 2, montor: 1, saljare: 2, ekonomi: 1 });
    const grants = buildEffectivePermissions(["saljare", "projektledare", "saljare"]);
    expect(new Set(grants.map((grant) => `${grant.module}:${grant.capability}`)).size).toBe(grants.length);
    expect(grants.every((grant) => grant.grantingRoles.join("|") === [...grant.grantingRoles].sort((a, b) => a.localeCompare(b, "sv")).join("|"))).toBe(true);
    const foreign = await clients.tenant_admin.from("tenant_memberships").select("id").eq("tenant_id", fixture.base.tenantB.id);
    expect(foreign.error).toBeNull();
    expect(foreign.data ?? []).toEqual([]);
  });
});
