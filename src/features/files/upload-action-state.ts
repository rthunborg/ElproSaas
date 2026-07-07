/**
 * Story 8.2 — the entity-file-upload server-action state contract (Task 4.2).
 *
 * The `useActionState` shape for the `EntityFilePanel` upload form. Maps the `uploadFile`
 * command's typed `Result` to the FOUR distinct user-safe error states (via the pure
 * `classifyUploadError` classifier) WITHOUT leaking internal detail:
 *   - `ok` → the file is uploaded + linked; the entity route revalidates + re-renders (a
 *     success banner is announced via role="status").
 *   - `BLOCKED_TYPE` / `TOO_LARGE` → a VALIDATION_FAILED disambiguated by the client
 *     pre-check discriminant (the raw value is never echoed).
 *   - `PERMISSION` → a generic TENANT_ACCESS_DENIED / FILE_ACCESS_DENIED (no existence
 *     disclosure — R-809; a foreign-owner failure looks identical to a not-found one).
 *   - `NETWORK_OR_SERVER` → a transient, RETRYABLE SERVER_ERROR (never a permanent denial).
 *
 * Mirrors the 6.3 `pdf-action-state.ts` shape so the panel reuses the same a11y/error
 * wiring without inventing a mechanism. NO raw input, stack, SQL, or tenant/user-existence
 * signal is ever carried.
 */
import type { UploadErrorState } from "@/server/storage/upload-error-classifier";

/** The status discriminant of an upload action result. */
export type UploadActionStatus = "idle" | "success" | "error";

/** The state `useActionState` carries for the entity-file upload form. */
export interface UploadActionState {
  readonly status: UploadActionStatus;
  /** The classified error state (when status === "error"); null otherwise. */
  readonly errorState: UploadErrorState | null;
  /** A generic, user-safe message. */
  readonly formError: string | null;
  /** The uploaded file id on success. */
  readonly fileId: string | null;
}

/** The initial, pristine upload state. */
export const UPLOAD_ACTION_INITIAL: UploadActionState = {
  status: "idle",
  errorState: null,
  formError: null,
  fileId: null,
};

/** The Swedish user-safe message for each of the four distinct error states. */
export const UPLOAD_ERROR_MESSAGES: Record<UploadErrorState, string> = {
  BLOCKED_TYPE:
    "Filtypen stöds inte. Ladda upp en PDF, bild eller ett vanligt dokument.",
  TOO_LARGE:
    "Filen är för stor. Välj en mindre fil och försök igen.",
  NETWORK_OR_SERVER:
    "Uppladdningen kunde inte slutföras just nu. Försök igen om en stund.",
  PERMISSION:
    "Du har inte behörighet att ladda upp en fil här.",
};

/** True iff the upload result is a transient, retryable failure. */
export function isRetryableUploadError(state: UploadActionState): boolean {
  return state.status === "error" && state.errorState === "NETWORK_OR_SERVER";
}
