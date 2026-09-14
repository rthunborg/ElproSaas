import { adminQuery, adminSession } from "../admin-sql";
import { rethrowWithCode } from "./core";
import { story106FixtureTaxInput } from "./calculations";
export interface TenantCounterSeed {
  readonly tenant_id: string;
  readonly counter_name?: string;
  readonly current_value?: number;
}

/** A seed for a `quotes` row (parent customer must exist, same tenant). */
export interface QuoteSeed {
  readonly tenant_id: string;
  readonly customer_id: string;
  readonly facility_id?: string | null;
  readonly contact_id?: string | null;
}

/** A seed for a `quote_versions` row (parent quote + source calc required, same tenant). */
export interface QuoteVersionSeed {
  readonly tenant_id: string;
  readonly quote_id: string;
  readonly calculation_id: string;
  readonly version_number?: number;
  readonly quote_number?: number;
  readonly captured_at?: string;
  readonly company_name?: string | null;
  /**
   * The frozen customer-commitment gross (Story 6.1) — the SOURCE SENT TOTAL a Story 7.1
   * acceptance measures its adjusted-price delta against. Integer öre; defaults to 0 at the DB.
   */
  readonly accepted_price_ore?: number;
  /** Lifecycle status (Story 6.2) — defaults to 'draft' at the DB. */
  readonly status?: string;
  /** A customer-visible presentational field (Story 6.2 draft-edit readback proof). */
  readonly intro_text?: string | null;
  readonly customer_display_name?: string | null;
  /** PDF render state (Story 6.3) — defaults to 'not_generated' at the DB. */
  readonly pdf_status?: string;
  /** The generated-PDF file reference (Story 6.3) — for a `generated` fixture state. */
  readonly pdf_file_id?: string | null;
  /** The PDF generated-at instant (Story 6.3) — for a `generated` fixture state. */
  readonly pdf_generated_at?: string | null;
  /**
   * The frozen readiness warnings snapshot (Story 6.4 send-gate proof) — a jsonb array of the
   * 5.4 classifier codes+severities. Seed a `severity: "blocker"` entry to prove a blocked draft
   * is UNSENDABLE. Defaults to `[]` at the DB.
   */
  readonly warnings_snapshot?: readonly {
    readonly code: string;
    readonly severity: string;
    readonly message: string;
  }[];
}

/** A seed for a `quote_version_lines` row (parent version required, same tenant). */
export interface QuoteVersionLineSeed {
  readonly tenant_id: string;
  readonly quote_version_id: string;
  readonly row_type?: string;
  readonly label?: string | null;
  readonly quantity?: number | null;
  readonly unit?: string | null;
  readonly unit_sell_ore?: number | null;
  /** Frozen line net used by Story 10.6 reconciliation; defaults to `unit_sell_ore`. */
  readonly line_net_ore?: number | null;
  readonly vat_rate_bp?: number | null;
  /** Economic inclusion is explicit in V2; fixture-only display rows default to excluded. */
  readonly included_in_invoice_total?: boolean;
  readonly deduction_classification?: string;
  readonly vat_type?: string;
  readonly sort_order?: number;
  readonly source_calculation_row_id?: string | null;
}

/** A seed for a `quote_version_attachments` row (parent version + file required, same tenant). */
export interface QuoteVersionAttachmentSeed {
  readonly tenant_id: string;
  readonly quote_version_id: string;
  readonly file_id: string;
  readonly display_name?: string | null;
  readonly sort_order?: number;
}

/** A seed for a `quote_events` row (parent quote required, same tenant). */
export interface QuoteEventSeed {
  readonly tenant_id: string;
  readonly quote_id: string;
  readonly quote_version_id?: string | null;
  readonly event_type?: string;
  /**
   * The lifecycle instant (timestamptz ISO). Defaults to the DB `now()` when omitted. Supply an
   * EXPLICIT in-window value where a period-scoped read (Story 10.4 pipeline read-model) must be
   * deterministic — otherwise a run outside the test's window silently drops the seeded event.
   */
  readonly occurred_at?: string | null;
}

/** Seed ONE `tenant_counters` row via the privileged superuser pg path (BYPASSRLS). */
export async function adminInsertTenantCounter(
  seed: TenantCounterSeed,
): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.tenant_counters (tenant_id, counter_name, current_value)
       values ($1, $2, $3)
       returning id`,
      [seed.tenant_id, seed.counter_name ?? "quote_number", seed.current_value ?? 0],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertTenantCounter: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/** Seed ONE `quotes` row via the privileged superuser pg path (BYPASSRLS). */
export async function adminInsertQuote(seed: QuoteSeed): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.quotes (tenant_id, customer_id, facility_id, contact_id)
       values ($1, $2, $3, $4)
       returning id`,
      [seed.tenant_id, seed.customer_id, seed.facility_id ?? null, seed.contact_id ?? null],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertQuote: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Seed a quote child artifact through a test-only, superuser-only, transaction-local trigger
 * bypass. This is reserved for arranging frozen fixture state (including an already-terminal
 * parent); application code can never reach it and every table CHECK still applies.
 */
async function adminInsertQuoteArtifactWithTriggerBypass(
  sql: string,
  params: readonly unknown[],
  label: string,
): Promise<string> {
  return adminSession(async ({ query }) => {
    await query("begin");
    try {
      await query("set local session_replication_role = replica");
      const rows = await query<{ id: string }>(sql, params);
      const id = rows[0]?.id;
      if (!id) throw new Error(`${label}: no id returned`);
      await query("commit");
      return id;
    } catch (error) {
      await query("rollback");
      throw error;
    }
  });
}

const STORY_10_6_FIXTURE_POLICY_ID = "SE-TAX-2026-v1";
const STORY_10_6_FIXTURE_CLASSIFICATIONS = [
  "NONE",
  "ROT_LABOR",
  "GREEN_SOLAR_LABOR",
  "GREEN_SOLAR_MATERIAL",
  "GREEN_STORAGE_LABOR",
  "GREEN_STORAGE_MATERIAL",
  "GREEN_CHARGING_LABOR",
  "GREEN_CHARGING_MATERIAL",
] as const;

type Story106FixtureCustomerPosture = "private" | "company" | "brf" | "public";

interface Story106FixtureLostReason {
  readonly outcome: string;
  readonly category: string;
  readonly note: string | null;
}

interface Story106FixtureTaxState {
  readonly capturedAt: string;
  readonly customerPosture: Story106FixtureCustomerPosture;
  readonly baseTotalOre: number;
  readonly vatTotalOre: number;
  readonly payableOre: number;
  readonly lineVatRateBp: number | null;
  readonly lineVatType: string | null;
  readonly taxInput: Record<string, unknown>;
  readonly taxAnswer: Record<string, unknown>;
}

function story106FixtureZeroClassifications(): Record<string, number> {
  return Object.fromEntries(
    STORY_10_6_FIXTURE_CLASSIFICATIONS.map((classification) => [classification, 0]),
  );
}

function story106FixturePolicy(resolvingDate: string): Record<string, unknown> {
  return {
    id: STORY_10_6_FIXTURE_POLICY_ID,
    validFrom: "2026-01-01",
    validTo: "2027-01-01",
    resolvingDate,
    resolvingFact: "QUOTE_CAPTURE_DATE",
    values: {
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
    },
  };
}

/**
 * Build a deliberately small but fully reconciled Story 10.6 V2 tax snapshot for shared
 * integration fixtures. Non-zero customer payables use 25% VAT when the gross can be represented
 * exactly; uncommon remainder values fall back to a canonical zero-rated category rather than
 * inventing or rounding away money. The fixture never exercises deductions.
 */
function buildStory106FixtureTaxState(
  seed: QuoteVersionSeed,
  customerPosture: Story106FixtureCustomerPosture,
): Story106FixtureTaxState {
  const capturedAt = seed.captured_at ?? "2026-07-05T12:00:00.000Z";
  const parsedCapture = new Date(capturedAt);
  if (Number.isNaN(parsedCapture.valueOf())) {
    throw new Error("adminInsertQuoteVersion: captured_at must be a valid timestamp");
  }
  const resolvingDate = parsedCapture.toISOString().slice(0, 10);
  if (resolvingDate < "2026-01-01" || resolvingDate >= "2027-01-01") {
    throw new Error("adminInsertQuoteVersion: V2 fixture capture must resolve inside 2026 policy");
  }

  const payableOre = seed.accepted_price_ore ?? 0;
  if (!Number.isSafeInteger(payableOre) || payableOre < 0) {
    throw new Error("adminInsertQuoteVersion: accepted_price_ore must be non-negative safe öre");
  }

  const canUseStandardVat = payableOre > 0 && payableOre % 5 === 0;
  const baseTotalOre = canUseStandardVat ? (payableOre / 5) * 4 : payableOre;
  const vatTotalOre = payableOre - baseTotalOre;
  const lineVatRateBp = payableOre === 0 ? null : canUseStandardVat ? 2500 : 0;
  const lineVatType =
    payableOre === 0 ? null : canUseStandardVat ? "STANDARD_VAT_25" : "ZERO_RATED";
  const zeroClassifications = story106FixtureZeroClassifications();
  const categories =
    payableOre === 0
      ? []
      : [
          {
            vatType: lineVatType,
            rateBp: lineVatRateBp,
            netOre: baseTotalOre,
            vatOre: vatTotalOre,
            grossOre: payableOre,
          },
        ];

  const taxInput = story106FixtureTaxInput();
  const taxAnswer = {
    schemaVersion: 2,
    taxRuleVersions: [STORY_10_6_FIXTURE_POLICY_ID],
    vatPolicy: story106FixturePolicy(resolvingDate),
    customerEligibilityPosture: customerPosture,
    documentVatType: "STANDARD_VAT_25",
    buyerVatNumber: null,
    reverseChargeApplied: false,
    deductionChoice: "NONE",
    categories,
    netByDeductionClassification: { ...zeroClassifications, NONE: baseTotalOre },
    vatByDeductionClassification: { ...zeroClassifications, NONE: vatTotalOre },
    summaries: {
      labor: { netOre: 0, vatOre: 0, grossOre: 0 },
      material: { netOre: 0, vatOre: 0, grossOre: 0 },
      other: { netOre: baseTotalOre, vatOre: vatTotalOre, grossOre: payableOre },
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
      fixedPriceRowIds: null,
      fixedPriceOre: null,
      fixedPriceCategorySplitOre: null,
      categories: {
        SOLAR: { category: "SOLAR", basisOre: 0, calculatedOre: 0, claimOre: 0 },
        STORAGE: { category: "STORAGE", basisOre: 0, calculatedOre: 0, claimOre: 0 },
        CHARGING: { category: "CHARGING", basisOre: 0, calculatedOre: 0, claimOre: 0 },
      },
      calculatedOre: 0,
      claimOre: 0,
      allocations: [],
    },
    netOre: baseTotalOre,
    vatOre: vatTotalOre,
    grossOre: payableOre,
    calculatedDeductionOre: 0,
    claimDeductionOre: 0,
    deductionOre: 0,
    payableOre,
  };

  return {
    capturedAt,
    customerPosture,
    baseTotalOre,
    vatTotalOre,
    payableOre,
    lineVatRateBp,
    lineVatType,
    taxInput,
    taxAnswer,
  };
}

/**
 * Seed a complete V2 quote version, plus the one economic line needed to reconcile a non-zero
 * payable. The transaction-local replica role remains narrowly test-only so callers can seed a
 * historical lifecycle status directly; all V2 CHECK constraints still run, and the constructed
 * parent/line pair is the same shape the production send guard validates.
 */
export async function adminInsertStory106QuoteVersion(
  seed: QuoteVersionSeed,
  lostReason?: Story106FixtureLostReason,
): Promise<{ quoteVersionId: string; lostReasonId: string | null }> {
  return adminSession(async ({ query }) => {
    await query("begin");
    try {
      const sources = await query<{ customer_type: string }>(
        `select customer.customer_type
           from public.calculations calculation
           join public.customers customer
             on customer.id = calculation.customer_id
            and customer.tenant_id = calculation.tenant_id
          where calculation.id = $1
            and calculation.tenant_id = $2`,
        [seed.calculation_id, seed.tenant_id],
      );
      const customerPosture = sources[0]?.customer_type;
      if (
        customerPosture !== "private" &&
        customerPosture !== "company" &&
        customerPosture !== "brf" &&
        customerPosture !== "public"
      ) {
        throw new Error("adminInsertQuoteVersion: no canonical source customer posture");
      }
      const tax = buildStory106FixtureTaxState(seed, customerPosture);
      let sourceCalculationRowId: string | null = null;
      if (tax.payableOre > 0) {
        const existingSourceRows = await query<{ id: string }>(
          `select row.id
             from public.calculation_rows row
             join public.calculation_sections section
               on section.id = row.section_id
              and section.tenant_id = row.tenant_id
            where section.calculation_id = $1
              and row.tenant_id = $2
              and row.archived_at is null
              and section.archived_at is null
            order by section.sort_order, section.id, row.sort_order, row.id
            limit 1`,
          [seed.calculation_id, seed.tenant_id],
        );
        sourceCalculationRowId = existingSourceRows[0]?.id ?? null;
        if (sourceCalculationRowId === null) {
          const sections = await query<{ id: string }>(
            `insert into public.calculation_sections
               (tenant_id, calculation_id, title, display_mode, sort_order)
             values ($1, $2, 'Story 10.6 fixture source', 'detailed', 2147483647)
             returning id`,
            [seed.tenant_id, seed.calculation_id],
          );
          const sectionId = sections[0]?.id;
          if (!sectionId || tax.lineVatRateBp === null || tax.lineVatType === null) {
            throw new Error("adminInsertQuoteVersion: could not create canonical source section");
          }
          const sourceRows = await query<{ id: string }>(
            `insert into public.calculation_rows
               (tenant_id, section_id, row_type, quantity, unit, unit_sell_ore,
                vat_rate_bp, included_in_invoice_total, deduction_classification,
                vat_type, is_hidden, is_optional, is_selected, label, sort_order)
             values ($1, $2, 'other', 1, 'st', $3, $4, true, 'NONE',
                     $5, false, false, null, 'Story 10.6 fixture total', 2147483647)
             returning id`,
            [
              seed.tenant_id,
              sectionId,
              tax.baseTotalOre,
              tax.lineVatRateBp,
              tax.lineVatType,
            ],
          );
          sourceCalculationRowId = sourceRows[0]?.id ?? null;
          if (sourceCalculationRowId === null) {
            throw new Error("adminInsertQuoteVersion: could not create canonical source row");
          }
        }
      }

      // A later fresh-version command must be able to recapture from this source calculation.
      // Preserve any test-authored tax input; only legacy/null calculations receive the canonical
      // deduction-free fixture input.
      await query(
        `update public.calculations
            set tax_input_snapshot = coalesce(tax_input_snapshot, $3::jsonb)
          where id = $1 and tenant_id = $2`,
        [seed.calculation_id, seed.tenant_id, JSON.stringify(tax.taxInput)],
      );

      await query("set local session_replication_role = replica");
      const versions = await query<{ id: string }>(
        `insert into public.quote_versions
           (tenant_id, quote_id, version_number, quote_number, calculation_id,
            captured_at, company_name, status, intro_text, customer_display_name, customer_type,
            pdf_status, pdf_file_id, pdf_generated_at, warnings_snapshot,
            base_total_ore, option_total_ore, vat_total_ore, deduction_total_ore,
            accepted_price_ore, vat_rate_bp, vat_display, deduction_type, requires_sign_off,
            snapshot_schema_version, tax_rule_version, tax_answer_snapshot, buyer_vat_number,
            calculated_deduction_ore, claim_deduction_ore, payable_ore)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                 $12, $13, $14, $15::jsonb,
                 $16, 0, $17, 0, $18, $19, 'fixture_v2', null, true,
                 2, $20, $21::jsonb, null, 0, 0, $22)
         returning id`,
        [
          seed.tenant_id,
          seed.quote_id,
          seed.version_number ?? 1,
          seed.quote_number ?? 1,
          seed.calculation_id,
          tax.capturedAt,
          seed.company_name ?? "tenant-b-company-seed",
          seed.status ?? "draft",
          seed.intro_text ?? null,
          seed.customer_display_name ?? null,
          tax.customerPosture,
          seed.pdf_status ?? "not_generated",
          seed.pdf_file_id ?? null,
          seed.pdf_generated_at ?? null,
          JSON.stringify(seed.warnings_snapshot ?? []),
          tax.baseTotalOre,
          tax.vatTotalOre,
          tax.payableOre,
          tax.lineVatRateBp,
          STORY_10_6_FIXTURE_POLICY_ID,
          JSON.stringify(tax.taxAnswer),
          tax.payableOre,
        ],
      );
      const quoteVersionId = versions[0]?.id;
      if (!quoteVersionId) throw new Error("adminInsertQuoteVersion: no id returned");

      if (tax.payableOre > 0 && tax.lineVatRateBp !== null && tax.lineVatType !== null) {
        await query(
          `insert into public.quote_version_lines
             (tenant_id, quote_version_id, row_type, sort_order, label, quantity, unit,
              unit_sell_ore, line_net_ore, vat_rate_bp, is_hidden, is_optional, is_selected,
              included_in_invoice_total, deduction_classification, vat_type,
              source_calculation_row_id)
           values ($1, $2, 'line', 2147483647, 'Story 10.6 fixture total', 1, 'st',
                   $3, $3, $4, false, false, null, true, 'NONE', $5, $6)`,
          [
            seed.tenant_id,
            quoteVersionId,
            tax.baseTotalOre,
            tax.lineVatRateBp,
            tax.lineVatType,
            sourceCalculationRowId,
          ],
        );
      }

      let lostReasonId: string | null = null;
      if (lostReason) {
        const reasons = await query<{ id: string }>(
          `insert into public.quote_lost_reasons
             (tenant_id, quote_id, quote_version_id, outcome, category, note)
           values ($1, $2, $3, $4, $5, $6)
           returning id`,
          [
            seed.tenant_id,
            seed.quote_id,
            quoteVersionId,
            lostReason.outcome,
            lostReason.category,
            lostReason.note,
          ],
        );
        lostReasonId = reasons[0]?.id ?? null;
        if (!lostReasonId) {
          throw new Error("adminInsertLostQuoteVersionWithReason: no reason id returned");
        }
      }

      await query("commit");
      return { quoteVersionId, lostReasonId };
    } catch (error) {
      await query("rollback");
      throw error;
    }
  });
}

/** Seed ONE complete, internally reconciled Story 10.6 V2 `quote_versions` fixture. */
export async function adminInsertQuoteVersion(
  seed: QuoteVersionSeed,
): Promise<string> {
  try {
    const inserted = await adminInsertStory106QuoteVersion(seed);
    return inserted.quoteVersionId;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/** Seed ONE complete V2 line through the tightly scoped test-only trigger bypass. */
export async function adminInsertQuoteVersionLine(
  seed: QuoteVersionLineSeed,
): Promise<string> {
  try {
    const unitSellOre = seed.unit_sell_ore ?? 85000;
    const lineNetOre = seed.line_net_ore ?? unitSellOre ?? 0;
    const vatRateBp = seed.vat_rate_bp ?? 2500;
    const vatType =
      seed.vat_type ??
      (vatRateBp === 2500
        ? "STANDARD_VAT_25"
        : vatRateBp === 1200 || vatRateBp === 600
          ? "REDUCED_VAT"
          : vatRateBp === 0
            ? "ZERO_RATED"
            : null);
    if (vatType === null) {
      throw new Error("adminInsertQuoteVersionLine: vat_rate_bp needs a canonical V2 VAT type");
    }
    let sourceCalculationRowId = seed.source_calculation_row_id ?? null;
    if (sourceCalculationRowId === null) {
      const sourceRows = await adminQuery<{ id: string }>(
        `select calculation_row.id
           from public.quote_versions quote_version
           join public.calculation_sections section
             on section.calculation_id = quote_version.calculation_id
            and section.tenant_id = quote_version.tenant_id
           join public.calculation_rows calculation_row
             on calculation_row.section_id = section.id
            and calculation_row.tenant_id = section.tenant_id
          where quote_version.id = $1
            and calculation_row.archived_at is null
            and section.archived_at is null
          order by section.sort_order, section.id,
                   calculation_row.sort_order, calculation_row.id
          limit 1`,
        [seed.quote_version_id],
      );
      sourceCalculationRowId = sourceRows[0]?.id ?? null;
    }
    return await adminInsertQuoteArtifactWithTriggerBypass(
      `insert into public.quote_version_lines
         (tenant_id, quote_version_id, row_type, label, quantity, unit,
          unit_sell_ore, line_net_ore, vat_rate_bp, included_in_invoice_total,
          deduction_classification, vat_type, sort_order, source_calculation_row_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       returning id`,
      [
        seed.tenant_id,
        seed.quote_version_id,
        seed.row_type ?? "line",
        seed.label ?? "tenant-b-line-seed",
        seed.quantity ?? null,
        seed.unit ?? null,
        unitSellOre,
        lineNetOre,
        vatRateBp,
        seed.included_in_invoice_total ?? false,
        seed.deduction_classification ?? "NONE",
        vatType,
        seed.sort_order ?? 0,
        sourceCalculationRowId,
      ],
      "adminInsertQuoteVersionLine",
    );
  } catch (error) {
    rethrowWithCode(error);
  }
}

/** Seed ONE frozen attachment through the tightly scoped test-only trigger bypass. */
export async function adminInsertQuoteVersionAttachment(
  seed: QuoteVersionAttachmentSeed,
): Promise<string> {
  try {
    return await adminInsertQuoteArtifactWithTriggerBypass(
      `insert into public.quote_version_attachments
         (tenant_id, quote_version_id, file_id, display_name, sort_order)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [
        seed.tenant_id,
        seed.quote_version_id,
        seed.file_id,
        seed.display_name ?? "tenant-b-attachment-seed.pdf",
        seed.sort_order ?? 0,
      ],
      "adminInsertQuoteVersionAttachment",
    );
  } catch (error) {
    rethrowWithCode(error);
  }
}

/** Seed ONE `quote_events` row via the privileged superuser pg path (BYPASSRLS). */
export async function adminInsertQuoteEvent(
  seed: QuoteEventSeed,
): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.quote_events
         (tenant_id, quote_id, quote_version_id, event_type, occurred_at)
       values ($1, $2, $3, $4, coalesce($5::timestamptz, now()))
       returning id`,
      [
        seed.tenant_id,
        seed.quote_id,
        seed.quote_version_id ?? null,
        seed.event_type ?? "created",
        seed.occurred_at ?? null,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertQuoteEvent: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Read ONE quote-table row's label column back via the privileged superuser pg path
 * (BYPASSRLS), independent of the app/RLS path. Used by the cross-tenant UPDATE negative
 * to prove the foreign row is UNCHANGED. `table`/`labelColumn` are a closed/inventory-
 * supplied set (never client input). Returns `null` if the row does not exist.
 */
export async function adminSelectQuoteLabel(
  table:
    | "tenant_counters"
    | "quotes"
    | "quote_versions"
    | "quote_version_lines"
    | "quote_version_attachments"
    | "quote_events"
    | "quote_follow_ups",
  labelColumn: string,
  id: string,
): Promise<{ id: string; label: string | null } | null> {
  const rows = await adminQuery<{ id: string; label: string | null }>(
    `select id, ${labelColumn}::text as label from public.${table} where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Read a quote_versions row's full snapshot columns back (BYPASSRLS) for freeze proofs. */
export async function adminSelectQuoteVersionRow(
  id: string,
): Promise<Record<string, unknown> | null> {
  const rows = await adminQuery<Record<string, unknown>>(
    `select * from public.quote_versions where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Flip a quote_versions row's `status` via the privileged superuser pg path (BYPASSRLS). The 6.5
 * fixtures seed a SENT version as draft → children → THEN flip to sent (the 6.4 child-lock blocks
 * child INSERTs into an already-sent parent). BYPASSRLS bypasses the sent-lock trigger's app-path
 * enforcement for seeding, so a draft→sent flip after the children exist is safe. Additive (B1).
 */
export async function adminUpdateQuoteVersionStatus(
  id: string,
  status: string,
): Promise<void> {
  await adminQuery(`update public.quote_versions set status = $2 where id = $1`, [
    id,
    status,
  ]);
}

/** Read all quote_versions rows for a quote back (BYPASSRLS, ordered by version_number). */
export async function adminSelectQuoteVersionsForQuote(
  quoteId: string,
): Promise<Record<string, unknown>[]> {
  return adminQuery<Record<string, unknown>>(
    `select * from public.quote_versions where quote_id = $1 order by version_number asc`,
    [quoteId],
  );
}

/** Read a quote_versions row's attachment rows back (BYPASSRLS, ordered) for freeze proofs. */
export async function adminSelectQuoteVersionAttachments(
  quoteVersionId: string,
): Promise<Record<string, unknown>[]> {
  return adminQuery<Record<string, unknown>>(
    `select * from public.quote_version_attachments
       where quote_version_id = $1 order by sort_order asc`,
    [quoteVersionId],
  );
}

/** Read a quote_versions' line rows back (BYPASSRLS, ordered) for freeze proofs. */
export async function adminSelectQuoteVersionLines(
  quoteVersionId: string,
): Promise<Record<string, unknown>[]> {
  return adminQuery<Record<string, unknown>>(
    `select * from public.quote_version_lines
       where quote_version_id = $1 order by sort_order asc`,
    [quoteVersionId],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Acceptance/job seed/read helpers (Story 7.1) — ADDITIVE (B1: add ALONGSIDE the
// existing handles; the two-tenant fixture shape is unchanged).
//
// Seed REAL quote_acceptances/jobs/job_events rows via the loopback-gated superuser
// `pg` pool (BYPASSRLS) so the cross-tenant/anon negatives can target a CONCRETE
// Tenant B commitment row (never a non-existent id that would deny vacuously), and so
// the job/job_event spoof INSERTs have a real Tenant B parent to reference. Mirror
// `adminInsertQuote`: THROW on a DB error with the Postgres `code` preserved.
//
// Acceptance/job tables are `tenant_id … on delete cascade`, so the EXISTING
// `cleanupFixture` tenant-delete cascades the seeded rows away — no new teardown path.
//
// Acceptance/job fixtures carry METADATA/DISPLAY SHAPE only — anonymized names, integer
// öre, NO PII (no real name/address/personnummer/orgnr/secret). Öre values are kept
// under the 10-digit orgnr-scan boundary (R-717).
// ─────────────────────────────────────────────────────────────────────────────

/** A seed for a `quote_acceptances` row (parent quote + accepted version required, same tenant). */
