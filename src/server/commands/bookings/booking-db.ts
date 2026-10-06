import type { BookingFacts, BookingResult } from "@/features/resources/booking-types";
import type { CommandDbClient } from "../envelope";
import { CommandError } from "../command-errors";

type BookingRpcArgs = {
  readonly p_tenant_id: string;
  readonly p_actor_id: string;
  readonly p_correlation_id: string;
  readonly p_command_id: string;
  readonly p_payload: BookingFacts;
  readonly p_booking_id?: string;
};
type BookingRpcClient = {
  rpc(name: "create_booking" | "update_booking", args: BookingRpcArgs): Promise<{
    readonly data: unknown;
    readonly error: { readonly code?: string } | null;
  }>;
};
export async function executeBooking(db: CommandDbClient, operation: "create_booking" | "update_booking", args: BookingRpcArgs): Promise<BookingResult> {
  const { data, error } = await (db as unknown as BookingRpcClient).rpc(operation, args);
  if (error) {
    if (error.code === "BK409") throw new CommandError("COMMAND_CONFLICT");
    if (error.code === "42501" || error.code === "23503") throw new CommandError("TENANT_ACCESS_DENIED");
    if (["23514", "22P02", "22007", "22008"].includes(error.code ?? "")) throw new CommandError("VALIDATION_FAILED");
    throw new Error("booking write failed");
  }
  if (!data || typeof data !== "object" || typeof (data as { bookingId?: unknown }).bookingId !== "string" || Object.keys(data).length !== 1) throw new Error("booking result invalid");
  return data as BookingResult;
}
