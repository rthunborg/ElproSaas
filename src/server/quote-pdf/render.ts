// SERVER-ONLY. This module renders PDF BYTES via `pdf-lib` (a server-only dependency) and MUST
// NEVER be imported into a `"use client"` / browser path — the renderer stays out of the client
// bundle (proven by `verify:bundle-containment`). It imports no `next/headers`, no service-role
// key, and no client surface. The app uses NO service-role key on any path.
//
/**
 * Story 6.3, Task 3 — the DETERMINISTIC server-side quote-PDF renderer (H3 / R-612).
 *
 * Takes the PURE `QuotePdfViewModel` (built from the frozen snapshot — Task 2) + an INJECTED
 * render instant, and returns the PDF bytes. The render is REPRODUCIBLE from the same snapshot:
 *   (a) the renderer (`pdf-lib`) + version are EXACT-pinned (package.json — no `^`/`~`);
 *   (b) fonts are the base-14 STANDARD Helvetica embedded by reference (NOT a host system font
 *       that varies by machine);
 *   (c) date/number/currency formatting uses a STABLE explicit `sv-SE` locale (never the host
 *       default) — money is ALREADY formatted kronor in the view model via the single
 *       `formatOreAsKronor`; dates format here with an explicit `sv-SE` Intl formatter;
 *   (d) the render timestamp is INJECTED via `renderedAt` (the command's single `ctx.clock.now()`)
 *       — NO `Date.now()` / wall-clock read anywhere in the render path. The renderer-injected
 *       `/CreationDate` + `/ModificationDate` are SET from the injected instant; `producer`/
 *       `creator` are cleared so no `pdf-lib`-version string embeds a variable value.
 * Repeated renders of the SAME view model + instant produce BYTE-comparable output (6.3-INT-03).
 *
 * ── SNAPSHOT-ONLY / NON-FINAL FRAMING ──────────────────────────────────────────────
 * The renderer prints ONLY what the view model carries (customer-visible, snapshot-derived —
 * NO internal cost/margin/internal-note, R-607). A `requiresSignOff` view model renders the
 * non-final "estimate / requires sign-off" cue — the PDF is NEVER a legally-final document
 * (demo-data-only accept, R-610). Money is printed VERBATIM from the pre-formatted view-model
 * kronor strings — the renderer does NO money math.
 *
 * [Source: epics.md#Story 6.3 Technical Notes (H3 determinism: pinned renderer/version, embedded
 *  base-14 fonts, stable sv-SE formatting, injected render timestamp, no wall-clock reads);
 *  architecture.md#12 (render server-side in Node), #4 (command time discipline);
 *  test-design-epic-6.md#6.3-INT-03/6.3-GOLDEN-01, R-612; src/lib/quote-pdf/view-model.ts]
 */
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { QuotePdfViewModel } from "@/lib/quote-pdf";

/** The non-final / requires-sign-off cue printed on an unapproved-estimate PDF (demo-data-only). */
export const NON_FINAL_CUE =
  "Preliminär uppskattning — kräver godkännande. Inte ett slutligt juridiskt dokument.";

/** A4 page dimensions in PostScript points (deterministic; never a host-derived page size). */
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const BODY_SIZE = 10;
const HEADING_SIZE = 16;
const SUBHEADING_SIZE = 12;
const LINE_GAP = 4;
const TEXT_COLOR = rgb(0.09, 0.09, 0.11);

/** Options for {@link renderQuotePdf}: the view model + the INJECTED render instant. */
export interface RenderQuotePdfInput {
  readonly viewModel: QuotePdfViewModel;
  /** The INJECTED render instant (ISO) — the command's single `ctx.clock.now()`. No wall clock. */
  readonly renderedAt: string;
}

/** A stable `sv-SE` date formatter (explicit locale — never the host default) for validity/dates. */
const SV_DATE = new Intl.DateTimeFormat("sv-SE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

/** Format an ISO date VERBATIM via the stable sv-SE formatter, or a dash when absent/invalid. */
function svDate(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return SV_DATE.format(new Date(t));
}

/**
 * A tiny sequential text cursor: draws lines top-to-bottom, wrapping to a new page when the
 * bottom margin is reached. Deterministic layout (fixed coordinates + fixed font metrics).
 */
class PdfCursor {
  private readonly doc: PDFDocument;
  private readonly font: PDFFont;
  private readonly boldFont: PDFFont;
  private y: number;
  private page: PDFPage;

  constructor(doc: PDFDocument, font: PDFFont, boldFont: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.boldFont = boldFont;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(lineHeight: number): void {
    if (this.y - lineHeight < MARGIN) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  /** Split one logical line into deterministic font-width-bounded physical lines. */
  private wrapLine(value: string, font: PDFFont, size: number): readonly string[] {
    if (value.length === 0 || font.widthOfTextAtSize(value, size) <= CONTENT_WIDTH) {
      return [value];
    }

    const wrapped: string[] = [];
    let current = "";

    const pushToken = (token: string): void => {
      const candidate = current.length > 0 ? `${current} ${token}` : token;
      if (font.widthOfTextAtSize(candidate, size) <= CONTENT_WIDTH) {
        current = candidate;
        return;
      }
      if (current.length > 0) {
        wrapped.push(current);
        current = "";
      }

      // Customer-controlled prose can contain a single unbroken token. Split it
      // by Unicode code point so even that case can never cross the right margin.
      let fragment = "";
      for (const codePoint of Array.from(token)) {
        const next = fragment + codePoint;
        if (fragment.length > 0 && font.widthOfTextAtSize(next, size) > CONTENT_WIDTH) {
          wrapped.push(fragment);
          fragment = codePoint;
        } else {
          fragment = next;
        }
      }
      current = fragment;
    };

    for (const token of value.trim().split(/\s+/)) {
      pushToken(token);
    }
    if (current.length > 0) wrapped.push(current);
    return wrapped.length > 0 ? wrapped : [""];
  }

  /** Draw width-safe text at the given size/weight; paginate and advance per physical line. */
  text(value: string, opts?: { size?: number; bold?: boolean }): void {
    const size = opts?.size ?? BODY_SIZE;
    const lineHeight = size + LINE_GAP;
    const font = opts?.bold ? this.boldFont : this.font;
    const logicalLines = value.split(/\r?\n/);
    const physicalLines = logicalLines.flatMap((line) => this.wrapLine(line, font, size));
    for (const line of physicalLines) {
      this.ensureSpace(lineHeight);
      this.y -= size;
      if (line.length > 0) {
        this.page.drawText(line, {
          x: MARGIN,
          y: this.y,
          size,
          font,
          color: TEXT_COLOR,
        });
      }
      this.y -= LINE_GAP;
    }
  }

  /** A blank spacer line. */
  gap(): void {
    this.ensureSpace(BODY_SIZE);
    this.y -= BODY_SIZE;
  }
}

/** Join non-empty parts with a separator (skips nulls/blanks) for a compact identity line. */
function joinParts(parts: readonly (string | null)[], sep = " "): string {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(sep);
}

/** `validTo` policies are exclusive: customer wording must name the final included day. */
function exclusiveValidToLabel(validTo: string | null): string {
  if (!validTo) return "";
  const date = new Date(`${validTo}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return ` till före ${validTo}`;
  date.setUTCDate(date.getUTCDate() - 1);
  return ` till och med ${date.toISOString().slice(0, 10)}`;
}

/**
 * Render the quote PDF from the view model. DETERMINISTIC: pinned renderer + embedded base-14
 * Helvetica + explicit sv-SE date formatting + the INJECTED render instant on the InfoDict dates
 * (no wall-clock read). Returns the PDF bytes (a `Uint8Array`).
 */
export async function renderQuotePdf(
  input: RenderQuotePdfInput,
): Promise<Uint8Array> {
  const vm = input.viewModel;
  const renderedInstant = new Date(input.renderedAt);

  const doc = await PDFDocument.create();
  // Determinism: pin every InfoDict field to a fixed/injected value so no wall-clock or
  // renderer-version string can vary the bytes run-to-run (H3 / R-612).
  doc.setTitle("Offert");
  doc.setAuthor("");
  doc.setSubject("");
  doc.setKeywords([]);
  doc.setProducer("");
  doc.setCreator("");
  doc.setCreationDate(renderedInstant);
  doc.setModificationDate(renderedInstant);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const cursor = new PdfCursor(doc, font, boldFont);

  // ── Header: company identity (the FULL customer-visible identity). ──
  cursor.text(vm.companyName ?? "Offert", { size: HEADING_SIZE, bold: true });
  if (vm.companyOrgNr) cursor.text(`Org.nr: ${vm.companyOrgNr}`);
  const addr = joinParts([vm.companyAddressLine1, vm.companyAddressLine2], ", ");
  if (addr) cursor.text(addr);
  const cityLine = joinParts([vm.companyPostalCode, vm.companyCity]);
  if (cityLine) cursor.text(cityLine);
  const contactLine = joinParts([vm.companyEmail, vm.companyPhone], " · ");
  if (contactLine) cursor.text(contactLine);
  cursor.gap();

  // ── Quote heading: number + validity + parties. ──
  cursor.text("Offert", { size: SUBHEADING_SIZE, bold: true });
  if (vm.quoteNumberDisplay) cursor.text(`Offertnummer: ${vm.quoteNumberDisplay}`);
  cursor.text(`Giltig till: ${svDate(vm.validUntil)}`);
  if (vm.customerDisplayName) cursor.text(`Kund: ${vm.customerDisplayName}`);
  if (vm.facilityName) cursor.text(`Anläggning: ${vm.facilityName}`);
  if (vm.contactName) cursor.text(`Kontakt: ${vm.contactName}`);
  cursor.gap();

  // ── The NON-FINAL / requires-sign-off framing (demo-data-only). ──
  if (vm.requiresSignOff) {
    cursor.text(NON_FINAL_CUE, { bold: true });
    cursor.gap();
  }

  // ── Intro / customer notes. ──
  if (vm.introText) {
    cursor.text(vm.introText);
    cursor.gap();
  }

  // ── Line items (customer-visible display model — tillval marked). ──
  // HIDDEN rows (`is_hidden=true`) are EXCLUDED from the rendered line list: they still count
  // toward the frozen totals (which are read verbatim from the snapshot row — never recomputed
  // here), but must NOT print as customer-visible line items. This matches the
  // `HIDDEN_ROWS_INCLUDED` = "Dolda rader ingår i totalen" warning intent (AC1 / Task 2.2 —
  // "HIDDEN rows excluded"). A hidden row's label/description/prices must never leak to the PDF.
  const visibleLines = vm.lines.filter((line) => !line.isHidden);
  cursor.text("Rader", { size: SUBHEADING_SIZE, bold: true });
  if (visibleLines.length === 0) {
    cursor.text("Inga rader i denna version.");
  } else {
    for (const line of visibleLines) {
      const label = line.label ?? line.description ?? "—";
      const tillval = line.isOptional
        ? line.isSelected
          ? " (tillval, valt)"
          : " (tillval, inte valt)"
        : "";
      const inclusion = line.includedInInvoiceTotal === false
        ? " (ingår inte i totalsumman)"
        : line.isOptional
          ? " (ingår i totalsumman)"
          : "";
      const qty = line.quantity !== null ? `${line.quantity} ${line.unit ?? ""}`.trim() : "";
      const unitSell = line.unitSellKronor !== null ? `${line.unitSellKronor} kr` : "";
      const net = line.lineNetKronor !== null ? `${line.lineNetKronor} kr` : "";
      const segments = joinParts([qty, unitSell ? `à ${unitSell}` : "", net ? `= ${net}` : ""], "  ");
      cursor.text(joinParts([`${label}${tillval}${inclusion}`, segments], "  —  "));
      if (line.quoteNote) cursor.text(`  ${line.quoteNote}`);
    }
  }
  cursor.gap();

  // ── Totals (READ VERBATIM from the frozen row — the renderer does NO money math). ──
  cursor.text("Summering", { size: SUBHEADING_SIZE, bold: true });
  cursor.text(`Grundbelopp (netto): ${vm.totals.baseKronor} kr`);
  cursor.text(`Tillval som ingår (netto): ${vm.totals.optionKronor} kr`);
  cursor.text(`Moms: ${vm.totals.vatKronor} kr`);
  if (
    vm.taxAnswer?.source === "v2" &&
    vm.taxAnswer.deductionChoice !== null &&
    vm.taxAnswer.deductionChoice !== "NONE"
  ) {
    cursor.text(`Beräknat avdrag: ${vm.taxAnswer.calculatedDeductionKronor} kr`);
    cursor.text(`Begärt avdrag: ${vm.taxAnswer.claimDeductionKronor} kr`);
  } else if (vm.taxAssumptions.deductionType) {
    cursor.text(`Avdrag (uppskattning): ${vm.totals.deductionKronor} kr`);
  }
  cursor.text(
    vm.taxAnswer?.source === "v2" || vm.reverseChargeText
      ? `Att betala: ${vm.taxAnswer?.payableKronor ?? vm.totals.acceptedPriceKronor} kr`
      : `Att betala (inkl. moms): ${vm.totals.acceptedPriceKronor} kr`,
    { bold: true },
  );
  cursor.gap();

  if (vm.taxAnswer?.source === "v2") {
    cursor.text("Moms per kategori", { size: SUBHEADING_SIZE, bold: true });
    for (const category of vm.taxAnswer.categories) {
      const label = category.vatType === "REVERSE_CHARGE_CONSTRUCTION"
        ? category.label
        : `${category.label} (${category.ratePercent} %)`;
      cursor.text(
        `${label}: netto ${category.netKronor} kr, moms ${category.vatKronor} kr, brutto ${category.grossKronor} kr`,
      );
    }
    if (vm.taxAnswer.summaries) {
      cursor.text("Arbete, material och övrigt", { bold: true });
      cursor.text(
        `Arbete: netto ${vm.taxAnswer.summaries.labor.netKronor} kr, moms ${vm.taxAnswer.summaries.labor.vatKronor} kr, brutto ${vm.taxAnswer.summaries.labor.grossKronor} kr`,
      );
      cursor.text(
        `Material: netto ${vm.taxAnswer.summaries.material.netKronor} kr, moms ${vm.taxAnswer.summaries.material.vatKronor} kr, brutto ${vm.taxAnswer.summaries.material.grossKronor} kr`,
      );
      cursor.text(
        `Övrigt: netto ${vm.taxAnswer.summaries.other.netKronor} kr, moms ${vm.taxAnswer.summaries.other.vatKronor} kr, brutto ${vm.taxAnswer.summaries.other.grossKronor} kr`,
      );
    }
    if (vm.taxAnswer.deductionChoice === "ROT" || vm.taxAnswer.deductionChoice === "ROT_AND_GREEN") {
      const rot = vm.taxAnswer.rot;
      if (rot) {
        cursor.text("ROT-avdrag", { bold: true });
        cursor.text(
          `Underlag: ${rot.basisKronor} kr (arbete ${rot.basisNetKronor} kr, fördelad moms ${rot.allocatedVatKronor} kr)`,
        );
        cursor.text(`Beräknat: ${rot.calculatedKronor} kr. Begärt: ${rot.claimKronor} kr.`);
        if (rot.policy) {
          cursor.text(
            `Regelverk ${rot.policy.id}, betalningsdatum ${rot.policy.resolvingDate}, giltigt från ${rot.policy.validFrom}${exclusiveValidToLabel(rot.policy.validTo)}.`,
          );
        }
        for (const allocation of rot.allocations) {
          cursor.text(`Fördelning ${allocation.slot}: ${allocation.kronor} kr`);
        }
      }
    }
    if (vm.taxAnswer.deductionChoice === "GREEN" || vm.taxAnswer.deductionChoice === "ROT_AND_GREEN") {
      const green = vm.taxAnswer.green;
      if (green) {
        const basisLabels = {
          ACTUAL_ELIGIBLE_COSTS: "Faktiska stödberättigade kostnader",
          FIXED_PRICE_97_PERCENT: "97 % av äkta fastprisavtal",
        } as const;
        const categoryLabels = {
          SOLAR: "Solceller",
          STORAGE: "Lagring",
          CHARGING: "Laddningspunkt",
        } as const;
        cursor.text("Grön teknik", { bold: true });
        const basisLabel = basisLabels[green.basisMethod as keyof typeof basisLabels]
          ?? "Okänd underlagsmetod";
        cursor.text(`Underlagsmetod: ${basisLabel}`);
        if (green.basisMethod === "FIXED_PRICE_97_PERCENT") {
          cursor.text("Fastprisets kategoriandelar: inkl. moms (brutto, före 97 %).");
        }
        for (const category of ["SOLAR", "STORAGE", "CHARGING"] as const) {
          const values = green.categories[category];
          cursor.text(
            `${categoryLabels[category]}: underlag ${values.basisKronor} kr, beräknat ${values.calculatedKronor} kr, begärt ${values.claimKronor} kr`,
          );
        }
        cursor.text(`Beräknat: ${green.calculatedKronor} kr. Begärt: ${green.claimKronor} kr.`);
        if (green.policy) {
          cursor.text(
            `Regelverk ${green.policy.id}, slutbetalningsdatum ${green.policy.resolvingDate}, giltigt från ${green.policy.validFrom}${exclusiveValidToLabel(green.policy.validTo)}.`,
          );
        }
        for (const allocation of green.allocations) {
          cursor.text(`Fördelning ${allocation.slot}: ${allocation.kronor} kr`);
        }
      }
    }
    cursor.gap();
  }

  // ── VAT / tax assumptions (with the non-final ROT/grön framing). ──
  cursor.text("Moms- och skatteantaganden", { size: SUBHEADING_SIZE, bold: true });
  if (vm.taxAssumptions.vatRatePercent) {
    cursor.text(`Momssats: ${vm.taxAssumptions.vatRatePercent} %`);
  }
  if (vm.reverseChargeText) {
    cursor.text(vm.reverseChargeText, { bold: true });
    if (vm.buyerVatNumber) cursor.text(`Köparens momsregistreringsnummer: ${vm.buyerVatNumber}`);
  }
  if (vm.taxAssumptions.deductionType && vm.taxAnswer?.source !== "v2") {
    const dType = vm.taxAssumptions.deductionType === "rot" ? "ROT-avdrag" : "Grön teknik";
    const rate = vm.taxAssumptions.deductionRatePercent
      ? ` (${vm.taxAssumptions.deductionRatePercent} %)`
      : "";
    cursor.text(`${dType}${rate}: preliminär uppskattning som kräver godkännande.`);
  }
  if (vm.requiresSignOff) {
    cursor.text("Skatteantaganden är inte slutligt godkända.");
  }
  cursor.gap();

  // ── Terms text (customer-visible; internal notes are NEVER interleaved — R-607). ──
  if (vm.termsText) {
    cursor.text("Villkor", { size: SUBHEADING_SIZE, bold: true });
    for (const termLine of vm.termsText.split(/\r?\n/)) {
      cursor.text(termLine);
    }
    if (vm.termsApprovedAt === null) {
      cursor.text("Villkoren är inte godkända ännu.");
    }
    cursor.gap();
  }

  // ── Customer notes (after terms so they read as a closing note). ──
  if (vm.customerNotes) {
    cursor.text("Noteringar", { size: SUBHEADING_SIZE, bold: true });
    cursor.text(vm.customerNotes);
    cursor.gap();
  }

  // ── Selected attachments (metadata display names by value). ──
  cursor.text("Bifogade filer", { size: SUBHEADING_SIZE, bold: true });
  if (vm.attachments.length === 0) {
    cursor.text("Inga bifogade filer.");
  } else {
    for (const att of vm.attachments) {
      cursor.text(`• ${att.displayName ?? "Fil"}`);
    }
  }
  cursor.gap();

  // ── Customer-visible warnings (DISPLAYED verbatim — the REAL ReadinessCode codes/messages). ──
  if (vm.warnings.length > 0) {
    cursor.text("Anmärkningar", { size: SUBHEADING_SIZE, bold: true });
    for (const w of vm.warnings) {
      cursor.text(`[${w.code}] ${w.message}`);
    }
  }

  // Determinism: `useObjectStreams: false` writes a plain xref (no compressed object streams),
  // yielding a stable, text-extractable byte layout the golden depends on.
  return doc.save({ useObjectStreams: false });
}
