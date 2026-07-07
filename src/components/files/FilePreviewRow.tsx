"use client";

/**
 * Shared per-file row (Story 8.5, Task 1.3/2.2 — extracted from `EntityFilePanel` so the index +
 * the entity panels + the locked-commitment panel share ONE preview/archive/lock row rather than
 * duplicating the signing logic; R-814 reuse). Renders:
 *   - the file's display-safe metadata (name, size);
 *   - a per-file PREVIEW affordance via `previewEntityFileAction` (the 8.1 signing funnel — the
 *     ONLY signing path; carries ONLY the file id; the server re-verifies own-tenant ownership +
 *     lifecycle) with the 8.3 expiry→refresh behavior (a stale URL is NEVER reused);
 *   - the 8.5 LOCK NOTICE (`file-lock-notice` / `evidence-lock-notice`) on a LOCKED file +
 *     the archive-only affordance (`archive-file`, wired to the existing `archiveFile` command via
 *     `archiveFileAction`), and NO `replace-file`/`delete-file`; an UNLOCKED file MAY offer a
 *     re-upload "replace" link + an archive.
 *
 * The lock notice + the absent replace/delete + the archive-only control are a UX convenience over
 * the DB truth — NEVER the guarantee (R-812; the command FILE_LINK_LOCKED + the FL823 trigger are).
 * NO raw `object_path`/`bucket_id` is ever rendered — the signed URL is the ONLY storage handle.
 */
import { useEffect, useState } from "react";
import { useActionState } from "react";
import { archiveFileAction, previewEntityFileAction } from "@/features/files/actions";
import {
  SIGNED_ACCESS_INITIAL,
  isSignedUrlExpired,
  type SignedAccessState,
} from "@/features/files/signed-access-state";
import {
  ARCHIVE_ACTION_INITIAL,
  type ArchiveActionState,
} from "@/features/files/archive-action-state";
import type { EntityFileRow } from "@/features/files/read";

/** Format a byte count as a compact human size for the list. */
function formatSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export interface FilePreviewRowProps {
  readonly file: EntityFileRow;
  /** Base→namespaced testid mapper (panel suffix). */
  readonly tid: (base: string) => string;
  readonly index: number;
  /** The panel's purpose — decides evidence-vs-file lock-notice wording (acceptance_evidence). */
  readonly purpose: string;
  /** The route to revalidate after a successful archive (mirrors the upload revalidation). */
  readonly revalidatePath?: string;
  /**
   * The panel upload input's id — the unlocked-file "replace" link scrolls to it. When absent
   * (a read-only commitment panel with no upload form), the replace link is not rendered.
   */
  readonly uploadInputId?: string;
}

export function FilePreviewRow({
  file,
  tid,
  index,
  purpose,
  revalidatePath,
  uploadInputId,
}: FilePreviewRowProps) {
  const [state, formAction, pending] = useActionState<SignedAccessState, FormData>(
    previewEntityFileAction,
    SIGNED_ACCESS_INITIAL,
  );
  const [archiveState, archiveAction, archivePending] = useActionState<
    ArchiveActionState,
    FormData
  >(archiveFileAction, ARCHIVE_ACTION_INITIAL);
  // A per-row testid: the canonical unsuffixed base (via `tid`) for the FIRST row keeps the E2E
  // `.first()` contract stable; each row also gets an index suffix so multiple files stay
  // individually addressable on a multi-file panel.
  const rowSuffix = index === 0 ? "" : `-${index}`;
  const rid = (base: string) => `${tid(base)}${rowSuffix}`;

  // The AUTHORITATIVE applied lock is the DB's `file_links.is_locked` (8.4), threaded into the row
  // (Task 2.1). The `evidence-lock-notice` variant is used for acceptance evidence.
  const isLocked = file.isLocked;
  const isEvidence = purpose === "acceptance_evidence";

  // Re-evaluate the expiry verdict on a wall-clock tick so a link that ages out flips to the
  // "open again" affordance WITHOUT a full re-render of the panel. One bounded timer per active link.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    if (state.status !== "success" || state.expiresAt === null) return;
    const expiryMs = Date.parse(state.expiresAt);
    if (!Number.isFinite(expiryMs)) return;
    const remaining = expiryMs - Date.now();
    const timer = setTimeout(() => setNowMs(Date.now()), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [state.status, state.expiresAt]);

  const hasFreshLink =
    state.status === "success" &&
    state.signedUrl !== null &&
    !isSignedUrlExpired(state.expiresAt, new Date(nowMs).toISOString());
  const linkExpired =
    state.status === "success" &&
    state.signedUrl !== null &&
    isSignedUrlExpired(state.expiresAt, new Date(nowMs).toISOString());

  const openLabel = pending
    ? "Öppnar…"
    : state.status === "success"
      ? "Öppna igen"
      : "Öppna fil";

  return (
    <li
      data-testid={rid("file-panel-file-item")}
      className="flex flex-col gap-1 rounded border border-zinc-100 px-2 py-1"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-zinc-800">{file.displayName}</span>
        <span className="shrink-0 text-xs text-zinc-500">
          {formatSize(file.sizeBytes)}
        </span>
      </div>
      <form action={formAction} className="flex flex-col gap-1">
        {/* The action carries ONLY the file id — NEVER owner_type/owner_id/object_path/bucket_id
            (the server command binds it to the caller's own tenant; a foreign id is denied). */}
        <input type="hidden" name="file_id" value={file.fileId} />
        {!linkExpired ? (
          <button
            type="submit"
            disabled={pending}
            data-testid={rid("file-preview-button")}
            className="inline-flex w-fit items-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-zinc-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {openLabel}
          </button>
        ) : (
          <>
            {/* EXPIRY → REFRESH (AC2): the stale URL is NOT reused. A generic text status (not
                color-only) + a re-open submit that RE-INVOKES the command (a fresh full auth). */}
            <p
              role="status"
              data-testid={rid("file-preview-expired")}
              className="text-xs text-amber-800"
            >
              Länken har gått ut.
            </p>
            <button
              type="submit"
              disabled={pending}
              data-testid={rid("file-preview-reopen")}
              className="inline-flex w-fit items-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-zinc-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {pending ? "Öppnar…" : "Länken har gått ut — öppna igen"}
            </button>
          </>
        )}
      </form>
      {/* On success, the time-limited link — the ONLY storage handle the client sees (R-810).
          Hidden once expired (the re-open control replaces it) so the stale URL is never reused. */}
      {hasFreshLink && state.signedUrl ? (
        <a
          href={state.signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={rid("file-preview-link")}
          className="w-fit text-sm text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Öppna fil (tidsbegränsad länk)
        </a>
      ) : null}
      {/* A denied/wrong-lifecycle/transient failure — a generic assertive alert, no raw path,
          no existence disclosure (R-809). A SERVER_ERROR is retryable (re-press the button). */}
      {state.status === "error" && state.formError ? (
        <p
          role="alert"
          data-testid={rid("file-preview-error")}
          className="text-sm text-red-800"
        >
          {state.formError}
        </p>
      ) : null}

      {/* ── LOCK NOTICE + ARCHIVE-ONLY / REPLACE affordances (Story 8.5, Task 2.2) ──────────────
          A LOCKED file (a sent quote's PDF/attachment, or an accepted acceptance's evidence) shows a
          TEXT lock notice explaining it is locked and can be ARCHIVED but not replaced/deleted, and
          renders the archive-only affordance + NEVER a replace/delete control. An UNLOCKED file MAY
          offer a re-upload "replace" + an archive. The disabled/absent control is UX ONLY — the
          command FILE_LINK_LOCKED + the FL823 trigger are the guarantee (R-812; architecture §9). */}
      {isLocked ? (
        <p
          role="note"
          data-testid={rid(isEvidence ? "evidence-lock-notice" : "file-lock-notice")}
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          {isEvidence
            ? "Filen är låst eftersom acceptansen är registrerad. Den kan arkiveras men inte ersättas eller tas bort."
            : "Filen är låst eftersom offerten är skickad. Den kan arkiveras men inte ersättas eller tas bort."}
        </p>
      ) : null}

      {/* The ONLY destructive affordance is ARCHIVE (archive-over-delete) — wired to the existing
          archiveFile command. NO delete-file control ever renders. */}
      <form action={archiveAction} className="flex flex-col gap-1">
        <input type="hidden" name="file_id" value={file.fileId} />
        {revalidatePath ? (
          <input type="hidden" name="revalidate_path" value={revalidatePath} />
        ) : null}
        <button
          type="submit"
          disabled={archivePending || archiveState.status === "success"}
          data-testid={rid("archive-file")}
          className="inline-flex w-fit items-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {archivePending
            ? "Arkiverar…"
            : archiveState.status === "success"
              ? "Arkiverad"
              : "Arkivera fil"}
        </button>
      </form>
      {archiveState.status === "error" && archiveState.formError ? (
        <p
          role="alert"
          data-testid={rid("archive-file-error")}
          className="text-sm text-red-800"
        >
          {archiveState.formError}
        </p>
      ) : null}

      {/* An UNLOCKED file MAY be REPLACED via a fresh re-upload (never a file_id re-point — the 8.4
          lock BLOCKS re-pointing; for an unlocked file a new upload+link is the sanctioned replace).
          A convenience link to the panel's own upload form (the write path). NO replace control
          renders for a LOCKED file (the E2E asserts its absence), nor without an upload form. */}
      {!isLocked && uploadInputId ? (
        <a
          href={`#${uploadInputId}`}
          data-testid={rid("replace-file")}
          className="w-fit text-sm text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Ersätt (ladda upp ny fil)
        </a>
      ) : null}
    </li>
  );
}
