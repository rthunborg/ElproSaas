"use server";

/**
 * Quote-detail server actions (Story 6.2, Task 3.3) — the ONLY write path the quote-detail UI
 * uses. This `"use server"` action wires the React 19 `useActionState` form pattern to the
 * EXISTING `updateDraftQuoteVersion` envelope command. The mutation goes through
 * `runCommand(updateDraftQuoteVersion, { client: createSupabaseServerClient(), input })`:
 *
 *   - `client` is the per-request, cookie-bound RLS server client (anon key ONLY — NEVER a
 *     service-role key; the containment guards enforce this). It NEVER writes a quote table
 *     directly — only the command writes, and only after the server-side re-assert-draft guard.
 *   - `input` is the raw parsed form values; the command's `validateInput` + the draft re-assert
 *     are the authority. The client-side read-only rendering is a UX nicety, not the guarantee.
 *
 * The typed `Result` is mapped to a `QuoteActionState`: `ok` revalidates the detail path;
 * `VALIDATION_FAILED`/`QUOTE_VERSION_NOT_DRAFT`/`TENANT_ACCESS_DENIED` are generic messages;
 * a transient `SERVER_ERROR` is a RETRYABLE failure (NOT a permanent denial). NO new
 * auth/error/audit mechanism, NO direct table write.
 */
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { runCommand, type CommandDbClient } from "@/server/commands/envelope";
import { COMMAND_MESSAGES } from "@/server/commands/command-errors";
import {
  acceptQuoteAndCreateJob,
  annotateQuoteFollowUp,
  completeQuoteFollowUp,
  createNewQuoteVersion,
  createQuoteVersionFromCalculation,
  generateQuotePdf,
  markQuoteVersionLost,
  markQuoteVersionSent,
  planQuoteFollowUp,
  updateDraftQuoteVersion,
} from "@/server/commands/quotes";
import { createSignedFileAccess } from "@/server/commands/files";
import { loadQuoteVersionAnchor } from "@/server/commands/quotes/quote-db";
import { kronorStringToOre } from "@/features/calculations/money-input";
import {
  ACCEPTANCE_ACTION_INITIAL,
  type AcceptanceActionState,
} from "./acceptance-action-state";
import {
  QUOTE_ACTION_INITIAL,
  type QuoteActionState,
} from "./action-state";
import {
  QUOTE_PDF_ACTION_INITIAL,
  QUOTE_PDF_PREVIEW_INITIAL,
  type QuotePdfActionState,
  type QuotePdfPreviewState,
} from "./pdf-action-state";
import {
  MARK_SENT_ACTION_INITIAL,
  type MarkSentActionState,
} from "./mark-sent-action-state";
import {
  LOST_ACTION_INITIAL,
  type LostActionState,
} from "./lost-action-state";
import {
  FOLLOW_UP_ACTION_INITIAL,
  type FollowUpActionState,
} from "./follow-up-action-state";
import {
  NEW_VERSION_ACTION_INITIAL,
  type NewVersionActionState,
} from "./new-version-action-state";
import {
  CREATE_QUOTE_ACTION_INITIAL,
  type CreateQuoteActionState,
} from "./create-quote-action-state";

/**
 * Resolve a version's IMMUTABLE `quote_id` without ever throwing (Codex follow-up).
 *
 * These pre-reads run BEFORE the command envelope validates input, so a crafted-but-malformed
 * `quote_version_id` would make PostgREST raise an invalid-UUID comparison and the Server Action
 * would reject with an infrastructure failure instead of the intended VALIDATION_FAILED state. A
 * transient read failure has the same shape. Returning `undefined` hands control back to each
 * caller's own safe path: the lost action skips the auto-complete (harmless orphan), and the
 * completion action FAILS CLOSED — neither ever widens a scope because a read misbehaved.
 */
async function tryResolveQuoteIdForVersion(
  client: CommandDbClient,
  quoteVersionId: unknown,
): Promise<string | undefined> {
  if (typeof quoteVersionId !== "string" || quoteVersionId.length === 0) return undefined;
  try {
    return (await loadQuoteVersionAnchor(client, quoteVersionId))?.quote_id;
  } catch {
    return undefined;
  }
}

/** Read a string form field (empty → undefined so the field is left unchanged). */
function optionalText(form: FormData, name: string): string | undefined {
  const v = form.get(name);
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Read the string form field, treating a present-but-empty value as an explicit clear (null). */
function clearableText(form: FormData, name: string): string | null | undefined {
  const v = form.get(name);
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * The draft-edit action (React `useActionState` signature: (prevState, formData)). Wires the
 * draft form to the `updateDraftQuoteVersion` command. Only the presentational draft fields are
 * read from the form — status/totals/lines are NEVER accepted here.
 */
export async function updateDraftQuoteVersionAction(
  _prev: QuoteActionState,
  form: FormData,
): Promise<QuoteActionState> {
  const quoteVersionId = form.get("quote_version_id");
  const quoteId = form.get("quote_id");
  const values: Record<string, string> = {};
  const introText = clearableText(form, "intro_text");
  const customerNotes = clearableText(form, "customer_notes");
  const validUntil = optionalText(form, "valid_until");
  const displayMode = optionalText(form, "display_mode");
  if (typeof form.get("intro_text") === "string")
    values.intro_text = String(form.get("intro_text") ?? "");
  if (typeof form.get("customer_notes") === "string")
    values.customer_notes = String(form.get("customer_notes") ?? "");
  if (validUntil !== undefined) values.valid_until = validUntil;
  if (displayMode !== undefined) values.display_mode = displayMode;

  const input: Record<string, unknown> = {
    quote_version_id: quoteVersionId,
  };
  // Only carry a field the form actually submitted (an absent field = unchanged).
  if (form.has("intro_text")) input.intro_text = introText ?? null;
  if (form.has("customer_notes")) input.customer_notes = customerNotes ?? null;
  if (form.has("valid_until")) input.valid_until = validUntil ?? null;
  if (form.has("display_mode")) input.display_mode = displayMode ?? null;

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(updateDraftQuoteVersion, { client, input });

  if (result.ok) {
    if (typeof quoteId === "string" && quoteId.length > 0) {
      revalidatePath(`/quotes/${quoteId}`);
      // The editor is also rendered from the version subroute; revalidate it too so a save
      // made there refreshes the server-rendered snapshot fields (both pages are
      // `force-dynamic`, but revalidating the parent path alone leaves the subroute stale).
      if (typeof quoteVersionId === "string" && quoteVersionId.length > 0) {
        revalidatePath(`/quotes/${quoteId}/versions/${quoteVersionId}`);
      }
    }
    return {
      ...QUOTE_ACTION_INITIAL,
      status: "success",
      targetId: result.data.targetId,
    };
  }

  return {
    ...QUOTE_ACTION_INITIAL,
    status: "error",
    code: result.code,
    formError: result.message || COMMAND_MESSAGES[result.code],
    values,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 6.3 — the PDF-panel server actions (generate/retry + preview/download).
//
// These `"use server"` actions are the ONLY write/sign path the six-state PDF panel uses.
// generate/retry → `generateQuotePdf`; preview/download → `createSignedFileAccess` (mint a
// SHORT-LIVED SIGNED URL, never a public URL). Both run on the per-request RLS server client
// (anon key — NEVER service-role). After a generate/retry, revalidate BOTH `/quotes/[quoteId]`
// AND the version subroute (the 6.2 review found a subroute-revalidation gap — do NOT repeat it).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The generate/retry action (React `useActionState` signature). Wires the PDF panel's Generate /
 * Retry button to `generateQuotePdf`. Only the version id is read from the form (never any
 * customer/money value); the command reads the frozen snapshot server-side.
 */
export async function generateQuotePdfAction(
  _prev: QuotePdfActionState,
  form: FormData,
): Promise<QuotePdfActionState> {
  const quoteVersionId = form.get("quote_version_id");
  const quoteId = form.get("quote_id");
  const input: Record<string, unknown> = { quote_version_id: quoteVersionId };

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(generateQuotePdf, { client, input });

  if (result.ok) {
    if (typeof quoteId === "string" && quoteId.length > 0) {
      revalidatePath(`/quotes/${quoteId}`);
      // Revalidate the version subroute too (the 6.2 review's subroute-revalidation fix) so a
      // generate/retry made there refreshes the server-rendered PDF status.
      if (typeof quoteVersionId === "string" && quoteVersionId.length > 0) {
        revalidatePath(`/quotes/${quoteId}/versions/${quoteVersionId}`);
      }
    }
    return {
      ...QUOTE_PDF_ACTION_INITIAL,
      status: "success",
      targetId: result.data.targetId,
    };
  }

  return {
    ...QUOTE_PDF_ACTION_INITIAL,
    status: "error",
    code: result.code,
    formError: result.message || COMMAND_MESSAGES[result.code],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 6.4 — the mark-sent server action (the ONLY write path the "Markera som skickad"
// affordance uses). Wires the DRAFT branch's mark-sent button to `markQuoteVersionSent`. Only
// the version id + optional recorded channel/reference are read from the form (never any
// status/tenant/totals — the command re-asserts draft server-side + gates readiness + runs the
// narrow RPC on the RLS client). After a successful send, revalidate BOTH `/quotes/[quoteId]`
// AND the version subroute (the 6.2/6.3 subroute-revalidation discipline — do NOT repeat the 6.2
// gap) so the version re-renders the READ-ONLY branch.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The mark-sent action (React `useActionState` signature). Wires the draft's "Markera som
 * skickad" button to `markQuoteVersionSent`. Only the version id + optional channel/reference are
 * read; the server command is the authority (the UI read-only state is a convenience).
 */
export async function markQuoteVersionSentAction(
  _prev: MarkSentActionState,
  form: FormData,
): Promise<MarkSentActionState> {
  const quoteVersionId = form.get("quote_version_id");
  const quoteId = form.get("quote_id");
  const input: Record<string, unknown> = { quote_version_id: quoteVersionId };
  // OPTIONAL recorded free-text channel/reference (never a send integration).
  const channel = optionalText(form, "channel");
  const reference = optionalText(form, "reference");
  if (channel !== undefined) input.channel = channel;
  if (reference !== undefined) input.reference = reference;

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(markQuoteVersionSent, { client, input });

  if (result.ok) {
    if (typeof quoteId === "string" && quoteId.length > 0) {
      revalidatePath(`/quotes/${quoteId}`);
      // Revalidate the version subroute too so the sent version re-renders READ-ONLY there.
      if (typeof quoteVersionId === "string" && quoteVersionId.length > 0) {
        revalidatePath(`/quotes/${quoteId}/versions/${quoteVersionId}`);
      }
    }
    return {
      ...MARK_SENT_ACTION_INITIAL,
      status: "success",
      targetId: result.data.targetId,
    };
  }

  return {
    ...MARK_SENT_ACTION_INITIAL,
    status: "error",
    code: result.code,
    formError: result.message || COMMAND_MESSAGES[result.code],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 6.5 — the new-version server action (the ONLY write path the activated "Skapa ny version"
// affordance uses). Wires the read-only branch's create-new-version button to
// `createNewQuoteVersion`. Only the PARENT `quote_version_id` (+ optional re-selected
// `attachment_file_ids`) is read from the form — status/tenant/totals are NEVER accepted (the
// command re-captures the fresh snapshot server-side + runs the narrow RPC on the RLS client).
// After a successful create, revalidate BOTH `/quotes/[quoteId]` AND the NEW version subroute (the
// 6.2/6.3/6.4 subroute-revalidation discipline — do NOT repeat the 6.2 gap) so the admin lands on
// the editable NEW draft. The UI is the MIRROR of the INT-proven server + DB enforcement, never the
// guarantee (a UI-only versioning rule is a STOP condition — architecture §9).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The create-new-version action (React `useActionState` signature). Wires the read-only branch's
 * "Skapa ny version" button to `createNewQuoteVersion`. Only the parent version id (+ optional
 * re-selected attachment file ids) is read; the server command is the authority.
 */
export async function createNewQuoteVersionAction(
  _prev: NewVersionActionState,
  form: FormData,
): Promise<NewVersionActionState> {
  const quoteVersionId = form.get("quote_version_id");
  const quoteId = form.get("quote_id");
  const input: Record<string, unknown> = { quote_version_id: quoteVersionId };
  // OPTIONAL re-selected attachment file ids (a repeated `attachment_file_ids` form field). An
  // absent field means "no attachments re-selected" (the command validator defaults it to []).
  const attachmentFileIds = form
    .getAll("attachment_file_ids")
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  if (attachmentFileIds.length > 0) input.attachment_file_ids = attachmentFileIds;

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(createNewQuoteVersion, { client, input });

  if (result.ok) {
    if (typeof quoteId === "string" && quoteId.length > 0) {
      revalidatePath(`/quotes/${quoteId}`);
      // Revalidate the NEW version subroute so the admin lands on the editable new draft (the new
      // version id is the command result's targetId — NOT the parent). Do NOT repeat the 6.2 gap.
      revalidatePath(`/quotes/${quoteId}/versions/${result.data.targetId}`);
    }
    return {
      ...NEW_VERSION_ACTION_INITIAL,
      status: "success",
      targetId: result.data.targetId,
    };
  }

  return {
    ...NEW_VERSION_ACTION_INITIAL,
    status: "error",
    code: result.code,
    formError: result.message || COMMAND_MESSAGES[result.code],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 10.2 — the mark-lost server action (the ONLY write path the "Markera som förlorad/avböjd"
// dialog uses). Wires the SENT-branch dialog to `markQuoteVersionLost`. Only the version id + the
// structured reason (outcome + category + optional/required note) are read from the form —
// status/tenant are NEVER accepted (the command re-asserts the sent → lost transition server-side,
// re-validates the reason, and runs the narrow RPC on the RLS client). After a successful flip,
// revalidate BOTH `/quotes/[quoteId]` AND the version subroute (the 6.2 subroute-revalidation
// discipline — do NOT repeat the 6.2 gap) so the version re-renders the terminal Förlorad/Avböjd
// state. The append-only lifecycle flip changes ONLY `status` — the sent snapshot is never touched.
// This is an authenticated admin-only affordance — NO public / portal / callback route exists.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The mark-lost action (React `useActionState` signature). Wires the "Markera som förlorad/avböjd"
 * dialog to `markQuoteVersionLost`. Only the version id + the structured reason are read; the server
 * command is the authority (the client-side outcome/category/note validation is a MIRROR, not the
 * guarantee).
 */
export async function markQuoteVersionLostAction(
  _prev: LostActionState,
  form: FormData,
): Promise<LostActionState> {
  const quoteVersionId = form.get("quote_version_id");
  const quoteId = form.get("quote_id");
  const input: Record<string, unknown> = {
    quote_version_id: quoteVersionId,
    outcome: form.get("outcome"),
    category: form.get("category"),
  };
  // The note is OPTIONAL in general, REQUIRED when category='annat' — the command validator owns the
  // hard gate. Carry the field only when the form actually submitted a value (an absent field = no note).
  const note = optionalText(form, "note");
  if (form.has("note")) input.note = note ?? null;

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;

  // Resolve the anchor BEFORE the mutation (Codex follow-up). A version's `quote_id` is IMMUTABLE, so
  // reading it up-front is equivalent to reading it after — but a transient failure of a read placed
  // AFTER the commit would reject the whole action even though the lost status/event/reason had
  // already committed, and the retry would then be refused ("already lost") leaving the follow-up
  // open. Failing here is safe: nothing has been committed yet.
  const preResolvedQuoteId = await tryResolveQuoteIdForVersion(client, quoteVersionId);

  // If the caller ASKED for auto-completion (the follow-up surface carries a hidden follow_up_id) but
  // the scope could not be resolved, abort BEFORE the irreversible transition (Codex follow-up).
  // Committing anyway would strand an open follow-up: it is hidden only while the quote stays
  // terminal, and creating a new version re-exposes it while the one-open-per-quote index then blocks
  // planning a replacement — a user-visible dead-end. Refusing here costs nothing (nothing has
  // committed) and the user can simply retry. The standalone lost dialog carries no follow_up_id and
  // is unaffected.
  const wantsAutoComplete =
    typeof form.get("follow_up_id") === "string" &&
    String(form.get("follow_up_id")).length > 0;
  if (wantsAutoComplete && !preResolvedQuoteId) {
    return {
      ...LOST_ACTION_INITIAL,
      status: "error",
      code: "SERVER_ERROR",
      formError: COMMAND_MESSAGES.SERVER_ERROR,
    };
  }

  const result = await runCommand(markQuoteVersionLost, { client, input });

  if (result.ok) {
    // Story 10.3 — the auto-complete-on-lost seam (Task 5.5, SETTLED DESIGN DECISION 5). When the
    // lost path is taken FROM the follow-up surface, the dialog carries a hidden `follow_up_id`. On a
    // successful lost flip (the irreversible commitment, done FIRST), auto-complete the open follow-up
    // with the chosen förlorad/avböjd outcome — so no open follow-up survives a lost flip taken from
    // this surface. TWO-command orchestration (NOT a widened RPC — the frozen mark_quote_version_lost
    // RPC is untouched). Non-atomicity residual: a rare transient failure of the completion AFTER a
    // successful lost flip leaves an OPEN follow-up row on the now-lost quote. This is NON-CORRUPTING but
    // NOT self-healing via the UI — once the version leaves `sent` the follow-up sheet UNMOUNTS, so the
    // user CANNOT Klarmarkera it manually (the earlier "the sheet stays available" claim was false). The
    // stranded row is harmless because the 10.4 read paths now EXCLUDE follow-ups on decided (accepted/
    // lost) quotes from the /quotes list flags AND the pipeline open/overdue counts — so it never
    // escalates. We still capture + log the completion Result on failure so the orphan has telemetry (no
    // silent swallow). The standalone (non-follow-up) lost dialog omits the field, so 10.2's behavior is
    // byte-unchanged when no follow-up id is carried.
    const followUpId = form.get("follow_up_id");
    const outcome = form.get("outcome");
    // F5 (integration review): derive the just-lost version's REAL quote id from the DB (NEVER the
    // form's `quote_id`, which is untrusted) and scope the auto-completion to it. A crafted/stale form
    // carrying the `follow_up_id` of ANOTHER own-tenant quote then completes zero rows instead of
    // silently completing the wrong quote's follow-up with the lost outcome. If the quote id cannot be
    // derived, we skip the auto-complete — the orphan open row is harmless (the 10.4 read paths
    // already exclude follow-ups on decided quotes). Uses the PRE-resolved id (read before the
    // mutation), so no fallible read runs after the transition has committed.
    const expectedQuoteId = preResolvedQuoteId;
    if (
      typeof followUpId === "string" &&
      followUpId.length > 0 &&
      typeof outcome === "string" &&
      outcome.length > 0 &&
      typeof expectedQuoteId === "string" &&
      expectedQuoteId.length > 0
    ) {
      const completeResult = await runCommand(completeQuoteFollowUp, {
        client,
        input: { follow_up_id: followUpId, outcome, expected_quote_id: expectedQuoteId },
      });
      if (!completeResult.ok) {
        // Surface the stranded-open-follow-up residual: the lost flip already committed, so the flip
        // still succeeds, but the auto-complete failed and left an orphaned open row (excluded from the
        // 10.4 read paths, so non-escalating). Log for telemetry — never swallow silently.
        console.error(
          "markQuoteVersionLostAction: auto-complete-on-lost failed after a successful lost flip",
          { followUpId, code: completeResult.code },
        );
      }
    }
    if (typeof quoteId === "string" && quoteId.length > 0) {
      revalidatePath(`/quotes/${quoteId}`);
      // Revalidate the version subroute too so the lost version re-renders the terminal state there.
      if (typeof quoteVersionId === "string" && quoteVersionId.length > 0) {
        revalidatePath(`/quotes/${quoteId}/versions/${quoteVersionId}`);
      }
    }
    return {
      ...LOST_ACTION_INITIAL,
      status: "success",
      targetId: result.data.targetId,
    };
  }

  return {
    ...LOST_ACTION_INITIAL,
    status: "error",
    code: result.code,
    formError: result.message || COMMAND_MESSAGES[result.code],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 10.3 — the follow-up server actions (plan / complete / annotate). The ONLY write path the
// follow-up dialog + completion sheet use. Each wires its affordance to the matching single-row
// envelope command (NO RPC). Only the follow-up shape is read from the form — tenant/status/quote_id
// are NEVER accepted (the plan command derives quote_id from the loaded anchor version; the
// complete/annotate commands re-assert the open-only predicate server-side). After success, revalidate
// BOTH `/quotes/[quoteId]` AND the version subroute (the 6.2 subroute-revalidation lesson) so the chip
// / completion sheet / list flags re-render. Authenticated admin-only — NO public / portal route.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The plan-follow-up action (React `useActionState` signature). Wires the "Planera uppföljning"
 * dialog to `planQuoteFollowUp`. Only the anchor version id + due date + optional note are read; the
 * server command is the authority (the one-open rule is DB-enforced → a clear VALIDATION_FAILED).
 */
export async function planQuoteFollowUpAction(
  _prev: FollowUpActionState,
  form: FormData,
): Promise<FollowUpActionState> {
  const quoteVersionId = form.get("quote_version_id");
  const quoteId = form.get("quote_id");
  const input: Record<string, unknown> = {
    quote_version_id: quoteVersionId,
    due_date: form.get("due_date"),
  };
  // The planning note is OPTIONAL — carry the field only when the form submitted a value.
  const note = optionalText(form, "note");
  if (form.has("note")) input.note = note ?? null;

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(planQuoteFollowUp, { client, input });

  if (result.ok) {
    if (typeof quoteId === "string" && quoteId.length > 0) {
      revalidatePath(`/quotes/${quoteId}`);
      if (typeof quoteVersionId === "string" && quoteVersionId.length > 0) {
        revalidatePath(`/quotes/${quoteId}/versions/${quoteVersionId}`);
      }
    }
    return {
      ...FOLLOW_UP_ACTION_INITIAL,
      status: "success",
      targetId: result.data.targetId,
    };
  }

  return {
    ...FOLLOW_UP_ACTION_INITIAL,
    status: "error",
    code: result.code,
    formError: result.message || COMMAND_MESSAGES[result.code],
  };
}

/**
 * The complete-follow-up action (React `useActionState` signature). Wires the "Klarmarkera"
 * completion sheet to `completeQuoteFollowUp`. Only the follow-up id + the required outcome note are
 * read; the server command re-asserts the open-only predicate and stamps completed_at with the
 * injected clock.
 */
export async function completeQuoteFollowUpAction(
  _prev: FollowUpActionState,
  form: FormData,
): Promise<FollowUpActionState> {
  const followUpId = form.get("follow_up_id");
  const quoteId = form.get("quote_id");
  const quoteVersionId = form.get("quote_version_id");
  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;

  // Codex review: the auto-complete-on-lost path scopes its completion to the just-lost quote, but
  // THIS manual path did not — so a crafted submit from quote A's sheet could carry the follow_up_id
  // of any other OPEN follow-up in the same tenant and complete quote B's follow-up while
  // revalidating quote A. Derive the displayed quote id SERVER-SIDE from the version the sheet is
  // rendered on (never the form's own quote_id, which is equally untrusted) and pass the same scope.
  // FAIL CLOSED (Codex follow-up): the previous shape added the scope only WHEN it resolved, so a
  // submit carrying a valid-but-foreign/nonexistent quote_version_id made the anchor lookup return
  // nothing, the scope was silently omitted, and the command fell back to an UNSCOPED completion —
  // completing an unrelated own-tenant follow-up. A scope that is conditional is not a scope. If the
  // displayed version cannot be resolved server-side, REFUSE rather than widening.
  const expectedQuoteId = await tryResolveQuoteIdForVersion(client, quoteVersionId);
  if (typeof expectedQuoteId !== "string" || expectedQuoteId.length === 0) {
    return {
      ...FOLLOW_UP_ACTION_INITIAL,
      status: "error",
      code: "TENANT_ACCESS_DENIED",
      formError: COMMAND_MESSAGES.TENANT_ACCESS_DENIED,
    };
  }

  const input: Record<string, unknown> = {
    follow_up_id: followUpId,
    outcome: form.get("outcome"),
    expected_quote_id: expectedQuoteId,
  };

  const result = await runCommand(completeQuoteFollowUp, { client, input });

  if (result.ok) {
    if (typeof quoteId === "string" && quoteId.length > 0) {
      revalidatePath(`/quotes/${quoteId}`);
      if (typeof quoteVersionId === "string" && quoteVersionId.length > 0) {
        revalidatePath(`/quotes/${quoteId}/versions/${quoteVersionId}`);
      }
    }
    return {
      ...FOLLOW_UP_ACTION_INITIAL,
      status: "success",
      targetId: result.data.targetId,
    };
  }

  return {
    ...FOLLOW_UP_ACTION_INITIAL,
    status: "error",
    code: result.code,
    formError: result.message || COMMAND_MESSAGES[result.code],
  };
}

/**
 * The annotate-follow-up action (React `useActionState` signature). Wires the note-edit affordance to
 * `annotateQuoteFollowUp`. Only the follow-up id + the note are read; the server command re-asserts
 * the open-only predicate.
 */
export async function annotateQuoteFollowUpAction(
  _prev: FollowUpActionState,
  form: FormData,
): Promise<FollowUpActionState> {
  const followUpId = form.get("follow_up_id");
  const quoteId = form.get("quote_id");
  const quoteVersionId = form.get("quote_version_id");
  const input: Record<string, unknown> = { follow_up_id: followUpId };
  const note = optionalText(form, "note");
  if (form.has("note")) input.note = note ?? null;

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(annotateQuoteFollowUp, { client, input });

  if (result.ok) {
    if (typeof quoteId === "string" && quoteId.length > 0) {
      revalidatePath(`/quotes/${quoteId}`);
      if (typeof quoteVersionId === "string" && quoteVersionId.length > 0) {
        revalidatePath(`/quotes/${quoteId}/versions/${quoteVersionId}`);
      }
    }
    return {
      ...FOLLOW_UP_ACTION_INITIAL,
      status: "success",
      targetId: result.data.targetId,
    };
  }

  return {
    ...FOLLOW_UP_ACTION_INITIAL,
    status: "error",
    code: result.code,
    formError: result.message || COMMAND_MESSAGES[result.code],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story 7.1 → 7.2 — the acceptance server action (the ONLY write path the acceptance form uses).
// Wires the SENT-branch acceptance form to the TRANSACTIONAL `acceptQuoteAndCreateJob` command
// (Story 7.2, Task 4 — SUPERSEDING 7.1's capture-only `captureQuoteAcceptance` at the LIVE UI path).
// Confirming acceptance on a sent version now RECORDS the acceptance AND creates the job in ONE
// atomic, idempotent call. Only the acceptance-capture fields are read from the form —
// status/tenant/source-total/admin-user are NEVER accepted (the command re-asserts the sent state
// server-side, re-validates the adjusted-price reason gate, loads the frozen source sent total, and
// derives the admin user from the resolved session). The entered kronor price is parsed to INTEGER
// ÖRE here (the UI-input seam); the command re-validates it with `isOreAmount`. After success,
// revalidate BOTH `/quotes/[quoteId]` AND the version subroute (the 6.2/6.3/6.4/7.1 subroute-
// revalidation discipline — do NOT repeat the 6.2 gap) so the version re-renders as `accepted` (the
// idempotent-return path lands on the same accepted state, never a duplicate/error — UX-DR24). This
// is an authenticated admin-only server action — NO public / portal / callback route exists. The
// TEST-ONLY `__faultInject` command field is NEVER read from the form here, so a real request can
// never set it (only a direct `runCommand` test call can drive the atomicity/rollback proof).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The acceptance action (React `useActionState` signature). Wires the acceptance form to the
 * transactional `acceptQuoteAndCreateJob` command. Only the capture fields are read; the server
 * command is the authority (the UI adjusted-price delta + reason gate is a MIRROR, not the guarantee).
 * On the idempotent re-attempt the command returns ok with the EXISTING ids — the UI still lands on
 * the accepted state, never a duplicate or an error.
 */
export async function captureQuoteAcceptanceAction(
  _prev: AcceptanceActionState,
  form: FormData,
): Promise<AcceptanceActionState> {
  const quoteVersionId = form.get("quote_version_id");
  const quoteId = form.get("quote_id");

  // Parse the entered kronor price → integer öre (the UI-input seam; the command re-validates).
  // A malformed price yields a client-shaped VALIDATION_FAILED at the command (accepted_price_ore
  // will be a non-öre value the validator rejects) — pass NaN through so the server owns the reject.
  const priceRaw = form.get("accepted_price_ore");
  let acceptedPriceOre: number = Number.NaN;
  if (typeof priceRaw === "string") {
    const parsed = kronorStringToOre(priceRaw);
    if (parsed.ok) acceptedPriceOre = parsed.ore;
  }

  const input: Record<string, unknown> = {
    quote_version_id: quoteVersionId,
    accepted_price_ore: acceptedPriceOre,
    accepted_at: form.get("accepted_at"),
  };
  const channel = optionalText(form, "channel");
  const adjustmentReason = optionalText(form, "adjustment_reason");
  const evidenceReference = optionalText(form, "evidence_reference");
  const evidenceFileId = optionalText(form, "evidence_file_id");
  const notes = optionalText(form, "notes");
  const plannedStart = optionalText(form, "planned_start_date");
  const plannedEnd = optionalText(form, "planned_end_date");
  const title = optionalText(form, "title");
  if (channel !== undefined) input.channel = channel;
  if (adjustmentReason !== undefined) input.adjustment_reason = adjustmentReason;
  if (evidenceReference !== undefined) input.evidence_reference = evidenceReference;
  if (evidenceFileId !== undefined) input.evidence_file_id = evidenceFileId;
  if (notes !== undefined) input.notes = notes;
  if (plannedStart !== undefined) input.planned_start_date = plannedStart;
  if (plannedEnd !== undefined) input.planned_end_date = plannedEnd;
  if (title !== undefined) input.title = title;

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(acceptQuoteAndCreateJob, { client, input });

  if (result.ok) {
    if (typeof quoteId === "string" && quoteId.length > 0) {
      revalidatePath(`/quotes/${quoteId}`);
      if (typeof quoteVersionId === "string" && quoteVersionId.length > 0) {
        revalidatePath(`/quotes/${quoteId}/versions/${quoteVersionId}`);
      }
    }
    return {
      ...ACCEPTANCE_ACTION_INITIAL,
      status: "success",
      targetId: result.data.targetId,
    };
  }

  return {
    ...ACCEPTANCE_ACTION_INITIAL,
    status: "error",
    code: result.code,
    formError: result.message || COMMAND_MESSAGES[result.code],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// List-page quote creation (owner decision 2026-07-14) — the "Skapa ny offert" server action.
// Wires the `/quotes` list's create affordance to the EXISTING 6.1
// `createQuoteVersionFromCalculation` command (reused verbatim — no new command, no new
// auth/error/audit mechanism). Only the picked `calculation_id` is read from the form — the full
// frozen snapshot is RE-CAPTURED server-side from the live rows (never trusted from the client);
// a crafted foreign calc id is denied TENANT_ACCESS_DENIED BEFORE execute (envelope ownership).
// On success revalidate `/quotes` + the new detail route; the returned `quoteId` is the
// navigation target (`/quotes/{quoteId}`).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The list-page create-quote action (React `useActionState` signature). Wires the "Skapa ny
 * offert" calc picker to `createQuoteVersionFromCalculation`. Only the calculation id is read;
 * the server command is the authority.
 */
export async function createQuoteVersionFromCalculationAction(
  _prev: CreateQuoteActionState,
  form: FormData,
): Promise<CreateQuoteActionState> {
  const calculationId = form.get("calculation_id");
  const values: Record<string, string> = {};
  if (typeof calculationId === "string") values.calculation_id = calculationId;
  const input: Record<string, unknown> = { calculation_id: calculationId };

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(createQuoteVersionFromCalculation, {
    client,
    input,
  });

  if (result.ok) {
    revalidatePath("/quotes");
    revalidatePath(`/quotes/${result.data.quoteId}`);
    return {
      ...CREATE_QUOTE_ACTION_INITIAL,
      status: "success",
      targetId: result.data.targetId,
      quoteId: result.data.quoteId,
    };
  }

  return {
    ...CREATE_QUOTE_ACTION_INITIAL,
    status: "error",
    code: result.code,
    formError: result.message || COMMAND_MESSAGES[result.code],
    values,
  };
}

/**
 * The preview/download action (React `useActionState` signature). Mints a SHORT-LIVED SIGNED URL
 * for the version's `quote_pdf` file via `createSignedFileAccess` (RLS-scoped signing — a
 * cross-tenant/anon caller is denied at the DB; never a public URL). Only shown for a `generated`
 * version. The signed URL lives only in the returned state (never logged).
 */
export async function previewQuotePdfAction(
  _prev: QuotePdfPreviewState,
  form: FormData,
): Promise<QuotePdfPreviewState> {
  const fileId = form.get("file_id");
  const input: Record<string, unknown> = { file_id: fileId };

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(createSignedFileAccess, { client, input });

  if (result.ok) {
    return {
      ...QUOTE_PDF_PREVIEW_INITIAL,
      status: "success",
      signedUrl: result.data.signedUrl,
      expiresAt: result.data.expiresAt,
    };
  }

  return {
    ...QUOTE_PDF_PREVIEW_INITIAL,
    status: "error",
    code: result.code,
    formError: result.message || COMMAND_MESSAGES[result.code],
  };
}
