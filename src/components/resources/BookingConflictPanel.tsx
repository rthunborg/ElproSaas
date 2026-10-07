"use client";

export type BookingWarning = {
  readonly logicalId: string; readonly ruleLabel: string; readonly personLabel: string;
  readonly startsAt: string; readonly endsAt: string;
  readonly bookingLabels?: readonly string[];
  readonly windowLabel?: string; readonly collisionLabel?: string;
};
export type BookingPreviewDisplay = {
  readonly requestId: string; readonly status: "pending" | "ready" | "error";
  readonly warnings: readonly BookingWarning[]; readonly availabilityLabel: string;
  readonly errorMessage?: string;
};
export type BookingPreviewState = { readonly currentRequestId: string; readonly preview: BookingPreviewDisplay; readonly reviewed: boolean };
export function advanceBookingPreview(state: BookingPreviewState, event: {kind: "candidateChanged"; requestId: string} | {kind: "response"; requestId: string; preview: BookingPreviewDisplay}): BookingPreviewState {
  if (event.kind === "candidateChanged") return {currentRequestId: event.requestId, reviewed: false, preview: {requestId: event.requestId, status: "pending", warnings: [], availabilityLabel: "Okänd"}};
  return event.requestId === state.currentRequestId ? {...state, preview: event.preview, reviewed: false} : state;
}
export function BookingConflictPanel({ preview, onRetry, selected = [], onSelect }: {
  readonly preview: BookingPreviewDisplay; readonly onRetry?: () => void;
  readonly selected?: readonly string[]; readonly onSelect?: (id: string, checked: boolean) => void;
}) {
  return <section data-testid="booking-conflict-panel" aria-label="Konfliktkontroll" aria-live="polite" className="space-y-3 rounded-lg border border-zinc-200 p-4">
    <h3 className="font-semibold text-zinc-900">Konfliktkontroll</h3>
    {preview.status === "pending" ? <p role="status">Kontrollerar… Tillgänglighet: Okänd</p> : preview.status === "error" ? <div role="alert" data-testid="booking-preview-error"><p>{preview.errorMessage}</p><p data-testid="booking-preview-unknown">Tillgänglighet: Okänd</p><button type="button" onClick={onRetry} className="min-h-11 rounded-md border border-zinc-300 px-3">Försök igen</button></div> : <>
      <p data-testid="booking-availability">{preview.availabilityLabel}</p>
      {preview.warnings.length === 0 ? <p data-testid="booking-conflict-free">Inga konflikter</p> : preview.warnings.map((warning) => <article key={warning.logicalId} className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        <p className="font-semibold">{warning.ruleLabel} · {warning.personLabel}</p>
        <p>{warning.windowLabel ?? `${formatBookingTime(warning.startsAt)} – ${formatBookingTime(warning.endsAt)}`}</p>
        <p>{warning.collisionLabel ?? warning.bookingLabels?.join(" · ")}</p>
        <div data-testid="booking-conflict-timeline" role="img" aria-label={`${warning.ruleLabel}: ${warning.personLabel}, ${formatBookingTime(warning.startsAt)} till ${formatBookingTime(warning.endsAt)}`} className="border-l-4 border-amber-600 pl-3"><time dateTime={warning.startsAt}>{formatBookingTime(warning.startsAt)}</time><span aria-hidden="true"> → </span><time dateTime={warning.endsAt}>{formatBookingTime(warning.endsAt)}</time></div>
        {onSelect && <label className="flex min-h-11 items-center gap-2"><input type="checkbox" data-testid={`booking-select-logical-${warning.logicalId}`} checked={selected.includes(warning.logicalId)} onChange={(e) => onSelect(warning.logicalId, e.target.checked)} />Acceptera denna konflikt</label>}
      </article>)}
    </>}
  </section>;
}
export function formatBookingTime(value: string): string {
  return new Intl.DateTimeFormat("sv-SE", {timeZone: "Europe/Stockholm", dateStyle: "short", timeStyle: "short"}).format(new Date(value));
}
