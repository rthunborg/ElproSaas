import type { BookingFacts } from "./booking-types";
import { stockholmLocalToUtc } from "@/features/scheduling/time-zone";

/** Human business decision only; receipt/signature are separate transport. */
export type BookingDecision = { readonly acknowledged: boolean; readonly reviewedLogicalIds: readonly string[];
  readonly selectedLogicalIds: readonly string[]; readonly reason: string };
export type BookingEditorReview = { readonly receipt: string; readonly decision: BookingDecision };
export function normalizeBookingDecision(raw: unknown): { ok: true; data: BookingDecision } | { ok: false; code: "VALIDATION_FAILED" } {
  const invalid = { ok: false, code: "VALIDATION_FAILED" } as const;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid;
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).length !== 4 || Object.keys(value).some((key) => !["acknowledged", "reviewedLogicalIds", "selectedLogicalIds", "reason"].includes(key)) ||
    typeof value.acknowledged !== "boolean" || typeof value.reason !== "string" || value.reason.length > 2000) return invalid;
  const lists = [value.reviewedLogicalIds, value.selectedLogicalIds];
  if (lists.some((list) => !Array.isArray(list) || list.some((id) => typeof id !== "string" || id.length === 0) || new Set(list).size !== list.length)) return invalid;
  const reviewed = [...value.reviewedLogicalIds as string[]].sort();
  const selected = [...value.selectedLogicalIds as string[]].sort();
  const reason = value.reason.trim();
  if (selected.some((id) => !reviewed.includes(id)) || (reviewed.length > 0 && value.acknowledged && !reason) ||
    (reviewed.length === 0 && (value.acknowledged || selected.length > 0 || reason !== ""))) return invalid;
  return { ok: true, data: { acknowledged: value.acknowledged, reviewedLogicalIds: reviewed, selectedLogicalIds: selected, reason } };
}
export const EMPTY_BOOKING_DECISION: BookingDecision = Object.freeze({ acknowledged: false, reviewedLogicalIds: [], selectedLogicalIds: [], reason: "" });
/** A denied retry cannot resolve a previously unknown committed outcome. */
export function retainUnresolvedBookingAttempt(code: string, wasUnresolved: boolean): boolean {
  return code === "SERVER_ERROR" || (wasUnresolved && ["UNAUTHENTICATED", "TENANT_MEMBERSHIP_REQUIRED", "PERMISSION_DENIED", "TENANT_ACCESS_DENIED"].includes(code));
}
export function prepareBookingTimes(input: { original: Pick<BookingFacts, "startsAt" | "endsAt">;
  startChanged: boolean; endChanged: boolean; allDay: boolean; startsAtLocal: string; endsAtLocal: string }): Pick<BookingFacts, "startsAt" | "endsAt"> {
  const local = (value: string) => input.allDay ? `${value.slice(0, 10)}T00:00:00` : value.length === 16 ? `${value}:00` : value;
  return { startsAt: input.startChanged ? stockholmLocalToUtc(local(input.startsAtLocal)) : input.original.startsAt,
    endsAt: input.endChanged ? stockholmLocalToUtc(local(input.endsAtLocal)) : input.original.endsAt };
}
