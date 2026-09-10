/**
 * Story 11.2 successor quote authority: Quotes.Create allows Admin,
 * Projektledare and Säljare to issue and consume a one-time successor review.
 * The role check, source revision, successor write and fixed audit are all
 * database-owned; these tests use the real anon-key/RLS command path.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminSelectAuditEvents } from "../../factories/audit-events";
import { adminExec, adminQuery, closeAdminPool } from "../../factories/admin-sql";
import {
  adminInsertCalculation,
  adminInsertCustomer,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminInsertRow,
  adminInsertSection,
  adminSelectQuoteVersionsForQuote,
  adminUpdateQuoteVersionStatus,
  cleanupRoleAwarePhaseAFixture,
  createRoleAwarePhaseAFixture,
  makeAuthedServerClient,
  type RoleAwarePhaseAFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { assertSearchPathExactlyEmpty } from "../../support/search-path";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { createNewQuoteVersion } from "@/server/commands/quotes";
import {
  attachmentsToPayload,
  buildFreshQuoteSnapshot,
  linesToPayload,
  snapshotToPayload,
} from "@/server/commands/quotes/snapshot-build";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-09-09T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

interface SentSource {
  readonly quoteId: string;
  readonly versionId: string;
  readonly calculationId: string;
  readonly rowId: string;
}

let stackUp = false;
let fixture: RoleAwarePhaseAFixture;
let admin: TestServerClient;
let projektledare: TestServerClient;
let seller: TestServerClient;
let montor: TestServerClient;

async function seedSentSource(label: string): Promise<SentSource> {
  const tenantId = fixture.base.tenantA.id;
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `${label}-customer`,
  });
  const calculationId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: `${label}-calculation`,
  });
  const sectionId = await adminInsertSection({ tenant_id: tenantId, calculation_id: calculationId });
  const rowId = await adminInsertRow({
    tenant_id: tenantId,
    section_id: sectionId,
    row_type: "labor",
    label: `${label}-labor`,
    quantity: 1,
    unit: "h",
    unit_cost_ore: 2_000,
    unit_sell_ore: 10_000,
    vat_rate_bp: 2500,
  });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calculationId,
    company_name: `${label}-company`,
  });
  await adminUpdateQuoteVersionStatus(versionId, "sent");
  return { quoteId, versionId, calculationId, rowId };
}

async function withForcedAuditFailure<T>(
  correlationId: string,
  run: () => Promise<T>,
): Promise<T> {
  await adminExec(
    `insert into test_support.forced_audit_failures (correlation_id)
     values ($1::uuid) on conflict (correlation_id) do nothing`,
    [correlationId],
  );
  try {
    return await run();
  } finally {
    await adminExec(
      `delete from test_support.forced_audit_failures
        where correlation_id = $1::uuid`,
      [correlationId],
    );
  }
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createRoleAwarePhaseAFixture();
  [admin, projektledare, seller, montor] = await Promise.all([
    makeAuthedServerClient(fixture.users.tenant_admin),
    makeAuthedServerClient(fixture.users.projektledare),
    makeAuthedServerClient(fixture.users.saljare),
    makeAuthedServerClient(fixture.users.montor),
  ]);
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupRoleAwarePhaseAFixture(fixture);
  if (stackUp) await closeAdminPool();
});

describe("Story 11.2 successor quote review and creation", () => {
  it("[P0] hardens successor review/creation RPCs and retains the private audit writer", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{
      proname: string;
      prosecdef: boolean;
      proconfig: string[] | null;
      anon_exec: boolean;
      authenticated_exec: boolean;
      service_exec: boolean;
      definition: string;
    }>(
      `select p.proname,
              p.prosecdef,
              p.proconfig,
              has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_exec,
              has_function_privilege('service_role', p.oid, 'EXECUTE') as service_exec,
              pg_get_functiondef(p.oid) as definition
         from pg_catalog.pg_proc p
         join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
            'authorize_quote_successor_review',
            'create_new_quote_version',
            'story_11_2_record_audit_event_internal'
          )`,
    );
    expect(rows).toHaveLength(3);
    for (const name of ["authorize_quote_successor_review", "create_new_quote_version"]) {
      const wrapper = rows.find((row) => row.proname === name);
      expect(wrapper?.prosecdef).toBe(true);
      expect(wrapper?.anon_exec).toBe(false);
      expect(wrapper?.authenticated_exec).toBe(true);
      expect(wrapper?.service_exec).toBe(false);
      assertSearchPathExactlyEmpty(name, wrapper?.proconfig ?? null);
      expect(wrapper?.definition).toContain("story_11_2_assert_quote_roles");
    }
    const successor = rows.find((row) => row.proname === "create_new_quote_version");
    expect(successor?.definition).toContain("story_11_2_record_audit_event_internal");
    expect(successor?.definition).not.toMatch(/perform public\.record_audit_event\(/);

    const internal = rows.find((row) => row.proname === "story_11_2_record_audit_event_internal");
    expect(internal?.prosecdef).toBe(false);
    expect(internal?.anon_exec).toBe(false);
    expect(internal?.authenticated_exec).toBe(false);
    expect(internal?.service_exec).toBe(false);
    assertSearchPathExactlyEmpty("story_11_2_record_audit_event_internal", internal?.proconfig ?? null);
  });

  it("[P0] gives Projektledare and Säljare policy-backed visibility of their tenant's quote version", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const source = await seedSentSource(`11.2-successor-rls-${crypto.randomUUID()}`);
    const tenantId = fixture.base.tenantA.id;
    const [pmRole, sellerRole, pmQuote, sellerQuote, pmCalculation, sellerCalculation, sellerRows] = await Promise.all([
      projektledare.rpc("has_tenant_role", {
        target_tenant_id: tenantId,
        allowed_roles: ["projektledare"],
      }),
      seller.rpc("has_tenant_role", {
        target_tenant_id: tenantId,
        allowed_roles: ["saljare"],
      }),
      projektledare.from("quote_versions").select("id").eq("id", source.versionId),
      seller.from("quote_versions").select("id").eq("id", source.versionId),
      projektledare.from("calculations").select("id").eq("id", source.calculationId),
      seller.from("calculations").select("id").eq("id", source.calculationId),
      seller.from("calculation_rows").select("id, unit_cost_ore, markup_bp").eq("id", source.rowId),
    ]);
    expect(pmRole.error).toBeNull();
    expect(pmRole.data).toBe(true);
    expect(sellerRole.error).toBeNull();
    expect(sellerRole.data).toBe(true);
    expect(pmQuote.error).toBeNull();
    expect(pmQuote.data).toEqual([{ id: source.versionId }]);
    expect(sellerQuote.error).toBeNull();
    expect(sellerQuote.data).toEqual([{ id: source.versionId }]);
    expect(pmCalculation.error).toBeNull();
    expect(pmCalculation.data).toEqual([{ id: source.calculationId }]);
    expect(sellerCalculation.error).toBeNull();
    expect(sellerCalculation.data).toEqual([]);
    expect(sellerRows.error).toBeNull();
    expect(sellerRows.data).toEqual([]);
    const pmSnapshot = await buildFreshQuoteSnapshot(projektledare as never, {
      calculationId: source.calculationId,
      attachmentFileIds: [],
      capturedAt: FIXED_ISO,
    });
    expect(pmSnapshot).toMatchObject({ customerId: expect.any(String) });
    const issueCorrelationId = crypto.randomUUID();
    const issued = await projektledare.rpc("authorize_quote_successor_review", {
      p_tenant_id: tenantId,
      p_quote_id: source.quoteId,
      p_source_quote_version_id: source.versionId,
      p_calculation_id: source.calculationId,
      p_captured_at: FIXED_ISO,
      p_customer_id: pmSnapshot.customerId,
      p_facility_id: pmSnapshot.facilityId,
      p_contact_id: pmSnapshot.contactId,
      p_snapshot: snapshotToPayload(pmSnapshot.snapshot),
      p_lines: linesToPayload(pmSnapshot.snapshot),
      p_attachments: attachmentsToPayload(pmSnapshot.snapshot),
      p_supersede_prior: true,
      p_actor_user_id: fixture.users.projektledare.id,
      p_correlation_id: issueCorrelationId,
    });
    expect(issued.error).toBeNull();
    expect(typeof issued.data).toBe("string");
    for (const malformed of [
      { p_correlation_id: null, p_supersede_prior: true },
      { p_correlation_id: crypto.randomUUID(), p_supersede_prior: null },
    ]) {
      const denied = await projektledare.rpc("authorize_quote_successor_review", {
        p_tenant_id: tenantId, p_quote_id: source.quoteId, p_source_quote_version_id: source.versionId,
        p_calculation_id: source.calculationId, p_captured_at: FIXED_ISO,
        p_customer_id: pmSnapshot.customerId, p_facility_id: pmSnapshot.facilityId, p_contact_id: pmSnapshot.contactId,
        p_snapshot: snapshotToPayload(pmSnapshot.snapshot), p_lines: linesToPayload(pmSnapshot.snapshot),
        p_attachments: attachmentsToPayload(pmSnapshot.snapshot), p_actor_user_id: fixture.users.projektledare.id,
        ...malformed,
      });
      expect(denied.data).toBeNull();
      expect(denied.error?.code).toBe("23514");
      expect(JSON.stringify(denied.error)).not.toMatch(/unitCostOre|sourceKind|source_revision|reviewed_readiness/i);
    }
  });

  it("[P0] gives Säljare only the checked current successor projection and recaptures its current sales price", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const source = await seedSentSource(`11.2-successor-sales-source-${crypto.randomUUID()}`);
    const projection = await seller.rpc("read_quote_successor_source", {
      p_tenant_id: fixture.base.tenantA.id,
      p_source_quote_version_id: source.versionId,
      p_requested_attachment_ids: null,
      p_actor_user_id: fixture.users.saljare.id,
    });
    expect(projection.error).toBeNull();
    const serialized = JSON.stringify(projection.data);
    for (const protectedField of [
      "unit_cost_ore", "markup_bp", "internal_note", "source_revision", "cost_hash",
    ]) expect(serialized).not.toContain(protectedField);
    expect(projection.data).toMatchObject({
      low_margin_warning: { present: false, threshold_percent: null },
    });

    await adminExec(
      `update public.calculation_rows set unit_sell_ore = $1 where id = $2`,
      [12_345, source.rowId],
    );
    const result = await runCommand(createNewQuoteVersion, {
      client: seller as never,
      input: { quote_version_id: source.versionId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lines = await adminQuery<{ unit_sell_ore: string | number }>(
      `select unit_sell_ore from public.quote_version_lines where quote_version_id = $1`,
      [result.data.targetId],
    );
    expect(lines).toEqual([{ unit_sell_ore: "12345" }]);
  });

  it("[P0] rejects a stale LOW_MARGIN warning and keeps foreign source projection generic", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const source = await seedSentSource(`11.2-successor-warning-${crypto.randomUUID()}`);
    const snapshot = await buildFreshQuoteSnapshot(projektledare as never, {
      calculationId: source.calculationId,
      attachmentFileIds: [],
      capturedAt: FIXED_ISO,
    });
    expect(snapshot.snapshot.warnings.some((warning) => warning.code === "LOW_MARGIN")).toBe(false);
    await adminExec(
      `update public.calculation_rows set unit_cost_ore = $1 where id = $2`,
      [9_500, source.rowId],
    );
    const stale = await projektledare.rpc("authorize_quote_successor_review", {
      p_tenant_id: fixture.base.tenantA.id,
      p_quote_id: source.quoteId,
      p_source_quote_version_id: source.versionId,
      p_calculation_id: source.calculationId,
      p_captured_at: FIXED_ISO,
      p_customer_id: snapshot.customerId,
      p_facility_id: snapshot.facilityId,
      p_contact_id: snapshot.contactId,
      p_snapshot: snapshotToPayload(snapshot.snapshot),
      p_lines: linesToPayload(snapshot.snapshot),
      p_attachments: attachmentsToPayload(snapshot.snapshot),
      p_supersede_prior: true,
      p_actor_user_id: fixture.users.projektledare.id,
      p_correlation_id: crypto.randomUUID(),
    });
    expect(stale.data).toBeNull();
    expect(stale.error?.code).toBe("23514");

    const foreign = await seller.rpc("read_quote_successor_source", {
      p_tenant_id: fixture.base.tenantB.id,
      p_source_quote_version_id: source.versionId,
      p_requested_attachment_ids: null,
      p_actor_user_id: fixture.users.saljare.id,
    });
    expect(foreign.data).toBeNull();
    expect(foreign.error?.code).toBe("42501");
  });

  for (const [role, clientForRole, actorForRole] of [
    ["Admin", () => admin, () => fixture.users.tenant_admin.id],
    ["Projektledare", () => projektledare, () => fixture.users.projektledare.id],
    ["Säljare", () => seller, () => fixture.users.saljare.id],
  ] as const) {
    it(`[P0] lets ${role} issue and consume a successor review with one fixed audit`, async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const source = await seedSentSource(`11.2-successor-${role}-${crypto.randomUUID()}`);
    const correlationId = crypto.randomUUID();
    const result = await runCommand(createNewQuoteVersion, {
      client: clientForRole() as never,
      input: { quote_version_id: source.versionId },
      clock: fixedClock,
      correlationId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const versions = await adminSelectQuoteVersionsForQuote(source.quoteId);
    expect(versions).toHaveLength(2);
    expect(versions[0]).toMatchObject({ id: source.versionId, status: "superseded" });
    expect(versions[1]).toMatchObject({ id: result.data.targetId, status: "draft" });
    expect(String(versions[1]?.version_number)).toBe("2");

    const review = await adminQuery<{
      actor_user_id: string;
      consumed_at: string | null;
      consumed_target_id: string | null;
    }>(
      `select actor_user_id, consumed_at::text as consumed_at, consumed_target_id
         from public.quote_review_authorizations
        where correlation_id = $1`,
      [correlationId],
    );
    expect(review).toHaveLength(1);
    expect(review[0]).toMatchObject({
      actor_user_id: actorForRole(),
      consumed_target_id: result.data.targetId,
    });
    expect(review[0]?.consumed_at).not.toBeNull();

    expect(await adminSelectAuditEvents({ correlationId })).toEqual([
      expect.objectContaining({
        tenant_id: fixture.base.tenantA.id,
        actor_user_id: actorForRole(),
        command: "quote.version.new",
        event_type: "quote.version.created",
        target_type: "quote_version",
        target_id: result.data.targetId,
        metadata: {},
      }),
    ]);
    });
  }

  it("[P0] denies a Montör through both successor RPCs and direct quote DML", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const source = await seedSentSource(`11.2-successor-denied-${crypto.randomUUID()}`);
    const reviewCorrelationId = crypto.randomUUID();
    const review = await montor.rpc("authorize_quote_successor_review", {
      p_tenant_id: fixture.base.tenantA.id,
      p_quote_id: source.quoteId,
      p_source_quote_version_id: source.versionId,
      p_calculation_id: crypto.randomUUID(),
      p_captured_at: FIXED_ISO,
      p_customer_id: crypto.randomUUID(),
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: {},
      p_lines: [],
      p_attachments: [],
      p_supersede_prior: true,
      p_actor_user_id: fixture.users.montor.id,
      p_correlation_id: reviewCorrelationId,
    });
    expect(review.data).toBeNull();
    expect(review.error?.code).toBe("42501");
    expect(await adminSelectAuditEvents({ correlationId: reviewCorrelationId })).toEqual([]);

    const consumeCorrelationId = crypto.randomUUID();
    const consume = await montor.rpc("create_new_quote_version", {
      p_tenant_id: fixture.base.tenantA.id,
      p_authorization_id: crypto.randomUUID(),
      p_captured_at: FIXED_ISO,
      p_actor_user_id: fixture.users.montor.id,
      p_correlation_id: consumeCorrelationId,
    });
    expect(consume.data).toBeNull();
    expect(consume.error?.code).toBe("42501");
    expect(await adminSelectAuditEvents({ correlationId: consumeCorrelationId })).toEqual([]);

    const direct = await montor
      .from("quote_versions")
      .update({ status: "draft" })
      .eq("id", source.versionId)
      .select("id");
    expect(direct.data).toBeNull();
    expect(direct.error?.code).toBe("42501");
    const versions = await adminSelectQuoteVersionsForQuote(source.quoteId);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ id: source.versionId, status: "sent" });
  });

  it("[P0] rolls back the Seller successor rows, source transition and review consumption when fixed audit fails", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const source = await seedSentSource(`11.2-successor-rollback-${crypto.randomUUID()}`);
    const correlationId = crypto.randomUUID();
    const result = await withForcedAuditFailure(correlationId, () =>
      runCommand(createNewQuoteVersion, {
        client: seller as never,
        input: { quote_version_id: source.versionId },
        clock: fixedClock,
        correlationId,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SERVER_ERROR");

    const versions = await adminSelectQuoteVersionsForQuote(source.quoteId);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ id: source.versionId, status: "sent" });
    const review = await adminQuery<{ consumed_at: string | null; consumed_target_id: string | null }>(
      `select consumed_at::text as consumed_at, consumed_target_id
         from public.quote_review_authorizations
        where correlation_id = $1`,
      [correlationId],
    );
    expect(review).toEqual([{ consumed_at: null, consumed_target_id: null }]);
    expect(await adminSelectAuditEvents({ correlationId })).toEqual([]);
  });
});
