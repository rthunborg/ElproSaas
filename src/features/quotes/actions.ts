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
import { generateQuotePdf, updateDraftQuoteVersion } from "@/server/commands/quotes";
import { createSignedFileAccess } from "@/server/commands/files";
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
