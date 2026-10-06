import type { BookingFacts, BookingResult } from "@/features/resources/booking-types";
import type { CommandDbClient } from "../envelope";
import { CommandError } from "../command-errors";
import { saveWithConflicts } from "@/server/bookings/save-with-conflicts";
import type { BookingRpcClient } from "@/server/bookings/conflict-facts";

type BookingRpcArgs = {
  readonly p_tenant_id: string;
  readonly p_actor_id: string;
  readonly p_correlation_id: string;
  readonly p_command_id: string;
  readonly p_payload: BookingFacts;
  readonly p_booking_id?: string;
};
export async function executeBooking(db: CommandDbClient, operation: "create_booking" | "update_booking", args: BookingRpcArgs): Promise<BookingResult> {
  void operation;
  try {
    return await saveWithConflicts(db as unknown as BookingRpcClient, args);
  } catch (error) {
    if (error instanceof CommandError) throw error;
    const code = (error as { code?: string } | null)?.code;
    if (code === "BK409") throw new CommandError("COMMAND_CONFLICT");
    if (code === "42501" || code === "23503") throw new CommandError("TENANT_ACCESS_DENIED");
    if (["23514", "22P02", "22007", "22008"].includes(code ?? "")) throw new CommandError("VALIDATION_FAILED");
    throw new Error("booking write failed");
  }
}
