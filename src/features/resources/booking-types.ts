/** Public booking projection excludes durable command identity and outcome history. */
export const BOOKING_PUBLIC_COLUMNS = "id,tenant_id,starts_at,ends_at,all_day,work_role_id,job_id,customer_id,facility_id,contact_id,description,status,series_id,occurrence_index,is_exception,created_at,updated_at";
export type BookingStatus = "planned" | "cancelled";
export type BookingFacts = {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly allDay: boolean;
  readonly workRoleId: string | null;
  readonly jobId: string | null;
  readonly customerId: string | null;
  readonly facilityId: string | null;
  readonly contactId: string | null;
  readonly description: string;
  readonly status: BookingStatus;
  readonly assigneeIds: readonly string[];
  readonly seriesId: null;
  readonly occurrenceIndex: null;
  readonly isException: false;
};
export type CreateBookingInput = BookingFacts & { readonly commandId: string };
export type UpdateBookingInput = CreateBookingInput & { readonly bookingId: string };
export type BookingResult = { readonly bookingId: string };
