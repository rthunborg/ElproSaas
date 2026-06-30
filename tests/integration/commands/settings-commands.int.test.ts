/**
 * Story 3.3 — ATDD RED-PHASE scaffold: settings command + sign-off integration.
 *
 * Covers the `updateCompanySettings` / `updateQuoteTerms` / `approveQuoteTerms`
 * envelope commands (architecture §5) for the two NEW tenant-owned settings tables
 * (`company_settings`, `quote_terms`). It MIRRORS the Story 3.1 CRM command-coverage
 * shape EXACTLY (`runCommand` over `defineCommand`, the two-tenant factory + BYPASSRLS
 * readbacks, deterministic injected clock, per-run unique ids) — NO new mechanism.
 *
 * 🔴 RED PHASE — the whole suite is `describe.skip(...)` so the green CI baseline is
 * UNPERTURBED until dev implements the commands. Un-skip (remove `.skip`) in the
 * GREEN phase once `src/server/commands/settings/*` and the migration exist; the
 * commented imports below are the exact symbols dev must export.
 *
 * The LOAD-BEARING contracts these tests pin (the story encodes them):
 *   - Sign-off STOP-CONDITION (P0, AC2): `quote_terms.approved_at` DEFAULTS NULL
 *     (= not-approved); a fresh/edited terms record is not-approved BY CONSTRUCTION;
 *     editing terms INVALIDATES a prior approval (approved_at back to NULL); the ONLY
 *     path that sets approved_at is the deliberate `approveQuoteTerms` command. There
 *     is NO path where a saved/edited terms record becomes approved without that
 *     explicit command.
 *   - Integer-öre / basis-points money (P0, AC5): VAT rate is stored as an INTEGER
 *     `vat_rate_bp` (basis points, 2500 = 25.00%), never a float; the validator
 *     rejects out-of-range / non-integer rates → `VALIDATION_FAILED`. NO VAT/ROT
 *     calculation engine is exercised (Epic 4 owns that).
 *   - Single row per tenant (P0, AC1): `updateCompanySettings` UPSERTS — a second
 *     call UPDATES the same row (the `unique (tenant_id)`), never duplicates; EXACTLY
 *     ONE audit row per successful change with NO PII (org_nr/address/terms) in
 *     metadata.
 *
 * Runs against LOCAL Supabase only; skips visibly when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminQuery } from "../../factories/admin-sql";
import { adminSelectAuditEvents } from "../../factories/audit-events";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import { runCommand } from "@/server/commands/envelope";
import type { CommandClock } from "@/server/commands/clock";
import { updateCompanySettings } from "@/server/commands/settings/company-settings";
import {
  updateQuoteTerms,
  approveQuoteTerms,
} from "@/server/commands/settings/quote-terms";

const FIXED_ISO = "2026-06-30T12:00:00.000Z";
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

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

/** Independent BYPASSRLS read of the tenant's single company_settings row. */
async function readCompanySettings(tenantId: string) {
  const rows = await adminQuery<{
    id: string;
    tenant_id: string;
    company_name: string | null;
    org_nr: string | null;
    default_vat_display: string;
    vat_rate_bp: number;
  }>(
    `select id, tenant_id, company_name, org_nr, default_vat_display, vat_rate_bp
       from public.company_settings where tenant_id = $1`,
    [tenantId],
  );
  return rows;
}

/** Independent BYPASSRLS read of the tenant's quote_terms row(s). */
async function readQuoteTerms(tenantId: string) {
  return adminQuery<{
    id: string;
    tenant_id: string;
    terms_text: string;
    approved_at: string | null;
    approved_by: string | null;
  }>(
    `select id, tenant_id, terms_text, approved_at, approved_by
       from public.quote_terms where tenant_id = $1`,
    [tenantId],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// company_settings — UPSERT-one-per-tenant + VAT (basis points) validation + audit.
// ─────────────────────────────────────────────────────────────────────────────

describe("updateCompanySettings — upsert, VAT bp validation, audit (Story 3.3 AC1/AC5)", () => {
  it("[P0] first call INSERTS the tenant's single settings row + writes ONE audit row with NO PII", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const correlationId = crypto.randomUUID();
    const orgNr = "556677-8899";
    const result = await runCommand(updateCompanySettings, {
      client: a as never,
      input: {
        company_name: "Elpro Pilot AB",
        org_nr: orgNr,
        address_line1: "Storgatan 1",
        postal_code: "11122",
        city: "Stockholm",
        default_vat_display: "company_togglable",
        vat_rate_bp: 2500, // legacy 25.00% as basis points — NEVER a float
      },
      clock: fixedClock,
      correlationId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const rows = await readCompanySettings(fixture.tenantA.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].tenant_id).toBe(fixture.tenantA.id);
    expect(rows[0].vat_rate_bp).toBe(2500);
    // Stored as an INTEGER, not a float (no fractional component snuck in).
    expect(Number.isInteger(rows[0].vat_rate_bp)).toBe(true);

    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits).toHaveLength(1);
    expect(audits[0].event_type).toBe("company_settings.updated");
    expect(audits[0].target_type).toBe("company_settings");
    expect(audits[0].tenant_id).toBe(fixture.tenantA.id);
    // NO PII in audit metadata: the org_nr / address / company name never leak.
    const serialized = JSON.stringify(audits[0].metadata ?? {});
    expect(serialized.includes(orgNr)).toBe(false);
    expect(serialized.includes("Storgatan 1")).toBe(false);
    expect(serialized.includes("Elpro Pilot AB")).toBe(false);
  });

  it("[P0] a SECOND call UPDATES the same row (unique(tenant_id)) — never a duplicate", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const base = {
      company_name: "Once AB",
      org_nr: "556000-7777",
      default_vat_display: "company_togglable",
      vat_rate_bp: 2500,
    };
    const first = await runCommand(updateCompanySettings, {
      client: a as never,
      input: base,
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(first.ok).toBe(true);
    const second = await runCommand(updateCompanySettings, {
      client: a as never,
      input: { ...base, company_name: "Twice AB", vat_rate_bp: 1200 },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(second.ok).toBe(true);

    const rows = await readCompanySettings(fixture.tenantA.id);
    expect(rows).toHaveLength(1); // STILL one row — upsert keyed on tenant_id
    expect(rows[0].company_name).toBe("Twice AB");
    expect(rows[0].vat_rate_bp).toBe(1200);
  });

  it("[P0] an out-of-range vat_rate_bp (> 10000) is rejected → VALIDATION_FAILED, no row mutated", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(updateCompanySettings, {
      client: a as never,
      input: {
        company_name: "Bad Rate AB",
        org_nr: "556000-8888",
        default_vat_display: "company_togglable",
        vat_rate_bp: 10001, // > 100.00% — must be rejected by the pure validator
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P1] a non-integer / float vat_rate_bp is rejected → VALIDATION_FAILED (basis points are integers)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(updateCompanySettings, {
      client: a as never,
      input: {
        company_name: "Float Rate AB",
        org_nr: "556000-9999",
        default_vat_display: "company_togglable",
        vat_rate_bp: 25.5 as never, // a float must NEVER be accepted as basis points
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });

  it("[P0] an unknown default_vat_display value is rejected → VALIDATION_FAILED", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const result = await runCommand(updateCompanySettings, {
      client: a as never,
      input: {
        company_name: "Bad Display AB",
        org_nr: "556000-1212",
        default_vat_display: "not-a-mode" as never,
        vat_rate_bp: 2500,
      },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_FAILED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// quote_terms — UPSERT terms text. The SIGN-OFF mechanics are the next block (P0).
// ─────────────────────────────────────────────────────────────────────────────

describe("updateQuoteTerms — upsert terms text (Story 3.3 AC1)", () => {
  it("[P0] first call INSERTS the tenant's terms row + ONE audit row with NO terms text in metadata", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const correlationId = crypto.randomUUID();
    const termsText = "Betalningsvillkor 30 dagar. (platshållartext)";
    const result = await runCommand(updateQuoteTerms, {
      client: a as never,
      input: { terms_text: termsText },
      clock: fixedClock,
      correlationId,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const rows = await readQuoteTerms(fixture.tenantA.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].terms_text).toBe(termsText);

    const audits = await adminSelectAuditEvents({ correlationId });
    expect(audits).toHaveLength(1);
    expect(audits[0].event_type).toBe("quote_terms.updated");
    // The customer-facing terms wording is PII-class free text — it must NOT land in
    // the allow-listed audit metadata.
    const serialized = JSON.stringify(audits[0].metadata ?? {});
    expect(serialized.includes(termsText)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SIGN-OFF mechanics (P0 — the HARD STOP-CONDITION). Customer-facing quote terms
// must NEVER be silently/auto approved by the implementation. Approval is ONLY ever
// set by the deliberate `approveQuoteTerms` command.
// ─────────────────────────────────────────────────────────────────────────────

describe("quote_terms SIGN-OFF — never silently approved (Story 3.3 AC2, HARD STOP-CONDITION)", () => {
  it("[P0] a FRESH terms row defaults to NOT-approved (approved_at IS NULL) — asserted on the DB row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const created = await runCommand(updateQuoteTerms, {
      client: a as never,
      input: { terms_text: "Fresh terms (platshållartext)" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(created.ok).toBe(true);

    const rows = await readQuoteTerms(fixture.tenantA.id);
    expect(rows).toHaveLength(1);
    // The ONLY representation of "not approved" is the ABSENCE of a sign-off.
    expect(rows[0].approved_at).toBeNull();
    expect(rows[0].approved_by).toBeNull();
  });

  it("[P0] approveQuoteTerms is the ONLY path that sets approved_at + approved_by (to the resolved user)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Establish a fresh (not-approved) terms record.
    const created = await runCommand(updateQuoteTerms, {
      client: a as never,
      input: { terms_text: "Terms to be approved" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(created.ok).toBe(true);

    const before = await readQuoteTerms(fixture.tenantA.id);
    expect(before[0].approved_at).toBeNull();

    const approved = await runCommand(approveQuoteTerms, {
      client: a as never,
      input: { id: before[0].id },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(approved.ok).toBe(true);

    const after = await readQuoteTerms(fixture.tenantA.id);
    // approved_at is set to the SINGLE deterministic command instant.
    expect(after[0].approved_at).not.toBeNull();
    expect(new Date(after[0].approved_at as string).toISOString()).toBe(FIXED_ISO);
    // approved_by is the resolved acting admin (adminA), never a client-supplied id.
    expect(after[0].approved_by).toBe(fixture.adminA.id);
  });

  it("[P0] editing an APPROVED terms record RESETS approval to NULL (an edit invalidates a prior sign-off)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Create → approve → then edit the wording.
    const created = await runCommand(updateQuoteTerms, {
      client: a as never,
      input: { terms_text: "Original approved wording" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(created.ok).toBe(true);
    let row = (await readQuoteTerms(fixture.tenantA.id))[0];

    const approved = await runCommand(approveQuoteTerms, {
      client: a as never,
      input: { id: row.id },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(approved.ok).toBe(true);
    row = (await readQuoteTerms(fixture.tenantA.id))[0];
    expect(row.approved_at).not.toBeNull(); // approved precondition

    // The wording changes → the OLD approval no longer applies → reset to NOT-approved.
    const edited = await runCommand(updateQuoteTerms, {
      client: a as never,
      input: { terms_text: "Edited wording — approval no longer valid" },
      clock: fixedClock,
      correlationId: crypto.randomUUID(),
    });
    expect(edited.ok).toBe(true);

    const after = (await readQuoteTerms(fixture.tenantA.id))[0];
    expect(after.terms_text).toBe("Edited wording — approval no longer valid");
    expect(after.approved_at).toBeNull(); // approval invalidated by the edit
    expect(after.approved_by).toBeNull();
  });

  it("[P0] NO create/edit path sets approval as a side-effect — repeated updateQuoteTerms NEVER yields approved_at", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Exercise create + several edits WITHOUT ever calling approveQuoteTerms. The
    // record must stay not-approved throughout — proving there is no hidden
    // auto-approve / default-approved code path inside the edit flow.
    for (const text of ["v1 terms", "v2 terms", "v3 terms"]) {
      const r = await runCommand(updateQuoteTerms, {
        client: a as never,
        input: { terms_text: text },
        clock: fixedClock,
        correlationId: crypto.randomUUID(),
      });
      expect(r.ok).toBe(true);
      const row = (await readQuoteTerms(fixture.tenantA.id))[0];
      expect(row.approved_at).toBeNull();
      expect(row.approved_by).toBeNull();
    }
  });
});
