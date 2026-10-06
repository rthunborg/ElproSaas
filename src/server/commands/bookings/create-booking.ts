import type { BookingResult, CreateBookingInput } from "@/features/resources/booking-types";
import { defineCommand } from "../envelope";
import { executeBooking } from "./booking-db";
import { bookingPayload, validateCreateBooking } from "./validation";

/** Internal foundation only; Story 14.3 detection integration gates any UI caller. */
export const createBooking = defineCommand<CreateBookingInput, BookingResult>({
  command: "createBooking", auditable: false, eventType: "booking_created", targetType: "booking",
  validateInput: validateCreateBooking,
  execute: (ctx) => executeBooking(ctx.db, "create_booking", {
    p_tenant_id: ctx.tenantContext.tenantId, p_actor_id: ctx.tenantContext.userId,
    p_correlation_id: ctx.correlationId, p_command_id: ctx.input.commandId, p_payload: bookingPayload(ctx.input),
  }),
});
