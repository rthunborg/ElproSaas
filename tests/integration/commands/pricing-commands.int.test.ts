/**
 * Story 3.4 — ATDD RED-PHASE scaffold: pricing command-envelope acceptance (AC2/AC3,
 * P0/P1). The work-role + article create/update/archive command families exercised
 * through the EXISTING `defineCommand`/`runCommand` envelope (architecture §5 steps
 * 1-9), reusing the EXISTING two-tenant factories + the `audit_events` BYPASSRLS read
 * helper — NO new auth/error/audit mechanism.
 *
 * ── WHY `describe.skip` (RED PHASE) ──────────────────────────────────────────────
 * The four commands (`upsertWorkRole`/`archiveWorkRole` + `upsertArticle`/
 * `archiveArticle`) and the `work_roles_and_articles` migration do NOT exist yet —
 * Task 1 (migration) + Task 2 (commands) are the Story 3.4 DEV phase. Until they land,
 * importing `@/server/commands/pricing/*` would not resolve, so this scaffold:
 *   - keeps the suite `describe.skip` so it cannot fail CI before the feature exists
 *     (the project's red-phase idiom — Story 3.1/3.3 used the same), and
 *   - declares the command surface via a LOCAL `notYetImplemented()` placeholder + a
 *     local `adminSelectPricingRow` readback so the file TYPE-CHECKS today WITHOUT
 *     importing a non-existent module.
 *
 * ── GREEN-PHASE HAND-OFF (Story 3.4 dev) ────────────────────────────────────────
 * After Task 1+2+3.3 land:
 *   1. Replace the `notYetImplemented()` stubs with real imports:
 *        import { upsertWorkRole, archiveWorkRole } from "@/server/commands/pricing/work-roles";
 *        import { upsertArticle, archiveArticle } from "@/server/commands/pricing/articles";
 *   2. Replace the LOCAL `adminSelectPricingRow` with the real `tests/factories/tenants.ts`
 *      BYPASSRLS read helper added in Task 3.3 (alongside adminInsertWorkRole/adminInsertArticle).
 *   3. Seed Tenant B work_role/article ids for the cross-tenant UPDATE negative.
 *   4. Remove `.skip`. The assertions are the CONTRACT — do not weaken them.
 *
 * Every assertion encodes EXPECTED behavior (no `expect(true).toBe(true)`); the suite
 * is designed to FAIL until the commands + migration exist. Runs against the LOCAL
 * Supabase stack only; skips visibly when unreachable.
 *
 * The LOAD-BEARING contracts these tests pin (the story encodes them):
 *   - Collection (NOT singleton, P0, AC2): work_roles/articles are MANY-per-tenant —
 *     a CREATE (no id) INSERTs a NEW row; a second create is a SECOND row (no
 *     unique(tenant_id), unlike Story 3.3 settings). UPDATE (id present) edits by id.
 *   - INTEGER-öre money never persists a bad shape (P0, AC2): a FLOAT/NEGATIVE/
 *     locale-comma rate or unit price → VALIDATION_FAILED, no row written.
 *   - Audit (P0, AC2): EXACTLY ONE append-only audit row per critical change, metadata
 *     allow-listed `{ targetId }` — NO rate value / name / PII in metadata.
 *   - Archive is SOFT (P0, AC2): archive flips is_active=false (the row STILL EXISTS),
 *     never a hard DELETE.
 *   - Cross-tenant ownership (P0, AC4): an upsert UPDATE supplying a Tenant-B id →
 *     TENANT_ACCESS_DENIED (the envelope ownership pre-check).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertWorkRole,
  adminInsertArticle,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import {
  upsertWorkRole,
  archiveWorkRole,
} from "@/server/commands/pricing/work-roles";
import {
  upsertArticle,
  archiveArticle,
} from "@/server/commands/pricing/articles";
import type { CommandClock } from "@/server/commands/clock";

// ── GREEN PHASE (Story 3.4 dev): the commands + migration have landed (Tasks 1-2). ──

const FIXED_ISO = "2026-06-30T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key (RLS) client
let tenantBWorkRoleId: string; // a seeded Tenant B work_role (cross-tenant target)
let tenantBArticleId: string; // a seeded Tenant B article (cross-tenant target)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  // Seed REAL Tenant B pricing rows so the cross-tenant UPDATE negatives target a
  // CONCRETE foreign row (never a non-existent id that would deny vacuously). The
  // cleanupFixture tenant-delete cascades them (on delete cascade).
  tenantBWorkRoleId = await adminInsertWorkRole({ tenant_id: fixture.tenantB.id });
  tenantBArticleId = await adminInsertArticle({ tenant_id: fixture.tenantB.id });
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

/**
 * Local readback (BYPASSRLS) — reads a pricing row's lifecycle/tenant independent of the
 * app/RLS path so a "soft-delete, not hard-delete" negative can prove the row EXISTS.
 */
async function adminSelectPricingRow(
  table: "work_roles" | "articles",
  id: string,
): Promise<{ id: string; tenant_id: string; is_active: boolean } | null> {
  // `table` is a closed union (never client input).
  const rows = await adminQuery<{ id: string; tenant_id: string; is_active: boolean }>(
    `select id, tenant_id, is_active from public.${table} where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

async function countPricingRows(table: "work_roles" | "articles", tenantId: string): Promise<number> {
  const rows = await adminQuery<{ n: string }>(
    `select count(*)::text as n from public.${table} where tenant_id = $1`,
    [tenantId],
  );
  return Number(rows[0]?.n ?? "0");
}

// ─────────────────────────────────────────────────────────────────────────────
// work_roles — collection create/update/archive + öre money + audit.
// ─────────────────────────────────────────────────────────────────────────────

describe("upsertWorkRole — create/update/archive collection + öre rates + audit (Story 3.4 AC2)", () => {
  it("[P0] CREATE (no id) INSERTs a new role with integer-öre rates + writes ONE audit row with NO rate/name in metadata", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const correlationId = crypto.randomUUID();
    const displayName = `Montör ${crypto.randomUUID()}`;
    const result = await runCommand(upsertWorkRole as never, {
      client: a as never,
      input: { display_name: displayName, cost_rate_ore: 45000, sell_rate_ore: 85000 },
      clock: fixedClock,
      correlationId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The persisted row carries the tenant + integer-öre rates (asserted via BYPASSRLS).
    const created = result as { ok: true; data: { targetId: string } };
    const row = await adminQuery<{
      id: string;
      tenant_id: string;
      // bigint (int8) is returned by the `pg` driver as a STRING (precision-safe); the
      // assertions coerce + compare the integer öre value (never a float).
      cost_rate_ore: string;
      sell_rate_ore: string;
      is_active: boolean;
    }>(
      `select id, tenant_id, cost_rate_ore, sell_rate_ore, is_active
         from public.work_roles where id = $1`,
      [created.data.targetId],
    );
    expect(row).toHaveLength(1);
    expect(row[0].tenant_id).toBe(fixture.tenantA.id);
    expect(Number(row[0].cost_rate_ore)).toBe(45000);
    expect(Number(row[0].sell_rate_ore)).toBe(85000);
    // INTEGER öre, never a float — the stored bigint string parses to a whole integer.
    expect(Number.isInteger(Number(row[0].cost_rate_ore))).toBe(true);
    expect(/^\d+$/.test(row[0].cost_rate_ore)).toBe(true); // a whole-integer öre string, no decimal point
    expect(row[0].is_active).toBe(true);

    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits).toHaveLength(1);
    expect(audits[0].target_type).toBe("work_role");
    expect(audits[0].tenant_id).toBe(fixture.tenantA.id);
    // Allow-listed metadata: NO rate value and NO display name leak.
    const serialized = JSON.stringify(audits[0].metadata ?? {});
    expect(serialized.includes("45000")).toBe(false);
    expect(serialized.includes("85000")).toBe(false);
    expect(serialized.includes(displayName)).toBe(false);
  });

  it("[P0] a SECOND create INSERTs a SECOND row — work_roles are MANY-per-tenant (NO unique(tenant_id))", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const before = await countPricingRows("work_roles", fixture.tenantA.id);
    for (const name of [`Elektriker ${crypto.randomUUID()}`, `Lärling ${crypto.randomUUID()}`]) {
      const r = await runCommand(upsertWorkRole as never, {
        client: a as never,
        input: { display_name: name, cost_rate_ore: 30000, sell_rate_ore: 60000 },
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      });
      expect(r.ok).toBe(true);
    }
    const after = await countPricingRows("work_roles", fixture.tenantA.id);
    expect(after).toBe(before + 2); // two distinct rows, NOT an upsert onto one
  });

  it("[P0] UPDATE (id present) edits the role by id without creating a new row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const created = await runCommand(upsertWorkRole as never, {
      client: a as never,
      input: { display_name: `Original ${crypto.randomUUID()}`, cost_rate_ore: 40000, sell_rate_ore: 80000 },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = (created as { ok: true; data: { targetId: string } }).data.targetId;

    const updated = await runCommand(upsertWorkRole as never, {
      client: a as never,
      input: { id, display_name: "Uppdaterad", cost_rate_ore: 42000, sell_rate_ore: 82000 },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(updated.ok).toBe(true);

    const row = await adminQuery<{ id: string; sell_rate_ore: string }>(
      `select id, sell_rate_ore from public.work_roles where id = $1`,
      [id],
    );
    expect(row).toHaveLength(1);
    expect(Number(row[0].sell_rate_ore)).toBe(82000); // bigint returns as a string
  });

  it("[P0] archiveWorkRole flips is_active=false — the row STILL EXISTS (soft, never a hard DELETE)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const created = await runCommand(upsertWorkRole as never, {
      client: a as never,
      input: { display_name: `ToArchive ${crypto.randomUUID()}`, cost_rate_ore: 40000, sell_rate_ore: 80000 },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = (created as { ok: true; data: { targetId: string } }).data.targetId;

    const archived = await runCommand(archiveWorkRole as never, {
      client: a as never,
      input: { id },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(archived.ok).toBe(true);

    const row = await adminSelectPricingRow("work_roles", id);
    expect(row).not.toBeNull(); // NOT hard-deleted
    expect(row?.is_active).toBe(false);
  });

  it("[P0] a FLOAT cost_rate_ore is rejected at the command layer → VALIDATION_FAILED, NO row persisted (AC2)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const before = await countPricingRows("work_roles", fixture.tenantA.id);
    const result = await runCommand(upsertWorkRole as never, {
      client: a as never,
      input: { display_name: "Bad Rate", cost_rate_ore: 450.5 as never, sell_rate_ore: 85000 },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
    expect(await countPricingRows("work_roles", fixture.tenantA.id)).toBe(before); // nothing persisted
  });

  it("[P0] a NEGATIVE / locale-comma sell_rate_ore is rejected → VALIDATION_FAILED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const bad of [-1, "850,00"]) {
      const result = await runCommand(upsertWorkRole as never, {
        client: a as never,
        input: { display_name: "Bad", cost_rate_ore: 45000, sell_rate_ore: bad as never },
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
    }
  });

  it("[P0/AC4] an upsert UPDATE supplying a TENANT-B work_role id → TENANT_ACCESS_DENIED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Target the REAL seeded Tenant B work_role (beforeAll). The envelope `ownership`
    // pre-check resolves the row's tenant via Tenant A's RLS — a foreign-tenant id is
    // invisible (zero rows) and rejected with TENANT_ACCESS_DENIED before any write.
    const result = await runCommand(upsertWorkRole as never, {
      client: a as never,
      input: { id: tenantBWorkRoleId, display_name: "hijack", cost_rate_ore: 1, sell_rate_ore: 1 },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// articles — same collection create/update/archive shape + öre + audit + NO supplier.
// ─────────────────────────────────────────────────────────────────────────────

describe("upsertArticle — create/update/archive collection + öre unit price + audit (Story 3.4 AC3)", () => {
  it("[P0] CREATE (no id) INSERTs a minimal manual article with an integer-öre unit price + ONE audit row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const correlationId = crypto.randomUUID();
    const name = `Kabel 3G1.5 ${crypto.randomUUID()}`;
    const result = await runCommand(upsertArticle as never, {
      client: a as never,
      input: { name, sku: "K-3G15", unit: "m", unit_price_ore: 1250 },
      clock: fixedClock,
      correlationId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const id = (result as { ok: true; data: { targetId: string } }).data.targetId;

    const row = await adminQuery<{ tenant_id: string; unit_price_ore: string; is_active: boolean }>(
      `select tenant_id, unit_price_ore, is_active from public.articles where id = $1`,
      [id],
    );
    expect(row).toHaveLength(1);
    expect(row[0].tenant_id).toBe(fixture.tenantA.id);
    // bigint (int8) returns as a STRING; coerce + assert the integer öre value (no float).
    expect(Number(row[0].unit_price_ore)).toBe(1250);
    expect(/^\d+$/.test(row[0].unit_price_ore)).toBe(true);

    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits).toHaveLength(1);
    expect(audits[0].target_type).toBe("article");
    const serialized = JSON.stringify(audits[0].metadata ?? {});
    expect(serialized.includes("1250")).toBe(false); // no price in metadata
    expect(serialized.includes(name)).toBe(false); // no name in metadata
  });

  it("[P0] a second create INSERTs a SECOND article — articles are MANY-per-tenant (NO unique(tenant_id))", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const before = await countPricingRows("articles", fixture.tenantA.id);
    for (const name of [`Dosa ${crypto.randomUUID()}`, `Rör ${crypto.randomUUID()}`]) {
      const r = await runCommand(upsertArticle as never, {
        client: a as never,
        input: { name, unit_price_ore: 500 },
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      });
      expect(r.ok).toBe(true);
    }
    expect(await countPricingRows("articles", fixture.tenantA.id)).toBe(before + 2);
  });

  it("[P0] archiveArticle flips is_active=false — the row STILL EXISTS (soft, never a hard DELETE)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const created = await runCommand(upsertArticle as never, {
      client: a as never,
      input: { name: `ToArchive ${crypto.randomUUID()}`, unit_price_ore: 500 },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = (created as { ok: true; data: { targetId: string } }).data.targetId;

    const archived = await runCommand(archiveArticle as never, {
      client: a as never,
      input: { id },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(archived.ok).toBe(true);
    const row = await adminSelectPricingRow("articles", id);
    expect(row).not.toBeNull();
    expect(row?.is_active).toBe(false);
  });

  it("[P0] a FLOAT / NEGATIVE / locale-comma unit_price_ore is rejected → VALIDATION_FAILED, no row persisted", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const before = await countPricingRows("articles", fixture.tenantA.id);
    for (const bad of [12.5, -1, "12,50"]) {
      const result = await runCommand(upsertArticle as never, {
        client: a as never,
        input: { name: "Bad Price", unit_price_ore: bad as never },
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
    }
    expect(await countPricingRows("articles", fixture.tenantA.id)).toBe(before);
  });

  it("[P0/AC3] a client-supplied supplier-ish field is silently DROPPED — never written (no-supplier-scope at the command)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(upsertArticle as never, {
      client: a as never,
      input: {
        name: `NoSupplier ${crypto.randomUUID()}`,
        unit_price_ore: 999,
        // These are NOT in the validated shape — the command must never persist them.
        supplier_id: "SUP-1",
        fortnox_article_id: "F-1",
        sync_token: "abc",
      } as never,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    // The valid minimal portion still saves (the supplier keys are simply stripped, not
    // a validation error) — and the persisted row has no supplier column to hold them
    // (the schema guard test proves the column does not exist).
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const id = (result as { ok: true; data: { targetId: string } }).data.targetId;
    const row = await adminSelectPricingRow("articles", id);
    expect(row).not.toBeNull();
  });

  it("[P0/AC4] an upsert UPDATE supplying a TENANT-B article id → TENANT_ACCESS_DENIED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Target the REAL seeded Tenant B article (beforeAll) — invisible under Tenant A's
    // RLS, so the envelope ownership pre-check rejects it with TENANT_ACCESS_DENIED.
    const result = await runCommand(upsertArticle as never, {
      client: a as never,
      input: { id: tenantBArticleId, name: "hijack", unit_price_ore: 1 },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
  });
});
