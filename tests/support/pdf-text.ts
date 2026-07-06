/**
 * Story 6.3 — the PDF TEXT-EXTRACTION test helper (wraps the pinned `pdfjs-dist` devDependency).
 *
 * The 6.3-GOLDEN-01 text golden + the 6.3-INT-01/03 source-of-truth/determinism proofs assert on
 * the SELECTABLE TEXT of the rendered PDF (never a pixel diff). This helper wraps `pdfjs-dist`'s
 * legacy build (pure JS, no native binary, no headless browser) so it runs under BOTH runners:
 * `node --test` (the golden fast gate) and Vitest (the DB-backed INT suites). It is TEST-ONLY —
 * it lives under `tests/**` and is NEVER imported into `src/`, so it stays out of the client and
 * server bundles (the extractor is a devDependency; the renderer is the only production PDF dep).
 *
 * [Source: test-design-epic-6.md#6.3-GOLDEN-01 (text extraction PRIMARY); story 6.3 Task 3.1
 *  (a text-extraction devDependency, kept out of the production bundle) + Task 6.3]
 */

/** The minimal pdfjs text-item shape we read (a glyph run carries a `str`). */
interface PdfTextItem {
  readonly str?: string;
}

/**
 * Extract ALL selectable text from a rendered PDF (pages joined by a space) via `pdfjs-dist`.
 * Deterministic: the extraction reads the embedded text runs verbatim; two byte-identical PDFs
 * yield identical text. Disables eval + system fonts so the extraction is hermetic.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  // Dynamic import so the (test-only) extractor is loaded lazily and never eagerly bundled.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    useSystemFonts: false,
    isEvalSupported: false,
    // pdfjs logs a warning about `standardFontDataUrl` when a base-14 font glyph is needed for
    // RENDERING; text EXTRACTION does not need it, so the warning is benign. Keep verbosity low.
    verbosity: 0,
  });
  const doc = await loadingTask.promise;
  const parts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => {
        const it = item as PdfTextItem;
        return typeof it.str === "string" ? it.str : "";
      })
      .join(" ");
    parts.push(pageText);
  }
  await doc.destroy();
  return parts.join("\n");
}
