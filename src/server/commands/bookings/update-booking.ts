import type { BookingResult, UpdateBookingInput } from "@/features/resources/booking-types";
import { defineCommand } from "../envelope";
import { executeBooking } from "./booking-db";
import { bookingPayload, validateUpdateBooking } from "./validation";

export const updateBooking = defineCommand<UpdateBookingInput, BookingResult>({
  command: "updateBooking", auditable: false, eventType: "booking_updated", targetType: "booking",
  validateInput: validateUpdateBooking,
  ownership: (input) => ({ table: "bookings", id: input.bookingId }),
  execute: (ctx) => executeBooking(ctx.db, "update_booking", {
    p_tenant_id: ctx.tenantContext.tenantId, p_actor_id: ctx.tenantContext.userId,
    p_correlation_id: ctx.correlationId, p_command_id: ctx.input.commandId,
    p_booking_id: ctx.input.bookingId, p_payload: bookingPayload(ctx.input),
  }),
});
