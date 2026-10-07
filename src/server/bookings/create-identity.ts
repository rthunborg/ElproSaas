import { createHash } from "node:crypto";

/** Stable custom UUID for internal callers without an explicit editor create ID.
 * Command keys are tenant scoped; booking primary keys are globally unique. */
export function proposedBookingIdentity(tenantId: string, commandId: string): string {
  const hex = createHash("sha256").update(JSON.stringify(["elpro.booking-create-id.v1", tenantId.toLowerCase(), commandId.toLowerCase()])).digest("hex").slice(0, 32).split("");
  hex[12] = "8"; hex[16] = ((parseInt(hex[16]!, 16) & 3) | 8).toString(16);
  const value = hex.join("");
  return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;
}
