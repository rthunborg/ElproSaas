import type { BookingResult, CreateBookingInput } from "@/features/resources/booking-types";
import { defineCommand } from "../envelope";
import { executeBooking } from "./booking-db";
import { bookingPayload, validateCreateBooking } from "./validation";

/** Internal authoritative save; the editor entry point belongs to Story 14.4. */
export const createBooking = defineCommand<CreateBookingInput, BookingResult>({
  command: "createBooking", auditable: false, eventType: "booking_created", targetType: "booking",
  validateInput: validateCreateBooking,
  execute: (ctx) => executeBooking(ctx.db, "create_booking", {
    p_tenant_id: ctx.tenantContext.tenantId, p_actor_id: ctx.tenantContext.userId,
    p_correlation_id: ctx.correlationId, p_command_id: ctx.input.commandId, p_payload: bookingPayload(ctx.input),
  }),
});
