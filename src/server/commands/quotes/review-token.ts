import { createHash, timingSafeEqual } from "node:crypto";

import {
  TAX_POLICY_REGISTRY,
  parseTaxInputSnapshot,
  resolveTaxPolicy,
} from "@/lib/money";

/**
 * Semantic source reviewed before quote creation. It contains no personnummer/internal notes.
 * Customer-visible frozen semantics and the internal cost/source facts that affect readiness
 * warnings are hashed; the latter are never copied into or rendered from the frozen quote.
 */
export interface QuoteReviewSource {
  readonly quoteCaptureDate: string;
  readonly calculation: Readonly<{
    id: string;
    status: string;
    customerId: string;
    facilityId: string | null;
    contactId: string | null;
    taxInput: unknown;
  }>;
  readonly sections: readonly Readonly<{
    id: string;
    title: string | null;
    displayMode: string;
    sortOrder: number;
  }>[];
  readonly rows: readonly Readonly<{
    id: string;
    sectionId: string;
    rowType: string;
    quantity: number;
    unit: string;
    /** Warning-affecting internal facts are reviewed but never frozen/rendered. */
    unitCostOre: number | null;
    sourceKind: string | null;
    unitSellOre: number | null;
    vatRateBp: number | null;
    includedInInvoiceTotal: boolean;
    deductionClassification: string;
    vatType: string | null;
    isHidden: boolean;
    isOptional: boolean;
    isSelected: boolean | null;
    label: string | null;
    description: string | null;
    quoteNote: string | null;
    sortOrder: number;
  }>[];
  readonly customer: Readonly<{
    displayName: string | null;
    customerType: string | null;
    facilityName: string | null;
    contactName: string | null;
  }>;
  readonly company: Readonly<{
    companyName: string | null;
    orgNr: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    postalCode: string | null;
    city: string | null;
    email: string | null;
    phone: string | null;
    logoUrl: string | null;
    defaultVatDisplay: string | null;
    vatRateBp: number | null;
  }> | null;
  readonly terms: Readonly<{
    text: string | null;
    approvedAt: string | null;
    approvedBy: string | null;
  }> | null;
  readonly attachments: readonly Readonly<{
    fileId: string;
    displayName: string | null;
    sortOrder: number;
  }>[];
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(",")}}`;
}

function applicableTaxPolicyDigestFacts(quoteCaptureDate: string): unknown {
  const resolved = resolveTaxPolicy({
    registry: TAX_POLICY_REGISTRY,
    effectiveDate: quoteCaptureDate,
  });
  return resolved.ok
    ? resolved.value
    : { unresolved: true, code: resolved.code, effectiveDate: quoteCaptureDate };
}

function resolvedTaxPolicyDigestFacts(source: QuoteReviewSource): unknown {
  const parsed = parseTaxInputSnapshot(source.calculation.taxInput);
  if (!parsed.ok) {
    return {
      quoteCapture: applicableTaxPolicyDigestFacts(source.quoteCaptureDate),
      taxInputUnresolved: parsed.code,
    };
  }
  const choice = parsed.value.deductionChoice;
  const usesRot = choice === "ROT" || choice === "ROT_AND_GREEN";
  const usesGreen = choice === "GREEN" || choice === "ROT_AND_GREEN";
  return {
    quoteCapture: applicableTaxPolicyDigestFacts(source.quoteCaptureDate),
    rotPayment: usesRot && parsed.value.paymentDate !== null
      ? applicableTaxPolicyDigestFacts(parsed.value.paymentDate)
      : null,
    greenFinalPayment: usesGreen && parsed.value.finalPaymentDate !== null
      ? applicableTaxPolicyDigestFacts(parsed.value.finalPaymentDate)
      : null,
  };
}

/**
 * Client/UI stale-preview detector only. This unkeyed digest is not an authority and
 * is never trusted by PostgreSQL; the attributable authority is the one-time UUID
 * issued after the database validates and persists the exact canonical payload.
 */
export function buildQuoteReviewDigest(source: QuoteReviewSource): string {
  const sections = [...source.sections].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
  );
  const sectionOrder = new Map(sections.map((section, index) => [section.id, index]));
  const sortedRows = [...source.rows].sort((left, right) =>
    (sectionOrder.get(left.sectionId) ?? Number.MAX_SAFE_INTEGER) -
      (sectionOrder.get(right.sectionId) ?? Number.MAX_SAFE_INTEGER) ||
    left.sortOrder - right.sortOrder ||
    left.id.localeCompare(right.id));
  const rows = sortedRows.map((row) => ({
    id: row.id,
    sectionId: row.sectionId,
    rowType: row.rowType,
    quantity: row.quantity,
    unit: row.unit,
    unitCostOre: row.unitCostOre,
    sourceKind: row.sourceKind,
    unitSellOre: row.unitSellOre,
    vatRateBp: row.vatRateBp,
    includedInInvoiceTotal: row.includedInInvoiceTotal,
    deductionClassification: row.deductionClassification,
    vatType: row.vatType,
    isHidden: row.isHidden,
    isOptional: row.isOptional,
    isSelected: row.isSelected,
    label: row.label,
    description: row.description,
    quoteNote: row.quoteNote,
    sortOrder: row.sortOrder,
  }));
  const attachments = [...source.attachments].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.fileId.localeCompare(right.fileId),
  );
  const normalized = {
    ...source,
    sections,
    rows,
    attachments,
    applicableTaxPolicies: resolvedTaxPolicyDigestFacts(source),
  };
  return createHash("sha256")
    .update("quote-review-v2\n")
    .update(stableJson(normalized))
    .digest("hex");
}

export function quoteReviewDigestsEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
