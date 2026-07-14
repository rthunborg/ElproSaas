"use client";

/**
 * `/files` list-page upload (owner decision 2026-07-14 — list-page create entry points): the
 * "Ladda upp fil" affordance on the Filer index. An inline-expanding form (the `CalculationList`
 * "Ny kalkyl" pattern): owner-TYPE select → owner select → file input, submitted through the
 * EXISTING `uploadFileAction` → `uploadFile` command VERBATIM (no new command, no new signing/
 * storage path — R-814; the server-side MIME/size/owner/purpose gate is the authority, the client
 * pre-check is a UX nicety it re-validates identically).
 *
 * The PURPOSE is DERIVED from the picked owner type (customer→crm_document,
 * calculation→calculation_attachment, job→job_evidence — the same fixed mapping as the entity
 * panels) — never a free client choice. The owner stays REQUIRED (no tenant-level/orphan file —
 * spec Never). On success the island `router.refresh()`es so the index re-reads (the action's own
 * revalidate targets the OWNER entity route, not `/files`), and the FORM BODY REMOUNTS (keyed on
 * the new fileId) so the file input + pickers reset — the same file can't be resubmitted
 * accidentally (double-submit guard) and the DOM can never desync from the derived-purpose state.
 *
 * Mirrors `EntityFilePanel`'s upload wiring (pre-check verdicts + the four distinct user-safe
 * error states as role="alert" regions). The success announcement and any error region are
 * MUTUALLY EXCLUSIVE: re-touching the file input marks the previous submit outcome STALE (no
 * "Filen laddades upp" beside a fresh blocked-type verdict, and no stale server error masking a
 * new selection). NO raw storage-path / bucket / tenant field.
 */
import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { SelectField } from "@/components/crm/FormField";
import { uploadFileAction } from "@/features/files/actions";
import {
  MAX_UPLOAD_SIZE_DISPLAY,
  isAllowedMimeType,
  isWithinSizeLimit,
} from "@/server/storage/upload-policy";
import {
  UPLOAD_ACTION_INITIAL,
  UPLOAD_ERROR_MESSAGES,
  type UploadActionState,
} from "@/features/files/upload-action-state";
import type { UploadErrorState } from "@/server/storage/upload-error-classifier";

/** The offered owner types + their FIXED derived purpose (the entity-panel mapping — closed). */
const UPLOAD_OWNER_TYPES = ["customer", "calculation", "job"] as const;
export type UploadOwnerType = (typeof UPLOAD_OWNER_TYPES)[number];

const OWNER_TYPE_LABELS: Record<UploadOwnerType, string> = {
  customer: "Kund",
  calculation: "Kalkyl",
  job: "Jobb",
};

/** The purpose is DERIVED from the owner type — never a free client choice. */
const OWNER_TYPE_PURPOSES: Record<UploadOwnerType, string> = {
  customer: "crm_document",
  calculation: "calculation_attachment",
  job: "job_evidence",
};

export interface UploadOwnerOption {
  readonly id: string;
  readonly label: string;
}

/** The owner option lists per offered owner type (fetched RLS-scoped by the page). */
export interface UploadOwnerOptions {
  readonly customer: readonly UploadOwnerOption[];
  readonly calculation: readonly UploadOwnerOption[];
  readonly job: readonly UploadOwnerOption[];
}

const ALLOWED_TYPES_DISPLAY = "PDF, bilder (PNG/JPEG/WebP/GIF), text/CSV, Word, Excel";

export function FileIndexUpload({
  ownerOptions,
  optionsLoadError = false,
}: {
  readonly ownerOptions: UploadOwnerOptions;
  /** True when ANY owner-options read FAILED — an empty owner list then means "unknown", NOT
   * "nothing to link to", so the form shows a neutral retry message instead of the misleading
   * empty hint (submit stays disabled). */
  readonly optionsLoadError?: boolean;
}) {
  const router = useRouter();
  const [showUpload, setShowUpload] = useState(false);
  const [state, formAction, pending] = useActionState(
    uploadFileAction,
    UPLOAD_ACTION_INITIAL,
  );

  // Success → re-read the index (the action's own revalidate targets the OWNER entity route,
  // not `/files`). A pure side effect — the form reset happens via the key remount below.
  useEffect(() => {
    if (state.status === "success" && state.fileId) {
      router.refresh();
    }
  }, [state.status, state.fileId, router]);

  return (
    <>
      <button
        type="button"
        data-testid="upload-file-button"
        onClick={() => setShowUpload((s) => !s)}
        aria-expanded={showUpload}
        className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        Ladda upp fil
      </button>
      {showUpload && (
        // Keyed on the successful upload's fileId: a success REMOUNTS the body, clearing the
        // file input + pickers to their defaults (double-submit guard; the DOM and the
        // derived-purpose state reset in lockstep — no imperative form.reset() desync).
        <UploadFormBody
          key={state.status === "success" && state.fileId ? state.fileId : "initial"}
          state={state}
          formAction={formAction}
          pending={pending}
          ownerOptions={ownerOptions}
          optionsLoadError={optionsLoadError}
        />
      )}
    </>
  );
}

/** The inline-expanding upload form body (remounted per successful upload — see the key above). */
function UploadFormBody({
  state,
  formAction,
  pending,
  ownerOptions,
  optionsLoadError,
}: {
  readonly state: UploadActionState;
  readonly formAction: (formData: FormData) => void;
  readonly pending: boolean;
  readonly ownerOptions: UploadOwnerOptions;
  readonly optionsLoadError: boolean;
}) {
  const [ownerType, setOwnerType] = useState<UploadOwnerType>("customer");
  // The client-side pre-check verdict (blocked-type / too-large) on file selection — instant
  // feedback BEFORE the round-trip; the server re-validates identically (R-808).
  const [clientError, setClientError] = useState<UploadErrorState | null>(null);
  // The action state the user last RE-TOUCHED the file input against. When it is the CURRENT
  // state, that submit outcome (success OR error) is STALE for display — the fresh pre-check
  // verdict owns the region instead (mutual exclusivity; a new submit result changes the state
  // identity, so it is never born stale). setState happens ONLY in the change handler.
  const [touchedAgainst, setTouchedAgainst] = useState<UploadActionState | null>(null);
  const serverStateStale = touchedAgainst === state;

  const showSuccess =
    state.status === "success" && !serverStateStale && clientError === null;
  const errorState: UploadErrorState | null =
    clientError ??
    (!serverStateStale && state.status === "error" ? state.errorState : null);
  const errorMessage =
    clientError !== null
      ? UPLOAD_ERROR_MESSAGES[clientError]
      : !serverStateStale && state.status === "error"
        ? state.formError
        : null;

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Any new selection invalidates the PREVIOUS submit outcome's display.
    setTouchedAgainst(state);
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

  const owners = ownerOptions[ownerType];

  return (
    <form
      action={formAction}
      data-testid="file-index-upload-form"
      className="flex w-full max-w-xl flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4"
      noValidate
    >
      {/* The purpose is DERIVED from the owner type (a fixed mapping — never a free choice). */}
      <input type="hidden" name="purpose" value={OWNER_TYPE_PURPOSES[ownerType]} />
      <SelectField
        name="owner_type"
        label="Koppla till"
        required
        defaultValue={ownerType}
        onChange={(value) => {
          if ((UPLOAD_OWNER_TYPES as readonly string[]).includes(value)) {
            setOwnerType(value as UploadOwnerType);
          }
        }}
        testId="file-index-upload-owner-type"
        options={UPLOAD_OWNER_TYPES.map((t) => ({
          value: t,
          label: OWNER_TYPE_LABELS[t],
        }))}
      />
      {optionsLoadError ? (
        <p
          role="alert"
          data-testid="file-index-upload-options-error"
          className="text-sm text-red-800"
        >
          Ägarlistorna kunde inte läsas — försök igen om en stund.
        </p>
      ) : owners.length === 0 ? (
        <p className="text-sm text-zinc-600" data-testid="file-index-upload-empty-hint">
          Det finns ingen {OWNER_TYPE_LABELS[ownerType].toLowerCase()} att koppla
          filen till ännu — en fil behöver alltid en ägare.
        </p>
      ) : (
        <SelectField
          key={ownerType /* reset the picked owner when the type changes */}
          name="owner_id"
          label={OWNER_TYPE_LABELS[ownerType]}
          required
          defaultValue=""
          testId="file-index-upload-owner"
          options={[
            { value: "", label: "Välj…" },
            ...owners.map((o) => ({ value: o.id, label: o.label })),
          ]}
        />
      )}
      <p className="text-sm text-zinc-600">
        Tillåtna filtyper: {ALLOWED_TYPES_DISPLAY}. Max filstorlek:{" "}
        {MAX_UPLOAD_SIZE_DISPLAY}.
      </p>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="file-index-upload-input"
          className="text-sm font-medium text-zinc-800"
        >
          Välj en fil att ladda upp
        </label>
        <input
          id="file-index-upload-input"
          data-testid="file-index-upload-input"
          type="file"
          name="file"
          onChange={onFileChange}
          className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-800 hover:file:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        />
      </div>
      <div className="flex justify-end">
        {/* The submit stays ENABLED on a client pre-check verdict — the client error is
            ADVISORY; the SERVER re-validates on submit (R-808). */}
        <button
          type="submit"
          disabled={pending || optionsLoadError || owners.length === 0}
          data-testid="file-index-upload-submit"
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
        >
          {pending ? "Laddar upp…" : "Ladda upp fil"}
        </button>
      </div>

      {/* Mutually exclusive with any error region: a fresh pre-check verdict (or a stale
          server outcome) suppresses the success announcement. */}
      {showSuccess ? (
        <p
          role="status"
          data-testid="file-index-upload-success"
          className="text-sm text-green-800"
        >
          Filen laddades upp.
        </p>
      ) : null}

      {/* The FOUR distinct user-safe error states (mirrors EntityFilePanel). */}
      {errorState === "BLOCKED_TYPE" ? (
        <p role="alert" data-testid="file-index-upload-blocked-type" className="text-sm text-red-800">
          {errorMessage ?? UPLOAD_ERROR_MESSAGES.BLOCKED_TYPE}
        </p>
      ) : null}
      {errorState === "TOO_LARGE" ? (
        <p role="alert" data-testid="file-index-upload-too-large" className="text-sm text-red-800">
          {errorMessage ?? UPLOAD_ERROR_MESSAGES.TOO_LARGE}
        </p>
      ) : null}
      {errorState === "NETWORK_OR_SERVER" ? (
        <p role="alert" data-testid="file-index-upload-network-or-server" className="text-sm text-amber-800">
          {errorMessage ?? UPLOAD_ERROR_MESSAGES.NETWORK_OR_SERVER}
        </p>
      ) : null}
      {errorState === "PERMISSION" ? (
        <p role="alert" data-testid="file-index-upload-permission" className="text-sm text-red-800">
          {errorMessage ?? UPLOAD_ERROR_MESSAGES.PERMISSION}
        </p>
      ) : null}
    </form>
  );
}
