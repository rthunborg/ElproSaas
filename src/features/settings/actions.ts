"use server";

/**
 * Settings server actions (Story 3.3, Task 4.4) — the ONLY write path the settings UI
 * uses. These `"use server"` actions wire the React 19 `useActionState` form pattern
 * to the EXISTING 3.3 envelope commands. EVERY mutation goes through
 * `runCommand(<3.3 command>, { client: createSupabaseServerClient(), input })`:
 *
 *   - `client` is the per-request, cookie-bound RLS server client (anon key ONLY —
 *     NEVER a service-role key; the containment guards enforce this). It is NEVER an
 *     `.insert()/.update()` against a settings table directly — only the 3.3 commands
 *     write.
 *   - `input` is the raw parsed form values; the command's `validateInput` is the
 *     authority. The client-side `parse*` field checks are a UX nicety, not the
 *     security/validation boundary.
 *
 * The typed `Result` is mapped to a `SettingsActionState` (architecture §5; AC4):
 * `ok` revalidates the affected path; `VALIDATION_FAILED` returns field/summary errors
 * and preserves input; `TENANT_ACCESS_DENIED` returns a generic denial; a transient
 * `SERVER_ERROR` returns a RETRYABLE failure (NOT a permanent denial).
 *
 * SIGN-OFF STOP-CONDITION: `saveQuoteTermsAction` calls `updateQuoteTerms`, which
 * NEVER approves (it resets approval). Approval is set ONLY by `approveTermsAction`
 * → `approveQuoteTerms`, the deliberate human sign-off. There is no auto-approve path.
 */
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import {
  runCommand,
  type Command,
  type CommandDbClient,
} from "@/server/commands/envelope";
import {
  COMMAND_MESSAGES,
  type CommandErrorCode,
} from "@/server/commands/command-errors";
import { updateCompanySettings } from "@/server/commands/settings/company-settings";
import {
  approveQuoteTerms,
  updateQuoteTerms,
} from "@/server/commands/settings/quote-terms";
import type { SettingsCommandResult } from "@/server/commands/settings/company-settings";
import {
  SETTINGS_ACTION_INITIAL,
  type SettingsActionState,
} from "./action-state";
import {
  parseApproveTermsForm,
  parseCompanySettingsForm,
  parseQuoteTermsForm,
  type ParsedSettingsForm,
} from "./form-parsing";

/**
 * Run a 3.3 command through the envelope on the per-request RLS server client and map
 * its typed `Result` to the form-action state. Client-detected field errors
 * short-circuit the round-trip (a pure UX nicety — the server would also reject), and
 * the submitted `values` are always echoed back so the form preserves input.
 */
async function runSettings(
  command: Command<never, SettingsCommandResult>,
  parsed: ParsedSettingsForm,
  revalidate: readonly string[],
): Promise<SettingsActionState> {
  if (Object.keys(parsed.fieldErrors).length > 0) {
    return {
      ...SETTINGS_ACTION_INITIAL,
      status: "error",
      code: "VALIDATION_FAILED",
      formError: COMMAND_MESSAGES.VALIDATION_FAILED,
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(command, { client, input: parsed.input });

  if (result.ok) {
    for (const path of revalidate) revalidatePath(path);
    return {
      ...SETTINGS_ACTION_INITIAL,
      status: "success",
      targetId: result.data.targetId,
    };
  }

  return mapErrorToState(result.code, result.message, parsed);
}

/** Map a failed command `Result` to the form-action state (no internal-detail leak). */
function mapErrorToState(
  code: CommandErrorCode,
  message: string,
  parsed: ParsedSettingsForm,
): SettingsActionState {
  return {
    ...SETTINGS_ACTION_INITIAL,
    status: "error",
    code,
    formError: message || COMMAND_MESSAGES[code],
    fieldErrors: code === "VALIDATION_FAILED" ? parsed.fieldErrors : {},
    values: parsed.values,
  };
}

// The action signatures match React's `useActionState`: (prevState, formData).

export async function saveCompanySettingsAction(
  _prev: SettingsActionState,
  form: FormData,
): Promise<SettingsActionState> {
  return runSettings(
    updateCompanySettings as unknown as Command<never, SettingsCommandResult>,
    parseCompanySettingsForm(form),
    ["/settings/company"],
  );
}

export async function saveQuoteTermsAction(
  _prev: SettingsActionState,
  form: FormData,
): Promise<SettingsActionState> {
  // Saving the terms TEXT NEVER approves them — updateQuoteTerms resets approval.
  return runSettings(
    updateQuoteTerms as unknown as Command<never, SettingsCommandResult>,
    parseQuoteTermsForm(form),
    ["/settings/quote-terms"],
  );
}

export async function approveTermsAction(
  _prev: SettingsActionState,
  form: FormData,
): Promise<SettingsActionState> {
  // The ONLY path to approval — the deliberate human sign-off.
  return runSettings(
    approveQuoteTerms as unknown as Command<never, SettingsCommandResult>,
    parseApproveTermsForm(form),
    ["/settings/quote-terms"],
  );
}
