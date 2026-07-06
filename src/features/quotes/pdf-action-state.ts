/**
 * Story 6.3 — the PDF-panel server-action state contracts (Task 5.1/5.2).
 *
 * Two `useActionState` shapes for the six-state PDF panel:
 *   - `QuotePdfActionState` — the generate/retry action result (a status discriminant + a generic
 *     user-safe error; NO raw input/stack/SQL/tenant-existence signal).
 *   - `QuotePdfPreviewState` — the preview/download action result: a SHORT-LIVED SIGNED URL (never
 *     a public URL) minted via `createSignedFileAccess`, or a generic error.
 *
 * Mirrors the 6.2 `action-state.ts` shape so the panel reuses the same a11y/error wiring without
 * inventing a mechanism. A transient `SERVER_ERROR` is a RETRYABLE failure (not a permanent
 * denial). NO signed URL is ever logged; it lives only in the returned state for the client.
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

/** The status discriminant of a generate/retry PDF action. */
export type QuotePdfActionStatus = "idle" | "success" | "error";

/** The state `useActionState` carries for the generate/retry action. */
export interface QuotePdfActionState {
  readonly status: QuotePdfActionStatus;
  /** The stable error code (when status === "error"); null otherwise. */
  readonly code: CommandErrorCode | null;
  /** A generic, user-safe message. */
  readonly formError: string | null;
  /** The affected version id on success. */
  readonly targetId: string | null;
}

/** The initial, pristine generate/retry state. */
export const QUOTE_PDF_ACTION_INITIAL: QuotePdfActionState = {
  status: "idle",
  code: null,
  formError: null,
  targetId: null,
};

/** True iff the generate/retry result is a transient, retryable failure. */
export function isRetryableQuotePdfError(state: QuotePdfActionState): boolean {
  return state.status === "error" && state.code === "SERVER_ERROR";
}

/** The state `useActionState` carries for the preview/download action. */
export interface QuotePdfPreviewState {
  readonly status: QuotePdfActionStatus;
  readonly code: CommandErrorCode | null;
  readonly formError: string | null;
  /** The SHORT-LIVED signed URL (never a public URL); null until a successful sign. */
  readonly signedUrl: string | null;
  /** The signed-URL expiry instant (ISO); null until success. */
  readonly expiresAt: string | null;
}

/** The initial, pristine preview state. */
export const QUOTE_PDF_PREVIEW_INITIAL: QuotePdfPreviewState = {
  status: "idle",
  code: null,
  formError: null,
  signedUrl: null,
  expiresAt: null,
};
