import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { QuoteDetail, QuoteVersionRow } from "@/features/quotes/read";

vi.mock("next/link", () => ({
  default: ({ children }: { readonly children?: ReactNode }) => children ?? null,
}));
vi.mock("@/components/quotes/StatusBadge", () => ({ StatusBadge: () => null }));
vi.mock("@/components/quotes/DraftQuoteEditor", () => ({
  DraftQuoteEditor: () => "DRAFT_EDITOR",
}));
vi.mock("@/components/quotes/MarkSentButton", () => ({
  MarkSentButton: () => "MARK_SENT",
}));
vi.mock("@/components/quotes/CreateNewVersionButton", () => ({
  CreateNewVersionButton: () => "CREATE_NEW_VERSION",
}));
vi.mock("@/components/quotes/MarkLostButton", () => ({ MarkLostButton: () => null }));
vi.mock("@/components/quotes/FollowUpChip", () => ({ FollowUpChip: () => null }));
vi.mock("@/components/quotes/FollowUpPanel", () => ({ FollowUpPanel: () => null }));
vi.mock("@/components/quotes/AcceptanceCaptureForm", () => ({
  AcceptanceCaptureForm: () => null,
}));
vi.mock("@/components/quotes/QuotePdfPanel", () => ({
  QuotePdfPanel: ({ allowGeneration }: { readonly allowGeneration: boolean }) =>
    allowGeneration ? "PDF_PANEL_GENERATE" : "PDF_PANEL_READ_ONLY",
}));

import {
  QuoteDetailView,
  isLegacyDraftVersion,
} from "@/components/quotes/QuoteDetailView";

function version(snapshotSchemaVersion: number | null): QuoteVersionRow {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    version_number: 1,
    quote_number: null,
    quote_number_display: null,
    status: "draft",
    calculation_id: "33333333-3333-4333-8333-333333333333",
    customer_display_name: "Testkund",
    customer_type: "private",
    facility_name: null,
    contact_name: null,
    valid_until: null,
    intro_text: null,
    customer_notes: null,
    terms_text: null,
    terms_approved_at: null,
    display_mode: "detailed",
    base_total_ore: 100_000,
    option_total_ore: 0,
    vat_total_ore: 25_000,
    deduction_total_ore: 0,
    accepted_price_ore: 125_000,
    snapshot_schema_version: snapshotSchemaVersion,
    tax_rule_version: null,
    tax_answer_snapshot: null,
    buyer_vat_number: null,
    calculated_deduction_ore: null,
    claim_deduction_ore: null,
    payable_ore: 125_000,
    vat_rate_bp: 2_500,
    vat_display: "private",
    deduction_type: null,
    deduction_rate_bp: null,
    deduction_cap_ore: null,
    deduction_persons: null,
    requires_sign_off: false,
    pdf_file_id: null,
    pdf_generated_at: null,
    pdf_status: "not_generated",
    warnings_snapshot: [],
    created_at: "2026-08-07T08:00:00.000Z",
  };
}

function detailFor(selected: QuoteVersionRow): QuoteDetail {
  return {
    header: {
      id: "11111111-1111-4111-8111-111111111111",
      customer_id: "44444444-4444-4444-8444-444444444444",
      customer_display_name: "Testkund",
      facility_name: null,
      contact_name: null,
      calculation_id: selected.calculation_id,
      updated_at: "2026-08-07T08:00:00.000Z",
    },
    versions: [selected],
    selectedVersionId: selected.id,
    selectedLines: [],
    selectedAttachments: [],
    eligibleCarryForwardAttachments: [],
    omittedCarryForwardAttachmentCount: 0,
    events: [],
    selectedLostReason: null,
    followUps: [],
    nowISO: "2026-08-07T08:00:00.000Z",
    acceptedJobIdByVersionId: {},
    acceptanceIdByVersionId: {},
  };
}

describe("QuoteDetailView — legacy V1 draft recovery", () => {
  it("classifies only null-schema drafts as recoverable legacy drafts", () => {
    expect(isLegacyDraftVersion("draft", null)).toBe(true);
    expect(isLegacyDraftVersion("draft", 2)).toBe(false);
    expect(isLegacyDraftVersion("draft", 1)).toBe(false);
    expect(isLegacyDraftVersion("sent", null)).toBe(false);
  });

  it("renders a clear read-only recovery path without edit, send, or PDF actions", () => {
    const html = renderToStaticMarkup(
      createElement(QuoteDetailView, { detail: detailFor(version(null)) }),
    );

    expect(html).toContain('data-testid="legacy-draft-recovery"');
    expect(html).toContain("Äldre utkast – kan inte skickas");
    expect(html).toContain("Det äldre utkastet bevaras oförändrat.");
    expect(html).toContain("CREATE_NEW_VERSION");
    expect(html).not.toContain("DRAFT_EDITOR");
    expect(html).not.toContain("MARK_SENT");
    expect(html).not.toContain("PDF_PANEL");
  });

  it("keeps a current V2 draft on the ordinary edit, send, and PDF path", () => {
    const current = { ...version(2), buyer_vat_number: "SE556677889901" };
    const html = renderToStaticMarkup(
      createElement(QuoteDetailView, { detail: detailFor(current) }),
    );

    expect(html).not.toContain('data-testid="legacy-draft-recovery"');
    expect(html).toContain("DRAFT_EDITOR");
    expect(html).toContain("MARK_SENT");
    expect(html).toContain("PDF_PANEL_GENERATE");
    expect(html).toContain('data-testid="quote-buyer-vat-number"');
    expect(html).toContain("SE556677889901");
    expect(html).not.toContain("CREATE_NEW_VERSION");
  });

  it("keeps sent PDF history visible without offering draft-only generation", () => {
    const sent = {
      ...version(2),
      status: "sent" as const,
      pdf_status: "failed",
    };
    const html = renderToStaticMarkup(
      createElement(QuoteDetailView, { detail: detailFor(sent) }),
    );

    expect(html).toContain("PDF_PANEL_READ_ONLY");
    expect(html).not.toContain("PDF_PANEL_GENERATE");
  });
});
