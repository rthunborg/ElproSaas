/**
 * Story 14.4 RED: test-owned adapters, not a proposed product export API.
 * GREEN: replace each required binding with a thin call to the real component,
 * parser or preview state transition. Never implement UI, normalization, race
 * handling or detector behavior here. Signature translation alone belongs here.
 * No DB/network state is created; deterministic factories return fresh values.
 */
import type { ReactElement } from "react";
import type { BookingFacts } from "@/features/resources/booking-types";

export const PERSON = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const PERSON_2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const CANDIDATE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const PEER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const GROUP_A = JSON.stringify(["double_booking", [CANDIDATE, PEER], [PERSON], "2026-10-12T07:00:00.000000Z", "2026-10-12T08:00:00.000000Z"]);
export const GROUP_B = JSON.stringify(["outside_work_hours", [CANDIDATE], [PERSON], "2026-10-12T06:00:00.000000Z", "2026-10-12T07:00:00.000000Z"]);

export function booking(overrides: Partial<BookingFacts> = {}): BookingFacts {
  return { startsAt: "2026-10-12T06:00:00.123456Z", endsAt: "2026-10-12T14:00:00.654321Z",
    allDay: false, workRoleId: null, jobId: null, customerId: null, facilityId: null,
    contactId: null, description: "Elcentral västra flygeln", status: "planned",
    assigneeIds: [PERSON], seriesId: null, occurrenceIndex: null, isException: false, ...overrides };
}
export type Warning = { logicalId: string; ruleLabel: string; personLabel: string;
  startsAt: string; endsAt: string; windowLabel: string; collisionLabel: string };
export function warning(overrides: Partial<Warning> = {}): Warning {
  return { logicalId: GROUP_A, ruleLabel: "Dubbelbokning", personLabel: "Elin Test",
    startsAt: "2026-10-12T07:00:00.000000Z", endsAt: "2026-10-12T08:00:00.000000Z",
    windowLabel: "12 oktober 2026, 09:00–10:00", collisionLabel: "Bokning i norra flygeln", ...overrides };
}
export type Preview = { requestId: string; status: "pending" | "ready" | "error";
  warnings: readonly Warning[]; availabilityLabel: string; errorMessage?: string };
export type EditorRequest = { draft: BookingFacts; preview: Preview;
  prefill?: { personId: string; startsAt: string; endsAt: string } };
export function editor(overrides: Partial<EditorRequest> = {}): EditorRequest {
  return { draft: booking(), preview: { requestId: "current", status: "ready",
    warnings: [], availabilityLabel: "Tillgänglig" }, ...overrides };
}
export type Decision = { acknowledged: boolean; reviewedLogicalIds: readonly string[];
  selectedLogicalIds: readonly string[]; reason: string };
export function decision(overrides: Partial<Decision> = {}): Decision {
  return { acknowledged: true, reviewedLogicalIds: [GROUP_A, GROUP_B],
    selectedLogicalIds: [GROUP_A], reason: "Kunden godkänner samordning", ...overrides };
}
export type Result<T> = { ok: true; data: T } | { ok: false; code: "VALIDATION_FAILED" };
export type TimesRequest = { original: Pick<BookingFacts, "startsAt" | "endsAt">;
  timeChanged: boolean; allDay: boolean; startsAtLocal: string; endsAtLocal: string };
export type PreviewState = { currentRequestId: string; preview: Preview; reviewed: boolean };
export type PreviewEvent =
  | { kind: "candidateChanged"; requestId: string }
  | { kind: "response"; requestId: string; preview: Preview };
export type Bindings = {
  Editor: (request: EditorRequest) => ReactElement;
  Panel: (preview: Preview) => ReactElement;
  normalizeDecision: (raw: unknown) => Result<Decision>;
  prepareTimes: (request: TimesRequest) => Pick<BookingFacts, "startsAt" | "endsAt">;
  advancePreview: (state: PreviewState, event: PreviewEvent) => PreviewState;
};
// Deliberately unbound. Remove skips task-by-task, confirm this failure, then map
// to actual production imports. The adapter is never a mocked implementation.
const production: Partial<Bindings> = {};
export function binding<K extends keyof Bindings>(name: K): Bindings[K] {
  const actual = production[name];
  if (!actual) throw new Error(`14.4 RED: missing actual production binding: ${name}`);
  return actual;
}
export function controlNames(html: string): string[] {
  return [...html.matchAll(/<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"/g)].map((match) => match[1]!);
}
