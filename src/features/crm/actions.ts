"use server";

/**
 * CRM server actions (Story 3.2, Task 4) — the ONLY write path the CRM UI uses.
 *
 * These `"use server"` actions wire the React 19 `useActionState` form pattern to the
 * EXISTING Story 3.1 envelope commands. EVERY mutation goes through
 * `runCommand(<3.1 command>, { client: createSupabaseServerClient(), input })`:
 *
 *   - `client` is the per-request, cookie-bound RLS server client (anon key ONLY —
 *     NEVER a service-role key; the containment guards enforce this). It is NEVER an
 *     `.insert()/.update()` against a CRM table directly — only the 3.1 commands write.
 *   - `input` is the raw parsed form values; the command's `validateInput` is the
 *     authority. The client-side `parse*` field checks are a UX nicety, not the
 *     security/validation boundary.
 *
 * The typed `Result` is mapped to a `CrmActionState` (architecture §5; AC4): `ok`
 * revalidates the affected path; `VALIDATION_FAILED` returns field/summary errors and
 * preserves input; `TENANT_ACCESS_DENIED` returns a generic denial (never reveals
 * another tenant's data); a transient `SERVER_ERROR` returns a RETRYABLE failure
 * (NOT a permanent denial); `UNAUTHENTICATED`/`TENANT_MEMBERSHIP_REQUIRED` are handled
 * defensively (the `(app)` boundary already redirects/blocks before this runs).
 *
 * The UI is NOT the security boundary — tenant isolation + validation are enforced
 * server-side by RLS + the 3.1 commands (epic-3 retro-note; architecture §3 ADR-A003).
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
  archiveContact,
  createContact,
  updateContact,
} from "@/server/commands/crm/contacts";
import {
  archiveCustomer,
  createCustomer,
  updateCustomer,
  type CrmCommandResult,
} from "@/server/commands/crm/customers";
import {
  archiveFacility,
  createFacility,
  updateFacility,
} from "@/server/commands/crm/facilities";
import {
  CRM_ACTION_INITIAL,
  type CrmActionState,
} from "./action-state";
import {
  parseArchiveForm,
  parseCreateContactForm,
  parseCreateCustomerForm,
  parseCreateFacilityForm,
  parseUpdateContactForm,
  parseUpdateCustomerForm,
  parseUpdateFacilityForm,
  type ParsedForm,
} from "./form-parsing";

/**
 * Run a 3.1 command through the envelope on the per-request RLS server client and map
 * its typed `Result` to the form-action state. `parsed.fieldErrors` (client-detected)
 * are merged into the VALIDATION_FAILED branch so a near-miss shows next to its field;
 * the submitted `values` are always echoed back so the form preserves input.
 */
async function runCrm(
  command: Command<never, CrmCommandResult>,
  parsed: ParsedForm,
  revalidate: readonly string[],
): Promise<CrmActionState> {
  // Short-circuit on a client-detected field error BEFORE the round-trip: it is a pure
  // UX nicety (the server would also reject), and it keeps the message field-associated.
  if (Object.keys(parsed.fieldErrors).length > 0) {
    return {
      ...CRM_ACTION_INITIAL,
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
      ...CRM_ACTION_INITIAL,
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
  parsed: ParsedForm,
): CrmActionState {
  // A VALIDATION_FAILED is the only code we surface against fields. Every other code
  // (denial / transient / auth) is a generic, top-of-form message — the values are
  // still preserved so the user does not lose work on a transient failure.
  return {
    ...CRM_ACTION_INITIAL,
    status: "error",
    code,
    formError: message || COMMAND_MESSAGES[code],
    fieldErrors:
      code === "VALIDATION_FAILED" ? parsed.fieldErrors : {},
    values: parsed.values,
  };
}

// The action signatures match React's `useActionState`: (prevState, formData).
// `prevState` is unused (the result is computed fresh each submit) but is part of the
// contract, so it is accepted and ignored.

export async function createCustomerAction(
  _prev: CrmActionState,
  form: FormData,
): Promise<CrmActionState> {
  return runCrm(
    createCustomer as unknown as Command<never, CrmCommandResult>,
    parseCreateCustomerForm(form),
    ["/customers"],
  );
}

export async function updateCustomerAction(
  _prev: CrmActionState,
  form: FormData,
): Promise<CrmActionState> {
  const parsed = parseUpdateCustomerForm(form);
  const id = typeof parsed.input.id === "string" ? parsed.input.id : "";
  return runCrm(
    updateCustomer as unknown as Command<never, CrmCommandResult>,
    parsed,
    ["/customers", id ? `/customers/${id}` : "/customers"],
  );
}

export async function archiveCustomerAction(
  _prev: CrmActionState,
  form: FormData,
): Promise<CrmActionState> {
  return runCrm(
    archiveCustomer as unknown as Command<never, CrmCommandResult>,
    parseArchiveForm(form),
    ["/customers"],
  );
}

export async function createFacilityAction(
  _prev: CrmActionState,
  form: FormData,
): Promise<CrmActionState> {
  const parsed = parseCreateFacilityForm(form);
  const customerId =
    typeof parsed.input.customer_id === "string" ? parsed.input.customer_id : "";
  return runCrm(
    createFacility as unknown as Command<never, CrmCommandResult>,
    parsed,
    [customerId ? `/customers/${customerId}` : "/customers"],
  );
}

export async function updateFacilityAction(
  _prev: CrmActionState,
  form: FormData,
): Promise<CrmActionState> {
  const parsed = parseUpdateFacilityForm(form);
  const customerId =
    typeof parsed.input.customer_id === "string" ? parsed.input.customer_id : "";
  return runCrm(
    updateFacility as unknown as Command<never, CrmCommandResult>,
    parsed,
    [customerId ? `/customers/${customerId}` : "/customers"],
  );
}

export async function archiveFacilityAction(
  _prev: CrmActionState,
  form: FormData,
): Promise<CrmActionState> {
  const parsed = parseArchiveForm(form);
  const customerId =
    typeof form.get("customer_id") === "string"
      ? (form.get("customer_id") as string)
      : "";
  return runCrm(
    archiveFacility as unknown as Command<never, CrmCommandResult>,
    parsed,
    [customerId ? `/customers/${customerId}` : "/customers"],
  );
}

export async function createContactAction(
  _prev: CrmActionState,
  form: FormData,
): Promise<CrmActionState> {
  const parsed = parseCreateContactForm(form);
  const customerId =
    typeof parsed.input.customer_id === "string" ? parsed.input.customer_id : "";
  return runCrm(
    createContact as unknown as Command<never, CrmCommandResult>,
    parsed,
    [customerId ? `/customers/${customerId}` : "/customers"],
  );
}

export async function updateContactAction(
  _prev: CrmActionState,
  form: FormData,
): Promise<CrmActionState> {
  const parsed = parseUpdateContactForm(form);
  const customerId =
    typeof form.get("customer_id") === "string"
      ? (form.get("customer_id") as string)
      : "";
  return runCrm(
    updateContact as unknown as Command<never, CrmCommandResult>,
    parsed,
    [customerId ? `/customers/${customerId}` : "/customers"],
  );
}

export async function archiveContactAction(
  _prev: CrmActionState,
  form: FormData,
): Promise<CrmActionState> {
  const parsed = parseArchiveForm(form);
  const customerId =
    typeof form.get("customer_id") === "string"
      ? (form.get("customer_id") as string)
      : "";
  return runCrm(
    archiveContact as unknown as Command<never, CrmCommandResult>,
    parsed,
    [customerId ? `/customers/${customerId}` : "/customers"],
  );
}
