/**
 * Story 5.3 — ATDD RED-PHASE scaffold: pricing-source ROW SNAPSHOTS (AC1-AC4, P0/P1 —
 * 5.3-INT-01/02/03/04; risks R-507 freeze / R-502 both-layers cross-tenant).
 *
 * The HEADLINE behavioural contract of this story: `createRow`/`updateRow`, when given a
 * `{ source_kind, source_id }` pair, RESOLVE the source under the caller's RLS (Story 3.5
 * `resolveSnapshotSource`), BUILD the copy-by-value frozen snapshot (Story 3.5
 * `buildWorkRoleSnapshot`/`buildArticleSnapshot`), and PERSIST the frozen `{source_id,
 * source_name, source_price_ore, source_cost_ore, source_updated_at, source_captured_at,
 * source_sku, source_unit}` columns on the row. Once captured, a LATER mutation/archive of
 * the underlying `work_role`/`article` MUST NOT change the prior row's stored snapshot
 * (R-008 copy-by-value + freeze — proven behaviourally, not by field-presence alone).
 *
 * COVERAGE (test-design-epic-5.md 5.3-INT-01/02/03/04; story AC1-AC4 / Task 2 / Task 4.1):
 *   - 5.3-INT-01 (AC1/AC2, P0): a labor row with a `work_role` source stores the frozen
 *     sell(=source_price_ore)/cost(=source_cost_ore)/name/updated_at/captured_at byte/öre-
 *     equal to the source; a material row with an `article` source stores
 *     name/unit_price(=source_price_ore)/sku/unit/updated_at — and NO supplier/import field.
 *   - 5.3-INT-02 (AC3, P0 — the freeze proof): after capture, MUTATE + ARCHIVE the source
 *     (change the rate, flip is_active false); re-read the row → its `source_*` fields are
 *     UNCHANGED (the snapshot never recomputes).
 *   - 5.3-INT-03 (AC4, P0 — both-layers cross-tenant spoof): a Tenant-A create/update
 *     supplying a Tenant-B `source_id` → `TENANT_ACCESS_DENIED` (resolver RLS layer) AND no
 *     row persists a foreign source id (resolved-tenant write layer).
 *   - 5.3-INT-04 (AC3, P1 — archived-source explainability): after the source is archived,
 *     re-reading the row STILL surfaces the captured name/rate (explainable from the row
 *     alone — no live re-read of the now-archived source).
 *
 * ── WHY THIS SUITE IS `describe.skip` (RED PHASE) ────────────────────────────────
 * The Story 5.3 dev work does NOT exist yet: the additive `source_*` columns on
 * `calculation_rows`, and the `createRow`/`updateRow` `resolveSnapshotSource` + `build*`
 * + persist extension (Task 1 + Task 2). Un-skipping this suite before then would fail
 * for the wrong reason (the columns / the write path are absent). The dev phase (green
 * hand-off below) removes the `describe.skip` in the SAME green run — a LINGERING skip on
 * the freeze/spoof suite is a vacuous pass on the exact R-507/R-502 behaviour this story
 * exists to prove (epic-5 retro resumed-run trap).
 *
 * ── GREEN-PHASE HAND-OFF (Story 5.3 dev) ─────────────────────────────────────────
 *   1. Land the additive migration (Task 1): the `source_*` columns on `calculation_rows`
 *      (`source_kind`/`source_id`/`source_name`/`source_price_ore`/`source_cost_ore`/
 *      `source_updated_at`/`source_captured_at`/`source_sku`/`source_unit`), then
 *      `supabase db reset` (+ poll `/auth/v1/health` to 200 — a false-green trap otherwise).
 *   2. Extend `createRow`/`updateRow` to accept `{source_kind, source_id}`, resolve+build+
 *      persist (Task 2); then DELETE the `describe.skip` on this suite and make it GREEN.
 *   3. The `adminQuery` source seed/mutate/readback below is self-contained (BYPASSRLS) so
 *      no factory extension is a prerequisite — but the dev phase MAY hoist these into
 *      `tests/factories/tenants.ts` (`adminInsertWorkRole` returning updated_at, an
 *      `adminUpdateWorkRole`/`adminUpdateArticle` mutate helper, an `adminSelectRowSource`
 *      readback) if a sibling suite reuses them.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable (the
 * `SUPABASE_TEST_REQUIRED=1` CI gate turns a skip into a hard failure).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertCalculation,
  adminInsertSection,
  adminInsertWorkRole,
  adminInsertArticle,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import { createRow, updateRow } from "@/server/commands/calculations";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-03T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

/** The persisted `source_*` snapshot columns this story adds to `calculation_rows`. */
interface RowSourceReadback {
  readonly source_kind: string | null;
  readonly source_id: string | null;
  readonly source_name: string | null;
  readonly source_price_ore: number | null;
  readonly source_cost_ore: number | null;
  readonly source_updated_at: string | null;
  readonly source_captured_at: string | null;
  readonly source_sku: string | null;
  readonly source_unit: string | null;
}

/** BYPASSRLS read of the frozen source columns off a row — the explainability surface. */
async function selectRowSource(rowId: string): Promise<RowSourceReadback | null> {
  const rows = await adminQuery<RowSourceReadback>(
    `select source_kind, source_id, source_name, source_price_ore, source_cost_ore,
            source_updated_at, source_captured_at, source_sku, source_unit
       from public.calculation_rows where id = $1`,
    [rowId],
  );
  return rows[0] ?? null;
}

/** BYPASSRLS read of a work_role's live rate + version (to prove capture equals source). */
async function selectWorkRole(id: string): Promise<{
  display_name: string;
  cost_rate_ore: number;
  sell_rate_ore: number;
  is_active: boolean;
  updated_at: string;
} | null> {
  const rows = await adminQuery<{
    display_name: string;
    cost_rate_ore: number;
    sell_rate_ore: number;
    is_active: boolean;
    updated_at: string;
  }>(
    `select display_name, cost_rate_ore, sell_rate_ore, is_active, updated_at
       from public.work_roles where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Seed an own-tenant customer → calc → section so a row has a concrete parent. */
async function seedSection(tenantId: string): Promise<string> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: "src-snapshot-owner",
    org_nr: "556000-7777",
  });
  const calcId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: "src-snapshot-calc",
  });
  return adminInsertSection({
    tenant_id: tenantId,
    calculation_id: calcId,
    title: "src-snapshot-section",
  });
}

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key (RLS) client

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe.skip("Pricing-source row snapshots (AC1-AC4 / 5.3-INT-01/02/03/04)", () => {
  it("[P0/5.3-INT-01/AC1] a work_role source stores the frozen sell/cost/name/version by value", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const sectionId = await seedSection(fixture.tenantA.id);
    const roleId = await adminInsertWorkRole({
      tenant_id: fixture.tenantA.id,
      display_name: "Elektriker",
      cost_rate_ore: 45000,
      sell_rate_ore: 85000,
    });
    const role = await selectWorkRole(roleId);
    expect(role).not.toBeNull();

    const result = await runCommand(createRow, {
      client: a as never,
      input: {
        section_id: sectionId,
        row_type: "labor",
        quantity: 1,
        unit: "h",
        unit_sell_ore: 85000,
        vat_rate_bp: 2500,
        source_kind: "work_role",
        source_id: roleId,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rowId = (result.data as { targetId: string }).targetId;

    // The persisted snapshot is BYTE/ÖRE-equal to the source row, captured by value.
    const snap = await selectRowSource(rowId);
    expect(snap).not.toBeNull();
    expect(snap?.source_kind).toBe("work_role");
    expect(snap?.source_id).toBe(roleId);
    expect(snap?.source_name).toBe(role?.display_name); // "Elektriker"
    expect(snap?.source_price_ore).toBe(role?.sell_rate_ore); // sell → price
    expect(snap?.source_cost_ore).toBe(role?.cost_rate_ore); // cost → cost
    expect(snap?.source_updated_at).not.toBeNull(); // the source "version"
    // captured_at is the INJECTED clock instant, never Date.now().
    expect(new Date(snap?.source_captured_at as string).toISOString()).toBe(FIXED_ISO);
    // An article-only column stays null on a work-role row.
    expect(snap?.source_sku).toBeNull();
    expect(snap?.source_unit).toBeNull();
  });

  it("[P0/5.3-INT-01/AC2] an article source stores name/unit_price/sku/unit — NO supplier field", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const sectionId = await seedSection(fixture.tenantA.id);
    const articleId = await adminInsertArticle({
      tenant_id: fixture.tenantA.id,
      name: "Kabel 3G1.5",
      unit_price_ore: 1250,
    });
    // The article seed writes only name + unit_price_ore; sku/unit stay null at source, so
    // the captured sku/unit are null too (copied by value — null stays null).
    const src = await adminQuery<{
      name: string;
      sku: string | null;
      unit: string | null;
      unit_price_ore: number;
    }>(
      `select name, sku, unit, unit_price_ore from public.articles where id = $1`,
      [articleId],
    );
    expect(src.length).toBe(1);

    const result = await runCommand(createRow, {
      client: a as never,
      input: {
        section_id: sectionId,
        row_type: "material",
        quantity: 10,
        unit: "m",
        unit_sell_ore: 1250,
        vat_rate_bp: 2500,
        source_kind: "article",
        source_id: articleId,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rowId = (result.data as { targetId: string }).targetId;

    const snap = await selectRowSource(rowId);
    expect(snap?.source_kind).toBe("article");
    expect(snap?.source_id).toBe(articleId);
    expect(snap?.source_name).toBe(src[0].name); // "Kabel 3G1.5"
    expect(snap?.source_price_ore).toBe(src[0].unit_price_ore); // unit_price → price
    expect(snap?.source_cost_ore).toBeNull(); // an article has no cost rate
    expect(snap?.source_sku).toBe(src[0].sku);
    expect(snap?.source_unit).toBe(src[0].unit);
    // HARD no-supplier-scope: the captured snapshot carries NO supplier/import signal (the
    // frozen migration-reset guard asserts the COLUMN NAMES; this asserts the VALUES too).
    expect(JSON.stringify(snap)).not.toMatch(
      /supplier|credential|api_key|apikey|sync|import|external|fortnox|mapping/i,
    );
  });

  it("[P0/5.3-INT-02/AC3] FREEZE PROOF: mutating + archiving the source after capture leaves the row snapshot UNCHANGED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const sectionId = await seedSection(fixture.tenantA.id);
    const roleId = await adminInsertWorkRole({
      tenant_id: fixture.tenantA.id,
      display_name: "Montör",
      cost_rate_ore: 40000,
      sell_rate_ore: 70000,
    });

    const created = await runCommand(createRow, {
      client: a as never,
      input: {
        section_id: sectionId,
        row_type: "labor",
        quantity: 1,
        unit: "h",
        unit_sell_ore: 70000,
        vat_rate_bp: 2500,
        source_kind: "work_role",
        source_id: roleId,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rowId = (created.data as { targetId: string }).targetId;

    const before = await selectRowSource(rowId);
    expect(before?.source_name).toBe("Montör");
    expect(before?.source_price_ore).toBe(70000);

    // Now MUTATE the underlying work_role (change name + rate) AND ARCHIVE it (is_active
    // false) via the BYPASSRLS admin path — simulating a later edit/archive of the source.
    await adminQuery(
      `update public.work_roles
          set display_name = 'Montör (uppdaterad)',
              cost_rate_ore = 99999,
              sell_rate_ore = 99999,
              is_active = false
        where id = $1`,
      [roleId],
    );

    // Re-read the ROW: its frozen source snapshot did NOT recompute — the copy-by-value
    // freeze (R-008) means the prior capture is immune to the later source mutation.
    const after = await selectRowSource(rowId);
    expect(after?.source_id).toBe(roleId);
    expect(after?.source_name).toBe("Montör"); // NOT "Montör (uppdaterad)"
    expect(after?.source_price_ore).toBe(70000); // NOT 99999
    expect(after?.source_cost_ore).toBe(before?.source_cost_ore);
    expect(after?.source_updated_at).toBe(before?.source_updated_at);
    expect(after?.source_captured_at).toBe(before?.source_captured_at);
  });

  it("[P0/5.3-INT-03/AC4] cross-tenant source spoof → TENANT_ACCESS_DENIED and no foreign source persisted (create)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const sectionId = await seedSection(fixture.tenantA.id);
    // A REAL Tenant-B work role — invisible to Tenant A under RLS.
    const foreignRoleId = await adminInsertWorkRole({
      tenant_id: fixture.tenantB.id,
      display_name: "tenant-b-role",
      cost_rate_ore: 30000,
      sell_rate_ore: 60000,
    });

    const result = await runCommand(createRow, {
      client: a as never, // Tenant A's RLS client
      input: {
        section_id: sectionId,
        row_type: "labor",
        quantity: 1,
        unit: "h",
        unit_sell_ore: 60000,
        vat_rate_bp: 2500,
        source_kind: "work_role",
        source_id: foreignRoleId, // Tenant B's id — layer-1 resolver RLS makes it invisible
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });

    // Layer 1: the resolver's own-tenant RLS SELECT returns zero rows → typed denial.
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");

    // Layer 2: NO row was persisted carrying the foreign source id — there is no path to
    // write a cross-tenant source (the snapshot is copy-by-value of the RESOLVED, always
    // own-tenant, row; the resolver never returned one).
    const leaked = await adminQuery<{ id: string }>(
      `select id from public.calculation_rows where source_id = $1`,
      [foreignRoleId],
    );
    expect(leaked.length).toBe(0);
  });

  it("[P0/5.3-INT-03/AC4] cross-tenant source spoof on updateRow → TENANT_ACCESS_DENIED, row's source unchanged", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const sectionId = await seedSection(fixture.tenantA.id);
    // An own-tenant row with NO source yet (manual).
    const created = await runCommand(createRow, {
      client: a as never,
      input: {
        section_id: sectionId,
        row_type: "labor",
        quantity: 1,
        unit: "h",
        unit_sell_ore: 50000,
        vat_rate_bp: 2500,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rowId = (created.data as { targetId: string }).targetId;

    const foreignRoleId = await adminInsertWorkRole({
      tenant_id: fixture.tenantB.id,
      display_name: "tenant-b-role-2",
    });

    const result = await runCommand(updateRow, {
      client: a as never,
      input: { id: rowId, source_kind: "work_role", source_id: foreignRoleId },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");

    // The row stays manual — no foreign source was written under a denied update.
    const snap = await selectRowSource(rowId);
    expect(snap?.source_kind).toBeNull();
    expect(snap?.source_id).toBeNull();
  });

  it("[P1/5.3-INT-04/AC3] after the source is ARCHIVED, the row is still explainable from its own captured fields", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const sectionId = await seedSection(fixture.tenantA.id);
    const articleId = await adminInsertArticle({
      tenant_id: fixture.tenantA.id,
      name: "Dosa infälld",
      unit_price_ore: 3900,
    });

    const created = await runCommand(createRow, {
      client: a as never,
      input: {
        section_id: sectionId,
        row_type: "material",
        quantity: 4,
        unit: "st",
        unit_sell_ore: 3900,
        vat_rate_bp: 2500,
        source_kind: "article",
        source_id: articleId,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const rowId = (created.data as { targetId: string }).targetId;

    // Archive the article (is_active false) — it would no longer be OFFERED for a NEW
    // selection, but the prior row must remain fully explainable from its OWN fields.
    await adminQuery(
      `update public.articles set is_active = false where id = $1`,
      [articleId],
    );

    const snap = await selectRowSource(rowId);
    expect(snap?.source_kind).toBe("article");
    expect(snap?.source_name).toBe("Dosa infälld"); // captured name survives the archive
    expect(snap?.source_price_ore).toBe(3900); // captured rate survives the archive
  });
});
