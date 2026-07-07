/**
 * The job evidence-preview action-state contract (Story 7.3, Task 3.1). The `useActionState` shape
 * for the "preview evidence" affordance on the job detail — maps the `createSignedFileAccess`
 * command's `Result` to a UI-renderable shape WITHOUT leaking internal detail. Mirrors the quote
 * PDF-preview state so the affordance reuses the same a11y/error wiring (never a new mechanism).
 *
 * The signed URL lives ONLY in this state (never logged, never a public URL). A
 * `TENANT_ACCESS_DENIED`/`FILE_ACCESS_DENIED` maps to a generic Swedish message; a transient
 * `SERVER_ERROR` is a RETRYABLE failure.
 */
import type { CommandErrorCode } from "@/server/commands/command-errors";

export type JobEvidencePreviewStatus = "idle" | "success" | "error";

export interface JobEvidencePreviewState {
  readonly status: JobEvidencePreviewStatus;
  readonly code: CommandErrorCode | null;
  readonly formError: string | null;
  /** The short-lived signed URL for the evidence file on success. */
  readonly signedUrl: string | null;
  /** The ISO expiry of the signed URL on success. */
  readonly expiresAt: string | null;
}

export const JOB_EVIDENCE_PREVIEW_INITIAL: JobEvidencePreviewState = {
  status: "idle",
  code: null,
  formError: null,
  signedUrl: null,
  expiresAt: null,
};
