"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingFacts } from "@/features/resources/booking-types";
import type { BookingEditorOptions, BookingSummary } from "@/features/resources/booking-action-state";
import { BookingEditor, type BookingPrefill } from "./BookingEditor";
import { BookingConflictChip } from "./BookingConflictChip";
import { formatBookingTime } from "./BookingConflictPanel";

export type BookingEntryProps = {
  readonly options: BookingEditorOptions; readonly canManage: boolean; readonly canView: boolean;
  readonly bookings: readonly BookingSummary[]; readonly openConflictCount: number; readonly error: string | null;
  readonly jobId?: string; readonly customerId?: string; readonly facilityId?: string; readonly contactId?: string;
  readonly prefill?: BookingPrefill; readonly host?: "toolbar" | "job" | "customer";
};
function newDraft(props: BookingEntryProps): BookingFacts {
  const start = new Date(); start.setMinutes(0,0,0); const end = new Date(start.getTime()+3600000);
  return {startsAt: props.prefill?.startsAt ?? start.toISOString(), endsAt: props.prefill?.endsAt ?? end.toISOString(), allDay: false,
    workRoleId: null, jobId: props.jobId ?? null, customerId: props.customerId ?? null, facilityId: props.facilityId ?? null, contactId: props.contactId ?? null,
    description: "", status: "planned", assigneeIds: props.prefill?.personId ? [props.prefill.personId] : [], seriesId: null, occurrenceIndex: null,isException: false};
}
/** Reopen only the approved editable fields; summary metadata is never command input. */
export function bookingSummaryDraft(booking: BookingSummary): BookingFacts {
  const {startsAt,endsAt,allDay,workRoleId,jobId,customerId,facilityId,contactId,description,status,assigneeIds} = booking;
  return {startsAt,endsAt,allDay,workRoleId,jobId,customerId,facilityId,contactId,description,status,assigneeIds,
    seriesId: null,occurrenceIndex: null,isException: false};
}
export function BookingEntry(props: BookingEntryProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<{draft: BookingFacts; bookingId?: string} | null>(null);
  if (!props.canView && !props.canManage && !props.error) return null;
  return <section aria-label="Bokningar" className="space-y-3">
    <div className="flex flex-wrap items-center gap-3">
      {props.canManage && !props.error && <button type="button" data-testid={`booking-entry-${props.host ?? "toolbar"}`} onClick={() => setEditing({draft: newDraft(props)})} className="min-h-11 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{props.host === "job" ? "Boka" : "Ny bokning"}</button>}
      {props.canView && !props.error && <BookingConflictChip count={props.openConflictCount} />}
    </div>
    {props.error && <p role="alert" className="text-sm text-red-800">{props.error} <button type="button" className="min-h-11 px-3 underline" onClick={() => router.refresh()}>Försök igen</button></p>}
    {props.canView && !props.error && <ul className="space-y-2">{props.bookings.map(booking => <li key={booking.id} data-testid={`booking-summary-${booking.id}`} className="space-y-2 rounded-md border border-zinc-200 p-3 text-sm"><p className="font-medium">{booking.description || "Bokning"}</p><p>{formatBookingTime(booking.startsAt)} – {formatBookingTime(booking.endsAt)} · {booking.status === "planned" ? "Planerad" : "Avbruten"}</p><BookingConflictChip count={booking.openConflictCount} />{props.canManage && !props.error && <button type="button" data-testid="booking-edit" className="min-h-11 px-3 text-blue-700 underline focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => setEditing({bookingId: booking.id,draft: bookingSummaryDraft(booking)})}>Redigera bokning</button>}</li>)}</ul>}
    {editing && <BookingEditor open onClose={() => {setEditing(null); router.refresh();}} draft={editing.draft} bookingId={editing.bookingId} options={props.options} prefill={editing.bookingId ? undefined : props.prefill} />}
  </section>;
}
