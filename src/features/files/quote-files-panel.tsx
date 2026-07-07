/**
 * Server helper (Story 8.5, Task 2.2) — build the locked commitment-file panel for the SELECTED
 * version of a quote detail when that version is NON-DRAFT (sent/accepted). SERVER-ONLY: it reads
 * the own-tenant `quote_version` files (the PDF / attachment snapshots) via `readEntityFiles` on the
 * per-request RLS client (anon key — NEVER service-role) and returns the `CommitmentFilesPanel` node
 * the `QuoteDetailView` renders.
 *
 * Returns `null` when the selected version is a DRAFT (a draft-version PDF is still regenerable — the
 * link is NOT locked, so no lock panel) or has no commitment files. Once the version is sent, the
 * 8.4 trigger has locked the PDF/attachment links (`file_links.is_locked=true`, files
 * `lifecycle_state='locked'`), so the panel surfaces the lock notice + archive-only affordance (AC4).
 *
 * Reuses the SINGLE file read + the SHARED preview/archive row (R-814) — no competing file/signing
 * model, no upload form (`quote_version` files are materialized by the 6.1/6.3 RPCs, not uploaded).
 */
import type { ReactNode } from "react";
import { CommitmentFilesPanel } from "@/components/files/CommitmentFilesPanel";
import { readEntityFiles } from "@/features/files/read";
import type { QuoteDetail, QuoteVersionRow } from "@/features/quotes/read";

export async function renderSentQuoteFilesPanel(
  detail: QuoteDetail,
  quoteId: string,
): Promise<ReactNode> {
  const selected: QuoteVersionRow | undefined = detail.versions.find(
    (v) => v.id === detail.selectedVersionId,
  );
  // A DRAFT version's PDF/attachment link is NOT locked (regenerable) — no lock panel. The panel
  // surfaces once the version is non-draft (sent/accepted) and the commitment files are locked.
  if (!selected || selected.status === "draft") return null;

  const filesRead = await readEntityFiles({
    ownerType: "quote_version",
    ownerId: selected.id,
  });
  // Only render when the version actually has commitment files (a PDF/attachment link).
  if (filesRead.error === null && filesRead.files.length === 0) return null;

  return (
    <CommitmentFilesPanel
      purpose="quote_pdf"
      heading="Offertfiler (låsta)"
      files={filesRead.files}
      readError={filesRead.error}
      // The archive action derives the version-subroute revalidation SERVER-SIDE from these ids
      // (a closed template allow-list) — NO client path (epic-8 review finding).
      ownerId={selected.id}
      parentQuoteId={quoteId}
      parentVersionId={selected.id}
    />
  );
}
