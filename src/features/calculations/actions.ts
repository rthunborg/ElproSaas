"use server";

/**
 * Calculation-editor server actions (Story 5.2, Task 3.1) — the ONLY write path the calc
 * editor UI uses. These `"use server"` actions wire the React 19 `useActionState` form
 * pattern to the EXISTING Story 5.1 envelope commands. EVERY mutation goes through
 * `runCommand(<5.1 command>, { client: createSupabaseServerClient(), input })`:
 *
 *   - `client` is the per-request, cookie-bound RLS server client (anon key ONLY — NEVER a
 *     service-role key; the containment guards enforce this). It is NEVER an
 *     `.insert()/.update()` against a calc table directly — only the 5.1 commands write.
 *   - `input` is the raw parsed form values; the command's `validateInput` is the
 *     authority. The client-side `parse*` field checks are a UX nicety, not the
 *     security/validation boundary.
 *
 * The typed `Result` is mapped to a `CalcActionState` (architecture §5; AC2/AC5):
 * `ok` revalidates the editor path; `VALIDATION_FAILED` returns field/summary errors and
 * preserves input; `TENANT_ACCESS_DENIED` a generic denial; a transient `SERVER_ERROR` a
 * RETRYABLE failure (NOT a permanent denial). NO new auth/error/audit mechanism, NO direct
 * table write.
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
  archiveCalculation,
  archiveRow,
  archiveSection,
  createCalculation,
  createRow,
  createSection,
  reorderRows,
  reorderSections,
  updateCalculation,
  updateRow,
  updateSection,
  type CalcCommandResult,
} from "@/server/commands/calculations";
import {
  CALC_ACTION_INITIAL,
  type CalcActionState,
  type CalcFormKind,
} from "./action-state";
import {
  parseArchiveForm,
  parseCreateCalculationForm,
  parseCreateRowForm,
  parseCreateSectionForm,
  parseReorderRowsForm,
  parseReorderSectionsForm,
  parseUpdateCalculationForm,
  parseUpdateRowForm,
  parseUpdateSectionForm,
  type ParsedCalcForm,
} from "./form-parsing";

/** Build the editor path a mutation revalidates. */
function editorPath(calculationId: string | undefined): string {
  return calculationId ? `/calculations/${calculationId}` : "/calculations";
}

/**
 * Run a 5.1 command through the envelope on the per-request RLS server client and map its
 * typed `Result` to the form-action state. A client-detected field error short-circuits the
 * round-trip (a pure UX nicety — the server would also reject); the submitted `values` are
 * always echoed back so the form preserves input. `revalidateId` is the calc id whose editor
 * path to revalidate on success (so the totals/summary re-render).
 */
async function run(
  command: Command<never, CalcCommandResult>,
  parsed: ParsedCalcForm,
  form: CalcFormKind,
  revalidateId: string | undefined,
): Promise<CalcActionState> {
  if (Object.keys(parsed.fieldErrors).length > 0) {
    return {
      ...CALC_ACTION_INITIAL,
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
    revalidatePath(editorPath(revalidateId));
    return {
      ...CALC_ACTION_INITIAL,
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
  parsed: ParsedCalcForm,
  form: CalcFormKind,
): CalcActionState {
  return {
    ...CALC_ACTION_INITIAL,
    status: "error",
    form,
    code,
    formError: message || COMMAND_MESSAGES[code],
    fieldErrors: code === "VALIDATION_FAILED" ? parsed.fieldErrors : {},
    values: parsed.values,
  };
}

/** Read a string field from a FormData for revalidation targeting (never trusts it for auth). */
function calcIdOf(form: FormData, name: string): string | undefined {
  const v = form.get(name);
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

// The action signatures match React's `useActionState`: (prevState, formData).

export async function createCalculationAction(
  _prev: CalcActionState,
  form: FormData,
): Promise<CalcActionState> {
  // A newly created calc has no id yet — revalidate the list so it appears.
  return run(
    createCalculation as unknown as Command<never, CalcCommandResult>,
    parseCreateCalculationForm(form),
    "calculation",
    undefined,
  );
}

export async function updateCalculationAction(
  _prev: CalcActionState,
  form: FormData,
): Promise<CalcActionState> {
  return run(
    updateCalculation as unknown as Command<never, CalcCommandResult>,
    parseUpdateCalculationForm(form),
    "calculation",
    calcIdOf(form, "id"),
  );
}

export async function archiveCalculationAction(
  _prev: CalcActionState,
  form: FormData,
): Promise<CalcActionState> {
  return run(
    archiveCalculation as unknown as Command<never, CalcCommandResult>,
    parseArchiveForm(form),
    "archive_calculation",
    undefined,
  );
}

export async function createSectionAction(
  _prev: CalcActionState,
  form: FormData,
): Promise<CalcActionState> {
  return run(
    createSection as unknown as Command<never, CalcCommandResult>,
    parseCreateSectionForm(form),
    "section",
    calcIdOf(form, "calculation_id"),
  );
}

export async function updateSectionAction(
  _prev: CalcActionState,
  form: FormData,
): Promise<CalcActionState> {
  return run(
    updateSection as unknown as Command<never, CalcCommandResult>,
    parseUpdateSectionForm(form),
    "section",
    calcIdOf(form, "calculation_id"),
  );
}

export async function archiveSectionAction(
  _prev: CalcActionState,
  form: FormData,
): Promise<CalcActionState> {
  return run(
    archiveSection as unknown as Command<never, CalcCommandResult>,
    parseArchiveForm(form),
    "archive_section",
    calcIdOf(form, "calculation_id"),
  );
}

export async function createRowAction(
  _prev: CalcActionState,
  form: FormData,
): Promise<CalcActionState> {
  return run(
    createRow as unknown as Command<never, CalcCommandResult>,
    parseCreateRowForm(form),
    "row",
    calcIdOf(form, "calculation_id"),
  );
}

export async function updateRowAction(
  _prev: CalcActionState,
  form: FormData,
): Promise<CalcActionState> {
  return run(
    updateRow as unknown as Command<never, CalcCommandResult>,
    parseUpdateRowForm(form),
    "row",
    calcIdOf(form, "calculation_id"),
  );
}

export async function archiveRowAction(
  _prev: CalcActionState,
  form: FormData,
): Promise<CalcActionState> {
  return run(
    archiveRow as unknown as Command<never, CalcCommandResult>,
    parseArchiveForm(form),
    "archive_row",
    calcIdOf(form, "calculation_id"),
  );
}

export async function reorderSectionsAction(
  _prev: CalcActionState,
  form: FormData,
): Promise<CalcActionState> {
  return run(
    reorderSections as unknown as Command<never, CalcCommandResult>,
    parseReorderSectionsForm(form),
    "reorder_sections",
    calcIdOf(form, "calculation_id"),
  );
}

export async function reorderRowsAction(
  _prev: CalcActionState,
  form: FormData,
): Promise<CalcActionState> {
  return run(
    reorderRows as unknown as Command<never, CalcCommandResult>,
    parseReorderRowsForm(form),
    "reorder_rows",
    calcIdOf(form, "calculation_id"),
  );
}
