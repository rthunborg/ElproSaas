"use client";

/**
 * Story 8.5, Task 2.2 — the READ-ONLY commitment-files panel (a sent quote's locked PDF/attachment).
 *
 * A LOCKED-commitment file surface with NO upload form (the `quote_version` owner type is not an
 * uploadable panel — its files are materialized by the 6.1/6.3 RPCs). It reuses the SHARED
 * `FilePreviewRow` (the same preview + LOCK NOTICE + archive-only affordance as `EntityFilePanel`;
 * R-814 — one row, one signing funnel, one archive command). A locked file shows `file-lock-notice`
 * + `archive-file` and NEVER a `replace-file`/`delete-file` control.
 *
 * The lock notice + the absence of replace/delete + the archive-only control are a UX convenience
 * over the DB truth — NEVER the guarantee (R-812; the command FILE_LINK_LOCKED + the FL823 trigger).
 */
import { FilePreviewRow } from "@/components/files/FilePreviewRow";
import type { EntityFileRow } from "@/features/files/read";

export interface CommitmentFilesPanelProps {
  /** The commitment purpose (`quote_pdf` / `quote_attachment_snapshot`) — for the lock-notice text. */
  readonly purpose: string;
  /** The panel heading (e.g. "Offert-PDF (låst)"). */
  readonly heading: string;
  /** The locked commitment files (own-tenant only — from `readEntityFiles`). */
  readonly files: readonly EntityFileRow[];
  /** A generic read-error signal (never a cross-tenant leak); null when the read succeeded. */
  readonly readError?: string | null;
  /**
   * The commitment file owner (`quote_version` + its id) + the STRUCTURED parent quote/version
   * ids the archive action uses to derive the revalidation route SERVER-SIDE (a closed template
   * allow-list — NO client `revalidate_path`; epic-8 review finding).
   */
  readonly ownerId?: string;
  readonly parentQuoteId?: string;
  readonly parentVersionId?: string;
  /**
   * A data-testid NAMESPACE suffix (so this panel's testids stay addressable alongside the entity
   * panels). Absent → the canonical unsuffixed testids (the E2E `file-lock-notice`/`archive-file`).
   */
  readonly testIdSuffix?: string;
}

export function CommitmentFilesPanel(props: CommitmentFilesPanelProps) {
  const suffix = props.testIdSuffix ? `-${props.testIdSuffix}` : "";
  const tid = (base: string) => `${base}${suffix}`;
  const headingId = `commitment-file-panel-heading${suffix}`;

  return (
    <section
      data-testid={tid("commitment-file-panel")}
      aria-labelledby={headingId}
      className="rounded-lg border border-zinc-200 bg-white p-4 text-sm"
    >
      <h3 id={headingId} className="mb-2 font-medium text-zinc-800">
        {props.heading}
      </h3>
      {props.readError ? (
        <p
          role="alert"
          data-testid={tid("commitment-file-list-error")}
          className="text-red-800"
        >
          {props.readError}
        </p>
      ) : props.files.length === 0 ? (
        <p data-testid={tid("commitment-file-empty")} className="text-zinc-500">
          Inga filer.
        </p>
      ) : (
        <ul
          data-testid={tid("commitment-file-list")}
          className="flex flex-col gap-1"
        >
          {props.files.map((f, i) => (
            <FilePreviewRow
              key={f.linkId}
              file={f}
              tid={tid}
              index={i}
              purpose={props.purpose}
              ownerType="quote_version"
              ownerId={props.ownerId}
              parentQuoteId={props.parentQuoteId}
              parentVersionId={props.parentVersionId}
              // NO uploadInputId → no "replace" link (the commitment panel has no upload form; an
              // unlocked commitment file — a draft-version PDF — is regenerated via the 6.3 path).
            />
          ))}
        </ul>
      )}
    </section>
  );
}
