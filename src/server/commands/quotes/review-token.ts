import { createHash, timingSafeEqual } from "node:crypto";

import { TAX_POLICY_REGISTRY } from "@/lib/money";

/**
 * Semantic source reviewed before quote creation. It contains no PII/internal notes.
 * Unit cost and source kind are hashed because they affect customer-visible readiness
 * warnings, but neither value is copied into the frozen quote or exposed to the client.
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
    unitCostOre: number | null;
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
    sourceKind: string | null;
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

/** SHA-256 digest of all reviewed semantics plus the active code-owned policy registry. */
export function buildQuoteReviewDigest(source: QuoteReviewSource): string {
  const sections = [...source.sections].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
  );
  const sectionOrder = new Map(sections.map((section, index) => [section.id, index]));
  const rows = [...source.rows].sort((left, right) =>
    (sectionOrder.get(left.sectionId) ?? Number.MAX_SAFE_INTEGER) -
      (sectionOrder.get(right.sectionId) ?? Number.MAX_SAFE_INTEGER) ||
    left.sortOrder - right.sortOrder ||
    left.id.localeCompare(right.id));
  const attachments = [...source.attachments].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.fileId.localeCompare(right.fileId),
  );
  const normalized = { ...source, sections, rows, attachments };
  return createHash("sha256")
    .update("quote-review-v2\n")
    .update(stableJson(TAX_POLICY_REGISTRY))
    .update("\n")
    .update(stableJson(normalized))
    .digest("hex");
}

export function quoteReviewDigestsEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
