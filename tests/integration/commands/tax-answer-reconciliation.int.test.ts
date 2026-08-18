/**
 * Story 10.6 integration coverage. Source checks pin the one-migration/no-table
 * contract; DB-backed cases exercise the actual JSON constraints, both creation
 * RPCs, freeze transition, OLD+NEW child locking, concurrency serialization and
 * acceptance source-of-truth against the local Supabase stack.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminInsertCalculation,
  adminInsertCustomer,
  adminInsertRow,
  adminInsertSection,
  cleanupFixture,
  createTwoTenantFixture,
  makeAuthedServerClient,
  type TestServerClient,
  type TwoTenantFixture,
} from "../../factories/tenants";
import { adminQuery, adminSession } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const ROOT = process.cwd();
const CAPTURED_AT = "2026-08-05T12:00:00.000Z";
const POLICY_ID = "SE-TAX-2026-v1";
const CLASSIFICATIONS = [
  "NONE",
  "ROT_LABOR",
  "GREEN_SOLAR_LABOR",
  "GREEN_SOLAR_MATERIAL",
  "GREEN_STORAGE_LABOR",
  "GREEN_STORAGE_MATERIAL",
  "GREEN_CHARGING_LABOR",
  "GREEN_CHARGING_MATERIAL",
] as const;

let stackUp = false;
let fixture: TwoTenantFixture;
let client: TestServerClient;
let customerId: string;
let calculationId: string;
let sectionId: string;

function readRepoFile(relativePath: string): string {
  const path = resolve(ROOT, relativePath);
  expect(existsSync(path), `${relativePath} must exist`).toBe(true);
  return readFileSync(path, "utf8");
}

function storyMigration(): string {
  const directory = resolve(ROOT, "supabase/migrations");
  const matches = readdirSync(directory)
    .filter((name) => /tax_answer_reconciliation|tax-answer-reconciliation/i.test(name))
    .sort();
  expect(matches, "Story 10.6 requires exactly one forward-only additive migration").toHaveLength(1);
  return readFileSync(resolve(directory, matches[0]!), "utf8");
}

function expectAll(source: string, tokens: readonly string[], context: string): void {
  for (const token of tokens) {
    expect(source, `${context} must carry ${token}`).toContain(token);
  }
}

function zeroClassifications(): Record<(typeof CLASSIFICATIONS)[number], number> {
  return Object.fromEntries(CLASSIFICATIONS.map((key) => [key, 0])) as Record<
    (typeof CLASSIFICATIONS)[number],
    number
  >;
}

function frozenPolicyValues(): Record<string, unknown> {
  return {
    vat: { standardRateBp: 2500 },
    rot: {
      rateBp: 3000,
      maxPerPersonYearOre: 5_000_000,
      combinedRotRutMaxPerPersonYearOre: 7_500_000,
    },
    green: {
      rateBpByCategory: { SOLAR: 1500, STORAGE: 5000, CHARGING: 5000 },
      maxPerPersonYearOre: 5_000_000,
      defaultBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
      fixedPriceEligibleShareBp: 9700,
    },
  };
}

function validTaxInput(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    documentVatType: "STANDARD_VAT_25",
    buyerVatNumber: null,
    deductionChoice: "NONE",
    paymentDate: null,
    finalPaymentDate: null,
    personAllowanceSlots: [],
    greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
    genuineFixedPrice: false,
    fixedPriceOre: null,
    fixedPriceCategorySplitOre: null,
  };
}

async function setCalculationTaxInput(value: Record<string, unknown> = validTaxInput()): Promise<void> {
  await adminQuery(
    `update public.calculations set tax_input_snapshot = $2::jsonb where id = $1`,
    [calculationId, JSON.stringify(value)],
  );
}

function validTaxAnswer(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    taxRuleVersions: [POLICY_ID],
    vatPolicy: {
      id: POLICY_ID,
      validFrom: "2026-01-01",
      validTo: "2027-01-01",
      resolvingDate: "2026-08-05",
      resolvingFact: "QUOTE_CAPTURE_DATE",
      values: frozenPolicyValues(),
    },
    customerEligibilityPosture: "private",
    documentVatType: "STANDARD_VAT_25",
    buyerVatNumber: null,
    reverseChargeApplied: false,
    deductionChoice: "NONE",
    categories: [
      {
        vatType: "STANDARD_VAT_25",
        rateBp: 2500,
        netOre: 10_000,
        vatOre: 2_500,
        grossOre: 12_500,
      },
    ],
    netByDeductionClassification: { ...zeroClassifications(), NONE: 10_000 },
    vatByDeductionClassification: { ...zeroClassifications(), NONE: 2_500 },
    summaries: {
      labor: { netOre: 10_000, vatOre: 2_500, grossOre: 12_500 },
      material: { netOre: 0, vatOre: 0, grossOre: 0 },
      other: { netOre: 0, vatOre: 0, grossOre: 0 },
    },
    rot: {
      policy: null,
      basisNetOre: 0,
      allocatedVatOre: 0,
      basisOre: 0,
      calculatedOre: 0,
      claimOre: 0,
      allocations: [],
    },
    green: {
      policy: null,
      basisMethod: "ACTUAL_ELIGIBLE_COSTS",
      categories: {
        SOLAR: { category: "SOLAR", basisOre: 0, calculatedOre: 0, claimOre: 0 },
        STORAGE: { category: "STORAGE", basisOre: 0, calculatedOre: 0, claimOre: 0 },
        CHARGING: { category: "CHARGING", basisOre: 0, calculatedOre: 0, claimOre: 0 },
      },
      calculatedOre: 0,
      claimOre: 0,
      allocations: [],
    },
    netOre: 10_000,
    vatOre: 2_500,
    grossOre: 12_500,
    calculatedDeductionOre: 0,
    claimDeductionOre: 0,
    deductionOre: 0,
    payableOre: 12_500,
  };
}

function validSnapshot(): Record<string, unknown> {
  return {
    companyName: "Elpro Test AB",
    companyOrgNr: "556000-1234",
    companyAddressLine1: null,
    companyAddressLine2: null,
    companyPostalCode: null,
    companyCity: null,
    companyEmail: null,
    companyPhone: null,
    companyLogoUrl: null,
    customerDisplayName: "Taxkund",
    customerType: "private",
    facilityName: null,
    contactName: null,
    quoteNumberDisplay: null,
    validUntil: null,
    introText: null,
    customerNotes: null,
    termsText: null,
    termsApprovedAt: null,
    termsApprovedBy: null,
    baseTotalOre: 10_000,
    optionTotalOre: 0,
    vatTotalOre: 2_500,
    deductionTotalOre: 0,
    acceptedPriceOre: 12_500,
    snapshotSchemaVersion: 2,
    taxRuleVersion: POLICY_ID,
    taxAnswerSnapshot: validTaxAnswer(),
    buyerVatNumber: null,
    calculatedDeductionOre: 0,
    claimDeductionOre: 0,
    payableOre: 12_500,
    vatRateBp: 2500,
    vatDisplay: "company_togglable",
    deductionType: null,
    deductionRateBp: null,
    deductionCapOre: null,
    deductionPersons: null,
    requiresSignOff: true,
    displayMode: "detailed",
    warnings: [],
  };
}

function validLine(): Record<string, unknown> {
  return {
    rowType: "labor",
    sortOrder: 0,
    label: "Arbete",
    description: null,
    quoteNote: null,
    quantity: 1,
    unit: "st",
    unitSellOre: 10_000,
    lineNetOre: 10_000,
    vatRateBp: 2500,
    includedInInvoiceTotal: true,
    deductionClassification: "NONE",
    vatType: "STANDARD_VAT_25",
    isHidden: false,
    isOptional: false,
    isSelected: null,
  };
}

type JsonPathPart = string | number;

function objectAt(root: unknown, path: readonly JsonPathPart[]): Record<string, unknown> {
  let current: unknown = root;
  for (const part of path) {
    if (typeof part === "number") {
      if (!Array.isArray(current)) throw new Error(`Expected array at ${path.join(".")}`);
      current = current[part];
    } else {
      if (typeof current !== "object" || current === null || Array.isArray(current)) {
        throw new Error(`Expected object at ${path.join(".")}`);
      }
      current = (current as Record<string, unknown>)[part];
    }
  }
  if (typeof current !== "object" || current === null || Array.isArray(current)) {
    throw new Error(`Expected object at ${path.join(".")}`);
  }
  return current as Record<string, unknown>;
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

async function createFreshV2(): Promise<{
  quoteId: string;
  versionId: string;
}> {
  await setCalculationTaxInput();
  const { data, error } = await client.rpc("create_quote_version_from_calculation", {
    p_tenant_id: fixture.tenantA.id,
    p_calculation_id: calculationId,
    p_captured_at: CAPTURED_AT,
    p_customer_id: customerId,
    p_facility_id: null,
    p_contact_id: null,
    p_snapshot: validSnapshot(),
    p_lines: [validLine()],
    p_attachments: [],
  });
  if (error) throw new Error(`valid V2 RPC failed: ${error.code} ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("valid V2 RPC returned no row");
  return {
    quoteId: String((row as Record<string, unknown>).quote_id),
    versionId: String((row as Record<string, unknown>).quote_version_id),
  };
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  client = await makeAuthedServerClient(fixture.adminA);
  customerId = await adminInsertCustomer({
    tenant_id: fixture.tenantA.id,
    customer_type: "private",
    display_name: "Story 10.6 customer",
  });
  calculationId = await adminInsertCalculation({
    tenant_id: fixture.tenantA.id,
    customer_id: customerId,
    title: "Story 10.6 calculation",
  });
  sectionId = await adminInsertSection({
    tenant_id: fixture.tenantA.id,
    calculation_id: calculationId,
    title: "Story 10.6 tax rows",
  });
  await setCalculationTaxInput();
});

afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
});

describe("Story 10.6 — migration source contract", () => {
  it("[10.6-INT-01][P0] remains one additive migration and both RPCs share the V2 assertion", () => {
    const migration = storyMigration();
    expectAll(
      migration,
      [
        "included_in_invoice_total",
        "deduction_classification",
        "vat_type",
        "ROT_AND_GREEN",
        "is_story_10_6_tax_answer_v2",
        "is_story_10_6_quote_lines_reconciled",
        "is_story_10_6_tax_answer_matches_input",
        "calculation_rows_classification_matches_row_type_check",
        "calculation_rows_tax_reconciliation_metadata_check",
        "enforce_story_10_6_calculation_row_limit",
        "quote_version_lines_classification_matches_row_type_check",
        "assert_story_10_6_fresh_quote_v2",
        "create_quote_version_from_calculation",
        "create_new_quote_version",
      ],
      "Story 10.6 migration",
    );
    expect(migration.match(/create\s+table/gi) ?? [], "reconciliation adds no tenant table").toHaveLength(0);
    expect(migration.match(/perform\s+public\.assert_story_10_6_fresh_quote_v2/gi) ?? []).toHaveLength(2);
    expect(migration.match(/jsonb_array_length\(p_lines\)\s*>\s*500/gi) ?? []).toHaveLength(2);
  });

  it("[10.6-INT-02][P0] lock source pins transition-only freeze and OLD+NEW serialized child parents", () => {
    const migration = storyMigration();
    expectAll(
      migration,
      [
        "to_jsonb(new) - array['status', 'updated_at']",
        "only a complete reconciled Story 10.6 V2 quote version may be sent",
        "quote_versions draft updates are limited to presentation and derived PDF state",
        "V2 quote-version child snapshots are immutable after creation",
        "V2 quote-version children may only be inserted in the atomic parent-creation transaction",
        "v_old_parent_id",
        "v_new_parent_id",
        "qv.xmin::text = pg_current_xact_id()::text",
        "order by qv.id",
        "for update",
        "enforce_quote_acceptance_frozen_source_total",
      ],
      "sent/child/acceptance locks",
    );
  });

  it("[10.6-INT-03][P0] application read/write/PDF paths carry the reconciled fields", () => {
    const source = [
      readRepoFile("src/server/commands/calculations/rows.ts"),
      readRepoFile("src/server/commands/calculations/validation.ts"),
      readRepoFile("src/server/commands/quotes/snapshot-build.ts"),
      readRepoFile("src/lib/quote-pdf/view-model.ts"),
    ].join("\n");
    expectAll(
      source,
      [
        "included_in_invoice_total",
        "deduction_classification",
        "vat_type",
        "taxAnswerSnapshot",
        "payableOre",
        "REVERSE_CHARGE_CONSTRUCTION",
      ],
      "application reconciliation paths",
    );
  });
});

describe("Story 10.6 — local Supabase behavior", () => {
  it("[10.6-INT-04][P0] calculation JSON rejects JSON null/invalid enums and accepts typed ROT+green", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await expect(
      adminQuery(
        `update public.calculations set tax_input_snapshot = 'null'::jsonb where id = $1`,
        [calculationId],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const invalid = {
      schemaVersion: 2,
      documentVatType: null,
      buyerVatNumber: null,
      deductionChoice: "NONE",
      paymentDate: null,
      finalPaymentDate: null,
      personAllowanceSlots: [],
      greenBasisMethod: "ACTUAL_ELIGIBLE_COSTS",
      genuineFixedPrice: false,
      fixedPriceOre: null,
      fixedPriceCategorySplitOre: null,
    };
    await expect(
      adminQuery(
        `update public.calculations set tax_input_snapshot = $2::jsonb where id = $1`,
        [calculationId, JSON.stringify(invalid)],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    // Canonical persisted input is fail-closed: reverse charge requires its buyer
    // VAT number even at the database boundary.
    await expect(
      adminQuery(
        `update public.calculations set tax_input_snapshot = $2::jsonb where id = $1`,
        [
          calculationId,
          JSON.stringify({
            ...invalid,
            documentVatType: "REVERSE_CHARGE_CONSTRUCTION",
          }),
        ],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      adminQuery(
        `update public.calculations set tax_input_snapshot = $2::jsonb where id = $1`,
        [
          calculationId,
          JSON.stringify({
            ...validTaxInput(),
            deductionChoice: "ROT",
            paymentDate: "2026-08-05",
            personAllowanceSlots: [
              {
                slot: "person_legacy",
                remainingRotAllowanceOre: 5_000_000,
                remainingCombinedRotRutAllowanceOre: 7_500_000,
              },
            ],
          }),
        ],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      adminQuery(
        `update public.calculations set tax_input_snapshot = $2::jsonb where id = $1`,
        [
          calculationId,
          JSON.stringify({
            ...invalid,
            documentVatType: "STANDARD_VAT_25",
            deductionChoice: "ROT",
            paymentDate: "2026-08-05",
            personAllowanceSlots: [
              { slot: "PERSON_1", remainingRotAllowanceOre: 5_000_000 },
            ],
          }),
        ],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const validMixed = {
      ...invalid,
      documentVatType: "STANDARD_VAT_25",
      deductionChoice: "ROT_AND_GREEN",
      paymentDate: "2026-08-05",
      finalPaymentDate: "2026-08-06",
      personAllowanceSlots: [
        {
          slot: "PERSON_1",
          remainingRotAllowanceOre: 5_000_000,
          remainingCombinedRotRutAllowanceOre: 7_500_000,
        },
        {
          slot: "PERSON_2",
          remainingGreenAllowanceOre: 5_000_000,
        },
      ],
    };
    await expect(
      adminQuery(
        `update public.calculations set tax_input_snapshot = $2::jsonb where id = $1`,
        [calculationId, JSON.stringify(validMixed)],
      ),
    ).resolves.toBeDefined();

    const invalidCanonicalInputs = [
      {
        ...validTaxInput(),
        buyerVatNumber: "SE123456789012",
      },
      {
        ...validTaxInput(),
        paymentDate: "2026-08-05",
      },
      {
        ...validTaxInput(),
        genuineFixedPrice: true,
        fixedPriceOre: 10_000,
        fixedPriceCategorySplitOre: { SOLAR: 10_000, STORAGE: 0, CHARGING: 0 },
      },
      {
        ...validMixed,
        personAllowanceSlots: [{ slot: "PERSON_1", remainingAllowanceOre: 5_000_000 }],
      },
      {
        ...validMixed,
        documentVatType: "REVERSE_CHARGE_CONSTRUCTION",
        buyerVatNumber: "SE123456789012",
      },
    ];
    for (const input of invalidCanonicalInputs) {
      const result = await adminQuery<{ valid: boolean }>(
        `select public.is_story_10_6_tax_input_v2($1::jsonb) as valid`,
        [JSON.stringify(input)],
      );
      expect(result[0]?.valid).toBe(false);
    }

    await expect(
      adminInsertRow({
        tenant_id: fixture.tenantA.id,
        section_id: sectionId,
        row_type: "material",
        unit_sell_ore: 10_000,
        deduction_classification: "ROT_LABOR",
      }),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      adminInsertRow({
        tenant_id: fixture.tenantA.id,
        section_id: sectionId,
        row_type: "machinery",
        unit_sell_ore: 10_000,
        deduction_classification: "GREEN_SOLAR_LABOR",
      }),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("[10.6-INT-04A][P0] migration finishes row reconciliation with owner-only bounded remediation", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;

    const privileges = await adminQuery<{
      anon_executes: boolean;
      authenticated_executes: boolean;
      service_executes: boolean;
    }>(
      `select
         has_function_privilege(
           'anon',
           'public.backfill_story_10_6_calculation_rows(integer)',
           'EXECUTE'
         ) as anon_executes,
         has_function_privilege(
           'authenticated',
           'public.backfill_story_10_6_calculation_rows(integer)',
           'EXECUTE'
         ) as authenticated_executes,
         has_function_privilege(
           'service_role',
           'public.backfill_story_10_6_calculation_rows(integer)',
           'EXECUTE'
         ) as service_executes`,
    );
    expect(privileges[0]).toEqual({
      anon_executes: false,
      authenticated_executes: false,
      service_executes: false,
    });

    for (const batchSize of [null, 0, 5001] as const) {
      await expect(
        adminQuery(`select public.backfill_story_10_6_calculation_rows($1)`, [batchSize]),
      ).rejects.toMatchObject({ code: "22023" });
    }
    const completed = await adminQuery<{ updated: number }>(
      `select public.backfill_story_10_6_calculation_rows(1) as updated`,
    );
    expect(Number(completed[0]?.updated)).toBe(0);

    const constraints = await adminQuery<{ conname: string; convalidated: boolean }>(
      `select conname, convalidated
         from pg_constraint
        where conrelid = 'public.calculation_rows'::regclass
          and conname = any($1::text[])
        order by conname`,
      [[
        "calculation_rows_included_in_invoice_total_present_check",
        "calculation_rows_deduction_classification_present_check",
        "calculation_rows_tax_reconciliation_required_present_check",
        "calculation_rows_tax_reconciliation_metadata_check",
        "calculation_rows_vat_type_rate_check",
      ]],
    );
    expect(constraints).toHaveLength(5);
    expect(constraints.every((constraint) => constraint.convalidated)).toBe(true);

    const quarantined = await adminQuery<{
      id: string;
      vat_type: string | null;
      tax_reconciliation_required: boolean;
      tax_reconciliation_reason: string;
    }>(
      `insert into public.calculation_rows (
         tenant_id, section_id, row_type, quantity, unit, unit_sell_ore, vat_rate_bp,
         included_in_invoice_total, deduction_classification, vat_type,
         tax_reconciliation_required, tax_reconciliation_reason
       ) values (
         $1, $2, 'other', 1, 'st', 10000, 0,
         true, 'NONE', null, true, 'LEGACY_VAT_ZERO_AMBIGUOUS'
       )
       returning id, vat_type, tax_reconciliation_required, tax_reconciliation_reason`,
      [fixture.tenantA.id, sectionId],
    );
    expect(quarantined[0]).toMatchObject({
      vat_type: null,
      tax_reconciliation_required: true,
      tax_reconciliation_reason: "LEGACY_VAT_ZERO_AMBIGUOUS",
    });
    await expect(
      adminQuery(
        `insert into public.calculation_rows (
           tenant_id, section_id, row_type, quantity, unit, unit_sell_ore, vat_rate_bp,
           included_in_invoice_total, deduction_classification, vat_type,
           tax_reconciliation_required, tax_reconciliation_reason
         ) values (
           $1, $2, 'other', 1, 'st', 10000, null,
           true, 'NONE', 'STANDARD_VAT_25', false, null
         )`,
        [fixture.tenantA.id, sectionId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      adminQuery(
        `update public.calculation_rows
            set tax_reconciliation_required = false,
                tax_reconciliation_reason = null
          where id = $1`,
        [quarantined[0]!.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      adminQuery(
        `update public.calculation_rows
            set vat_rate_bp = 2500,
                vat_type = 'STANDARD_VAT_25',
                tax_reconciliation_required = false,
                tax_reconciliation_reason = null
          where id = $1`,
        [quarantined[0]!.id],
      ),
    ).resolves.toBeDefined();
  });

  it("[10.6-INT-04C][P0] calculation rows are capped at 500 across all sections", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const cappedCalculationId = await adminInsertCalculation({
      tenant_id: fixture.tenantA.id,
      customer_id: customerId,
      title: "Story 10.6 capped calculation",
    });
    const firstSectionId = await adminInsertSection({
      tenant_id: fixture.tenantA.id,
      calculation_id: cappedCalculationId,
      title: "First capped section",
    });
    const secondSectionId = await adminInsertSection({
      tenant_id: fixture.tenantA.id,
      calculation_id: cappedCalculationId,
      title: "Second capped section",
    });

    await adminQuery(
      `insert into public.calculation_rows (
         tenant_id, section_id, row_type, quantity, unit, unit_sell_ore, vat_rate_bp,
         included_in_invoice_total, deduction_classification, vat_type, sort_order
       )
       select $1, $2, 'other', 1, 'st', 0, 2500,
              true, 'NONE', 'STANDARD_VAT_25', ordinal
         from generate_series(1, 499) as ordinal`,
      [fixture.tenantA.id, firstSectionId],
    );
    await expect(
      adminInsertRow({
        tenant_id: fixture.tenantA.id,
        section_id: secondSectionId,
        row_type: "other",
        unit_sell_ore: 0,
      }),
    ).resolves.toBeDefined();
    await expect(
      adminInsertRow({
        tenant_id: fixture.tenantA.id,
        section_id: secondSectionId,
        row_type: "other",
        unit_sell_ore: 0,
      }),
    ).rejects.toMatchObject({ code: "23514" });

    await adminQuery(
      `update public.calculation_rows
          set archived_at = now()
        where id = (
          select id
            from public.calculation_rows
           where section_id = $1 and archived_at is null
           order by id
           limit 1
        )`,
      [firstSectionId],
    );
    await expect(
      adminInsertRow({
        tenant_id: fixture.tenantA.id,
        section_id: secondSectionId,
        row_type: "other",
        unit_sell_ore: 0,
      }),
    ).resolves.toBeDefined();

    await adminQuery(
      `update public.calculation_sections set archived_at = now() where id = $1`,
      [firstSectionId],
    );
    await expect(
      adminInsertRow({
        tenant_id: fixture.tenantA.id,
        section_id: secondSectionId,
        row_type: "other",
        unit_sell_ore: 0,
      }),
    ).resolves.toBeDefined();
    await expect(
      adminQuery(
        `update public.calculation_sections set archived_at = null where id = $1`,
        [firstSectionId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await adminQuery(
      `update public.calculation_rows
          set archived_at = now()
        where id = (
          select id
            from public.calculation_rows
           where section_id = $1 and archived_at is null
           order by id
           limit 1
        )`,
      [firstSectionId],
    );
    await expect(
      adminQuery(
        `update public.calculation_sections set archived_at = null where id = $1`,
        [firstSectionId],
      ),
    ).resolves.toBeDefined();
  });

  it("[10.6-INT-04B][P0] finalized V2 enforces whole-SEK claims and reverse metadata", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const missingVatPolicy = validTaxAnswer();
    delete missingVatPolicy.vatPolicy;
    const missingVatPolicyResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(missingVatPolicy)],
    );
    expect(missingVatPolicyResult[0]?.valid).toBe(false);

    const nonCanonicalResolvingDate = validTaxAnswer();
    (nonCanonicalResolvingDate.vatPolicy as Record<string, unknown>).resolvingDate = "2026/08/05";
    const nonCanonicalDateResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(nonCanonicalResolvingDate)],
    );
    expect(nonCanonicalDateResult[0]?.valid).toBe(false);

    const duplicateRuleVersion = validTaxAnswer();
    duplicateRuleVersion.taxRuleVersions = [POLICY_ID, POLICY_ID];
    const duplicateRuleResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(duplicateRuleVersion)],
    );
    expect(duplicateRuleResult[0]?.valid).toBe(false);

    const missingPosture = validTaxAnswer();
    delete missingPosture.customerEligibilityPosture;
    const missingPostureResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(missingPosture)],
    );
    expect(missingPostureResult[0]?.valid).toBe(false);

    const standardWithBuyerVat = validTaxAnswer();
    standardWithBuyerVat.buyerVatNumber = "SE123456789012";
    const standardWithBuyerVatResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(standardWithBuyerVat)],
    );
    expect(standardWithBuyerVatResult[0]?.valid).toBe(false);

    const companyAnswer = validTaxAnswer();
    companyAnswer.customerEligibilityPosture = "company";
    const companyAnswerResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(companyAnswer)],
    );
    expect(companyAnswerResult[0]?.valid).toBe(true);
    await expect(
      adminQuery(
        `select public.assert_story_10_6_fresh_quote_v2(
           $1::jsonb, $2::jsonb, $3::jsonb, $4::date
         )`,
        [
          JSON.stringify({
            ...validSnapshot(),
            customerType: "company",
            taxAnswerSnapshot: companyAnswer,
          }),
          JSON.stringify([validLine()]),
          JSON.stringify(validTaxInput()),
          "2026-08-05",
        ],
      ),
    ).resolves.toBeDefined();
    await expect(
      adminQuery(
        `select public.assert_story_10_6_fresh_quote_v2(
           $1::jsonb, $2::jsonb, $3::jsonb, $4::date
         )`,
        [
          JSON.stringify({
            ...validSnapshot(),
            customerType: "private",
            taxAnswerSnapshot: companyAnswer,
          }),
          JSON.stringify([validLine()]),
          JSON.stringify(validTaxInput()),
          "2026-08-05",
        ],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const tamperedPolicy = validTaxAnswer();
    (
      (
        (tamperedPolicy.vatPolicy as Record<string, unknown>).values as Record<string, unknown>
      ).green as { rateBpByCategory: Record<string, number> }
    ).rateBpByCategory.SOLAR = 2000;
    const tamperedPolicyResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(tamperedPolicy)],
    );
    expect(tamperedPolicyResult[0]?.valid).toBe(false);

    const whole = validTaxAnswer();
    whole.deductionChoice = "ROT";
    whole.netByDeductionClassification = { ...zeroClassifications(), ROT_LABOR: 10_000 };
    whole.vatByDeductionClassification = { ...zeroClassifications(), ROT_LABOR: 2_500 };
    whole.summaries = {
      labor: { netOre: 10_000, vatOre: 2_500, grossOre: 12_500 },
      material: { netOre: 0, vatOre: 0, grossOre: 0 },
      other: { netOre: 0, vatOre: 0, grossOre: 0 },
    };
    whole.rot = {
      policy: {
        id: POLICY_ID,
        validFrom: "2026-01-01",
        validTo: "2027-01-01",
        resolvingDate: "2026-08-05",
        resolvingFact: "ROT_PAYMENT_DATE",
        values: frozenPolicyValues(),
      },
      basisNetOre: 10_000,
      allocatedVatOre: 2_500,
      basisOre: 12_500,
      calculatedOre: 3_750,
      claimOre: 3_700,
      allocations: [{ slot: "PERSON_1", ore: 3_700 }],
    };
    whole.calculatedDeductionOre = 3_750;
    whole.claimDeductionOre = 3_700;
    whole.deductionOre = 3_700;
    whole.payableOre = 8_800;
    const wholeResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(whole)],
    );
    expect(wholeResult[0]?.valid).toBe(true);

    const ineligibleWhole = structuredClone(whole);
    ineligibleWhole.customerEligibilityPosture = "company";
    const ineligibleWholeResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(ineligibleWhole)],
    );
    expect(ineligibleWholeResult[0]?.valid).toBe(false);

    const exactObjectPaths: readonly (readonly JsonPathPart[])[] = [
      [],
      ["vatPolicy"],
      ["vatPolicy", "values"],
      ["vatPolicy", "values", "vat"],
      ["vatPolicy", "values", "rot"],
      ["vatPolicy", "values", "green"],
      ["vatPolicy", "values", "green", "rateBpByCategory"],
      ["categories", 0],
      ["netByDeductionClassification"],
      ["vatByDeductionClassification"],
      ["summaries"],
      ["summaries", "labor"],
      ["rot"],
      ["rot", "policy"],
      ["rot", "allocations", 0],
      ["green"],
      ["green", "categories"],
      ["green", "categories", "SOLAR"],
    ];
    for (const path of exactObjectPaths) {
      const withUnknownKey = structuredClone(whole);
      objectAt(withUnknownKey, path)._unexpected = true;
      const result = await adminQuery<{ valid: boolean }>(
        `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
        [JSON.stringify(withUnknownKey)],
      );
      expect(result[0]?.valid, `unknown key at ${path.join(".")} must fail`).toBe(false);
    }

    const rotAtLimit = structuredClone(whole);
    (rotAtLimit.rot as Record<string, unknown>).allocations = [
      { slot: "PERSON_1", ore: 3_700 },
      ...Array.from({ length: 49 }, (_, index) => ({
        slot: `zero_rot_${index + 1}`,
        ore: 0,
      })),
    ];
    const rotAtLimitResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(rotAtLimit)],
    );
    expect(rotAtLimitResult[0]?.valid).toBe(true);
    const oversizedRot = structuredClone(rotAtLimit);
    ((oversizedRot.rot as Record<string, unknown>).allocations as unknown[]).push({
      slot: "zero_rot_50",
      ore: 0,
    });
    const oversizedRotResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(oversizedRot)],
    );
    expect(oversizedRotResult[0]?.valid).toBe(false);

    const orderedInput = {
      ...validTaxInput(),
      deductionChoice: "ROT",
      paymentDate: "2026-08-05",
      personAllowanceSlots: [
        {
          slot: "PERSON_1",
          remainingRotAllowanceOre: 2_000,
          remainingCombinedRotRutAllowanceOre: 2_000,
        },
        {
          slot: "PERSON_2",
          remainingRotAllowanceOre: 2_000,
          remainingCombinedRotRutAllowanceOre: 2_000,
        },
      ],
    };
    const orderedAnswer = structuredClone(whole);
    (orderedAnswer.rot as Record<string, unknown>).allocations = [
      { slot: "PERSON_1", ore: 2_000 },
      { slot: "PERSON_2", ore: 1_700 },
    ];
    const orderedMatch = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_matches_input(
         $1::jsonb, $2::jsonb, $3::date
       ) as valid`,
      [JSON.stringify(orderedAnswer), JSON.stringify(orderedInput), "2026-08-05"],
    );
    expect(orderedMatch[0]?.valid).toBe(true);
    (orderedAnswer.rot as Record<string, unknown>).allocations = [
      { slot: "PERSON_2", ore: 1_700 },
      { slot: "PERSON_1", ore: 2_000 },
    ];
    const reorderedMatch = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_matches_input(
         $1::jsonb, $2::jsonb, $3::date
       ) as valid`,
      [JSON.stringify(orderedAnswer), JSON.stringify(orderedInput), "2026-08-05"],
    );
    expect(reorderedMatch[0]?.valid).toBe(false);

    const mixed = structuredClone(whole);
    mixed.deductionChoice = "ROT_AND_GREEN";
    (mixed.green as Record<string, unknown>).policy = {
      id: POLICY_ID,
      validFrom: "2026-01-01",
      validTo: "2027-01-01",
      resolvingDate: "2026-08-06",
      resolvingFact: "GREEN_FINAL_PAYMENT_DATE",
      values: frozenPolicyValues(),
    };
    const mixedPayload = {
      ...validSnapshot(),
      taxAnswerSnapshot: mixed,
      calculatedDeductionOre: 3_750,
      claimDeductionOre: 3_700,
      deductionTotalOre: 3_700,
      payableOre: 8_800,
      acceptedPriceOre: 8_800,
      deductionType: "rot_and_green",
    };
    const rotLine = { ...validLine(), deductionClassification: "ROT_LABOR" };
    const mixedInput = {
      ...validTaxInput(),
      deductionChoice: "ROT_AND_GREEN",
      paymentDate: "2026-08-05",
      finalPaymentDate: "2026-08-06",
      personAllowanceSlots: [
        {
          slot: "PERSON_1",
          remainingRotAllowanceOre: 5_000_000,
          remainingCombinedRotRutAllowanceOre: 7_500_000,
          remainingGreenAllowanceOre: 5_000_000,
        },
      ],
    };
    await expect(
      adminQuery(
        `select public.assert_story_10_6_fresh_quote_v2(
           $1::jsonb, $2::jsonb, $3::jsonb, $4::date
         )`,
        [
          JSON.stringify(mixedPayload),
          JSON.stringify([rotLine]),
          JSON.stringify(mixedInput),
          "2026-08-05",
        ],
      ),
    ).resolves.toBeDefined();
    await expect(
      adminQuery(
        `select public.assert_story_10_6_fresh_quote_v2(
           $1::jsonb, $2::jsonb, $3::jsonb, $4::date
         )`,
        [
          JSON.stringify(mixedPayload),
          JSON.stringify([{ ...rotLine, rowType: "material" }]),
          JSON.stringify(mixedInput),
          "2026-08-05",
        ],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const fixedGreen = validTaxAnswer();
    fixedGreen.deductionChoice = "GREEN";
    fixedGreen.netByDeductionClassification = {
      ...zeroClassifications(),
      GREEN_SOLAR_LABOR: 10_000,
    };
    fixedGreen.vatByDeductionClassification = {
      ...zeroClassifications(),
      GREEN_SOLAR_LABOR: 2_500,
    };
    fixedGreen.summaries = {
      labor: { netOre: 10_000, vatOre: 2_500, grossOre: 12_500 },
      material: { netOre: 0, vatOre: 0, grossOre: 0 },
      other: { netOre: 0, vatOre: 0, grossOre: 0 },
    };
    fixedGreen.green = {
      policy: {
        id: POLICY_ID,
        validFrom: "2026-01-01",
        validTo: "2027-01-01",
        resolvingDate: "2026-08-06",
        resolvingFact: "GREEN_FINAL_PAYMENT_DATE",
        values: frozenPolicyValues(),
      },
      basisMethod: "FIXED_PRICE_97_PERCENT",
      categories: {
        SOLAR: { category: "SOLAR", basisOre: 12_125, calculatedOre: 1_818, claimOre: 1_800 },
        STORAGE: { category: "STORAGE", basisOre: 0, calculatedOre: 0, claimOre: 0 },
        CHARGING: { category: "CHARGING", basisOre: 0, calculatedOre: 0, claimOre: 0 },
      },
      calculatedOre: 1_818,
      claimOre: 1_800,
      allocations: [{ slot: "green_person", ore: 1_800 }],
    };
    fixedGreen.calculatedDeductionOre = 1_818;
    fixedGreen.claimDeductionOre = 1_800;
    fixedGreen.deductionOre = 1_800;
    fixedGreen.payableOre = 10_700;
    const fixedGreenResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(fixedGreen)],
    );
    expect(fixedGreenResult[0]?.valid).toBe(true);

    // Each category is below one SEK on its own (30 öre + 70 öre), but their
    // exact rational claims sum to one SEK. The document truncates once and then
    // allocates the resulting 100 öre proportionally across the categories.
    const aggregateGreen = validTaxAnswer();
    aggregateGreen.deductionChoice = "GREEN";
    aggregateGreen.categories = [
      {
        vatType: "STANDARD_VAT_25",
        rateBp: 2500,
        netOre: 272,
        vatOre: 68,
        grossOre: 340,
      },
    ];
    aggregateGreen.netByDeductionClassification = {
      ...zeroClassifications(),
      GREEN_SOLAR_LABOR: 160,
      GREEN_STORAGE_LABOR: 112,
    };
    aggregateGreen.vatByDeductionClassification = {
      ...zeroClassifications(),
      GREEN_SOLAR_LABOR: 40,
      GREEN_STORAGE_LABOR: 28,
    };
    aggregateGreen.summaries = {
      labor: { netOre: 272, vatOre: 68, grossOre: 340 },
      material: { netOre: 0, vatOre: 0, grossOre: 0 },
      other: { netOre: 0, vatOre: 0, grossOre: 0 },
    };
    aggregateGreen.green = {
      policy: {
        id: POLICY_ID,
        validFrom: "2026-01-01",
        validTo: "2027-01-01",
        resolvingDate: "2026-08-06",
        resolvingFact: "GREEN_FINAL_PAYMENT_DATE",
        values: frozenPolicyValues(),
      },
      basisMethod: "ACTUAL_ELIGIBLE_COSTS",
      categories: {
        SOLAR: { category: "SOLAR", basisOre: 200, calculatedOre: 30, claimOre: 30 },
        STORAGE: { category: "STORAGE", basisOre: 140, calculatedOre: 70, claimOre: 70 },
        CHARGING: { category: "CHARGING", basisOre: 0, calculatedOre: 0, claimOre: 0 },
      },
      calculatedOre: 100,
      claimOre: 100,
      allocations: [{ slot: "green_person", ore: 100 }],
    };
    aggregateGreen.netOre = 272;
    aggregateGreen.vatOre = 68;
    aggregateGreen.grossOre = 340;
    aggregateGreen.calculatedDeductionOre = 100;
    aggregateGreen.claimDeductionOre = 100;
    aggregateGreen.deductionOre = 100;
    aggregateGreen.payableOre = 240;
    const aggregateGreenResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(aggregateGreen)],
    );
    expect(aggregateGreenResult[0]?.valid).toBe(true);

    const independentlyTruncatedGreen = structuredClone(aggregateGreen);
    const independentlyTruncatedCategories = (
      independentlyTruncatedGreen.green as Record<string, unknown>
    ).categories as Record<string, Record<string, unknown>>;
    independentlyTruncatedCategories.SOLAR!.claimOre = 0;
    independentlyTruncatedCategories.STORAGE!.claimOre = 0;
    (independentlyTruncatedGreen.green as Record<string, unknown>).claimOre = 0;
    (independentlyTruncatedGreen.green as Record<string, unknown>).allocations = [];
    independentlyTruncatedGreen.claimDeductionOre = 0;
    independentlyTruncatedGreen.deductionOre = 0;
    independentlyTruncatedGreen.payableOre = 340;
    const independentlyTruncatedResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(independentlyTruncatedGreen)],
    );
    expect(independentlyTruncatedResult[0]?.valid).toBe(false);
    const greenWithUnknownAllocationKey = structuredClone(fixedGreen);
    objectAt(greenWithUnknownAllocationKey, ["green", "policy"])._unexpected = true;
    const unknownGreenPolicyResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(greenWithUnknownAllocationKey)],
    );
    expect(unknownGreenPolicyResult[0]?.valid).toBe(false);
    const greenAtLimit = structuredClone(fixedGreen);
    (greenAtLimit.green as Record<string, unknown>).allocations = [
      { slot: "green_person", ore: 1_800 },
      ...Array.from({ length: 49 }, (_, index) => ({
        slot: `zero_green_${index + 1}`,
        ore: 0,
      })),
    ];
    const greenAtLimitResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(greenAtLimit)],
    );
    expect(greenAtLimitResult[0]?.valid).toBe(true);
    const oversizedGreen = structuredClone(greenAtLimit);
    ((oversizedGreen.green as Record<string, unknown>).allocations as unknown[]).push({
      slot: "zero_green_50",
      ore: 0,
    });
    const oversizedGreenResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(oversizedGreen)],
    );
    expect(oversizedGreenResult[0]?.valid).toBe(false);
    const mismatchedFixedGreen = structuredClone(fixedGreen);
    (
      (mismatchedFixedGreen.green as Record<string, unknown>).categories as Record<
        string,
        Record<string, unknown>
      >
    ).SOLAR!.basisOre = 12_124;
    const mismatchedFixedResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(mismatchedFixedGreen)],
    );
    expect(mismatchedFixedResult[0]?.valid).toBe(false);

    const fractional = structuredClone(whole);
    (fractional.rot as Record<string, unknown>).claimOre = 3_750;
    (fractional.rot as Record<string, unknown>).allocations = [{ slot: "PERSON_1", ore: 3_750 }];
    fractional.claimDeductionOre = 3_750;
    fractional.deductionOre = 3_750;
    fractional.payableOre = 8_750;
    const fractionalResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(fractional)],
    );
    expect(fractionalResult[0]?.valid).toBe(false);

    const reverse = validTaxAnswer();
    reverse.documentVatType = "REVERSE_CHARGE_CONSTRUCTION";
    reverse.reverseChargeApplied = true;
    reverse.categories = [
      {
        vatType: "REVERSE_CHARGE_CONSTRUCTION",
        rateBp: 2500,
        netOre: 10_000,
        vatOre: 0,
        grossOre: 10_000,
      },
    ];
    reverse.vatByDeductionClassification = zeroClassifications();
    reverse.summaries = {
      labor: { netOre: 0, vatOre: 0, grossOre: 0 },
      material: { netOre: 0, vatOre: 0, grossOre: 0 },
      other: { netOre: 10_000, vatOre: 0, grossOre: 10_000 },
    };
    reverse.vatOre = 0;
    reverse.grossOre = 10_000;
    reverse.payableOre = 10_000;
    const missingBuyer = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(reverse)],
    );
    expect(missingBuyer[0]?.valid).toBe(false);
    reverse.buyerVatNumber = "ZZ1234567890";
    const invalidPrefix = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(reverse)],
    );
    expect(invalidPrefix[0]?.valid).toBe(false);
    reverse.buyerVatNumber = "SE123456789012";
    const completeReverse = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(reverse)],
    );
    expect(completeReverse[0]?.valid).toBe(true);
    const reverseWithPrivateDeduction = structuredClone(reverse);
    reverseWithPrivateDeduction.deductionChoice = "ROT";
    const reverseDeductionResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(reverseWithPrivateDeduction)],
    );
    expect(reverseDeductionResult[0]?.valid).toBe(false);

    // The closed VAT-category set contains five identities because reduced VAT has
    // two sanctioned rates. Pin both the structural validator and the fresh-RPC
    // reconciliation so a count cap cannot accidentally reject a legal mixed quote.
    const allFiveCategories = validTaxAnswer();
    allFiveCategories.documentVatType = "REVERSE_CHARGE_CONSTRUCTION";
    allFiveCategories.buyerVatNumber = "SE123456789012";
    allFiveCategories.reverseChargeApplied = true;
    allFiveCategories.categories = [
      { vatType: "STANDARD_VAT_25", rateBp: 2500, netOre: 10_000, vatOre: 2_500, grossOre: 12_500 },
      { vatType: "REVERSE_CHARGE_CONSTRUCTION", rateBp: 2500, netOre: 10_000, vatOre: 0, grossOre: 10_000 },
      { vatType: "ZERO_RATED", rateBp: 0, netOre: 10_000, vatOre: 0, grossOre: 10_000 },
      { vatType: "REDUCED_VAT", rateBp: 600, netOre: 10_000, vatOre: 600, grossOre: 10_600 },
      { vatType: "REDUCED_VAT", rateBp: 1200, netOre: 10_000, vatOre: 1_200, grossOre: 11_200 },
    ];
    allFiveCategories.netByDeductionClassification = {
      ...zeroClassifications(),
      NONE: 50_000,
    };
    allFiveCategories.vatByDeductionClassification = {
      ...zeroClassifications(),
      NONE: 4_300,
    };
    allFiveCategories.summaries = {
      labor: { netOre: 50_000, vatOre: 4_300, grossOre: 54_300 },
      material: { netOre: 0, vatOre: 0, grossOre: 0 },
      other: { netOre: 0, vatOre: 0, grossOre: 0 },
    };
    allFiveCategories.netOre = 50_000;
    allFiveCategories.vatOre = 4_300;
    allFiveCategories.grossOre = 54_300;
    allFiveCategories.payableOre = 54_300;
    const allFiveResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(allFiveCategories)],
    );
    expect(allFiveResult[0]?.valid).toBe(true);

    const allFiveLines = (
      allFiveCategories.categories as Array<Record<string, unknown>>
    ).map((category, index) => ({
      ...validLine(),
      sortOrder: index,
      label: `VAT category ${index + 1}`,
      vatType: category.vatType,
      vatRateBp: category.rateBp,
    }));
    await expect(
      adminQuery(
        `select public.assert_story_10_6_fresh_quote_v2(
           $1::jsonb, $2::jsonb, $3::jsonb, $4::date
         )`,
        [
          JSON.stringify({
            ...validSnapshot(),
            baseTotalOre: 50_000,
            vatTotalOre: 4_300,
            acceptedPriceOre: 54_300,
            taxAnswerSnapshot: allFiveCategories,
            buyerVatNumber: "SE123456789012",
            payableOre: 54_300,
          }),
          JSON.stringify(allFiveLines),
          JSON.stringify({
            ...validTaxInput(),
            documentVatType: "REVERSE_CHARGE_CONSTRUCTION",
            buyerVatNumber: "SE123456789012",
          }),
          "2026-08-05",
        ],
      ),
    ).resolves.toBeDefined();

    const duplicateWithinFive = structuredClone(allFiveCategories);
    (duplicateWithinFive.categories as unknown[])[4] = structuredClone(
      (duplicateWithinFive.categories as unknown[])[0],
    );
    const duplicateWithinFiveResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(duplicateWithinFive)],
    );
    expect(duplicateWithinFiveResult[0]?.valid).toBe(false);

    const oversizedCategories = structuredClone(allFiveCategories);
    (oversizedCategories.categories as unknown[]).push(
      structuredClone((oversizedCategories.categories as unknown[])[0]),
    );
    const oversizedCategoriesResult = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_tax_answer_v2($1::jsonb) as valid`,
      [JSON.stringify(oversizedCategories)],
    );
    expect(oversizedCategoriesResult[0]?.valid).toBe(false);
  });

  it("[10.6-INT-05][P0] both fresh RPCs reject V1/partial V2 and incomplete child keys", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await setCalculationTaxInput();
    const v1 = { ...validSnapshot(), snapshotSchemaVersion: 1 };
    const initialV1 = await client.rpc("create_quote_version_from_calculation", {
      p_tenant_id: fixture.tenantA.id,
      p_calculation_id: calculationId,
      p_captured_at: CAPTURED_AT,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: v1,
      p_lines: [validLine()],
      p_attachments: [],
    });
    expect(initialV1.error?.code).toBe("23514");

    const incompleteLine = { ...validLine() };
    delete incompleteLine.vatType;
    const initialLine = await client.rpc("create_quote_version_from_calculation", {
      p_tenant_id: fixture.tenantA.id,
      p_calculation_id: calculationId,
      p_captured_at: CAPTURED_AT,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: validSnapshot(),
      p_lines: [incompleteLine],
      p_attachments: [],
    });
    expect(initialLine.error?.code).toBe("23514");

    const falseMathAnswer = validTaxAnswer();
    falseMathAnswer.categories = [
      {
        vatType: "STANDARD_VAT_25",
        rateBp: 2500,
        netOre: 10_000,
        vatOre: 2_000,
        grossOre: 12_000,
      },
    ];
    falseMathAnswer.vatByDeductionClassification = {
      ...zeroClassifications(),
      NONE: 2_000,
    };
    falseMathAnswer.summaries = {
      labor: { netOre: 10_000, vatOre: 2_000, grossOre: 12_000 },
      material: { netOre: 0, vatOre: 0, grossOre: 0 },
      other: { netOre: 0, vatOre: 0, grossOre: 0 },
    };
    falseMathAnswer.vatOre = 2_000;
    falseMathAnswer.grossOre = 12_000;
    falseMathAnswer.payableOre = 12_000;
    const falseMathSnapshot = {
      ...validSnapshot(),
      taxAnswerSnapshot: falseMathAnswer,
      vatTotalOre: 2_000,
      acceptedPriceOre: 12_000,
      payableOre: 12_000,
    };
    const initialFalseMath = await client.rpc("create_quote_version_from_calculation", {
      p_tenant_id: fixture.tenantA.id,
      p_calculation_id: calculationId,
      p_captured_at: CAPTURED_AT,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: falseMathSnapshot,
      p_lines: [validLine()],
      p_attachments: [],
    });
    expect(initialFalseMath.error?.code).toBe("23514");

    const created = await createFreshV2();
    const partialAnswer = validTaxAnswer();
    delete partialAnswer.summaries;
    const newVersion = await client.rpc("create_new_quote_version", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_id: created.quoteId,
      p_calculation_id: calculationId,
      p_captured_at: CAPTURED_AT,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: { ...validSnapshot(), taxAnswerSnapshot: partialAnswer },
      p_lines: [validLine()],
      p_attachments: [],
      p_supersede_prior: false,
    });
    expect(newVersion.error?.code).toBe("23514");

    const falseMathNewVersion = await client.rpc("create_new_quote_version", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_id: created.quoteId,
      p_calculation_id: calculationId,
      p_captured_at: CAPTURED_AT,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: falseMathSnapshot,
      p_lines: [validLine()],
      p_attachments: [],
      p_supersede_prior: false,
    });
    expect(falseMathNewVersion.error?.code).toBe("23514");

    const count = await adminQuery<{ count: string }>(
      `select count(*)::text as count from public.quote_versions where quote_id = $1`,
      [created.quoteId],
    );
    expect(Number(count[0]?.count)).toBe(1);
  });

  it("[10.6-INT-05B][P0] quote validation accepts 500 lines and rejects 501", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const excluded = {
      ...validLine(),
      includedInInvoiceTotal: false,
      lineNetOre: 0,
      unitSellOre: 0,
    };
    const linesAtLimit = [
      validLine(),
      ...Array.from({ length: 499 }, (_, index) => ({
        ...excluded,
        sortOrder: index + 1,
      })),
    ];
    const atLimit = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_quote_lines_reconciled($1::jsonb, $2::jsonb) as valid`,
      [JSON.stringify(validTaxAnswer()), JSON.stringify(linesAtLimit)],
    );
    expect(atLimit[0]?.valid).toBe(true);
    const overLimit = await adminQuery<{ valid: boolean }>(
      `select public.is_story_10_6_quote_lines_reconciled($1::jsonb, $2::jsonb) as valid`,
      [JSON.stringify(validTaxAnswer()), JSON.stringify([...linesAtLimit, excluded])],
    );
    expect(overLimit[0]?.valid).toBe(false);
  });

  it("[10.6-INT-05C][P0] both creation RPCs resolve capture dates in Europe/Stockholm", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await setCalculationTaxInput();
    const stockholmMidnightBoundary = "2026-08-04T22:30:00.000Z";
    const initial = await client.rpc("create_quote_version_from_calculation", {
      p_tenant_id: fixture.tenantA.id,
      p_calculation_id: calculationId,
      p_captured_at: stockholmMidnightBoundary,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: validSnapshot(),
      p_lines: [validLine()],
      p_attachments: [],
    });
    expect(initial.error).toBeNull();
    const initialRow = Array.isArray(initial.data) ? initial.data[0] : initial.data;
    const quoteId = String((initialRow as Record<string, unknown>).quote_id);

    const successor = await client.rpc("create_new_quote_version", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_id: quoteId,
      p_calculation_id: calculationId,
      p_captured_at: stockholmMidnightBoundary,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: validSnapshot(),
      p_lines: [validLine()],
      p_attachments: [],
      p_supersede_prior: false,
    });
    expect(successor.error).toBeNull();
  });

  it("[10.6-INT-12][P0] authenticated Tenant B cannot call either fresh-version RPC against Tenant A data and leaves the existing A quote untouched", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const tenantBClient = await makeAuthedServerClient(fixture.adminB);
    const existing = await createFreshV2();

    type TenantWriteFootprint = {
      quote_count: string;
      version_count: string;
      line_count: string;
      event_count: string;
      counter_value: string | null;
    };
    type ExistingVersionState = {
      id: string;
      quote_id: string;
      version_number: string;
      quote_number: string;
      status: string;
      snapshot_schema_version: number;
      tax_rule_version: string;
      tax_answer_snapshot: Record<string, unknown>;
      buyer_vat_number: string | null;
      calculated_deduction_ore: string;
      claim_deduction_ore: string;
      payable_ore: string;
      accepted_price_ore: string;
    };
    type ExistingLineState = {
      id: string;
      quote_version_id: string;
      row_type: string;
      label: string | null;
      line_net_ore: string;
      vat_rate_bp: number;
      included_in_invoice_total: boolean;
      deduction_classification: string;
      vat_type: string;
      is_hidden: boolean;
      is_optional: boolean;
      is_selected: boolean | null;
    };

    const readFootprint = async (): Promise<TenantWriteFootprint> => {
      const rows = await adminQuery<TenantWriteFootprint>(
        `select
           (select count(*)::text from public.quotes
             where tenant_id = $1) as quote_count,
           (select count(*)::text from public.quote_versions
             where tenant_id = $1) as version_count,
           (select count(*)::text from public.quote_version_lines
             where tenant_id = $1) as line_count,
           (select count(*)::text from public.quote_events
             where tenant_id = $1) as event_count,
           (select current_value::text from public.tenant_counters
             where tenant_id = $1 and counter_name = 'quote_number') as counter_value`,
        [fixture.tenantA.id],
      );
      expect(rows).toHaveLength(1);
      return rows[0]!;
    };

    const readExistingState = async () => {
      const versions = await adminQuery<ExistingVersionState>(
        `select id, quote_id, version_number::text, quote_number::text, status,
                snapshot_schema_version, tax_rule_version, tax_answer_snapshot,
                buyer_vat_number, calculated_deduction_ore::text,
                claim_deduction_ore::text, payable_ore::text, accepted_price_ore::text
           from public.quote_versions where id = $1`,
        [existing.versionId],
      );
      const lines = await adminQuery<ExistingLineState>(
        `select id, quote_version_id, row_type, label, line_net_ore::text, vat_rate_bp,
                included_in_invoice_total, deduction_classification, vat_type,
                is_hidden, is_optional, is_selected
           from public.quote_version_lines
          where quote_version_id = $1
          order by sort_order, id`,
        [existing.versionId],
      );
      expect(versions).toHaveLength(1);
      expect(lines).toHaveLength(1);
      return { version: versions[0]!, lines };
    };

    const beforeFootprint = await readFootprint();
    const beforeState = await readExistingState();

    const deniedInitial = await tenantBClient.rpc("create_quote_version_from_calculation", {
      p_tenant_id: fixture.tenantA.id,
      p_calculation_id: calculationId,
      p_captured_at: CAPTURED_AT,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: validSnapshot(),
      p_lines: [validLine()],
      p_attachments: [],
    });
    expect(deniedInitial.data).toBeNull();
    expect(deniedInitial.error).not.toBeNull();

    const deniedNewVersion = await tenantBClient.rpc("create_new_quote_version", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_id: existing.quoteId,
      p_calculation_id: calculationId,
      p_captured_at: CAPTURED_AT,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: validSnapshot(),
      p_lines: [validLine()],
      p_attachments: [],
      p_supersede_prior: true,
    });
    expect(deniedNewVersion.data).toBeNull();
    expect(deniedNewVersion.error).not.toBeNull();

    const afterFootprint = await readFootprint();
    const afterState = await readExistingState();
    expect(afterFootprint).toEqual(beforeFootprint);
    expect(afterState).toEqual(beforeState);
  });

  it("[10.6-INT-06][P0] historical V1 stays readable, cannot send, and can recover through a fresh V2", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await setCalculationTaxInput();
    const quote = await adminQuery<{ id: string }>(
      `insert into public.quotes (tenant_id, customer_id) values ($1, $2) returning id`,
      [fixture.tenantA.id, customerId],
    );
    // Simulate a row that predates this forward migration. New V1 inserts are
    // intentionally blocked by the INSERT guard, including privileged test writes.
    const version = await adminSession(async ({ query }) => {
      await query("begin");
      try {
        await query(`set local session_replication_role = 'replica'`);
        const rows = await query<{ id: string }>(
          `insert into public.quote_versions
             (tenant_id, quote_id, version_number, quote_number, status,
              calculation_id, captured_at, accepted_price_ore)
           values ($1, $2, 1, 999999, 'draft', $3, $4, 12500)
           returning id`,
          [fixture.tenantA.id, quote[0]!.id, calculationId, CAPTURED_AT],
        );
        await query("commit");
        return rows;
      } catch (error) {
        await query("rollback");
        throw error;
      }
    });

    const before = await adminQuery<{
      status: string;
      snapshot_schema_version: number | null;
      tax_answer_snapshot: unknown;
    }>(
      `select status, snapshot_schema_version, tax_answer_snapshot
         from public.quote_versions where id = $1`,
      [version[0]!.id],
    );
    expect(before[0]).toMatchObject({
      status: "draft",
      snapshot_schema_version: null,
      tax_answer_snapshot: null,
    });
    await expect(
      adminQuery(
        `update public.quote_versions set deduction_type = 'rot_and_green' where id = $1`,
        [version[0]!.id],
      ),
    ).rejects.toMatchObject({ code: "QV409" });
    await expect(
      adminQuery(`update public.quote_versions set intro_text = 'legacy presentation' where id = $1`, [
        version[0]!.id,
      ]),
    ).resolves.toBeDefined();
    await expect(
      adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [version[0]!.id]),
    ).rejects.toMatchObject({ code: "QV409" });

    const legacyBeforeRecovery = await adminQuery<{ frozen: Record<string, unknown> }>(
      `select to_jsonb(qv) as frozen from public.quote_versions qv where id = $1`,
      [version[0]!.id],
    );
    const inventory = await adminQuery<{ count: string }>(
      `select count(*)::text as count
         from public.quote_versions
        where tenant_id = $1
          and status = 'draft'
          and snapshot_schema_version is null`,
      [fixture.tenantA.id],
    );
    expect(Number(inventory[0]?.count)).toBeGreaterThanOrEqual(1);

    const recovered = await client.rpc("create_new_quote_version", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_id: quote[0]!.id,
      p_calculation_id: calculationId,
      p_captured_at: CAPTURED_AT,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: validSnapshot(),
      p_lines: [validLine()],
      p_attachments: [],
      p_supersede_prior: false,
    });
    expect(recovered.error).toBeNull();
    const recoveredRow = Array.isArray(recovered.data) ? recovered.data[0] : recovered.data;
    expect(recoveredRow && typeof recoveredRow === "object").toBe(true);
    const recoveredVersionId = String(
      (recoveredRow as Record<string, unknown>).quote_version_id,
    );

    const legacyAfterRecovery = await adminQuery<{ frozen: Record<string, unknown> }>(
      `select to_jsonb(qv) as frozen from public.quote_versions qv where id = $1`,
      [version[0]!.id],
    );
    expect(legacyAfterRecovery[0]?.frozen).toEqual(legacyBeforeRecovery[0]?.frozen);
    const recoveredState = await adminQuery<{
      status: string;
      snapshot_schema_version: number;
    }>(
      `select status, snapshot_schema_version
         from public.quote_versions
        where id = $1`,
      [recoveredVersionId],
    );
    expect(recoveredState[0]).toEqual({ status: "draft", snapshot_schema_version: 2 });
    await expect(
      adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [
        recoveredVersionId,
      ]),
    ).resolves.toBeDefined();
  });

  it("[10.6-INT-07][P0] draft→sent rejects co-mutation and locks child mutation/reparent", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const frozen = await createFreshV2();
    const other = await createFreshV2();
    const line = await adminQuery<{ id: string }>(
      `select id from public.quote_version_lines where quote_version_id = $1`,
      [frozen.versionId],
    );

    await expect(
      adminQuery(
        `update public.quote_versions
            set intro_text = 'Presentation remains editable',
                customer_notes = 'Visible note',
                valid_until = $2,
                display_mode = 'summary'
          where id = $1`,
        [frozen.versionId, "2026-09-01T00:00:00.000Z"],
      ),
    ).resolves.toBeDefined();
    await expect(
      adminQuery(`update public.quote_versions set pdf_status = 'generating' where id = $1`, [
        frozen.versionId,
      ]),
    ).resolves.toBeDefined();
    await expect(
      adminQuery(`update public.quote_versions set vat_total_ore = 2400 where id = $1`, [
        frozen.versionId,
      ]),
    ).rejects.toMatchObject({ code: "QV409" });
    await expect(
      adminQuery(`update public.quote_version_lines set label = 'draft tamper' where id = $1`, [
        line[0]!.id,
      ]),
    ).rejects.toMatchObject({ code: "QV409" });
    await expect(
      adminQuery(
        `update public.quote_version_lines set deduction_classification = 'ROT_LABOR' where id = $1`,
        [line[0]!.id],
      ),
    ).rejects.toMatchObject({ code: "QV409" });

    await expect(
      adminQuery(
        `update public.quote_versions
            set status = 'sent', customer_display_name = 'co-mutated'
          where id = $1`,
        [frozen.versionId],
      ),
    ).rejects.toMatchObject({ code: "QV409" });
    await adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [
      frozen.versionId,
    ]);

    await expect(
      adminQuery(
        `update public.quote_version_lines set deduction_classification = 'ROT_LABOR' where id = $1`,
        [line[0]!.id],
      ),
    ).rejects.toMatchObject({ code: "QV409" });
    await expect(
      adminQuery(
        `update public.quote_version_lines set quote_version_id = $2 where id = $1`,
        [line[0]!.id, other.versionId],
      ),
    ).rejects.toMatchObject({ code: "QV409" });
  });

  it("[10.6-INT-07A][P0] draft→sent validates frozen V2 facts, not mutable calculation input", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const frozen = await createFreshV2();
    const before = await adminQuery<{
      tax_answer_snapshot: Record<string, unknown>;
      line_count: string;
    }>(
      `select qv.tax_answer_snapshot,
              (select count(*)::text
                 from public.quote_version_lines qvl
                where qvl.quote_version_id = qv.id) as line_count
         from public.quote_versions qv
        where qv.id = $1`,
      [frozen.versionId],
    );

    try {
      await setCalculationTaxInput({
        ...validTaxInput(),
        documentVatType: "REVERSE_CHARGE_CONSTRUCTION",
        buyerVatNumber: "SE123456789012",
      });
      await expect(
        adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [
          frozen.versionId,
        ]),
      ).resolves.toBeDefined();
    } finally {
      await setCalculationTaxInput();
    }

    const after = await adminQuery<{
      status: string;
      tax_answer_snapshot: Record<string, unknown>;
      line_count: string;
    }>(
      `select qv.status, qv.tax_answer_snapshot,
              (select count(*)::text
                 from public.quote_version_lines qvl
                where qvl.quote_version_id = qv.id) as line_count
         from public.quote_versions qv
        where qv.id = $1`,
      [frozen.versionId],
    );
    expect(after[0]?.status).toBe("sent");
    expect(after[0]?.tax_answer_snapshot).toEqual(before[0]?.tax_answer_snapshot);
    expect(after[0]?.line_count).toBe(before[0]?.line_count);
  });

  it("[10.6-INT-07B][P0] direct inserts cannot skip draft or append V2 children after parent creation", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    await setCalculationTaxInput();
    const quote = await adminQuery<{ id: string }>(
      `insert into public.quotes (tenant_id, customer_id) values ($1, $2) returning id`,
      [fixture.tenantA.id, customerId],
    );
    const nextNumber = await adminQuery<{ quote_number: string }>(
      `select (coalesce(max(quote_number), 0) + 1000)::text as quote_number
         from public.quote_versions where tenant_id = $1`,
      [fixture.tenantA.id],
    );
    const insertParent = (status: "draft" | "sent") =>
      adminQuery<{ id: string }>(
        `insert into public.quote_versions (
           tenant_id, quote_id, version_number, quote_number, status,
           calculation_id, captured_at,
           customer_type,
           base_total_ore, option_total_ore, vat_total_ore,
           deduction_total_ore, accepted_price_ore,
           snapshot_schema_version, tax_rule_version, tax_answer_snapshot,
           buyer_vat_number, calculated_deduction_ore,
           claim_deduction_ore, payable_ore, deduction_type
         ) values (
           $1, $2, 1, $3, $4, $5, $6,
           'private',
           10000, 0, 2500, 0, 12500,
           2, $7, $8::jsonb, null, 0, 0, 12500, null
         ) returning id`,
        [
          fixture.tenantA.id,
          quote[0]!.id,
          nextNumber[0]!.quote_number,
          status,
          calculationId,
          CAPTURED_AT,
          POLICY_ID,
          JSON.stringify(validTaxAnswer()),
        ],
      );

    await expect(insertParent("sent")).rejects.toMatchObject({ code: "QV409" });
    const direct = await insertParent("draft");
    await expect(
      adminQuery(
        `insert into public.quote_version_lines (
           tenant_id, quote_version_id, row_type, sort_order, label,
           quantity, unit, unit_sell_ore, line_net_ore, vat_rate_bp,
           included_in_invoice_total, deduction_classification, vat_type,
           is_hidden, is_optional, is_selected
         ) values (
           $1, $2, 'labor', 0, 'null-rate tamper',
           1, 'st', 10000, 10000, null,
           true, 'NONE', 'STANDARD_VAT_25', false, false, null
         )`,
        [fixture.tenantA.id, direct[0]!.id],
      ),
    ).rejects.toMatchObject({ code: "QV409" });
    await expect(
      adminQuery(
        `insert into public.quote_version_lines (
           tenant_id, quote_version_id, row_type, sort_order, label,
           quantity, unit, unit_sell_ore, line_net_ore, vat_rate_bp,
           included_in_invoice_total, deduction_classification, vat_type,
           is_hidden, is_optional, is_selected
         ) values (
           $1, $2, 'labor', 0, 'late append',
           1, 'st', 10000, 10000, 2500,
           true, 'NONE', 'STANDARD_VAT_25', false, false, null
         )`,
        [fixture.tenantA.id, direct[0]!.id],
      ),
    ).rejects.toMatchObject({ code: "QV409" });
    const after = await adminQuery<{ status: string }>(
      `select status from public.quote_versions where id = $1`,
      [direct[0]!.id],
    );
    expect(after[0]?.status).toBe("draft");
  });

  it("[10.6-INT-08][P0] child writes serialize behind an in-flight send and reject after freeze", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const created = await createFreshV2();
    const line = await adminQuery<{ id: string }>(
      `select id from public.quote_version_lines where quote_version_id = $1`,
      [created.versionId],
    );

    let signalParentLocked!: () => void;
    let releaseParent!: () => void;
    const parentLocked = new Promise<void>((resolveLocked) => {
      signalParentLocked = resolveLocked;
    });
    const parentRelease = new Promise<void>((resolveRelease) => {
      releaseParent = resolveRelease;
    });

    const parentTx = adminSession(async ({ query }) => {
      await query("begin");
      try {
        await query(`update public.quote_versions set status = 'sent' where id = $1`, [
          created.versionId,
        ]);
        signalParentLocked();
        await parentRelease;
        await query("commit");
      } catch (error) {
        await query("rollback");
        throw error;
      }
    });
    await parentLocked;

    let signalChildPid!: (pid: number) => void;
    const childPidReady = new Promise<number>((resolvePid) => {
      signalChildPid = resolvePid;
    });
    const childAttempt = adminSession(async ({ query }) => {
      const pid = await query<{ pid: number }>(`select pg_backend_pid() as pid`);
      signalChildPid(pid[0]!.pid);
      await query(`update public.quote_version_lines set label = 'race' where id = $1`, [
        line[0]!.id,
      ]);
    }).then(
      () => ({ ok: true as const, error: null }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    const childPid = await childPidReady;

    let observedParentWait = false;
    try {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const activity = await adminQuery<{ wait_event_type: string | null }>(
          `select wait_event_type from pg_stat_activity where pid = $1`,
          [childPid],
        );
        if (activity[0]?.wait_event_type === "Lock") {
          observedParentWait = true;
          break;
        }
        const finished = await Promise.race([
          childAttempt.then(() => true),
          new Promise<false>((resolveDelay) => setTimeout(() => resolveDelay(false), 10)),
        ]);
        if (finished) break;
      }
      expect(observedParentWait, "child trigger must wait on the parent row lock").toBe(true);
    } finally {
      releaseParent();
      await parentTx;
    }

    const childResult = await childAttempt;
    expect(childResult.ok).toBe(false);
    expect(errorCode(childResult.error)).toBe("QV409");
  }, 10_000);

  it("[10.6-INT-09][P0] acceptance source total must equal frozen V2 payable", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const created = await createFreshV2();
    await adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [
      created.versionId,
    ]);

    await expect(
      adminQuery(
        `insert into public.quote_acceptances
           (tenant_id, quote_id, quote_version_id, accepted_at,
            accepted_price_ore, source_sent_total_ore, adjustment_reason)
         values ($1, $2, $3, $4, 12000, 12400, 'Test adjustment')`,
        [fixture.tenantA.id, created.quoteId, created.versionId, CAPTURED_AT],
      ),
    ).rejects.toMatchObject({ code: "QV409" });

    await expect(
      adminQuery(
        `insert into public.quote_acceptances
           (tenant_id, quote_id, quote_version_id, accepted_at,
            accepted_price_ore, source_sent_total_ore, adjustment_reason)
         values ($1, $2, $3, $4, 12000, 12500, 'Test adjustment')`,
        [fixture.tenantA.id, created.quoteId, created.versionId, CAPTURED_AT],
      ),
    ).resolves.toBeDefined();

    await adminQuery(`update public.quote_versions set status = 'accepted' where id = $1`, [
      created.versionId,
    ]);
    const acceptedSuccessor = await client.rpc("create_new_quote_version", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_id: created.quoteId,
      p_calculation_id: calculationId,
      p_captured_at: CAPTURED_AT,
      p_customer_id: customerId,
      p_facility_id: null,
      p_contact_id: null,
      p_snapshot: validSnapshot(),
      p_lines: [validLine()],
      p_attachments: [],
      p_supersede_prior: true,
    });
    expect(acceptedSuccessor.error?.code).toBe("QV409");
  });
});
