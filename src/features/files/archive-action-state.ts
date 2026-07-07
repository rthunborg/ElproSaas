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
import { COMMAND_MESSAGES } from "@/server/commands/command-errors";

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
