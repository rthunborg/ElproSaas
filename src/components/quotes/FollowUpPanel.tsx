"use client";

/**
 * Follow-up orchestrator (Story 10.3, Task 5.1/5.2/5.3) — the ALWAYS-MOUNTED follow-up surface on a
 * SENT version. It OWNS the `completeQuoteFollowUp` action (not the sheet) so the "just completed →
 * show the decide-here jumps" transition is reliable: on success the page revalidates and the open
 * follow-up becomes completed, so the completion sheet unmounts — a success detector inside the sheet
 * would never fire. Deriving the jumps from the panel's own action state (no local flag, no effect)
 * survives that revalidation. It renders exactly one of:
 *   - the `Planera uppföljning` dialog (`PlanFollowUpButton`) when there is NO open follow-up;
 *   - the `Klarmarkera` completion sheet (`FollowUpSheet`) when there IS an open follow-up;
 *   - the decide-here JUMPS after a completion: `planera nästa` (re-open the plan dialog), the shipped
 *     10.2 `MarkLostButton` (`Markera som förlorad/avböjd`), and the 6.5 `CreateNewVersionButton`
 *     (`Ny version`) — reusing the existing affordances, never forking a second path.
 *
 * The one-open-per-quote rule is DB-enforced; this UI is the MIRROR. The pipeline read-model /
 * aggregation is Story 10.4 — this panel only surfaces the plan/complete/jumps affordances.
 */
import { useActionState, useEffect, useState } from "react";
import { completeQuoteFollowUpAction } from "@/features/quotes/actions";
import { FOLLOW_UP_ACTION_INITIAL } from "@/features/quotes/follow-up-action-state";
import { FollowUpSheet } from "./FollowUpSheet";
import { PlanFollowUpButton } from "./PlanFollowUpButton";
import { MarkLostButton } from "./MarkLostButton";
import { CreateNewVersionButton } from "./CreateNewVersionButton";

export interface FollowUpPanelProps {
  readonly quoteId: string;
  readonly quoteVersionId: string;
  /** The quote's single OPEN follow-up (the one-open invariant), or null when none is open. */
  readonly openFollowUp: {
    readonly id: string;
    readonly due_date: string;
    readonly note: string | null;
  } | null;
  /**
   * Story 10.4 review: notify the parent when the decide-here JUMPS branch is active, so the parent can
   * SUPPRESS its standalone `MarkLostButton` / `CreateNewVersionButton` while the jumps render their own
   * copies — one visible owner per affordance at a time (no duplicated accessible name / data-testid).
   */
  readonly onJumpsActiveChange?: (active: boolean) => void;
}

export function FollowUpPanel({
  quoteId,
  quoteVersionId,
  openFollowUp,
  onJumpsActiveChange,
}: FollowUpPanelProps) {
  const [completeState, completeAction, completePending] = useActionState(
    completeQuoteFollowUpAction,
    FOLLOW_UP_ACTION_INITIAL,
  );
  // "planera nästa" was chosen after a completion (force the plan dialog). `dismissedTarget` records the
  // COMPLETED follow-up id whose jumps we retired, so a fresh plan lands back on the Klarmarkera sheet —
  // yet a LATER completion (a NEW follow-up id) shows its jumps again. This replaces the old one-way
  // `dismissedJumps` boolean latch that silently killed the 2nd+ completion's jumps until a reload.
  const [planNext, setPlanNext] = useState(false);
  const [dismissedTarget, setDismissedTarget] = useState<string | null>(null);

  // The decide-here jumps are DERIVED from the completion success (no local flag, no effect) so they
  // survive the completion's page revalidation (which unmounts the sheet as the follow-up completes).
  // `completedId` is the just-completed follow-up id; jumps show unless THAT target was dismissed.
  const completedId =
    completeState.status === "success" ? completeState.targetId ?? null : null;
  const showJumps = completedId !== null && completedId !== dismissedTarget;

  // Notify the parent so it can retire its standalone lost/new-version affordances while jumps own them.
  // The cleanup RESETS the flag to false — critical on UNMOUNT: in the lost-from-jumps path, submitting
  // `MarkLostButton` flips the version sent→lost, so this panel unmounts while the flag is still true;
  // without the reset the terminal read-only view would keep suppressing `CreateNewVersionButton` via
  // `!jumpsActive`, hiding the documented revive path until a reload (integration review F2). The parent
  // passes a stable `setJumpsActive` setter, so the cleanup does not thrash on re-render.
  useEffect(() => {
    onJumpsActiveChange?.(showJumps);
    return () => onJumpsActiveChange?.(false);
  }, [showJumps, onJumpsActiveChange]);

  if (planNext) {
    return (
      <PlanFollowUpButton
        quoteId={quoteId}
        quoteVersionId={quoteVersionId}
        autoOpen
        onPlanned={() => setPlanNext(false)}
      />
    );
  }

  if (showJumps) {
    return (
      <section
        data-testid="follow-up-jumps"
        aria-label="Uppföljning – nästa steg"
        className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
      >
        <h3 className="text-sm font-semibold text-zinc-900">Uppföljning</h3>
        <p role="status" className="text-sm text-green-800">
          Uppföljningen är klarmarkerad. Vad vill du göra härnäst?
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex justify-start">
            <button
              type="button"
              data-testid="follow-up-plan-next"
              onClick={() => {
                setDismissedTarget(completedId);
                setPlanNext(true);
              }}
              className="rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              planera nästa
            </button>
          </div>
          {/* Reuse the shipped 10.2 mark-lost affordance + the 6.5 new-version affordance. */}
          <MarkLostButton quoteId={quoteId} quoteVersionId={quoteVersionId} />
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900">Ny version</h3>
            <CreateNewVersionButton quoteId={quoteId} quoteVersionId={quoteVersionId} />
          </div>
        </div>
      </section>
    );
  }

  if (openFollowUp) {
    return (
      <FollowUpSheet
        quoteId={quoteId}
        quoteVersionId={quoteVersionId}
        followUpId={openFollowUp.id}
        formAction={completeAction}
        state={completeState}
        pending={completePending}
      />
    );
  }

  return <PlanFollowUpButton quoteId={quoteId} quoteVersionId={quoteVersionId} />;
}
