"use client";

/**
 * Story 8.2, Task 5 — the entity file panel client island (AC1/AC3/AC5).
 *
 * Rendered on a CRM / calculation / quote-acceptance / job entity. Surfaces:
 *   - the ALLOWED file types + the size expectation (from the Task-1 policy display strings);
 *   - the owning entity (name) + the purpose (so each file has a clear owner + purpose);
 *   - the existing linked-files list (from `readEntityFiles` — own-tenant only, never a
 *     cross-tenant file; RLS enforces, the UI adds no cross-tenant read);
 *   - a file `<input>` upload control — with NO raw storage-path / bucket / tenant field
 *     (R-803/R-811: the object path is 100% server-derived);
 *   - the FOUR distinct user-safe error states as `role="alert"` regions, each with its own
 *     `data-testid` (blocked-type / too-large / network-or-server / permission).
 *
 * ── A11Y (AC1/AC3; the epic-6 timeline pattern) ──────────────────────────────────────
 * Status is a NON-COLOR text cue (WCAG 1.4.1). Every control is a real keyboard-operable
 * button/input with an accessible name; `focus-visible` rings throughout. The error alerts
 * are assertive (`role="alert"`), text-not-color.
 *
 * This component is presentation + interaction only — NEVER the security boundary. The
 * upload authority is the `uploadFile` command's server-side gate; the client pre-check
 * (blocked-type / too-large) is a UX nicety that the server re-validates identically.
 */
import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { previewEntityFileAction, uploadFileAction } from "@/features/files/actions";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_SIZE_DISPLAY,
  isAllowedMimeType,
  isWithinSizeLimit,
} from "@/server/storage/upload-policy";
import {
  UPLOAD_ACTION_INITIAL,
  UPLOAD_ERROR_MESSAGES,
} from "@/features/files/upload-action-state";
import {
  SIGNED_ACCESS_INITIAL,
  isSignedUrlExpired,
  type SignedAccessState,
} from "@/features/files/signed-access-state";
import type { UploadErrorState } from "@/server/storage/upload-error-classifier";
import type { EntityFileRow } from "@/features/files/read";
import type { ActiveOwnerType } from "@/server/commands/files/validation";

/** The Swedish label for the panel's purpose (per purpose union member). */
const PURPOSE_LABEL: Record<string, string> = {
  crm_document: "Kunddokument",
  calculation_attachment: "Kalkylbilaga",
  acceptance_evidence: "Acceptansunderlag",
  job_evidence: "Jobbunderlag",
  quote_pdf: "Offert-PDF",
  quote_attachment_snapshot: "Offertbilaga",
};

/** A friendly allowed-types display list (extensions/labels, not raw MIME strings). */
const ALLOWED_TYPES_DISPLAY = "PDF, bilder (PNG/JPEG/WebP/GIF), text/CSV, Word, Excel";

export interface EntityFilePanelProps {
  /**
   * The owning entity's type. Sourced from the single-source-of-truth `ActiveOwnerType`
   * union (derived from `ACTIVE_OWNER_TYPES`) — matching the `readEntityFiles` read type —
   * so the panel prop can never silently drift from the active owner set (Task 2.2).
   */
  readonly ownerType: ActiveOwnerType;
  readonly ownerId: string;
  readonly purpose: string;
  /** The owning entity's display name (shown so the file has a clear owner). */
  readonly ownerLabel: string;
  /** The existing linked files (own-tenant only — from readEntityFiles). */
  readonly files: readonly EntityFileRow[];
  /** A generic read-error signal (never a cross-tenant leak); null when the read succeeded. */
  readonly readError?: string | null;
  /**
   * An explicit route to revalidate after a successful upload (for facility/contact/
   * acceptance panels that render inside a parent detail route). Optional.
   */
  readonly revalidatePath?: string;
  /**
   * A data-testid NAMESPACE suffix. When multiple panels render on the SAME page (e.g. the
   * customer's own panel PLUS a panel per facility/contact), the SECONDARY panels pass a
   * unique suffix (e.g. the facility id) so their testids stay individually addressable and
   * the page's canonical `entity-file-panel` resolves to the PRIMARY (owner) panel only.
   * Absent → the canonical unsuffixed testids (the primary panel + the E2E contract).
   */
  readonly testIdSuffix?: string;
}

/** Format a byte count as a compact human size for the list. */
function formatSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function EntityFilePanel(props: EntityFilePanelProps) {
  const [state, action, pending] = useActionState(
    uploadFileAction,
    UPLOAD_ACTION_INITIAL,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Namespace the testids when a suffix is provided (secondary panels on a multi-panel page).
  const suffix = props.testIdSuffix ? `-${props.testIdSuffix}` : "";
  const tid = (base: string) => `${base}${suffix}`;
  // The client-side pre-check verdict (blocked-type / too-large) computed on file selection —
  // instant feedback BEFORE the server round-trip. The server re-validates identically.
  const [clientError, setClientError] = useState<UploadErrorState | null>(null);

  // The effective error state to render: the client pre-check verdict (instant) OR the
  // server-classified state from the last submit.
  const errorState: UploadErrorState | null =
    clientError ?? (state.status === "error" ? state.errorState : null);
  const errorMessage =
    clientError !== null
      ? UPLOAD_ERROR_MESSAGES[clientError]
      : state.status === "error"
        ? state.formError
        : null;

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0] ?? null;
    if (!file) {
      setClientError(null);
      return;
    }
    const mime = (file.type || "").trim().toLowerCase();
    if (!isAllowedMimeType(mime)) {
      setClientError("BLOCKED_TYPE");
      return;
    }
    if (!isWithinSizeLimit(file.size)) {
      setClientError("TOO_LARGE");
      return;
    }
    setClientError(null);
  }

  const headingId = `entity-file-panel-heading${suffix}`;
  const inputId = `entity-file-input${suffix}`;

  return (
    <section
      data-testid={tid("entity-file-panel")}
      aria-labelledby={headingId}
      className="rounded-lg border border-zinc-200 bg-white p-4 text-sm"
    >
      <h3 id={headingId} className="mb-2 font-medium text-zinc-800">
        Filer
      </h3>

      {/* The owning entity + purpose — each file has a clear owner + purpose (AC1). */}
      <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-zinc-700">
        <dt className="text-zinc-500">Ägare</dt>
        <dd data-testid={tid("file-panel-owner")}>{props.ownerLabel}</dd>
        <dt className="text-zinc-500">Syfte</dt>
        <dd data-testid={tid("file-panel-purpose")}>
          {PURPOSE_LABEL[props.purpose] ?? props.purpose}
        </dd>
      </dl>

      {/* Allowed types + size expectation (from the Task-1 policy display strings). */}
      <p data-testid={tid("file-panel-allowed-types")} className="text-zinc-600">
        Tillåtna filtyper: {ALLOWED_TYPES_DISPLAY}.
      </p>
      <p data-testid={tid("file-panel-size-limit")} className="text-zinc-600">
        Max filstorlek: {MAX_UPLOAD_SIZE_DISPLAY}.
      </p>

      {/* The upload form — a file <input> + submit. NO raw path / bucket / tenant field. */}
      <form action={action} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="owner_type" value={props.ownerType} />
        <input type="hidden" name="owner_id" value={props.ownerId} />
        <input type="hidden" name="purpose" value={props.purpose} />
        {props.revalidatePath ? (
          <input type="hidden" name="revalidate_path" value={props.revalidatePath} />
        ) : null}
        <label className="font-medium text-zinc-700" htmlFor={inputId}>
          Välj en fil att ladda upp
        </label>
        <input
          id={inputId}
          ref={fileInputRef}
          data-testid={tid("file-input")}
          type="file"
          name="file"
          onChange={onFileChange}
          className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-800 hover:file:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        />
        {/* The submit stays ENABLED even on a client pre-check verdict — the client error is
            ADVISORY (instant feedback); the SERVER remains the authority and re-validates on
            submit (a client bypass is still rejected server-side, R-808). Only a pending submit
            disables it. */}
        <button
          type="submit"
          disabled={pending}
          data-testid={tid("file-upload-submit")}
          className="w-fit rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
        >
          {pending ? "Laddar upp…" : "Ladda upp fil"}
        </button>
      </form>

      {/* Success announcement (non-color text cue, announced). */}
      {state.status === "success" ? (
        <p role="status" data-testid={tid("file-upload-success")} className="mt-2 text-green-800">
          Filen laddades upp.
        </p>
      ) : null}

      {/* The FOUR distinct user-safe error states — each a role="alert" with its data-testid.
          Only the ACTIVE state renders; the four testids never collapse into one region. */}
      {errorState === "BLOCKED_TYPE" ? (
        <p role="alert" data-testid={tid("file-error-blocked-type")} className="mt-2 text-red-800">
          {errorMessage ?? UPLOAD_ERROR_MESSAGES.BLOCKED_TYPE}
        </p>
      ) : null}
      {errorState === "TOO_LARGE" ? (
        <p role="alert" data-testid={tid("file-error-too-large")} className="mt-2 text-red-800">
          {errorMessage ?? UPLOAD_ERROR_MESSAGES.TOO_LARGE}
        </p>
      ) : null}
      {errorState === "NETWORK_OR_SERVER" ? (
        <p
          role="alert"
          data-testid={tid("file-error-network-or-server")}
          className="mt-2 text-amber-800"
        >
          {errorMessage ?? UPLOAD_ERROR_MESSAGES.NETWORK_OR_SERVER}
        </p>
      ) : null}
      {errorState === "PERMISSION" ? (
        <p role="alert" data-testid={tid("file-error-permission")} className="mt-2 text-red-800">
          {errorMessage ?? UPLOAD_ERROR_MESSAGES.PERMISSION}
        </p>
      ) : null}

      {/* The existing linked-files list (own-tenant only; RLS enforces). */}
      <div className="mt-4">
        <h4 className="mb-1 font-medium text-zinc-700">Uppladdade filer</h4>
        {props.readError ? (
          <p role="alert" data-testid={tid("file-panel-list-error")} className="text-red-800">
            {props.readError}
          </p>
        ) : (
          <ul data-testid={tid("file-panel-existing-list")} className="flex flex-col gap-1">
            {props.files.length === 0 ? (
              <li data-testid={tid("file-panel-empty")} className="text-zinc-500">
                Inga filer uppladdade ännu.
              </li>
            ) : (
              props.files.map((f, i) => (
                <FilePreviewRow key={f.linkId} file={f} tid={tid} index={i} />
              ))
            )}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * A single listed-file row with its per-file preview/download affordance (Story 8.3, Task 3).
 *
 * Each row owns its OWN `useActionState(previewEntityFileAction)` so the minted signed URL
 * lives only in THIS row's state — never shared across files, never logged, never a public URL
 * (R-810). The affordance:
 *   - a per-row form → `previewEntityFileAction` carrying ONLY the row's `fileId` (the SERVER
 *     command re-verifies own-tenant ownership + lifecycle before signing — the client shape is
 *     a UX choice, never the security boundary);
 *   - on success → a time-limited `<a target="_blank" rel="noopener noreferrer">` ("Öppna fil
 *     (tidsbegränsad länk)"); once the returned `expiresAt` has passed (the pure
 *     `isSignedUrlExpired` verdict), the stale link is HIDDEN and a "Länken har gått ut — öppna
 *     igen" control RE-SUBMITS the form (re-invoking the command = a fresh full auth — the stale
 *     URL is NEVER reused, AC2);
 *   - on error → a generic `role="alert"` message (no raw path, no existence disclosure, R-809);
 *   - while pending → a disabled "Öppnar…" button.
 *
 * NO raw `object_path` / `bucket_id` is ever rendered — the list row carries only display-safe
 * fields from `readEntityFiles`, and the signed URL is the ONLY storage handle the client sees.
 * The preview does NOT re-fetch/re-render the panel (no `router.refresh`) — the mint is a
 * client-triggered action returning state; the LIST stays the server-fetched prop (Task 3.4).
 */
function FilePreviewRow({
  file,
  tid,
  index,
}: {
  readonly file: EntityFileRow;
  readonly tid: (base: string) => string;
  readonly index: number;
}) {
  const [state, formAction, pending] = useActionState<SignedAccessState, FormData>(
    previewEntityFileAction,
    SIGNED_ACCESS_INITIAL,
  );
  // A per-row testid: the canonical unsuffixed base (via `tid`) for the FIRST row keeps the E2E
  // `.first()` contract stable; each row also gets an index suffix so multiple files stay
  // individually addressable on a multi-file panel.
  const rowSuffix = index === 0 ? "" : `-${index}`;
  const rid = (base: string) => `${tid(base)}${rowSuffix}`;

  // Re-evaluate the expiry verdict on a wall-clock tick so a link that ages out flips to the
  // "open again" affordance WITHOUT a full re-render of the panel (Task 3.2/3.4). `nowMs` is the
  // client's current instant; the pure `isSignedUrlExpired` owns the comparison (never the DOM).
  // We only ever advance `nowMs` from a scheduled timer (never synchronously in the effect body),
  // so an already-expired link is flipped via a 0ms timer — no cascading synchronous re-render.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    if (state.status !== "success" || state.expiresAt === null) return;
    const expiryMs = Date.parse(state.expiresAt);
    if (!Number.isFinite(expiryMs)) return;
    const remaining = expiryMs - Date.now();
    // Flip to "expired" exactly when the link ages out (or immediately, via 0ms, for a link that
    // arrives already past). One bounded timer per active link; cleared on state change/unmount.
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
        {/* When the current link has NOT expired, the primary button is a plain "open"/pending.
            Once it expires, the SAME submit becomes the re-open control (a fresh full auth). */}
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
    </li>
  );
}

/** The allowed MIME types re-exported for a client accept hint (kept in sync with the policy). */
export const ENTITY_FILE_ACCEPT = ALLOWED_MIME_TYPES.join(",");
