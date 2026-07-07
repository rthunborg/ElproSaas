"use client";

/**
 * Story 8.5, Task 1.3 — the LIMITED `Filer` index list island (AC1/AC3; R-810/R-816).
 *
 * Renders the tenant's OWN non-archived Phase A entity files (from `readFileIndex` — RLS-scoped,
 * own-tenant only; a cross-tenant file is never listed). A THIN, FLAT index — NOT a document
 * center (R-816 STOP): a name/type search + an owner-CATEGORY filter (the seven fixed Phase A
 * categories ONLY), each row showing display-safe metadata (display_name, category label, type,
 * size, created_at) + a per-file preview affordance REUSING `previewEntityFileAction` (the 8.1
 * signing funnel — R-814, no competing signing path). Filtering is CLIENT-SIDE in-memory over the
 * server-fetched rows (mirrors `JobList`'s `useMemo` narrowing).
 *
 * SCOPE GUARD (AC1, R-816): NO deferred-module grouping, NO cross-module analytics, NO
 * document-library workflow — the category filter exposes ONLY the seven Phase A owner categories.
 *
 * A11Y: status is TEXT (WCAG 1.4.1 — never color alone); every control is keyboard-operable with a
 * visible focus ring. NO raw `object_path`/`bucket_id` is ever rendered — the signed URL is the ONLY
 * storage handle the client sees, minted on demand through the signing action.
 */
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { previewEntityFileAction } from "@/features/files/actions";
import {
  filterFileIndexRows,
  OWNER_CATEGORY_ORDER,
  ownerCategoryLabel,
  type FileIndexRow,
} from "@/features/files/file-index";
import {
  SIGNED_ACCESS_INITIAL,
  type SignedAccessState,
} from "@/features/files/signed-access-state";
import { useSignedLinkExpiry } from "@/features/files/use-signed-link-expiry";

/** Format a byte count as a compact human size for the list. */
function formatSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Date(t).toLocaleDateString("sv-SE");
}

export function FileIndexList({
  rows,
  loadError,
}: {
  readonly rows: readonly FileIndexRow[];
  readonly loadError: string | null;
}) {
  const [search, setSearch] = useState("");
  const [ownerCategory, setOwnerCategory] = useState("");

  // Client-side in-memory narrowing over the already-tenant-scoped rows (the thin Phase-A pattern).
  const filtered = useMemo(
    () => filterFileIndexRows(rows, { search, ownerCategory }),
    [rows, search, ownerCategory],
  );

  return (
    <section
      data-testid="file-index"
      aria-labelledby="file-index-heading"
      className="flex flex-col gap-6 p-6"
    >
      <h1 id="file-index-heading" className="text-2xl font-semibold text-zinc-900">
        Filer
      </h1>
      <p className="text-sm text-zinc-600">
        Här listas dina filer kopplade till kunder, kalkyler, offerter och jobb.
      </p>

      {loadError ? (
        <p
          role="alert"
          data-testid="file-index-error"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {loadError}
        </p>
      ) : (
        <>
          {/* Search + owner-category filter (the fixed Phase A category set ONLY — R-816). */}
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600">Sök (namn eller typ)</span>
              <input
                type="search"
                data-testid="file-index-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sök filnamn eller filtyp"
                className="rounded-md border border-zinc-300 px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-600">Kategori</span>
              <select
                data-testid="file-index-category-filter"
                value={ownerCategory}
                onChange={(e) => setOwnerCategory(e.target.value)}
                className="rounded-md border border-zinc-300 px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <option value="">Alla kategorier</option>
                {OWNER_CATEGORY_ORDER.map((ot) => (
                  <option key={ot} value={ot}>
                    {ownerCategoryLabel(ot)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filtered.length === 0 ? (
            <p data-testid="file-index-empty" className="text-sm text-zinc-600">
              Inga filer matchar. Filer visas när de laddats upp och kopplats till en
              kund, kalkyl, offert eller ett jobb.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((r) => (
                <FileIndexRowItem key={r.linkId} row={r} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/**
 * A single index row + its per-file preview affordance. Each row owns its OWN
 * `useActionState(previewEntityFileAction)` so the minted signed URL lives only in THIS row's state
 * (never shared, never logged, never a public URL — R-810). The action carries ONLY the row's
 * `fileId`; the SERVER command re-verifies own-tenant ownership + lifecycle before signing (a
 * foreign id is denied `TENANT_ACCESS_DENIED`, no existence disclosure — R-809/AC5).
 *
 * Honors the SAME 8.3 expiry→refresh contract as the shared `FilePreviewRow` (via the shared
 * `useSignedLinkExpiry` hook): a link minted here that ages out while the row stays mounted flips
 * to a "Länken har gått ut — öppna igen" re-open control that RE-INVOKES the command (a fresh full
 * auth) — the stale URL is NEVER reused (epic-8 review finding).
 */
function FileIndexRowItem({ row }: { readonly row: FileIndexRow }) {
  const [state, formAction, pending] = useActionState<SignedAccessState, FormData>(
    previewEntityFileAction,
    SIGNED_ACCESS_INITIAL,
  );

  const { hasFreshLink, linkExpired } = useSignedLinkExpiry(state);

  return (
    <li
      data-testid="file-index-row"
      className="flex flex-col gap-1 rounded-md border border-zinc-200 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="truncate text-sm font-medium text-zinc-900">
          {row.displayName}
        </span>
        <span
          data-testid="file-index-row-category"
          className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
        >
          {row.ownerCategory}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
        <span>{row.mimeType ?? "Okänd typ"}</span>
        <span>·</span>
        <span>{formatSize(row.sizeBytes) || "—"}</span>
        <span>·</span>
        <span>Uppladdad: {formatDate(row.createdAt)}</span>
      </div>
      <form action={formAction} className="mt-1 flex flex-col gap-1">
        {/* The action carries ONLY the file id — the server binds it to the caller's own tenant. */}
        <input type="hidden" name="file_id" value={row.fileId} />
        {!linkExpired ? (
          <button
            type="submit"
            disabled={pending}
            data-testid="file-index-preview-button"
            className="inline-flex w-fit items-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-zinc-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {pending ? "Öppnar…" : state.status === "success" ? "Öppna igen" : "Förhandsgranska"}
          </button>
        ) : (
          <>
            {/* EXPIRY → REFRESH (AC2): the stale URL is NOT reused. A generic text status (not
                color-only) + a re-open submit that RE-INVOKES the command (a fresh full auth). */}
            <p
              role="status"
              data-testid="file-index-preview-expired"
              className="text-xs text-amber-800"
            >
              Länken har gått ut.
            </p>
            <button
              type="submit"
              disabled={pending}
              data-testid="file-index-preview-reopen"
              className="inline-flex w-fit items-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-zinc-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {pending ? "Öppnar…" : "Länken har gått ut — öppna igen"}
            </button>
          </>
        )}
      </form>
      {hasFreshLink && state.signedUrl ? (
        <a
          href={state.signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="file-index-preview-link"
          className="w-fit text-sm text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Öppna fil (tidsbegränsad länk)
        </a>
      ) : null}
      {state.status === "error" && state.formError ? (
        <p
          role="alert"
          data-testid="file-index-preview-error"
          className="text-sm text-red-800"
        >
          {state.formError}
        </p>
      ) : null}
    </li>
  );
}
