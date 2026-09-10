/** Story 11.2: Seller-only initial quote projection and atomic creation. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminSelectAuditEvents } from "../../factories/audit-events";
import { adminExec, adminQuery, closeAdminPool } from "../../factories/admin-sql";
import {
  adminInsertCalculation,
  adminInsertCustomer,
  adminInsertRow,
  adminInsertSection,
  cleanupRoleAwarePhaseAFixture,
  createRoleAwarePhaseAFixture,
  makeAuthedServerClient,
  type RoleAwarePhaseAFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { assertSearchPathExactlyEmpty } from "../../support/search-path";
import { skipUnlessStack } from "../../support/stack-gate";
import { buildQuoteReviewProof } from "../../support/quote-review-proof";
import { runCommand } from "@/server/commands/envelope";
import { createQuoteVersionFromCalculation } from "@/server/commands/quotes";
import {
  buildQuoteInitialCustomerVisibleReviewDigest,
  loadQuoteInitialCustomerVisibleSource,
} from "@/server/commands/quotes/quote-initial-source-db";
import { attachmentsToPayload, buildFreshQuoteSnapshotFromCustomerVisibleSource, linesToPayload, snapshotToPayload } from "@/server/commands/quotes/snapshot-build";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-09-09T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

interface InitialSource { readonly calculationId: string; readonly rowId: string; }
let stackUp = false;
let fixture: RoleAwarePhaseAFixture;
let projektledare: TestServerClient;
let seller: TestServerClient;
let montor: TestServerClient;

async function seedInitialSource(label: string): Promise<InitialSource> {
  const tenantId = fixture.base.tenantA.id;
  const customerId = await adminInsertCustomer({ tenant_id: tenantId, customer_type: "company", display_name: `${label}-customer` });
  const calculationId = await adminInsertCalculation({ tenant_id: tenantId, customer_id: customerId, title: `${label}-calculation` });
  const sectionId = await adminInsertSection({ tenant_id: tenantId, calculation_id: calculationId, title: "Arbete" });
  const rowId = await adminInsertRow({
    tenant_id: tenantId, section_id: sectionId, row_type: "labor", label: `${label}-labor`,
    quantity: 1, unit: "h", unit_cost_ore: 2_000, unit_sell_ore: 10_000, vat_rate_bp: 2500,
  });
  return { calculationId, rowId };
}

async function sellerPreview(calculationId: string) {
  const source = await loadQuoteInitialCustomerVisibleSource(seller as never, {
    p_tenant_id: fixture.base.tenantA.id,
    p_calculation_id: calculationId,
    p_requested_attachment_ids: [],
    p_actor_user_id: fixture.users.saljare.id,
  });
  const built = buildFreshQuoteSnapshotFromCustomerVisibleSource(source.source, {
    calculationId, capturedAt: FIXED_ISO,
  });
  return { source, built, proof: {
    reviewed_snapshot_digest: buildQuoteInitialCustomerVisibleReviewDigest(source.source, built),
    reviewed_quote_capture_date: built.quoteCaptureDate,
  } };
}

async function withForcedAuditFailure<T>(correlationId: string, run: () => Promise<T>): Promise<T> {
  await adminExec(`insert into test_support.forced_audit_failures (correlation_id) values ($1::uuid) on conflict (correlation_id) do nothing`, [correlationId]);
  try { return await run(); }
  finally { await adminExec(`delete from test_support.forced_audit_failures where correlation_id=$1::uuid`, [correlationId]); }
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createRoleAwarePhaseAFixture();
  [projektledare, seller, montor] = await Promise.all([
    makeAuthedServerClient(fixture.users.projektledare),
    makeAuthedServerClient(fixture.users.saljare), makeAuthedServerClient(fixture.users.montor),
  ]);
});
afterAll(async () => {
  if (stackUp && fixture) await cleanupRoleAwarePhaseAFixture(fixture);
  if (stackUp) await closeAdminPool();
});

describe("Story 11.2 initial Seller quote review and creation", () => {
  it("[P0] exposes only the checked customer-visible projection and has narrow RPC grants", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const source = await seedInitialSource(`initial-visible-${crypto.randomUUID()}`);
    const projection = await seller.rpc("read_quote_initial_customer_visible_source", {
      p_tenant_id: fixture.base.tenantA.id, p_calculation_id: source.calculationId,
      p_requested_attachment_ids: [], p_actor_user_id: fixture.users.saljare.id,
    });
    expect(projection.error).toBeNull();
    const serialized = JSON.stringify(projection.data);
    for (const field of ["unit_cost_ore", "markup_bp", "internal_note", "source_revision", "cost_hash"]) expect(serialized).not.toContain(field);
    expect(projection.data).toMatchObject({ low_margin_warning: { present: false, threshold_percent: null } });
    const raw = await seller.from("calculation_rows").select("id,unit_cost_ore,markup_bp").eq("id", source.rowId);
    expect(raw.error).toBeNull();
    expect(raw.data).toEqual([]);
    const functions = await adminQuery<{ proname: string; prosecdef: boolean; proconfig: string[] | null; anon_exec: boolean; authenticated_exec: boolean; service_exec: boolean }>(
      `select p.proname,p.prosecdef,p.proconfig,
              has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,
              has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_exec,
              has_function_privilege('service_role',p.oid,'EXECUTE') service_exec
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname in ('read_quote_initial_customer_visible_source','authorize_quote_initial_customer_visible_review','authorize_quote_initial_review')`,
    );
    expect(functions).toHaveLength(3);
    for (const fn of functions) {
      expect(fn.prosecdef).toBe(true); expect(fn.anon_exec).toBe(false); expect(fn.authenticated_exec).toBe(true); expect(fn.service_exec).toBe(false);
      assertSearchPathExactlyEmpty(fn.proname, fn.proconfig ?? []);
    }
  });

  it("[P0] lets Seller recapture a current sales price and writes one fixed audit", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const source = await seedInitialSource(`initial-sales-${crypto.randomUUID()}`);
    await adminExec(`update public.calculation_rows set unit_sell_ore=$1 where id=$2`, [12_345, source.rowId]);
    const preview = await sellerPreview(source.calculationId);
    const correlationId = crypto.randomUUID();
    const result = await runCommand(createQuoteVersionFromCalculation, {
      client: seller as never, input: { calculation_id: source.calculationId, attachment_file_ids: [], ...preview.proof }, clock: fixedClock, correlationId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await adminQuery(`select unit_sell_ore from public.quote_version_lines where quote_version_id=$1`, [result.data.targetId])).toEqual([{ unit_sell_ore: "12345" }]);
    expect(await adminSelectAuditEvents({ correlationId })).toEqual([expect.objectContaining({
      actor_user_id: fixture.users.saljare.id, command: "quote.version.create", event_type: "quote.version.created", target_id: result.data.targetId,
    })]);
  });

  it("[P0] rejects a locked LOW_MARGIN threshold crossing instead of rewriting the preview", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const source = await seedInitialSource(`initial-warning-${crypto.randomUUID()}`);
    const preview = await sellerPreview(source.calculationId);
    expect(preview.built.snapshot.warnings.some((warning) => warning.code === "LOW_MARGIN")).toBe(false);
    await adminExec(`update public.calculation_rows set unit_cost_ore=$1 where id=$2`, [9_500, source.rowId]);
    const stale = await seller.rpc("authorize_quote_initial_customer_visible_review", {
      p_tenant_id: fixture.base.tenantA.id, p_calculation_id: source.calculationId, p_captured_at: FIXED_ISO,
      p_customer_id: preview.built.customerId, p_facility_id: preview.built.facilityId, p_contact_id: preview.built.contactId,
      p_snapshot: snapshotToPayload(preview.built.snapshot), p_lines: linesToPayload(preview.built.snapshot), p_attachments: attachmentsToPayload(preview.built.snapshot),
      p_reviewed_quote_capture_date: preview.built.quoteCaptureDate, p_reviewed_calculation_status: preview.built.reviewedCalculationStatus,
      p_actor_user_id: fixture.users.saljare.id, p_correlation_id: crypto.randomUUID(),
    });
    expect(stale.data).toBeNull();
    expect(stale.error?.code).toBe("23514");
  });

  it("[P0] denies Seller before the legacy cost-bearing initial review parser and denies foreign/Montör callers", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const source = await seedInitialSource(`initial-deny-${crypto.randomUUID()}`);
    const safePreview = await sellerPreview(source.calculationId);
    const nullCorrelation = await seller.rpc("authorize_quote_initial_customer_visible_review", {
      p_tenant_id: fixture.base.tenantA.id, p_calculation_id: source.calculationId, p_captured_at: FIXED_ISO,
      p_customer_id: safePreview.built.customerId, p_facility_id: safePreview.built.facilityId, p_contact_id: safePreview.built.contactId,
      p_snapshot: snapshotToPayload(safePreview.built.snapshot), p_lines: linesToPayload(safePreview.built.snapshot), p_attachments: attachmentsToPayload(safePreview.built.snapshot),
      p_reviewed_quote_capture_date: safePreview.built.quoteCaptureDate, p_reviewed_calculation_status: safePreview.built.reviewedCalculationStatus,
      p_actor_user_id: fixture.users.saljare.id, p_correlation_id: null,
    });
    expect(nullCorrelation.data).toBeNull();
    expect(nullCorrelation.error?.code).toBe("23514");
    expect(JSON.stringify(nullCorrelation.error)).not.toMatch(/unitCostOre|sourceKind|source_revision|reviewed_readiness/i);


    const legacy = await seller.rpc("authorize_quote_initial_review", {
      p_tenant_id: fixture.base.tenantA.id, p_calculation_id: crypto.randomUUID(), p_captured_at: FIXED_ISO,
      p_customer_id: crypto.randomUUID(), p_facility_id: null, p_contact_id: null, p_snapshot: { malformed: true }, p_lines: [], p_attachments: [],
      p_reviewed_quote_capture_date: "1900-01-01", p_reviewed_calculation_status: "guess", p_reviewed_readiness_rows: [{ unitCostOre: 1 }],
      p_actor_user_id: fixture.users.saljare.id, p_correlation_id: crypto.randomUUID(),
    });
    expect(legacy.data).toBeNull(); expect(legacy.error?.code).toBe("42501");
    expect(legacy.error?.message ?? "").not.toMatch(/cost|readiness|unit_cost/i);
    const foreign = await seller.rpc("read_quote_initial_customer_visible_source", {
      p_tenant_id: fixture.base.tenantB.id, p_calculation_id: source.calculationId, p_requested_attachment_ids: [], p_actor_user_id: fixture.users.saljare.id,
    });
    expect(foreign.data).toBeNull(); expect(foreign.error?.code).toBe("42501");
    const denied = await montor.rpc("authorize_quote_initial_customer_visible_review", {
      p_tenant_id: fixture.base.tenantA.id, p_calculation_id: source.calculationId, p_captured_at: FIXED_ISO,
      p_customer_id: crypto.randomUUID(), p_facility_id: null, p_contact_id: null, p_snapshot: {}, p_lines: [], p_attachments: [],
      p_reviewed_quote_capture_date: "1900-01-01", p_reviewed_calculation_status: "guess", p_actor_user_id: fixture.users.montor.id, p_correlation_id: crypto.randomUUID(),
    });
    expect(denied.data).toBeNull(); expect(denied.error?.code).toBe("42501");
  });

  it("[P0] preserves the Admin/PM legacy path and rolls Seller creation back when audit fails", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const pmSource = await seedInitialSource(`initial-pm-${crypto.randomUUID()}`);
    const pmProof = await buildQuoteReviewProof(projektledare, { calculationId: pmSource.calculationId, capturedAt: FIXED_ISO });
    const pm = await runCommand(createQuoteVersionFromCalculation, {
      client: projektledare as never, input: { calculation_id: pmSource.calculationId, attachment_file_ids: [], ...pmProof }, clock: fixedClock, correlationId: crypto.randomUUID(),
    });
    expect(pm.ok).toBe(true);

    const sellerSource = await seedInitialSource(`initial-rollback-${crypto.randomUUID()}`);
    const preview = await sellerPreview(sellerSource.calculationId);
    const correlationId = crypto.randomUUID();
    const failed = await withForcedAuditFailure(correlationId, () => runCommand(createQuoteVersionFromCalculation, {
      client: seller as never, input: { calculation_id: sellerSource.calculationId, attachment_file_ids: [], ...preview.proof }, clock: fixedClock, correlationId,
    }));
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.code).toBe("SERVER_ERROR");
    expect(await adminQuery(`select id from public.quote_versions where calculation_id=$1`, [sellerSource.calculationId])).toEqual([]);
    expect(await adminQuery(`select consumed_at from public.quote_review_authorizations where correlation_id=$1`, [correlationId])).toEqual([{ consumed_at: null }]);
    expect(await adminSelectAuditEvents({ correlationId })).toEqual([]);
  });
});
