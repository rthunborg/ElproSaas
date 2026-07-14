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
  createNewQuoteVersion,
  createQuoteVersionFromCalculation,
  generateQuotePdf,
  markQuoteVersionSent,
  updateDraftQuoteVersion,
} from "@/server/commands/quotes";
import { createSignedFileAccess } from "@/server/commands/files";
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
  NEW_VERSION_ACTION_INITIAL,
  type NewVersionActionState,
} from "./new-version-action-state";
import {
  CREATE_QUOTE_ACTION_INITIAL,
  type CreateQuoteActionState,
} from "./create-quote-action-state";

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
