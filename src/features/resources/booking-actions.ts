"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import { resolveCapability } from "@/server/authz/permission-matrix";
import { runCommand, type CommandDbClient } from "@/server/commands/envelope";
import { COMMAND_MESSAGES, CommandError, type CommandErrorCode } from "@/server/commands/command-errors";
import { createBooking } from "@/server/commands/bookings/create-booking";
import { updateBooking } from "@/server/commands/bookings/update-booking";
import { bookingPayload, validateCreateBooking, validateUpdateBooking } from "@/server/commands/bookings/validation";
import { previewBookingEditor } from "@/server/bookings/editor-preview";
import { validateBookingCandidateReferences } from "@/server/bookings/candidate-references";
import type { BookingRpcClient } from "@/server/bookings/conflict-facts";
import type { BookingActionError, BookingPreviewActionResult, BookingSaveActionResult } from "./booking-action-state";
import { bookingPersonLabel, readBookingPeople, readBookingEditorOptions } from "./bookings-read";
import { bookingActionFitsTransport } from "./booking-transport";

function failure(code: CommandErrorCode): BookingActionError {
  return { status: "error", code, message: COMMAND_MESSAGES[code] };
}
function isUpdate(input: unknown): boolean { return !!input && typeof input === "object" && "bookingId" in input; }
function errorCode(error: unknown): CommandErrorCode {
  if (error instanceof CommandError) return error.code;
  const code = (error as { code?: string } | null)?.code;
  if (code === "42501" || code === "23503") return "TENANT_ACCESS_DENIED";
  if (code === "BK409") return "COMMAND_CONFLICT";
  if (code === "BR409") return "PREVIEW_STALE";
  if (["23514", "22P02", "22007", "22008"].includes(code ?? "")) return "VALIDATION_FAILED";
  return "SERVER_ERROR";
}

/** Browser preview shares SQL's checked current facts and the sole detector. */
export async function previewBookingAction(input: unknown): Promise<BookingPreviewActionResult> {
  try {
    const client = await createSupabaseServerClient(); const context = await resolveTenantContext({ client });
    if (!context.ok) return failure(context.code);
    if (!resolveCapability({ roles: context.data.roles ?? [context.data.role], module: "resources", capability: "Bookings.Manage" }).granted) return failure("PERMISSION_DENIED");
    const update = isUpdate(input);
    const validated = update ? validateUpdateBooking(input) : validateCreateBooking(input);
    if (!validated.ok) return failure(validated.code);
    const candidate = validated.data;
    const bookingId = "bookingId" in candidate && typeof candidate.bookingId === "string" ? candidate.bookingId : undefined;
    if (update && !bookingId) return failure("VALIDATION_FAILED");
    // Preview cannot mint a new create identity each time the draft changes.
    if (!update && !candidate.proposedBookingId) return failure("VALIDATION_FAILED");
    if (update) {
      const { data, error } = await client.from("bookings").select("id").eq("tenant_id", context.data.tenantId)
        .eq("id", bookingId!).maybeSingle();
      if (error) return failure("SERVER_ERROR");
      if (!data) return failure("TENANT_ACCESS_DENIED");
    }
    await validateBookingCandidateReferences(client, context.data.tenantId, candidate);
    const preview = await previewBookingEditor(client as unknown as BookingRpcClient, {
      p_tenant_id: context.data.tenantId, p_actor_id: context.data.userId, p_correlation_id: randomUUID(),
      p_command_id: candidate.commandId, p_payload: bookingPayload(candidate),
      ...(update ? { p_booking_id: bookingId! } : { p_proposed_id: candidate.proposedBookingId! }),
    });
    const people = await readBookingPeople(client, context.data.tenantId, context.data.userId);
    // Explicit DTO projection excludes any future internal proof/fact fields.
    return { status: "success", preview: { receipt: preview.receipt, bookingId: preview.bookingId,
      warnings: preview.warnings.map((warning) => ({ logicalId: warning.logicalId, ruleLabel: warning.ruleLabel,
        personId: warning.personId, personLabel: bookingPersonLabel(warning.personId, people.find(person => person.id === warning.personId)?.label),
        bookingIds: warning.bookingIds, bookingLabels: warning.bookingIds.map((id) => id === preview.bookingId ? "Den här bokningen" : `Bokning ${id}`),
        startsAt: warning.startsAt, endsAt: warning.endsAt })),
      availability: preview.availability.map(({ personId, available }) => ({ personId, available })) } };
  } catch (error) { return failure(errorCode(error)); }
}

/** Save returns success only after the checked atomic command confirms persistence. */
export async function saveBookingAction(input: unknown): Promise<BookingSaveActionResult> {
  try {
    if (!bookingActionFitsTransport(input)) return failure("VALIDATION_FAILED");
    const client = await createSupabaseServerClient(); const update = isUpdate(input);
    const validated = update ? validateUpdateBooking(input) : validateCreateBooking(input);
    if (!validated.ok) return failure(validated.code);
    const result = update
      ? await runCommand(updateBooking, { client: client as unknown as CommandDbClient, input })
      : await runCommand(createBooking, { client: client as unknown as CommandDbClient, input });
    if (!result.ok) return failure(result.code);
    revalidatePath("/jobs");
    // An update may clear/move connections; invalidate both former and new hosts.
    if (update) {
      revalidatePath("/jobs/[jobId]", "page");
      revalidatePath("/customers/[customerId]", "page");
    }
    if (validated.data.jobId) revalidatePath(`/jobs/${validated.data.jobId}`);
    if (validated.data.customerId) revalidatePath(`/customers/${validated.data.customerId}`);
    return { status: "success", bookingId: result.data.bookingId, message: "Bokningen har sparats." };
  } catch (error) { return failure(errorCode(error)); }
}

/** Refresh only current authorized, sanitized options; no draft or write authority is supplied. */
export async function reloadBookingEditorOptionsAction() { return readBookingEditorOptions(); }
