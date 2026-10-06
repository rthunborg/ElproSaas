// SERVER-ONLY. Checked cookie-bound RPC facts; no privileged application client.
import { createHash } from "node:crypto";
import { buildScheduleReadShifts } from "@/features/resources/schedule-read";
import type { BookingFacts } from "@/features/resources/booking-types";
import { detectConflicts } from "@/features/scheduling/conflicts";
import { DEFAULT_SCHEDULING_RULES, SCHEDULING_RULES_VERSION,
  type SchedulingBooking, type SchedulingFacts, type SchedulingRules } from "@/features/scheduling/types";
import { BOOKING_CONFLICT_ENGINE_VERSION, CONFLICT_CLAIM_FIELDS, type ConflictClaims } from "./conflict-attestation";
import { CommandError } from "@/server/commands/command-errors";

export type BookingRpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{
  readonly data: unknown; readonly error: { readonly code?: string } | null;
}> };
export type BookingRpcArgs = { readonly p_tenant_id: string; readonly p_actor_id: string;
  readonly p_correlation_id: string; readonly p_command_id: string; readonly p_booking_id?: string;
  readonly p_payload: BookingFacts };
type FactBundle = {
  readonly bookings: readonly SchedulingBooking[];
  readonly profiles: readonly { readonly id: string; readonly membershipId: string; readonly defaultWorkRoleId: string | null;
    readonly employmentPercentage: number | null; readonly archivedAt: string | null }[];
  readonly hours: readonly { readonly id: string; readonly personProfileId: string | null; readonly entryKind: string;
    readonly weekday: number | null; readonly localDate: string | null; readonly exceptionKind: string | null;
    readonly startsAt: string | null; readonly endsAt: string | null }[];
  readonly calendarDays: readonly { readonly date: string; readonly variant: string; readonly reductionPercent: number | null }[];
  readonly memberships: readonly { readonly id: string; readonly userId: string | null; readonly status: string; readonly role: string; readonly roles: readonly string[] }[];
  readonly workRoles: readonly { readonly id: string; readonly isActive: boolean }[];
  readonly jobInputs: null; readonly rules: SchedulingRules;
};
export type DetectionSnapshot = ConflictClaims & { readonly kind: "snapshot"; readonly candidate: BookingFacts;
  readonly canonicalFacts: string; readonly facts: FactBundle };
export type DerivedConflict = { readonly booking_id: string; readonly related_booking_id: string | null;
  readonly affected_person_profile_id: string; readonly conflict_type: string; readonly starts_at: string;
  readonly ends_at: string; readonly natural_key: string };
export type SnapshotResult = DetectionSnapshot | { readonly kind: "replay"; readonly result: { readonly bookingId: string } };

export function conflictClaims(snapshot: ConflictClaims): ConflictClaims {
  return Object.fromEntries(CONFLICT_CLAIM_FIELDS.map((field) => [field, snapshot[field]])) as ConflictClaims;
}
export function parseDetectionSnapshot(data: unknown): SnapshotResult {
  if (!data || typeof data !== "object") throw new Error("booking snapshot invalid");
  const row = data as Record<string, unknown>;
  if (row.kind === "replay" && row.result && typeof row.result === "object" &&
    typeof (row.result as { bookingId?: unknown }).bookingId === "string" && Object.keys(row.result).length === 1) return row as SnapshotResult;
  if (row.kind !== "snapshot" || CONFLICT_CLAIM_FIELDS.some((field) => typeof row[field] !== "string") ||
    typeof row.canonicalFacts !== "string" || !row.candidate || typeof row.candidate !== "object" ||
    row.engineVersion !== BOOKING_CONFLICT_ENGINE_VERSION || row.configVersion !== SCHEDULING_RULES_VERSION ||
    createHash("sha256").update(row.canonicalFacts).digest("hex") !== row.factDigest) throw new Error("booking snapshot invalid");
  const facts = JSON.parse(row.canonicalFacts) as FactBundle;
  if ([facts.bookings, facts.profiles, facts.hours, facts.calendarDays, facts.memberships, facts.workRoles].some((set) => !Array.isArray(set)) ||
    facts.jobInputs !== null || !facts.rules ||
    facts.rules.version !== DEFAULT_SCHEDULING_RULES.version || facts.rules.timeZone !== DEFAULT_SCHEDULING_RULES.timeZone ||
    facts.rules.planningBufferMinutes !== DEFAULT_SCHEDULING_RULES.planningBufferMinutes ||
    facts.rules.acknowledgmentThresholdMinutes !== DEFAULT_SCHEDULING_RULES.acknowledgmentThresholdMinutes ||
    !Array.isArray(facts.rules.authorizedOvertime) || facts.rules.authorizedOvertime.length !== 0) throw new Error("booking facts invalid");
  const snapshot = { ...row, facts } as DetectionSnapshot;
  return freezeFacts(snapshot);
}
function freezeFacts<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freezeFacts); Object.freeze(value); }
  return value;
}
export async function snapshotBookingConflicts(client: BookingRpcClient, args: BookingRpcArgs, keyId: string): Promise<SnapshotResult> {
  const { data, error } = await client.rpc("snapshot_booking_conflicts", { ...args, p_booking_id: args.p_booking_id ?? null, p_key_id: keyId });
  if (error) throw error;
  return parseDetectionSnapshot(data);
}

/** Internal frozen-fact preview seam for 14.4. No route/action/browser entry point. */
export function previewBookingConflicts(snapshot: DetectionSnapshot): DerivedConflict[] {
  const facts = snapshot.facts;
  // A caller-supplied assignee outside the checked tenant is an authorization
  // failure, not malformed schedule data. SQL also enforces every FK at commit.
  if (snapshot.candidate.assigneeIds.some((id) => !facts.profiles.some((profile) => profile.id === id)))
    throw new CommandError("TENANT_ACCESS_DENIED");
  const people = facts.profiles.map((profile) => {
    const hours = facts.hours.filter((row) => row.personProfileId === profile.id);
    const member = facts.memberships.find((row) => row.id === profile.membershipId);
    if (!member) throw new Error("booking membership facts invalid");
    if (hours.some((row) => row.entryKind !== "exception" &&
      (row.weekday === null || row.startsAt === null || row.endsAt === null))) throw new Error("booking weekly facts invalid");
    // Inactive history keeps its actual schedules. New assignment validation is SQL-owned.
    return { id: profile.id, employmentPercentage: profile.employmentPercentage ?? 100,
      shifts: buildScheduleReadShifts(hours.map((row) => ({ entry_kind: row.entryKind, weekday: row.weekday,
        starts_at: row.startsAt, ends_at: row.endsAt }))),
      exceptions: hours.filter((row) => row.entryKind === "exception").map((row) => {
        if (!row.localDate || !row.exceptionKind) throw new Error("booking exception facts invalid");
        return { kind: row.exceptionKind, date: row.localDate, ...(row.startsAt !== null && row.endsAt !== null ? { start: row.startsAt, end: row.endsAt } : {}) };
      }),
      workRoleIds: profile.defaultWorkRoleId && facts.workRoles.some((row) => row.id === profile.defaultWorkRoleId && row.isActive) ? [profile.defaultWorkRoleId] : [],
    };
  });
  const proposed: SchedulingBooking = { id: snapshot.bookingId, startsAt: snapshot.candidate.startsAt,
    endsAt: snapshot.candidate.endsAt, allDay: snapshot.candidate.allDay, status: snapshot.candidate.status,
    assigneeIds: snapshot.candidate.assigneeIds };
  const bookings = [...facts.bookings.filter((row) => row.id !== proposed.id), proposed];
  const common = { people, calendarDays: facts.calendarDays.map((row) => ({ date: row.date, variant: row.variant,
    ...(row.reductionPercent !== null ? { reductionPercent: row.reductionPercent } : {}) })), jobInputs: null, rules: facts.rules };
  const unique = new Map<string, DerivedConflict>();
  for (const candidate of bookings) {
    const input: SchedulingFacts = { ...common, candidate, existingBookings: bookings.filter((row) => row.id !== candidate.id) };
    for (const conflict of detectConflicts(input)) {
      for (const personId of conflict.affectedPersonIds) {
        // The engine's collision identity encodes every participant. Hashing keeps
        // complete aggregate identities within the existing DB column constraint.
        const naturalKey = `v1:${createHash("sha256").update(JSON.stringify([conflict.naturalKey, personId])).digest("hex")}`;
        const row: DerivedConflict = { booking_id: conflict.bookingIds[0]!, related_booking_id: conflict.bookingIds[1] ?? null,
          affected_person_profile_id: personId, conflict_type: conflict.conflictType,
          starts_at: conflict.startsAt, ends_at: conflict.endsAt, natural_key: naturalKey };
        unique.set(naturalKey, row);
        // Preserve the established first-pair row/key, then expose every remaining
        // aggregate participant through an existing-schema association row. Each
        // key still binds the complete participant set, person, type and window.
        for (const bookingId of conflict.bookingIds.slice(2)) {
          const participantKey = `v2:${createHash("sha256").update(JSON.stringify([conflict.naturalKey, personId, bookingId])).digest("hex")}`;
          unique.set(participantKey, { ...row, booking_id: bookingId,
            related_booking_id: conflict.bookingIds[0]!, natural_key: participantKey });
        }
      }
    }
  }
  return [...unique.values()].sort((left, right) => left.natural_key < right.natural_key ? -1 : left.natural_key > right.natural_key ? 1 : 0);
}
