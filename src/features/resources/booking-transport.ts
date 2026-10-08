/** Plain JSON Server Action input; leave framework framing headroom below Next's 4 MiB limit. */
export const BOOKING_ACTION_INPUT_LIMIT_BYTES = 3 * 1024 * 1024;
export function bookingActionFitsTransport(input: unknown): boolean {
  try { return new TextEncoder().encode(JSON.stringify([input])).byteLength <= BOOKING_ACTION_INPUT_LIMIT_BYTES; }
  catch { return false; }
}
