"use server";

/**
 * Pricing server actions (Story 3.4, Task 4.4) — the ONLY write path the pricing UI
 * uses. These `"use server"` actions wire the React 19 `useActionState` form pattern to
 * the EXISTING 3.4 envelope commands. EVERY mutation goes through
 * `runCommand(<3.4 command>, { client: createSupabaseServerClient(), input })`:
 *
 *   - `client` is the per-request, cookie-bound RLS server client (anon key ONLY —
 *     NEVER a service-role key; the containment guards enforce this). It is NEVER an
 *     `.insert()/.update()` against a pricing table directly — only the 3.4 commands
 *     write.
 *   - `input` is the raw parsed form values; the command's `validateInput` is the
 *     authority. The client-side `parse*` field checks are a UX nicety, not the
 *     security/validation boundary.
 *
 * The typed `Result` is mapped to a `PricingActionState` (architecture §5; AC5):
 * `ok` revalidates `/settings/pricing`; `VALIDATION_FAILED` returns field/summary errors
 * and preserves input; `TENANT_ACCESS_DENIED` returns a generic denial; a transient
 * `SERVER_ERROR` returns a RETRYABLE failure (NOT a permanent denial).
 *
 * NO supplier field is ever read, forwarded, or written (HARD no-supplier-scope).
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
import {
  archiveWorkRole,
  upsertWorkRole,
  type PricingCommandResult,
} from "@/server/commands/pricing/work-roles";
import {
  archiveArticle,
  upsertArticle,
} from "@/server/commands/pricing/articles";
import {
  PRICING_ACTION_INITIAL,
  type PricingActionState,
  type PricingFormKind,
} from "./action-state";
import {
  parseArchiveForm,
  parseArticleForm,
  parseWorkRoleForm,
  type ParsedPricingForm,
} from "./form-parsing";

const PRICING_PATH = "/settings/pricing";

/**
 * Run a 3.4 command through the envelope on the per-request RLS server client and map
 * its typed `Result` to the form-action state. Client-detected field errors
 * short-circuit the round-trip (a pure UX nicety — the server would also reject), and
 * the submitted `values` are always echoed back so the form preserves input.
 */
async function runPricing(
  command: Command<never, PricingCommandResult>,
  parsed: ParsedPricingForm,
  form: PricingFormKind,
): Promise<PricingActionState> {
  if (Object.keys(parsed.fieldErrors).length > 0) {
    return {
      ...PRICING_ACTION_INITIAL,
      status: "error",
      form,
      code: "VALIDATION_FAILED",
      formError: COMMAND_MESSAGES.VALIDATION_FAILED,
      fieldErrors: parsed.fieldErrors,
      values: parsed.values,
    };
  }

  const client = (await createSupabaseServerClient()) as unknown as CommandDbClient;
  const result = await runCommand(command, { client, input: parsed.input });

  if (result.ok) {
    revalidatePath(PRICING_PATH);
    return {
      ...PRICING_ACTION_INITIAL,
      status: "success",
      form,
      targetId: result.data.targetId,
    };
  }

  return mapErrorToState(result.code, result.message, parsed, form);
}

/** Map a failed command `Result` to the form-action state (no internal-detail leak). */
function mapErrorToState(
  code: CommandErrorCode,
  message: string,
  parsed: ParsedPricingForm,
  form: PricingFormKind,
): PricingActionState {
  return {
    ...PRICING_ACTION_INITIAL,
    status: "error",
    form,
    code,
    formError: message || COMMAND_MESSAGES[code],
    fieldErrors: code === "VALIDATION_FAILED" ? parsed.fieldErrors : {},
    values: parsed.values,
  };
}

// The action signatures match React's `useActionState`: (prevState, formData).

export async function saveWorkRoleAction(
  _prev: PricingActionState,
  form: FormData,
): Promise<PricingActionState> {
  return runPricing(
    upsertWorkRole as unknown as Command<never, PricingCommandResult>,
    parseWorkRoleForm(form),
    "work_role",
  );
}

export async function archiveWorkRoleAction(
  _prev: PricingActionState,
  form: FormData,
): Promise<PricingActionState> {
  return runPricing(
    archiveWorkRole as unknown as Command<never, PricingCommandResult>,
    parseArchiveForm(form),
    "work_role",
  );
}

export async function saveArticleAction(
  _prev: PricingActionState,
  form: FormData,
): Promise<PricingActionState> {
  return runPricing(
    upsertArticle as unknown as Command<never, PricingCommandResult>,
    parseArticleForm(form),
    "article",
  );
}

export async function archiveArticleAction(
  _prev: PricingActionState,
  form: FormData,
): Promise<PricingActionState> {
  return runPricing(
    archiveArticle as unknown as Command<never, PricingCommandResult>,
    parseArchiveForm(form),
    "article",
  );
}
