import type { BookingFacts } from "./booking-types";
import type { CommandErrorCode } from "@/server/commands/command-errors";

/** Browser DTOs contain display fields only, never detector facts or private proofs. */
export type BookingOption = { readonly id: string; readonly label: string };
export type BookingPersonOption = BookingOption & {
  readonly defaultWorkRoleId: string | null;
  readonly workRoleIds: readonly string[];
};
export type BookingEditorOptions = {
  readonly canManage: boolean;
  readonly people: readonly BookingPersonOption[];
  readonly workRoles: readonly BookingOption[];
  readonly jobs: readonly (BookingOption & { readonly customerId: string; readonly facilityId: string | null; readonly contactId: string | null })[];
  readonly customers: readonly BookingOption[];
  readonly facilities: readonly (BookingOption & { readonly customerId: string })[];
  readonly contacts: readonly (BookingOption & { readonly customerId: string; readonly facilityId: string | null })[];
  readonly error: string | null;
};
export type BookingSummary = BookingFacts & { readonly id: string; readonly openConflictCount: number };
export type BookingHostReadResult = {
  readonly canView: boolean;
  readonly canManage: boolean;
  readonly bookings: readonly BookingSummary[];
  readonly openConflictCount: number;
  readonly error: string | null;
};
export type BookingEditorWarning = {
  readonly logicalId: string;
  readonly ruleLabel: string;
  readonly personId: string;
  readonly personLabel: string;
  readonly bookingIds: readonly string[];
  readonly bookingLabels: readonly string[];
  readonly startsAt: string;
  readonly endsAt: string;
};
export type BookingEditorPreview = {
  readonly receipt: string;
  readonly bookingId: string;
  readonly warnings: readonly BookingEditorWarning[];
  readonly availability: readonly { readonly personId: string; readonly available: boolean }[];
};
export type BookingActionError = { readonly status: "error"; readonly code: CommandErrorCode; readonly message: string };
export type BookingPreviewActionResult = { readonly status: "success"; readonly preview: BookingEditorPreview } | BookingActionError;
export type BookingSaveActionResult = { readonly status: "success"; readonly bookingId: string; readonly message: string } | BookingActionError;
