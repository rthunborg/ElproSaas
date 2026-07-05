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
import { updateDraftQuoteVersion } from "@/server/commands/quotes";
import {
  QUOTE_ACTION_INITIAL,
  type QuoteActionState,
} from "./action-state";

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
