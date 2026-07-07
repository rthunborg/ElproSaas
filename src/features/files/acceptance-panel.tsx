/**
 * Server helper (Story 8.2) — build the acceptance-evidence `EntityFilePanel` for the
 * SELECTED version of a quote detail, when that version is accepted. SERVER-ONLY: it reads
 * the own-tenant acceptance-evidence files via `readEntityFiles` on the per-request RLS
 * client (anon key — NEVER service-role) and returns the panel node the `QuoteDetailView`
 * renders on its accepted section.
 *
 * Returns `null` when the selected version is NOT accepted or has no acceptance id (the
 * panel only makes sense once an acceptance exists — the file attaches to the acceptance,
 * `owner_type='quote_acceptance'` + `purpose='acceptance_evidence'`).
 *
 * NOTE (8.4 boundary): this story only ADDS an evidence-file upload panel; the
 * evidence-file LOCK (an accepted acceptance's evidence becoming immutable) is Story 8.4 —
 * not enforced here. Under Phase A demo-data-only this addition is safe; 8.4 hardens it.
 */
import type { ReactNode } from "react";
import { EntityFilePanel } from "@/components/files/EntityFilePanel";
import { readEntityFiles } from "@/features/files/read";
import type { QuoteDetail } from "@/features/quotes/read";

export async function renderAcceptanceFilesPanel(
  detail: QuoteDetail,
  quoteId: string,
): Promise<ReactNode> {
  const selected = detail.versions.find((v) => v.id === detail.selectedVersionId);
  if (!selected || selected.status !== "accepted") return null;
  const acceptanceId = detail.acceptanceIdByVersionId[selected.id];
  if (!acceptanceId) return null;

  const filesRead = await readEntityFiles({
    ownerType: "quote_acceptance",
    ownerId: acceptanceId,
  });

  return (
    <EntityFilePanel
      ownerType="quote_acceptance"
      ownerId={acceptanceId}
      purpose="acceptance_evidence"
      ownerLabel={`Accepterad offert ${selected.quote_number_display ?? selected.quote_number ?? ""}`.trim()}
      files={filesRead.files}
      readError={filesRead.error}
      // Revalidate the version subroute (server-derived from these ids) so a successful upload
      // refreshes the accepted section — NO client path (epic-8 review finding).
      parentQuoteId={quoteId}
      parentVersionId={selected.id}
    />
  );
}
