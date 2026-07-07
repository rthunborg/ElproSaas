"use client";

/**
 * Job acceptance-evidence surface (Story 7.3, Task 3.1 / AC1). Displays the acceptance evidence:
 * a signed-preview affordance for a linked evidence FILE (via `previewJobEvidenceAction` →
 * `createSignedFileAccess`, the 8.1 signing funnel REUSED verbatim — never a public URL, never a
 * competing store) AND/OR the external `evidence_reference` text. The 7.1/7.2 capture convention is
 * that exactly ONE shape is present per acceptance (a file OR a reference — never both), but that
 * exclusivity is a prose convention enforced by no DB CHECK. So this surface is DEFENSIVE: if a row
 * ever carries BOTH an evidence file id AND an external reference, it renders BOTH (never silently
 * dropping the reference behind the file branch) so no captured evidence becomes permanently
 * invisible on the money-critical job detail (epic-7 review: evidence exclusivity finding — the
 * DB-XOR CHECK is the stronger option and is ledger-deferred).
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

  const hasFile = Boolean(evidenceFileId);
  const hasReference = Boolean(evidenceReference);

  // Defensive: render the file affordance AND/OR the external reference whenever each is present, so
  // a both-present row (the prose "file OR reference" convention is DB-unenforced) never silently
  // drops the reference behind the file branch. Neither present ⇒ the "no evidence" line.
  return (
    <div data-testid="job-acceptance-evidence" className="flex flex-col gap-2 text-sm">
      {hasFile && (
        <div className="flex flex-col gap-1">
          <span className="text-zinc-800">
            Bevis (fil): {evidenceFileName ?? "Bifogad fil"}
          </span>
          <form action={formAction}>
            <input type="hidden" name="file_id" value={evidenceFileId ?? ""} />
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
      )}
      {hasReference && (
        <span className="text-zinc-800">Bevis (extern referens): {evidenceReference}</span>
      )}
      {!hasFile && !hasReference && (
        <span className="text-zinc-500">Inget bevis registrerat.</span>
      )}
    </div>
  );
}
