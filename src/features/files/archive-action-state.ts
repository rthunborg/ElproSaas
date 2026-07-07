/**
 * Story 8.5, Task 2.3 — the entity-file ARCHIVE server-action state contract.
 *
 * The `useActionState` shape for the panel/index archive-only affordance. Maps the EXISTING
 * `archiveFile` command's typed `Result` to a user-safe UI state WITHOUT leaking internal detail:
 *   - `ok` → the file is archived; the entity route revalidates + re-renders (the file drops out).
 *   - `LOCKED` → a crafted hard-delete surfaced `FILE_LINK_LOCKED` (the archive-only rule) — a
 *     user-safe locked message (the panel never sends `hardDelete:true`, so this is defensive).
 *   - `PERMISSION` → a generic `TENANT_ACCESS_DENIED` (a foreign id looks identical to not-found —
 *     no existence disclosure, R-809/AC5).
 *   - `NETWORK_OR_SERVER` → a transient, RETRYABLE `SERVER_ERROR`.
 *
 * NO raw input, stack, SQL, or tenant/user-existence signal is ever carried.
 */
import {
  COMMAND_MESSAGES,
  type CommandErrorCode,
} from "@/server/commands/command-errors";

/** The status discriminant of an archive action result. */
export type ArchiveActionStatus = "idle" | "success" | "error";

/** The classified error state of an archive failure. */
export type ArchiveErrorState = "LOCKED" | "PERMISSION" | "NETWORK_OR_SERVER";

/** The state `useActionState` carries for the file archive form. */
export interface ArchiveActionState {
  readonly status: ArchiveActionStatus;
  readonly errorState: ArchiveErrorState | null;
  readonly formError: string | null;
}

/** The initial, pristine archive state. */
export const ARCHIVE_ACTION_INITIAL: ArchiveActionState = {
  status: "idle",
  errorState: null,
  formError: null,
};

/** The Swedish user-safe message per archive error state. */
export const ARCHIVE_ERROR_MESSAGES: Record<ArchiveErrorState, string> = {
  // Reuse the shared FILE_LINK_LOCKED boundary message (one voice).
  LOCKED: COMMAND_MESSAGES.FILE_LINK_LOCKED,
  PERMISSION: "Du har inte behörighet att arkivera den här filen.",
  NETWORK_OR_SERVER:
    "Filen kunde inte arkiveras just nu. Försök igen om en stund.",
};

/**
 * PURE archive-error classifier (Story 8.5, Task 2.3) — maps a failed `archiveFile` command's typed
 * error code to exactly ONE user-safe `ArchiveErrorState`. Pulled OUT of the `"use server"`
 * `archiveFileAction` (a `.tsx`/`"use server"` module escapes the fast `node --test` gate — the same
 * coverage-shape lesson `classifyUploadError` follows) so every branch is unit-covered:
 *   - `FILE_LINK_LOCKED`                         → LOCKED (defensive — the UI always ARCHIVES, never
 *     `hardDelete:true`, so this path shouldn't trip; classified safely regardless);
 *   - `TENANT_ACCESS_DENIED` / `FILE_ACCESS_DENIED` → PERMISSION (R-809 — one generic shape, a foreign
 *     id is indistinguishable from not-found, no existence disclosure);
 *   - any auth/membership denial                 → PERMISSION (generic, no leak);
 *   - `SERVER_ERROR` / anything else / unknown   → NETWORK_OR_SERVER (transient, retryable — never a
 *     more-informative state that would over-disclose, never a throw).
 */
export function classifyArchiveError(
  code: CommandErrorCode | string,
): ArchiveErrorState {
  switch (code) {
    case "FILE_LINK_LOCKED":
      return "LOCKED";
    case "TENANT_ACCESS_DENIED":
    case "FILE_ACCESS_DENIED":
    // Auth/membership denials are ALSO generic permission failures (no existence leak, R-809).
    case "UNAUTHENTICATED":
    case "TENANT_MEMBERSHIP_REQUIRED":
      return "PERMISSION";
    default:
      // Defense-in-depth: SERVER_ERROR + any unmapped code degrade to a GENERIC retryable state
      // (never LOCKED/PERMISSION, which would over-disclose or mislabel; never a throw).
      return "NETWORK_OR_SERVER";
  }
}
