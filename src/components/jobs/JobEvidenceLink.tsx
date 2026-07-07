"use client";

/**
 * Job acceptance-evidence surface (Story 7.3, Task 3.1 / AC1). Displays the acceptance evidence:
 * either a signed-preview affordance for a linked evidence FILE (via `previewJobEvidenceAction` →
 * `createSignedFileAccess`, the 8.1 signing funnel REUSED verbatim — never a public URL, never a
 * competing store) OR the external `evidence_reference` text. Exactly one shape is present per
 * acceptance (the 7.1/7.2 capture stores a file OR a reference — never both).
 */
import { useActionState } from "react";
import { previewJobEvidenceAction } from "@/features/jobs/actions";
import {
  JOB_EVIDENCE_PREVIEW_INITIAL,
  type JobEvidencePreviewState,
} from "@/features/jobs/evidence-preview-state";

export interface JobEvidenceLinkProps {
  readonly evidenceFileId: string | null;
  readonly evidenceReference: string | null;
  readonly evidenceFileName: string | null;
}

export function JobEvidenceLink({
  evidenceFileId,
  evidenceReference,
  evidenceFileName,
}: JobEvidenceLinkProps) {
  const [state, formAction, pending] = useActionState<
    JobEvidencePreviewState,
    FormData
  >(previewJobEvidenceAction, JOB_EVIDENCE_PREVIEW_INITIAL);

  if (evidenceFileId) {
    return (
      <div data-testid="job-acceptance-evidence" className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-800">
          Bevis (fil): {evidenceFileName ?? "Bifogad fil"}
        </span>
        <form action={formAction}>
          <input type="hidden" name="file_id" value={evidenceFileId} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex w-fit items-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-zinc-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {pending ? "Öppnar…" : "Öppna bevis"}
          </button>
        </form>
        {state.status === "success" && state.signedUrl && (
          <a
            href={state.signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Visa bevisfil (tidsbegränsad länk)
          </a>
        )}
        {state.status === "error" && state.formError && (
          <p role="alert" className="text-sm text-red-800">
            {state.formError}
          </p>
        )}
      </div>
    );
  }

  return (
    <div data-testid="job-acceptance-evidence" className="text-sm text-zinc-800">
      {evidenceReference ? (
        <span>Bevis (extern referens): {evidenceReference}</span>
      ) : (
        <span className="text-zinc-500">Inget bevis registrerat.</span>
      )}
    </div>
  );
}
